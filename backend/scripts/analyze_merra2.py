"""Tendências de 45 anos (1980–2024) com o MERRA-2 mensal de superfície (M2TMNXLND), e teste de robustez.

Mesma estatística de analyze_trends.py (anomalias mensais, Mann-Kendall modificado de Hamed-Rao, Theil-Sen
com IC 95 %, FDR nos mapas), aplicada a três janelas:
  1980–2024  série completa: mais poder estatístico
  2001–2024  mesma janela do IMERG/GLDAS: compara produtos
  1980–2019  sem as secas de 2020–2022 no fim: testa se a tendência depende das pontas

Saída em data/historical/merra2/:
  series/<REGIAO>/<variavel>.json    série mensal 1980–2024 + tendências nas três janelas
  maps/<variavel>.json               tendência por pixel 1980–2024 (grade 0,5° × 0,625°)
  summary.json                       tabela comparativa (todas as regiões × variáveis × janelas)

Uso:  python scripts/analyze_merra2.py
"""
from __future__ import annotations

import calendar
import json
import re
import sys
from pathlib import Path

import netCDF4
import numpy as np
import pymannkendall as mk

sys.path.insert(0, str(Path(__file__).resolve().parent))
import analyze_trends as at  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "merra2_monthly"
OUT = ROOT / "data" / "historical" / "merra2"
WINDOWS = {"1980-2024": (1980, 2024), "2001-2024": (2001, 2024), "1980-2019": (1980, 2019)}

# id: (variável MERRA-2, nome, unidade, conversão)
VARS = {
    "precipitation": ("PRECTOTLAND", "Chuva mensal", "mm/mês", "flux"),
    "precipitation_wettest_month": ("PRECTOTLAND", "Chuva do mês mais chuvoso do ano", "mm", "flux"),
    "surface_runoff": ("RUNOFF", "Escoamento superficial", "mm/mês", "flux"),
    "baseflow": ("BASEFLOW", "Escoamento subterrâneo", "mm/mês", "flux"),
    "evapotranspiration": ("EVLAND", "Evapotranspiração", "mm/mês", "flux"),
    "surface_soil_moisture": ("SFMC", "Umidade do solo superficial", "m³/m³", "state"),
    "root_zone_soil_moisture": ("RZMC", "Umidade do solo (zona das raízes)", "m³/m³", "state"),
    "root_zone_wetness": ("GWETROOT", "Saturação do solo (zona das raízes, 0–1)", "fração", "state"),
}


def load() -> tuple[dict, np.ndarray, np.ndarray, list[tuple[int, int]]]:
    files = sorted(RAW.rglob("*.nc4"))
    srcs = sorted({v[0] for v in VARS.values()})
    arrays = {s: [] for s in srcs}
    dates = []
    lat = lon = None
    for f in files:
        m = re.search(r"\.(\d{4})(\d{2})\.south_br", f.name)
        y, mo = int(m.group(1)), int(m.group(2))
        nd = calendar.monthrange(y, mo)[1]
        with netCDF4.Dataset(f) as ds:
            if lat is None:
                lat, lon = ds["lat"][:].astype(float), ds["lon"][:].astype(float)
            for s in srcs:
                a = ds[s][0]
                a = (a.filled(np.nan) if np.ma.isMaskedArray(a) else np.asarray(a)).astype("float64")
                a[np.abs(a) > 1e10] = np.nan
                if s in ("PRECTOTLAND", "RUNOFF", "BASEFLOW", "EVLAND"):
                    a = a * 86400 * nd          # kg m-2 s-1 -> mm/mês
                arrays[s].append(a)
        dates.append((y, mo))
    assert len(dates) == 540, f"esperava 540 meses, achei {len(dates)}"
    return {s: np.stack(v) for s, v in arrays.items()}, lat, lon, dates


