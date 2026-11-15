"""Cruza a suscetibilidade do relevo com as tendências hidrológicas -> "pontos de atenção".

Para cada célula de 0,1° (grade do IMERG) dentro de PR, SC e RS:
  * suscetibilidade do relevo (terrain.json): 1 baixa, 2 média, 3 alta;
  * evidência de aumento em chuva, chuva do mês mais chuvoso e escoamento superficial:
       2 = aumento significativo após correção FDR
       1 = aumento com p < 0,05 sem correção (indício)
       0 = sem evidência de aumento
  * categoria final:
       "attention"  relevo alto + evidência >= 1 em pelo menos uma variável
       "terrain"    relevo alto, sem evidência de aumento
       "trend"      evidência >= 1, relevo baixo/médio
       "none"       nenhum dos dois

Não é probabilidade de enchente: é um índice para orientar a investigação.

Requer: analyze_trends.py e build_terrain.py já executados.
Saída:  data/historical/hotspots.json
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import shapely

ROOT = Path(__file__).resolve().parents[1]
HIST = ROOT / "data" / "historical"
REGIONS_FILE = ROOT / "data" / "regions.geojson"
ALPHA = 0.05
TREND_VARS = ["precipitation", "precipitation_wettest_month", "surface_runoff"]


def load(name):
    return json.loads((HIST / name).read_text(encoding="utf-8"))


def arr(rows, dtype=float):
    return np.array([[np.nan if v is None else v for v in r] for r in rows], dtype=dtype)


def evidence_on_grid(m: dict, lat: np.ndarray, lon: np.ndarray) -> np.ndarray:
    """Evidência de aumento (0/1/2) reamostrada por vizinho mais próximo para (lat, lon)."""
    mlat, mlon = np.array(m["lat"]), np.array(m["lon"])
    slope = arr(m["slope_per_decade"])
    p = arr(m["p_value"])
    fdr = np.array(m["significant_fdr"], dtype=bool)
    ev = np.zeros(slope.shape)
    up = slope > 0
    ev[up & (p < ALPHA)] = 1
    ev[up & fdr] = 2
    ev[~np.isfinite(slope)] = np.nan
    ii = np.abs(mlat[:, None] - lat[None, :]).argmin(axis=0)
    jj = np.abs(mlon[:, None] - lon[None, :]).argmin(axis=0)
    return ev[np.ix_(ii, jj)]


def main() -> None:
    terrain = load("terrain.json")
    lat, lon = np.array(terrain["lat"]), np.array(terrain["lon"])
    cls = arr(terrain["susceptibility_class"])
    frac = arr(terrain["susceptible_fraction"])

    evid = {v: evidence_on_grid(load(f"maps/{v}.json"), lat, lon) for v in TREND_VARS}
    stack = np.stack(list(evid.values()))
    best = np.nanmax(np.where(np.isfinite(stack), stack, -1), axis=0)

    fc = json.loads(REGIONS_FILE.read_text(encoding="utf-8"))
    lon2, lat2 = np.meshgrid(lon, lat)
    state = np.full(cls.shape, "", dtype=object)
    for f in fc["features"]:
        g = shapely.geometry.shape(f["geometry"])
        state[shapely.contains_xy(g, lon2, lat2)] = f["properties"]["id"]
    valid = np.isfinite(cls) & (state != "")

    high = cls == 3
    trend = best >= 1
    cat = np.full(cls.shape, None, dtype=object)
    cat[valid] = "none"
    cat[valid & high & ~trend] = "terrain"
    cat[valid & ~high & trend] = "trend"
    cat[valid & high & trend] = "attention"

    def grid(a, nd=0):
        return [[None if not np.isfinite(x) else round(float(x), nd) for x in row] for row in a]

    summary = {}
    for sid in ["PR", "SC", "RS"]:
        s = valid & (state == sid)
        n = int(s.sum())
        summary[sid] = {
            "cells": n,
            **{k: int((cat[s] == k).sum()) for k in ("attention", "terrain", "trend", "none")},
            "evidence_by_variable": {v: {"fdr": int((evid[v][s] == 2).sum()), "raw": int((evid[v][s] >= 1).sum())}
                                     for v in TREND_VARS},
        }

    # lista das células "attention", ordenada por força da evidência e fração de planície
    cells = []
    for i, j in zip(*np.nonzero(cat == "attention")):
        cells.append({
            "lat": round(float(lat[i]), 2), "lon": round(float(lon[j]), 2), "state": state[i, j],
            "susceptible_fraction": round(float(frac[i, j]), 3),
            "evidence": {v: int(evid[v][i, j]) if np.isfinite(evid[v][i, j]) else None for v in TREND_VARS},
        })
    cells.sort(key=lambda c: (-max(x or 0 for x in c["evidence"].values()), -c["susceptible_fraction"]))

    (HIST / "hotspots.json").write_text(json.dumps({
        "description": ("Pontos de atenção = relevo de alta suscetibilidade (planícies baixas) E indício de aumento "
                        "em chuva, chuva do mês mais chuvoso ou escoamento superficial. Índice para investigação, "
                        "não probabilidade de enchente."),
        "lat": [round(float(x), 4) for x in lat],
        "lon": [round(float(x), 4) for x in lon],
        "category": [[c for c in row] for row in cat],
        "category_labels": {"attention": "Relevo suscetível + tendência de aumento",
                            "terrain": "Relevo suscetível, sem tendência de aumento",
                            "trend": "Tendência de aumento, relevo pouco suscetível",
                            "none": "Sem sinal"},
        "evidence_levels": {"2": "aumento significativo após correção FDR", "1": "aumento com p < 0,05 (sem correção)",
                            "0": "sem evidência de aumento"},
        "evidence": {v: grid(evid[v]) for v in TREND_VARS},
        "summary_by_state": summary,
        "attention_cells": cells,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
