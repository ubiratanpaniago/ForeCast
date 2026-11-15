"""Análise de tendências das variáveis hidrológicas do Sul do Brasil (2001–2024).

Lê os recortes mensais de IMERG e GLDAS em data/raw, calcula:
  * séries regionais (PR, SC, RS e Sul) com climatologia, anomalias e totais anuais;
  * testes de tendência: Mann-Kendall modificado (Hamed-Rao) nas anomalias mensais,
    Mann-Kendall sazonal, Theil-Sen com IC 95 %, regressão linear anual (teste t + IC 95 %);
  * mapas de tendência por pixel com correção de testes múltiplos (FDR Benjamini-Hochberg).

Saída em data/historical/:
  catalog.json                         variáveis, regiões, métodos
  series/<REGIAO>/<variavel>.json      série + estatísticas + resumo em português
  maps/<variavel>.json                 grade de tendência por pixel

Uso:  python scripts/analyze_trends.py
"""
from __future__ import annotations

import argparse
import calendar
import json
import re
import time
from dataclasses import dataclass
from pathlib import Path

import netCDF4
import numpy as np
import pymannkendall as mk
import shapely
from scipy import stats

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "historical"
REGIONS_FILE = ROOT / "data" / "regions.geojson"
INTERMEDIATE_FILE = ROOT / "data" / "regions_intermediate.geojson"

ALPHA = 0.05
YEARS = list(range(2001, 2025))


# --------------------------------------------------------------------------------------
# Catálogo de variáveis
# --------------------------------------------------------------------------------------
@dataclass
class Var:
    id: str
    name: str
    unit: str
    dataset: str          # imerg | gldas | derived
    source_var: str | None
    annual: str           # "sum" (fluxo) ou "mean" (estado) ou "max"
    definition: str
    flood_link: str


VARS = [
    Var("precipitation", "Chuva mensal", "mm/mês", "imerg", "precipitation", "sum",
        "Quantidade de chuva que caiu no mês, medida por satélites (missão GPM).",
        "Mais chuva aumenta a água que chega aos rios e ao solo."),
    Var("precipitation_wettest_month", "Chuva do mês mais chuvoso do ano", "mm", "derived", None, "max",
        "Em cada ano, o total de chuva do mês mais chuvoso. Mostra se os meses extremos estão ficando mais extremos.",
        "Enchentes vêm de períodos muito chuvosos, não da média do ano."),
    Var("surface_runoff", "Escoamento superficial", "mm/mês", "gldas", "Qs_acc", "sum",
        "Água da chuva que não infiltra no solo e corre pela superfície até os rios.",
        "É a parcela da chuva que alimenta diretamente as cheias."),
    Var("baseflow", "Escoamento subterrâneo", "mm/mês", "gldas", "Qsb_acc", "sum",
        "Água que infiltra, passa pelo subsolo e chega devagar aos rios.",
        "Mantém os rios altos por mais tempo depois das chuvas."),
    Var("root_zone_soil_moisture", "Umidade do solo (zona das raízes)", "mm", "gldas", "RootMoist_inst", "mean",
        "Quanta água está guardada no solo até a profundidade das raízes, em milímetros de lâmina d'água.",
        "Solo já encharcado não absorve mais chuva, e quase tudo vira escoamento."),
    Var("surface_soil_moisture", "Umidade do solo superficial (0–10 cm)", "mm", "gldas", "SoilMoi0_10cm_inst", "mean",
        "Água guardada nos primeiros 10 cm do solo.",
        "Indica se a superfície está saturada logo antes de uma chuva forte."),
    Var("evapotranspiration", "Evapotranspiração", "mm/mês", "gldas", "Evap_tavg", "sum",
        "Água que volta para a atmosfera pela evaporação do solo e pela transpiração das plantas.",
        "Mais evapotranspiração seca o solo e reduz o excesso de água."),
    Var("air_temperature", "Temperatura do ar", "°C", "gldas", "Tair_f_inst", "mean",
        "Temperatura do ar perto da superfície, em média no mês.",
        "Contexto: ar mais quente comporta mais vapor e pode gerar chuvas mais intensas."),
]
VAR_BY_ID = {v.id: v for v in VARS}

