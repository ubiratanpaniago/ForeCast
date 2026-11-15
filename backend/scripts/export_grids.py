"""Exporta os resultados para o frontend no formato de frontend/GRID-CONTRACT.md (modo de arquivos locais).

Gera, em frontend/public/data/ (ou --out):

  grids/catalog.json
  grids/{gridId}/cells/{INDICADOR}/2001-2024.geojson          células nativas + resumo estatístico
  grids/{gridId}/series/{cellId}/{INDICADOR}/2001-2024.json   série anual da célula (CellDetail)
  regions/south-intermediate-regions.geojson                  21 regiões intermediárias do IBGE
  regions/{regionId}/{INDICADOR}/2001-2024.json               série + estatística por região (TrendResult)

Indicadores exportados:
  PRCP_ANNUAL   IMERG mensal  -> soma anual (mm)
  SOIL_SURFACE  GLDAS mensal  -> média anual da umidade 0–10 cm (kg/m²)
  SOIL_ROOT     GLDAS mensal  -> média anual da umidade da zona radicular (kg/m²)
  RX1DAY        IMERG diário  -> maior chuva diária do ano (mm)
  R50MM         IMERG diário  -> dias do ano com chuva >= 50 mm
RX1DAY e R50MM só entram no catálogo se o IMERG diário estiver completo (todos os dias de 2001–2024);
caso contrário a grade diária aparece como indisponível.

Estatística por célula/região (série anual, 24 anos):
  Mann-Kendall + inclinação de Theil-Sen por década + IC 95 % de Sen (Gilbert, 1987).
  Células: a "direction" só é increasing/decreasing se a célula passar na correção FDR
  (Benjamini-Hochberg, q = 0,05, entre todas as células exportadas do indicador) E o IC excluir zero;
  "pValue" é o p bruto. Regiões: sem FDR (poucos testes), direção por p < 0,05 e IC excluindo zero.

Uso:  python scripts/export_grids.py [--out ../frontend/public/data]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
from datetime import date
from pathlib import Path

import numpy as np
import pymannkendall as mk
import shapely

sys.path.insert(0, str(Path(__file__).resolve().parent))
import analyze_trends as at  # noqa: E402  (reaproveita leitores e estatística)

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
DEFAULT_OUT = ROOT.parent / "frontend" / "public" / "data"
PERIOD = {"start": 2001, "end": 2024}
YEARS = list(range(PERIOD["start"], PERIOD["end"] + 1))
PSTR = f"{PERIOD['start']}-{PERIOD['end']}"
ALPHA = 0.05
UNITS = {"PRCP_ANNUAL": "mm", "SOIL_SURFACE": "kg/m²", "SOIL_ROOT": "kg/m²", "RX1DAY": "mm", "R50MM": "dias"}
DAILY_INDICATORS = ["RX1DAY", "R50MM"]

GRIDS = {
    "imerg-monthly-v07": {
        "name": "IMERG Final mensal", "productId": "GPM_3IMERGM_07", "version": "07",
        "doi": "10.5067/GPM/IMERG/3B-MONTH/07", "res": 0.1, "raw": "imerg_monthly",
        "origin": (-180.0, -90.0), "indicators": ["PRCP_ANNUAL"],
    },
    "gldas-noah-monthly-v21": {
        "name": "GLDAS Noah mensal", "productId": "GLDAS_NOAH025_M_2.1", "version": "2.1",
        "doi": "10.5067/SXAVCZFAQLNO", "res": 0.25, "raw": "gldas_monthly",
        "origin": (-180.0, -60.0), "indicators": ["SOIL_SURFACE", "SOIL_ROOT"],
    },
}
DAILY = {
    "name": "IMERG Final diário", "productId": "GPM_3IMERGDF_07", "version": "07",
    "doi": "10.5067/GPM/IMERGDF/DAY/07", "res": 0.1, "raw": "imerg_daily",
    "origin": (-180.0, -90.0), "indicators": DAILY_INDICATORS,
}


# --------------------------------------------------------------------------------------
def revision() -> str:
    """Data + hash dos manifestos brutos: muda se os dados de entrada mudarem."""
    h = hashlib.sha256()
    for g in list(GRIDS.values()) + [DAILY]:
        h.update((RAW / g["raw"] / "manifest.jsonl").read_bytes())
    h.update(Path(__file__).read_bytes())
    h.update(Path(at.__file__).read_bytes())
    return f"{date.today().isoformat()}-{h.hexdigest()[:8]}"


def r(v, nd=4):
    return None if v is None or not np.isfinite(v) else round(float(v), nd)


def annual_stats(values: np.ndarray) -> dict | None:
    """Mann-Kendall + Sen + IC 95 % na série anual. None se a série estiver incompleta ou constante."""
    if values.shape[0] != len(YEARS) or not np.all(np.isfinite(values)) or np.std(values) == 0:
        return None
    res = mk.original_test(values)
    lo, hi = at.sen_ci(values, res.var_s)
    slope = res.slope * 10
    lo, hi = lo * 10, hi * 10
    lo, hi = min(lo, slope), max(hi, slope)   # garante lo <= Sen <= hi após arredondamentos
    return {"slope": slope, "lo": lo, "hi": hi, "p": float(res.p), "tau": float(res.Tau)}


def statistics_obj(st: dict | None, significant: bool, method: str) -> dict:
    if st is None:
        return {"slopePerDecade": None, "pValue": None, "tau": None, "confidenceInterval95": None,
                "direction": "inconclusive", "status": "insufficient", "method": method}
    slope, lo, hi = r(st["slope"]), r(st["lo"]), r(st["hi"])
    lo, hi = min(lo, slope), max(hi, slope)
    excludes_zero = lo > 0 or hi < 0
    direction = "inconclusive"
    if significant and excludes_zero:
        direction = "increasing" if slope > 0 else "decreasing"
    return {"slopePerDecade": slope, "pValue": r(st["p"], 6), "tau": r(st["tau"]),
            "confidenceInterval95": [lo, hi], "direction": direction, "status": "valid", "method": method}


def metadata_obj(grid: dict, indicator: str, notes: list[str]) -> dict:
    return {"unit": UNITS[indicator], "productId": grid["productId"], "version": grid["version"],
            "sourceDOI": grid["doi"], "qualityNotes": notes, "demonstrative": False}


def series_obj(values: np.ndarray) -> list[dict]:
    return [{"year": y, "value": r(v, 2) if np.isfinite(v) and v >= 0 else None} for y, v in zip(YEARS, values)]


def write(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


# --------------------------------------------------------------------------------------
def load_annual() -> dict[str, tuple[np.ndarray, np.ndarray, np.ndarray]]:
    """{indicador: (anual (ano, lat, lon), lat, lon)} com lat crescente."""
    out = {}
    precip, lat_i, lon_i, dates_i = at.load_imerg()
    yi = np.array([d[0] for d in dates_i])
    out["PRCP_ANNUAL"] = (at.annual_values(precip, yi, "sum"), lat_i, lon_i)
    # anos sem 12 meses válidos viram NaN (nansum transformaria lacunas em zero)
    counts = np.stack([np.isfinite(precip[yi == y]).sum(axis=0) for y in YEARS])
    out["PRCP_ANNUAL"][0][counts < 12] = np.nan

    gl, lat_g, lon_g, dates_g = at.load_gldas(["surface_soil_moisture", "root_zone_soil_moisture"])
    yg = np.array([d[0] for d in dates_g])
    for ind, vid in (("SOIL_SURFACE", "surface_soil_moisture"), ("SOIL_ROOT", "root_zone_soil_moisture")):
        a = gl[vid]
        ann = np.stack([np.mean(a[yg == y], axis=0) for y in YEARS])   # NaN se faltar algum mês
        out[ind] = (ann, lat_g, lon_g)
    return out


def load_daily_indices(regions: list[tuple[str, object]] | None = None) -> tuple[dict, dict, dict]:
    """RX1DAY (máx. diária do ano, mm) e R50MM (dias com >= 50 mm) por célula, a partir do IMERG diário.

    Um ano só é calculado se TODOS os seus dias estiverem baixados; caso contrário fica NaN.
    Para regiões, os índices são calculados sobre a chuva diária MÉDIA da região (ponderada por área).
    Retorna ({indicador: (anual, lat, lon)}, {regiao: {indicador: anual}}, {ano: dias disponíveis}).
    """
    import calendar
    import netCDF4
    from datetime import date, timedelta

    raw = RAW / "imerg_daily"
    spec = json.loads((raw / "grid_spec.json").read_text())
    lat = np.array(spec["lat_values"], dtype=float)
    lon = np.array(spec["lon_values"], dtype=float)
    rx = np.full((len(YEARS), len(lat), len(lon)), np.nan)
    r50 = np.full_like(rx, np.nan)
    coverage = {}
    fracs = {rid: at.cell_fraction(g, lat, lon) for rid, g in (regions or [])}
    reg = {rid: {"RX1DAY": np.full(len(YEARS), np.nan), "R50MM": np.full(len(YEARS), np.nan)} for rid in fracs}
    for k, y in enumerate(YEARS):
        ndays = 366 if calendar.isleap(y) else 365
        days = [date(y, 1, 1) + timedelta(n) for n in range(ndays)]
        files = [raw / f"{y}" / f"3B-DAY.MS.MRG.3IMERG.{d:%Y%m%d}-S000000-E235959.V07B.south_br.nc4" for d in days]
        present = [f for f in files if f.exists()]
        coverage[y] = len(present)
        if len(present) < ndays:
            continue
        stack = np.empty((ndays, len(lat), len(lon)))
        for n, f in enumerate(present):
            with netCDF4.Dataset(f) as ds:
                a = ds["precipitation"][0].filled(np.nan).astype("float64").T   # (lon, lat) -> (lat, lon)
            a[a < 0] = np.nan
            stack[n] = a
        bad = np.isnan(stack).any(axis=0)       # célula com algum dia faltando no ano -> NaN
        rx[k] = np.where(bad, np.nan, np.nanmax(stack, axis=0))
        r50[k] = np.where(bad, np.nan, (stack >= 50).sum(axis=0))
        for rid, fr in fracs.items():
            daily = at.regional_mean(stack, fr, lat)
            if np.all(np.isfinite(daily)):
                reg[rid]["RX1DAY"][k] = daily.max()
                reg[rid]["R50MM"][k] = int((daily >= 50).sum())
    return {"RX1DAY": (rx, lat, lon), "R50MM": (r50, lat, lon)}, reg, coverage


def export_grid(gid: str, grid: dict, annual: dict, union, out: Path, rev: str) -> dict:
    spec = json.loads((RAW / grid["raw"] / "grid_spec.json").read_text())
    row0, col0 = spec["lat_slice"][0], spec["lon_slice"][0]
    res, (lon_org, lat_org) = grid["res"], grid["origin"]
    _, lat, lon = annual[grid["indicators"][0]]
    nlat, nlon = len(lat), len(lon)

    # geometria nativa a partir do índice global (não do BBOX do recorte)
    cells = []
    for i in range(nlat):
        for j in range(nlon):
            row, col = row0 + i, col0 + j
            w, s = lon_org + col * res, lat_org + row * res
            e, n = w + res, s + res
            assert abs((w + e) / 2 - lon[j]) < 1e-4 and abs((s + n) / 2 - lat[i]) < 1e-4, "índice global não bate"
            box = shapely.box(w, s, e, n)
            if not union.intersects(box):
                continue
            frac = union.intersection(box).area / box.area
            if frac < 1e-4:
                continue
            cells.append({"i": i, "j": j, "row": row, "col": col, "id": f"{gid}-r{row}-c{col}",
                          "bounds": [round(w, 6), round(s, 6), round(e, 6), round(n, 6)],
                          "frac": round(min(frac, 1.0), 4)})

    summary_counts = {}
    for ind in grid["indicators"]:
        data, _, _ = annual[ind]
        stats = [annual_stats(data[:, c["i"], c["j"]]) for c in cells]
        pvals = np.array([s["p"] if s else np.nan for s in stats])
        fdr = at.bh_fdr(pvals)
        n_valid = int(np.isfinite(pvals).sum())
        method = ("Mann-Kendall na série anual; inclinação de Theil-Sen e IC 95 % (Gilbert, 1987); "
                  "direção exige FDR Benjamini-Hochberg q=0,05 e IC excluindo zero")
        notes = [
            f"Série anual {PSTR} completa (24/24 anos) nas células com resumo; células sem dado têm summary=null.",
            "pValue é o p-valor bruto; a direção increasing/decreasing só aparece após correção FDR "
            f"entre {n_valid} células deste indicador.",
            "Mann-Kendall anual sem correção de autocorrelação; 24 anos é uma série curta para extremos.",
            {"PRCP_ANNUAL": "Soma dos 12 totais mensais IMERG (mm/h × 24 × dias do mês).",
             "SOIL_SURFACE": "Média anual da umidade 0–10 cm do modelo GLDAS (kg/m² = mm de água).",
             "SOIL_ROOT": "Média anual da umidade da zona radicular do modelo GLDAS (kg/m² = mm de água).",
             "RX1DAY": "Maior chuva diária do ano no IMERG diário; ano só calculado com todos os dias disponíveis.",
             "R50MM": "Número de dias do ano com chuva diária >= 50 mm no IMERG diário; muitos empates (contagens)."
             }[ind],
            "fractionInside = fração da área da célula dentro de PR/SC/RS (malha IBGE, interseção de polígonos).",
        ]
        meta = metadata_obj(grid, ind, notes)
        features = []
        up = down = 0
        for c, st, sig in zip(cells, stats, fdr):
            stat = statistics_obj(st, bool(sig), method)
            up += stat["direction"] == "increasing"
            down += stat["direction"] == "decreasing"
            w, s, e, n = c["bounds"]
            features.append({
                "type": "Feature",
                "geometry": {"type": "Polygon", "coordinates": [[[w, s], [e, s], [e, n], [w, n], [w, s]]]},
                "properties": {
                    "id": c["id"], "gridId": gid, "row": c["row"], "column": c["col"],
                    "center": [round((w + e) / 2, 6), round((s + n) / 2, 6)], "bounds": c["bounds"],
                    "fractionInside": c["frac"],
                    "summary": None if st is None else
                    {"indicator": ind, "period": PERIOD, "statistics": stat, "metadata": meta},
                },
            })
            write(out / "grids" / gid / "series" / c["id"] / ind / f"{PSTR}.json", {
                "gridId": gid, "revision": rev, "cellId": c["id"], "indicator": ind, "period": PERIOD,
                "series": series_obj(data[:, c["i"], c["j"]]),
                "statistics": None if st is None else stat, "metadata": meta,
            })
        write(out / "grids" / gid / "cells" / ind / f"{PSTR}.geojson", {
            "type": "FeatureCollection", "gridId": gid, "revision": rev, "indicator": ind,
            "period": PERIOD, "truncated": False, "features": features,
        })
        summary_counts[ind] = {"cells": len(features), "with_stats": n_valid, "increasing": up, "decreasing": down}
        print(f"  {gid}/{ind}: {len(features)} células, {n_valid} com estatística, "
              f"{up} aumento e {down} redução significativos (FDR)")
    return summary_counts


def region_list() -> list[tuple[str, object]]:
    fc = json.loads(at.INTERMEDIATE_FILE.read_text(encoding="utf-8"))
    states = json.loads(at.REGIONS_FILE.read_text(encoding="utf-8"))
    regions = [(f["properties"]["id"], shapely.geometry.shape(f["geometry"])) for f in fc["features"]]
    regions += [(str(f["properties"]["code"]), shapely.geometry.shape(f["geometry"])) for f in states["features"]]
    return regions


def export_regions(annual: dict, daily_regional: dict | None, out: Path) -> None:
    fc = json.loads(at.INTERMEDIATE_FILE.read_text(encoding="utf-8"))
    feats = [{"type": "Feature", "geometry": f["geometry"],
              "properties": {"id": f["properties"]["id"], "name": f["properties"]["name"],
                             "abbreviation": f["properties"]["state"], "level": "regiao_intermediaria"}}
             for f in fc["features"]]
    write(out / "regions" / "south-intermediate-regions.geojson", {"type": "FeatureCollection", "features": feats})

    method = "Mann-Kendall na série anual da média regional ponderada por área; Theil-Sen e IC 95 % (Gilbert, 1987)"
    regions = region_list()
    indicators = [i for i in UNITS if i in annual]
    for ind in indicators:
        data, lat, lon = annual[ind]
        grid = {"PRCP_ANNUAL": GRIDS["imerg-monthly-v07"], "RX1DAY": DAILY, "R50MM": DAILY}.get(
            ind, GRIDS["gldas-noah-monthly-v21"])
        notes = [
            "Média regional ponderada pela área de cada célula dentro da região (cos lat × fração)."
            if ind not in DAILY_INDICATORS else
            "Índice calculado sobre a chuva diária média da região (ponderada por área), não sobre cada célula.",
            f"Sem correção para testes múltiplos entre regiões: com {len(regions)} regiões e {len(indicators)} "
            "indicadores, alguns resultados com p < 0,05 são esperados por acaso.",
        ]
        meta = metadata_obj(grid, ind, notes)
        for rid, geom in regions:
            if ind in DAILY_INDICATORS:
                series = daily_regional[rid][ind]
            else:
                series = at.regional_mean(data, at.cell_fraction(geom, lat, lon), lat)
            st = annual_stats(series)
            sig = st is not None and st["p"] < ALPHA
            write(out / "regions" / rid / ind / f"{PSTR}.json", {
                "regionId": rid, "indicator": ind, "period": PERIOD, "series": series_obj(series),
                "statistics": statistics_obj(st, sig, method), "metadata": meta,
            })
    print(f"  regiões: {len(regions)} × {len(indicators)} indicadores")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = ap.parse_args()
    out: Path = args.out.resolve()

    # limpa só o que este script gera
    for gid in list(GRIDS) + ["imerg-daily-v07"]:
        shutil.rmtree(out / "grids" / gid, ignore_errors=True)
    shutil.rmtree(out / "regions", ignore_errors=True)

    rev = revision()
    print(f"revisão {rev}\nlendo dados mensais...")
    annual = load_annual()
    print("lendo IMERG diário...")
    daily, daily_regional, coverage = load_daily_indices(region_list())
    expected = {y: 366 if y % 4 == 0 else 365 for y in YEARS}
    complete_years = [y for y in YEARS if coverage[y] == expected[y]]
    daily_ok = len(complete_years) == len(YEARS)
    print(f"  IMERG diário: {len(complete_years)}/{len(YEARS)} anos completos "
          f"({sum(coverage.values())}/{sum(expected.values())} dias)")

    grids = dict(GRIDS)
    if daily_ok:
        annual.update(daily)
        grids = {"imerg-monthly-v07": GRIDS["imerg-monthly-v07"], "imerg-daily-v07": DAILY,
                 "gldas-noah-monthly-v21": GRIDS["gldas-noah-monthly-v21"]}

    states = json.loads(at.REGIONS_FILE.read_text(encoding="utf-8"))
    union = shapely.union_all([shapely.geometry.shape(f["geometry"]) for f in states["features"]])
    shapely.prepare(union)

    catalog = []
    for gid, g in grids.items():
        export_grid(gid, g, annual, union, out, rev)
        catalog.append({"id": gid, "name": g["name"], "productId": g["productId"], "version": g["version"],
                        "resolutionDegrees": g["res"], "crs": "EPSG:4326", "indicators": g["indicators"],
                        "period": PERIOD, "revision": rev, "available": True})
    if not daily_ok:
        catalog.insert(1, {
            "id": "imerg-daily-v07", "name": DAILY["name"], "productId": DAILY["productId"],
            "version": DAILY["version"], "resolutionDegrees": 0.1, "crs": "EPSG:4326",
            "indicators": DAILY_INDICATORS, "period": PERIOD, "revision": "not-ingested", "available": False,
            "unavailableReason": f"P1 · IMERG diário com {len(complete_years)}/{len(YEARS)} anos completos "
                                 f"({sum(coverage.values())}/{sum(expected.values())} dias). "
                                 "Rode backend/scripts/download_imerg_daily.py.",
        })
    write(out / "grids" / "catalog.json", {"grids": catalog})
    export_regions(annual, daily_regional if daily_ok else None, out)
    print(f"ok -> {out}")


if __name__ == "__main__":
    main()
