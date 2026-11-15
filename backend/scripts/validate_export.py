"""Valida a saída de export_grids.py contra as regras de frontend/src/services/{gridApi,trendContract}.ts
(branch feat/map). É uma tradução das checagens do TypeScript, útil enquanto não há Node na máquina.

Uso:  python scripts/validate_export.py [--out ../frontend/public/data]
"""
from __future__ import annotations

import argparse
import json
import math
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UNITS = {"PRCP_ANNUAL": "mm", "RX1DAY": "mm", "R50MM": "dias", "SOIL_SURFACE": "kg/m²", "SOIL_ROOT": "kg/m²"}
STUDY = (-58, -34, -47, -22)


def fin(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x)


def nullable(x):
    return x is None or fin(x)


def check_trend(d: dict, rid: str, ind: str, start: int, end: int, need_series=True):
    s, m = d["statistics"], d["metadata"]
    assert d["regionId"] == rid and d["indicator"] == ind
    assert d["period"] == {"start": start, "end": end}
    ser = d["series"]
    assert len(ser) == end - start + 1 and all(p["year"] == start + i for i, p in enumerate(ser))
    for p in ser:
        assert nullable(p["value"]) and (p["value"] is None or p["value"] >= 0)
    assert s["status"] in ("valid", "exploratory", "insufficient")
    assert s["direction"] in ("increasing", "decreasing", "inconclusive")
    for k in ("slopePerDecade", "pValue", "tau"):
        assert nullable(s[k]), k
    assert s["pValue"] is None or 0 <= s["pValue"] <= 1
    assert s["tau"] is None or abs(s["tau"]) <= 1
    ci = s["confidenceInterval95"]
    assert ci is None or (len(ci) == 2 and all(map(fin, ci)) and ci[0] <= ci[1])
    assert isinstance(s["method"], str) and s["method"]
    assert m["unit"] == UNITS[ind], (m["unit"], ind)
    for k in ("productId", "version", "sourceDOI"):
        assert isinstance(m[k], str)
    assert isinstance(m["demonstrative"], bool) and isinstance(m["qualityNotes"], list)
    if s["status"] == "valid":
        assert None not in (s["slopePerDecade"], s["pValue"], s["tau"], ci)
    if s["status"] == "insufficient":
        assert s["direction"] == "inconclusive" and all(v is None for v in (s["slopePerDecade"], s["pValue"], s["tau"], ci))
    if ci is not None and s["slopePerDecade"] is not None:
        assert ci[0] <= s["slopePerDecade"] <= ci[1]
    if not m["demonstrative"]:
        assert m["sourceDOI"].startswith("10.") and m["productId"] and m["version"]
    if s["direction"] == "increasing":
        assert s["slopePerDecade"] > 0
    if s["direction"] == "decreasing":
        assert s["slopePerDecade"] < 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=ROOT.parent / "frontend" / "public" / "data")
    out = ap.parse_args().out
    grids = json.loads((out / "grids" / "catalog.json").read_text(encoding="utf-8"))["grids"]
    assert len({g["id"] for g in grids}) == len(grids)
    n_cells = n_series = n_regions = 0
    for g in grids:
        assert g["resolutionDegrees"] in (0.1, 0.25) and g["crs"] == "EPSG:4326"
        assert g["indicators"] and all(i in UNITS for i in g["indicators"])
        assert g["period"]["start"] <= g["period"]["end"]
        if not g["available"]:
            continue
        p = g["period"]
        for ind in g["indicators"]:
            fc = json.loads((out / "grids" / g["id"] / "cells" / ind / f"{p['start']}-{p['end']}.geojson")
                            .read_text(encoding="utf-8"))
            assert fc["type"] == "FeatureCollection" and fc["gridId"] == g["id"] and fc["revision"] == g["revision"]
            assert fc["indicator"] == ind and fc["period"] == p and fc["truncated"] is False
            assert len(fc["features"]) <= 20000
            ids = set()
            res = g["resolutionDegrees"]
            for f in fc["features"]:
                q = f["properties"]
                assert q["id"] not in ids and q["gridId"] == g["id"]
                ids.add(q["id"])
                assert isinstance(q["row"], int) and isinstance(q["column"], int) and q["row"] >= 0 and q["column"] >= 0
                w, s, e, n = q["bounds"]
                near = lambda a, b: abs(a - b) < 1e-6  # noqa: E731
                assert near(e - w, res) and near(n - s, res), (q["id"], e - w, n - s)
                assert near(q["center"][0], (w + e) / 2) and near(q["center"][1], (s + n) / 2)
                assert e > STUDY[0] and w < STUDY[2] and n > STUDY[1] and s < STUDY[3]
                fr = q["fractionInside"]
                assert fr is None or (fin(fr) and 0 < fr <= 1)
                ring = f["geometry"]["coordinates"][0]
                assert f["geometry"]["type"] == "Polygon" and len(f["geometry"]["coordinates"]) == 1 and len(ring) == 5
                assert near(ring[0][0], ring[4][0]) and near(ring[0][1], ring[4][1])
                for c in ([w, s], [e, s], [e, n], [w, n]):
                    assert any(near(c[0], r[0]) and near(c[1], r[1]) for r in ring[:4])
                for i in range(4):
                    a, b = ring[i], ring[(i + 1) % 4]
                    assert near(a[0], b[0]) or near(a[1], b[1])
                if q["summary"] is not None:
                    sm = q["summary"]
                    assert sm["metadata"]["demonstrative"] is False
                    check_trend({**sm, "regionId": q["id"],
                                 "series": [{"year": y, "value": None} for y in range(p["start"], p["end"] + 1)]},
                                q["id"], ind, p["start"], p["end"])
                n_cells += 1
            # amostra de séries (todas existem; checa conteúdo de 300)
            for f in fc["features"]:
                path = out / "grids" / g["id"] / "series" / f["properties"]["id"] / ind / f"{p['start']}-{p['end']}.json"
                assert path.exists(), path
            for f in random.Random(0).sample(fc["features"], min(300, len(fc["features"]))):
                cid = f["properties"]["id"]
                d = json.loads((out / "grids" / g["id"] / "series" / cid / ind / f"{p['start']}-{p['end']}.json")
                               .read_text(encoding="utf-8"))
                assert d["gridId"] == g["id"] and d["revision"] == g["revision"] and d["cellId"] == cid
                assert d["metadata"]["demonstrative"] is False
                stats = d["statistics"] or {"slopePerDecade": None, "pValue": None, "tau": None,
                                            "confidenceInterval95": None, "direction": "inconclusive",
                                            "status": "insufficient", "method": "x"}
                check_trend({**d, "regionId": cid, "statistics": stats}, cid, ind, p["start"], p["end"])
                n_series += 1
    for rdir in (out / "regions").iterdir():
        if not rdir.is_dir():
            continue
        for ind_dir in rdir.iterdir():
            d = json.loads((ind_dir / "2001-2024.json").read_text(encoding="utf-8"))
            check_trend(d, rdir.name, ind_dir.name, 2001, 2024)
            n_regions += 1
    regions = json.loads((out / "regions" / "south-intermediate-regions.geojson").read_text(encoding="utf-8"))
    assert len(regions["features"]) == 21
    assert len({f["properties"]["id"] for f in regions["features"]}) == 21
    print(f"ok: {n_cells} células, {n_series} séries amostradas, {n_regions} arquivos de região válidos")


if __name__ == "__main__":
    main()