METHODS = {
    "primary": "Mann-Kendall modificado (Hamed-Rao, corrige autocorrelação) aplicado às anomalias mensais; "
               "inclinação de Theil-Sen com IC 95 %.",
    "seasonal_mk": "Mann-Kendall sazonal: compara cada mês só com o mesmo mês de outros anos.",
    "annual_ols": "Regressão linear nos valores anuais, teste t para a inclinação e IC 95 %.",
    "annual_mk": "Mann-Kendall original nos valores anuais, com inclinação de Theil-Sen.",
    "maps": "Por pixel, o mesmo teste principal; os p-valores são corrigidos por FDR (Benjamini-Hochberg, q = 0,05).",
    "alpha": ALPHA,
}


# --------------------------------------------------------------------------------------
# Leitura dos dados brutos
# --------------------------------------------------------------------------------------
def _days(year: int, month: int) -> int:
    return calendar.monthrange(year, month)[1]


def load_imerg() -> tuple[np.ndarray, np.ndarray, np.ndarray, list[tuple[int, int]]]:
    """Retorna precipitação (tempo, lat, lon) em mm/mês."""
    # netCDF4 direto: o xarray levava ~1 s por arquivo decodificando metadados do grupo HDF5
    files = sorted((RAW / "imerg_monthly").rglob("*.nc4"))
    arrays, dates = [], []
    lat = lon = None
    for f in files:
        m = re.search(r"3IMERG\.(\d{4})(\d{2})01", f.name)
        y, mo = int(m.group(1)), int(m.group(2))
        with netCDF4.Dataset(f) as ds:
            g = ds["Grid"]
            if lat is None:
                lat, lon = g["lat"][:].astype(float), g["lon"][:].astype(float)
            v = g["precipitation"][0].filled(np.nan).astype("float64").T   # (lon, lat) -> (lat, lon)
        v[v < 0] = np.nan
        arrays.append(v * 24 * _days(y, mo))
        dates.append((y, mo))
    return np.stack(arrays), lat, lon, dates


def load_gldas(var_ids: list[str]):
    """Retorna {var_id: (tempo, lat, lon)} em unidades amigáveis."""
    files = sorted((RAW / "gldas_monthly").rglob("*.nc4"))
    out = {vid: [] for vid in var_ids}
    dates = []
    lat = lon = None
    for f in files:
        m = re.search(r"\.A(\d{4})(\d{2})\.", f.name)
        y, mo = int(m.group(1)), int(m.group(2))
        nd = _days(y, mo)
        with netCDF4.Dataset(f) as ds:
            if lat is None:
                lat, lon = ds["lat"][:].astype(float), ds["lon"][:].astype(float)
            for vid in var_ids:
                src = VAR_BY_ID[vid].source_var
                a = ds[src][0].filled(np.nan).astype("float64")
                a[a <= -9999] = np.nan
                if src in ("Qs_acc", "Qsb_acc"):      # kg m-2 por 3 h (média mensal) -> mm/mês
                    a = a * 8 * nd
                elif src.endswith("_tavg"):           # kg m-2 s-1 -> mm/mês
                    a = a * 86400 * nd
                elif src == "Tair_f_inst":            # K -> °C
                    a = a - 273.15
                out[vid].append(a)                    # *_inst de umidade já está em mm
        dates.append((y, mo))
    return {k: np.stack(v) for k, v in out.items()}, lat, lon, dates