def window_trend(series: np.ndarray, years: np.ndarray, months: np.ndarray, vid: str, w: tuple[int, int]) -> dict:
    sel = (years >= w[0]) & (years <= w[1])
    x, yy, mm = series[sel], years[sel], months[sel]
    if vid == "precipitation_wettest_month":
        ann = np.array([x[yy == y].max() for y in range(w[0], w[1] + 1)])
        r = mk.original_test(ann)
        lo, hi = at.sen_ci(ann, r.var_s)
        slope, lo, hi = r.slope * 10, lo * 10, hi * 10
    else:
        _, anom, _ = at.climatology_and_anomalies(x, mm)
        r = mk.hamed_rao_modification_test(anom)
        base = mk.original_test(anom)
        lo, hi = at.sen_ci(anom, base.var_s)
        slope, lo, hi = r.slope * 120, lo * 120, hi * 120
    mean = float(np.mean(x)) if vid != "precipitation_wettest_month" else float(np.mean(ann))
    return {"slope_per_decade": at._r(slope, 5), "ci95_per_decade": [at._r(lo, 5), at._r(hi, 5)],
            "p_value": at._r(r.p, 6), "significant": bool(r.p < at.ALPHA), "tau": at._r(r.Tau),
            "relative_pct_per_decade": at._r(slope / mean * 100 if mean else None, 2), "mean": at._r(mean, 4)}


def main() -> None:
    data, lat, lon, dates = load()
    years = np.array([d[0] for d in dates])
    months = np.array([d[1] for d in dates])
    masks = at.region_masks(lat, lon)
    summary = {}
    for vid, (src, name, unit, _) in VARS.items():
        x = data[src]
        summary[vid] = {}
        for rid, (rname, frac) in masks.items():
            s = at.regional_mean(x, frac, lat)
            if not np.all(np.isfinite(s)):
                continue
            trends = {wn: window_trend(s, years, months, vid, w) for wn, w in WINDOWS.items()}
            summary[vid][rid] = trends
            _, anom, z = at.climatology_and_anomalies(s, months)
            at.write_json(OUT / "series" / rid / f"{vid}.json", {
                "variable": vid, "variable_name": name, "unit": unit, "region": rid, "region_name": rname,
                "source": "NASA MERRA-2 M2TMNXLND 5.12.4 (DOI 10.5067/8S35XF81C28F)",
                "monthly": {"dates": [f"{y:04d}-{m:02d}" for y, m in dates],
                            "values": [at._r(v, 5) for v in s], "anomalies": [at._r(v, 5) for v in anom],
                            "standardized_anomalies": [at._r(v, 3) for v in z]},
                "trends": trends,
            })

        # mapa 1980–2024 por pixel
        slope = np.full(x.shape[1:], np.nan)
        pval = np.full(x.shape[1:], np.nan)
        for i in range(x.shape[1]):
            for j in range(x.shape[2]):
                px = x[:, i, j]
                if not np.all(np.isfinite(px)) or np.std(px) == 0:
                    continue
                t = window_trend(px, years, months, vid, WINDOWS["1980-2024"])
                slope[i, j], pval[i, j] = t["slope_per_decade"], t["p_value"]
        fdr = at.bh_fdr(pval)
        at.write_json(OUT / "maps" / f"{vid}.json", {
            "variable": vid, "unit_slope": f"{unit} por década", "period": "1980-2024",
            "lat": [float(v) for v in lat], "lon": [float(v) for v in lon], "resolution_deg": [0.5, 0.625],
            "slope_per_decade": at.grid_to_list(slope, 5), "p_value": at.grid_to_list(pval, 5),
            "significant_fdr": [[bool(v) for v in row] for row in fdr],
            "stats": {"valid_pixels": int(np.isfinite(pval).sum()), "significant_raw": int(np.nansum(pval < at.ALPHA)),
                      "significant_fdr_up": int((fdr & (slope > 0)).sum()),
                      "significant_fdr_down": int((fdr & (slope < 0)).sum())},
        })
        print(f"{vid}: mapa {int(np.isfinite(pval).sum())} px, FDR +{int((fdr & (slope > 0)).sum())} "
              f"-{int((fdr & (slope < 0)).sum())}")
    at.write_json(OUT / "summary.json", {
        "source": "NASA MERRA-2 M2TMNXLND 5.12.4, DOI 10.5067/8S35XF81C28F",
        "windows": WINDOWS, "variables": {k: {"name": v[1], "unit": v[2]} for k, v in VARS.items()},
        "trends": summary,
    })
    print("ok ->", OUT)


if __name__ == "__main__":
    main()