# --------------------------------------------------------------------------------------
# Estatística
# --------------------------------------------------------------------------------------
def climatology_and_anomalies(x: np.ndarray, months: np.ndarray):
    """x: (tempo, ...). Retorna climatologia (12, ...), anomalias e anomalias padronizadas."""
    clim = np.stack([np.nanmean(x[months == m], axis=0) for m in range(1, 13)])
    sd = np.stack([np.nanstd(x[months == m], axis=0, ddof=1) for m in range(1, 13)])
    anom = x - clim[months - 1]
    with np.errstate(invalid="ignore", divide="ignore"):
        z = anom / sd[months - 1]
    return clim, anom, z


def annual_values(x: np.ndarray, years_idx: np.ndarray, how: str) -> np.ndarray:
    fn = {"sum": np.nansum, "mean": np.nanmean, "max": np.nanmax}[how]
    return np.stack([fn(x[years_idx == y], axis=0) for y in YEARS])


def sen_ci(x: np.ndarray, var_s: float, alpha: float = ALPHA) -> tuple[float, float]:
    """IC da inclinação de Theil-Sen (Gilbert, 1987)."""
    n = len(x)
    i, j = np.triu_indices(n, k=1)
    slopes = np.sort((x[j] - x[i]) / (j - i))
    big_n = len(slopes)
    c = stats.norm.ppf(1 - alpha / 2) * np.sqrt(var_s)
    m1 = int(np.floor((big_n - c) / 2))
    m2 = int(np.ceil((big_n + c) / 2))
    m1 = min(max(m1, 0), big_n - 1)
    m2 = min(max(m2, 0), big_n - 1)
    return float(slopes[m1]), float(slopes[m2])


def bh_fdr(p: np.ndarray, q: float = ALPHA) -> np.ndarray:
    """Máscara booleana de significância por Benjamini-Hochberg (ignora NaN)."""
    sig = np.zeros(p.shape, dtype=bool)
    flat = p.ravel()
    ok = np.isfinite(flat)
    pv = flat[ok]
    if pv.size == 0:
        return sig
    order = np.argsort(pv)
    ranked = pv[order]
    m = pv.size
    below = ranked <= q * np.arange(1, m + 1) / m
    k = np.max(np.nonzero(below)[0]) + 1 if below.any() else 0
    passed = np.zeros(m, dtype=bool)
    passed[order[:k]] = True
    out = np.zeros(flat.shape, dtype=bool)
    out[np.nonzero(ok)[0]] = passed
    return out.reshape(p.shape)


def _r(v, nd=4):
    if v is None:
        return None
    v = float(v)
    return None if not np.isfinite(v) else round(v, nd)


def trend_monthly(anom: np.ndarray) -> dict:
    r = mk.hamed_rao_modification_test(anom)
    base = mk.original_test(anom)   # variância sem correção, usada só no IC de Sen
    lo, hi = sen_ci(anom, base.var_s)
    return {
        "method": "hamed_rao_mk_on_monthly_anomalies",
        "p_value": _r(r.p, 6),
        "significant": bool(r.p < ALPHA),
        "direction": "up" if r.slope > 0 else "down" if r.slope < 0 else "none",
        "tau": _r(r.Tau),
        "z": _r(r.z),
        "slope_per_decade": _r(r.slope * 120),
        "ci95_per_decade": [_r(lo * 120), _r(hi * 120)],
    }


def trend_annual(values: np.ndarray) -> dict:
    yrs = np.array(YEARS, dtype=float)
    lr = stats.linregress(yrs, values)
    tcrit = stats.t.ppf(1 - ALPHA / 2, len(yrs) - 2)
    r = mk.original_test(values)
    lo, hi = sen_ci(values, r.var_s)
    return {
        "ols": {
            "slope_per_decade": _r(lr.slope * 10),
            "ci95_per_decade": [_r((lr.slope - tcrit * lr.stderr) * 10), _r((lr.slope + tcrit * lr.stderr) * 10)],
            "p_value": _r(lr.pvalue, 6),
            "r2": _r(lr.rvalue ** 2),
            "significant": bool(lr.pvalue < ALPHA),
        },
        "mann_kendall": {
            "p_value": _r(r.p, 6),
            "tau": _r(r.Tau),
            "sen_slope_per_decade": _r(r.slope * 10),
            "ci95_per_decade": [_r(lo * 10), _r(hi * 10)],
            "significant": bool(r.p < ALPHA),
        },
    }


def trend_seasonal(values: np.ndarray) -> dict:
    r = mk.seasonal_test(values, period=12)
    return {"p_value": _r(r.p, 6), "slope_per_decade": _r(r.slope * 10), "significant": bool(r.p < ALPHA)}


def summary_pt(var: Var, region_name: str, primary: dict, mean_level: float | None) -> str:
    unit_dec = var.unit.replace("/mês", "/mês por década") if "/mês" in var.unit else f"{var.unit} por década"
    slope = primary["slope_per_decade"]
    p = primary["p_value"]
    direction = {"up": "aumento", "down": "redução", "none": "estabilidade"}[primary["direction"]]
    rel = ""
    if mean_level and abs(mean_level) > 1e-9 and var.id != "air_temperature":
        rel = f" (cerca de {abs(slope) / abs(mean_level) * 100:.1f} % da média por década)"
    if primary["significant"]:
        return (f"{var.name} em {region_name}: tendência de {direction} de {abs(slope):.2f} {unit_dec}{rel}, "
                f"estatisticamente significativa (p = {p:.3f}). É improvável que essa tendência seja só acaso.")
    return (f"{var.name} em {region_name}: os dados sugerem {direction} de {abs(slope):.2f} {unit_dec}{rel}, "
            f"mas a tendência não é significativa (p = {p:.3f}). Pode ser variação natural; "
            f"uma série mais longa ajudaria a confirmar.")


# --------------------------------------------------------------------------------------
# Regiões
# --------------------------------------------------------------------------------------
def load_regions() -> list[tuple[str, str, object]]:
    """[(id, nome, geometria)]: estados, Região Sul e as 21 regiões intermediárias."""
    out, geoms = [], []
    for f in json.loads(REGIONS_FILE.read_text(encoding="utf-8"))["features"]:
        g = shapely.geometry.shape(f["geometry"])
        geoms.append(g)
        out.append((f["properties"]["id"], f["properties"]["name"], g))
    out.append(("SUL", "Região Sul", shapely.union_all(geoms)))
    if INTERMEDIATE_FILE.exists():
        for f in json.loads(INTERMEDIATE_FILE.read_text(encoding="utf-8"))["features"]:
            p = f["properties"]
            out.append((p["id"], f"{p['name']} ({p['state']})", shapely.geometry.shape(f["geometry"])))
    return out


def cell_fraction(geom, lat: np.ndarray, lon: np.ndarray) -> np.ndarray:
    """Fração da área de cada célula (lat, lon) que cai dentro de geom."""
    res_lat, res_lon = abs(lat[1] - lat[0]), abs(lon[1] - lon[0])
    lon2, lat2 = np.meshgrid(lon, lat)
    boxes = shapely.box(lon2 - res_lon / 2, lat2 - res_lat / 2, lon2 + res_lon / 2, lat2 + res_lat / 2)
    shapely.prepare(geom)
    frac = np.zeros(lat2.shape)
    hit = shapely.intersects(geom, boxes)
    frac[hit] = shapely.area(shapely.intersection(boxes[hit], geom)) / (res_lat * res_lon)
    return np.clip(frac, 0, 1)


def region_masks(lat: np.ndarray, lon: np.ndarray) -> dict[str, tuple[str, np.ndarray]]:
    """{id: (nome, fração de cada célula dentro da região)}."""
    return {rid: (name, cell_fraction(g, lat, lon)) for rid, name, g in load_regions()}


def regional_mean(x: np.ndarray, frac: np.ndarray, lat: np.ndarray) -> np.ndarray:
    """Média ponderada pela área (cos lat × fração dentro da região), ignorando células sem dado."""
    w = np.cos(np.deg2rad(lat))[:, None] * frac
    w = np.broadcast_to(w, x.shape[1:])
    ok = np.isfinite(x) & (w > 0)
    num = np.sum(np.where(ok, x * w, 0.0), axis=(1, 2))
    den = np.sum(np.where(ok, w, 0.0), axis=(1, 2))
    with np.errstate(invalid="ignore"):
        return num / den


# --------------------------------------------------------------------------------------
# Saídas
# --------------------------------------------------------------------------------------
def write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def grid_to_list(a: np.ndarray, nd: int = 3):
    return [[None if not np.isfinite(v) else round(float(v), nd) for v in row] for row in a]


def process_variable(var: Var, data: np.ndarray, lat, lon, dates, masks, skip_maps: bool = False) -> dict:
    years_idx = np.array([d[0] for d in dates])
    months = np.array([d[1] for d in dates])
    date_str = [f"{y:04d}-{m:02d}" for y, m in dates]
    region_results = {}

    # ---------------- séries regionais ----------------
    for rid, (rname, mask) in masks.items():
        series = regional_mean(data, mask, lat)
        clim, anom, z = climatology_and_anomalies(series, months)
        if var.annual == "max":
            ann = annual_values(series, years_idx, "max")
        else:
            ann = annual_values(series, years_idx, var.annual)
        annual_tr = trend_annual(ann)

        if var.id == "precipitation_wettest_month":
            primary = {
                "method": "mann_kendall_on_annual_values",
                "p_value": annual_tr["mann_kendall"]["p_value"],
                "significant": annual_tr["mann_kendall"]["significant"],
                "direction": "up" if annual_tr["mann_kendall"]["sen_slope_per_decade"] > 0 else "down",
                "tau": annual_tr["mann_kendall"]["tau"],
                "slope_per_decade": annual_tr["mann_kendall"]["sen_slope_per_decade"],
                "ci95_per_decade": annual_tr["mann_kendall"]["ci95_per_decade"],
            }
            seasonal = None
            level = float(np.mean(ann))
        else:
            primary = trend_monthly(anom)
            seasonal = trend_seasonal(series)
            level = float(np.mean(series))

        payload = {
            "variable": var.id,
            "variable_name": var.name,
            "unit": var.unit,
            "region": rid,
            "region_name": rname,
            "period": {"start": date_str[0], "end": date_str[-1]},
            "annual_aggregation": var.annual,
            "mean": _r(level),
            "monthly": None if var.id == "precipitation_wettest_month" else {
                "dates": date_str,
                "values": [_r(v, 3) for v in series],
                "anomalies": [_r(v, 3) for v in anom],
                "standardized_anomalies": [_r(v, 3) for v in z],
            },
            "climatology": None if var.id == "precipitation_wettest_month" else [_r(v, 3) for v in clim],
            "annual": {"years": YEARS, "values": [_r(v, 3) for v in ann]},
            "trend": {"primary": primary, "seasonal_mk": seasonal, "annual": annual_tr},
            "summary": summary_pt(var, rname, primary, level),
        }
        write_json(OUT / "series" / rid / f"{var.id}.json", payload)
        region_results[rid] = primary

    # ---------------- mapa por pixel ----------------
    if skip_maps:
        return region_results
    t0 = time.time()
    nlat, nlon = data.shape[1:]
    slope = np.full((nlat, nlon), np.nan)
    pval = np.full((nlat, nlon), np.nan)
    mean = np.full((nlat, nlon), np.nan)
    if var.id == "precipitation_wettest_month":
        series_px = annual_values(data, years_idx, "max")
    else:
        _, series_px, _ = climatology_and_anomalies(data, months)
    for i in range(nlat):
        for j in range(nlon):
            s = series_px[:, i, j]
            if not np.all(np.isfinite(s)) or np.nanstd(s) == 0:
                continue
            if var.id == "precipitation_wettest_month":
                r = mk.original_test(s)
                slope[i, j] = r.slope * 10
            else:
                r = mk.hamed_rao_modification_test(s)
                slope[i, j] = r.slope * 120
            pval[i, j] = r.p
            mean[i, j] = np.nanmean(series_px[:, i, j]) if var.id == "precipitation_wettest_month" \
                else np.nanmean(data[:, i, j])
    sig_fdr = bh_fdr(pval)
    sig_raw = pval < ALPHA
    write_json(OUT / "maps" / f"{var.id}.json", {
        "variable": var.id,
        "unit_slope": f"{var.unit} por década",
        "unit_mean": var.unit,
        "lat": [round(float(v), 4) for v in lat],
        "lon": [round(float(v), 4) for v in lon],
        "resolution_deg": round(float(abs(lat[1] - lat[0])), 3),
        "slope_per_decade": grid_to_list(slope),
        "p_value": grid_to_list(pval, 5),
        "significant_fdr": [[bool(v) for v in row] for row in sig_fdr],
        "mean": grid_to_list(mean),
        "stats": {
            "valid_pixels": int(np.isfinite(pval).sum()),
            "significant_raw": int(np.nansum(sig_raw)),
            "significant_fdr": int(sig_fdr.sum()),
            "significant_fdr_up": int((sig_fdr & (slope > 0)).sum()),
            "significant_fdr_down": int((sig_fdr & (slope < 0)).sum()),
        },
    })
    print(f"  mapa {var.id}: {int(np.isfinite(pval).sum())} pixels, "
          f"{int(np.nansum(sig_raw))} sig. brutos, {int(sig_fdr.sum())} sig. FDR ({time.time() - t0:.0f}s)")
    return region_results


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-maps", action="store_true", help="só séries regionais (os mapas levam ~4 min)")
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    print("lendo IMERG...")
    precip, lat_i, lon_i, dates_i = load_imerg()
    print("lendo GLDAS...")
    gl_ids = [v.id for v in VARS if v.dataset == "gldas"]
    gldas, lat_g, lon_g, dates_g = load_gldas(gl_ids)
    assert len(dates_i) == len(dates_g) == 12 * len(YEARS), "série incompleta"

    masks_i = region_masks(lat_i, lon_i)
    masks_g = region_masks(lat_g, lon_g)

    results = {}
    for var in VARS:
        print(f"processando {var.id}...")
        if var.dataset in ("imerg", "derived"):
            results[var.id] = process_variable(var, precip, lat_i, lon_i, dates_i, masks_i, args.skip_maps)
        else:
            results[var.id] = process_variable(var, gldas[var.id], lat_g, lon_g, dates_g, masks_g, args.skip_maps)

    regions = [{"id": rid, "name": name, "level": "estado" if rid in ("PR", "SC", "RS")
                else "regiao" if rid == "SUL" else "regiao_intermediaria"} for rid, name, _ in load_regions()]
    catalog = {
        "period": {"start": "2001-01", "end": "2024-12"},
        "bbox": {"lat": [-34.0, -22.0], "lon": [-58.0, -47.0]},
        "regions": regions,
        "variables": [{
            "id": v.id, "name": v.name, "unit": v.unit, "definition": v.definition, "flood_link": v.flood_link,
            "dataset": {"imerg": "NASA GPM IMERG V07B (mensal, 0,1°)", "derived": "NASA GPM IMERG V07B (mensal, 0,1°)",
                        "gldas": "NASA GLDAS Noah 2.1 (mensal, 0,25°)"}[v.dataset],
            "has_monthly": v.id != "precipitation_wettest_month",
        } for v in VARS],
        "methods": METHODS,
        "overview": {vid: {rid: {k: r[k] for k in ("slope_per_decade", "p_value", "significant", "direction")}
                           for rid, r in res.items()} for vid, res in results.items()},
    }
    write_json(OUT / "catalog.json", catalog)
    print("ok ->", OUT)


if __name__ == "__main__":
    main()
