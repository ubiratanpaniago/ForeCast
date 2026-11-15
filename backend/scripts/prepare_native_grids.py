"""Derive independent native grids from verified, already-subset NASA granules.

No network or credentials are needed. Existing outputs are checked, never replaced.
"""
import argparse
import calendar
import hashlib
import json
from pathlib import Path

import numpy as np
import xarray as xr
from pyproj import Geod
from shapely.geometry import box, shape
from shapely.ops import unary_union
from shapely.geometry.polygon import orient

ROOT = Path(__file__).resolve().parents[1]
YEARS = list(range(2001, 2025))
PERIOD = {"start": 2001, "end": 2024}
ALGORITHM = "native-monthly-v1"
PRODUCTS = (
    dict(id="imerg-monthly-v07", folder="imerg_monthly", name="IMERG Final mensal",
         productId="GPM_3IMERGM_07", version="07B", resolutionDegrees=0.1,
         indicator="PRCP_ANNUAL", variable="precipitation", sourceUnit="mm/hr",
         unit="mm", sourceDOI="10.5067/GPM/IMERG/3B-MONTH/07", latOrigin=-90),
    dict(id="gldas-noah-monthly-v21", folder="gldas_monthly", name="GLDAS Noah mensal",
         productId="GLDAS_NOAH025_M_2.1", version="2.1", resolutionDegrees=0.25,
         indicator="SOIL_SURFACE", variable="SoilMoi0_10cm_inst", sourceUnit="kg m-2",
         unit="kg/m²", sourceDOI="10.5067/SXAVCZFAQLNO", latOrigin=-60),
)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def encode(data):
    return json.dumps(data, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode("utf-8")


def write_checked(path, data):
    payload = encode(data)
    if path.exists():
        if path.read_bytes() != payload:
            raise ValueError(f"Output already exists with different content: {path}")
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive creation prevents an accidental overwrite by simultaneous runs.
    with path.open("xb") as stream:
        stream.write(payload)


def annual_values(monthly, years, soil=False):
    """Require twelve valid months; retain incomplete years as missing."""
    annual, coverage = [], []
    for year in years:
        values = monthly[(year - 2001) * 12:(year - 2001 + 1) * 12]
        counts = np.isfinite(values).sum(axis=0)
        days = np.array([calendar.monthrange(year, m)[1] for m in range(1, 13)])
        if soil:
            result = np.sum(values * days[:, None], axis=0) / days.sum()
        else:
            result = np.sum(values * (days * 24)[:, None], axis=0)
        annual.append(np.where(counts == 12, result, np.nan))
        coverage.append(counts)
    return np.stack(annual), np.stack(coverage)


def geometry_area(geom, geod):
    if geom.is_empty:
        return 0.0
    if geom.geom_type == "Polygon":
        return abs(geod.geometry_area_perimeter(orient(geom, sign=1.0))[0])
    return sum(geometry_area(g, geod) for g in geom.geoms)


def prepare(raw_root, output, mask_path, product):
    folder = raw_root / product["folder"]
    manifest_bytes = (folder / "manifest.jsonl").read_bytes()
    spec_bytes = (folder / "grid_spec.json").read_bytes()
    records = [json.loads(line) for line in manifest_bytes.splitlines() if line.strip()]
    records.sort(key=lambda r: r["time_start"])
    expected = [f"{y}-{m:02d}" for y in YEARS for m in range(1, 13)]
    if [r["time_start"][:7] for r in records] != expected:
        raise ValueError("Expected exactly one source granule for each month in 2001–2024")
    mask_bytes = mask_path.read_bytes()
    features = json.loads(mask_bytes)["features"]
    if {str(f["properties"]["id"]) for f in features} != {"41", "42", "43"}:
        raise ValueError("Mask must contain precisely the three official state IDs")
    mask = unary_union([shape(f["geometry"]) for f in features])
    if not mask.is_valid:
        raise ValueError("Invalid state boundary geometry")
    spec = json.loads(spec_bytes)
    revision = digest(encode({"algorithm": ALGORITHM, "manifest": digest(manifest_bytes),
                             "spec": digest(spec_bytes), "mask": digest(mask_bytes), "product": product}))[:20]
    geod = Geod(ellps="WGS84")
    selected, cells, monthly = [], [], []
    lat_ref = lon_ref = None
    quality_missing = 0
    for index, record in enumerate(records):
        path = (raw_root / record["file"]).resolve()
        if not path.is_relative_to(folder.resolve()):
            raise ValueError("Manifest file outside product directory")
        if digest(path.read_bytes()) != record["sha256"]:
            raise ValueError(f"Source checksum mismatch: {path.name}")
        group = "Grid" if product["indicator"] == "PRCP_ANNUAL" else None
        with xr.open_dataset(path, group=group, engine="netcdf4") as ds:
            variable = ds[product["variable"]]
            if variable.attrs.get("units") != product["sourceUnit"]:
                raise ValueError(f"Unexpected source unit: {variable.attrs.get('units')}")
            # Check the actual granule timestamp as well as the manifest.
            if str(ds.time.values[0])[:7] != record["time_start"][:7]:
                raise ValueError("Granule and manifest timestamps differ")
            lat, lon = ds.lat.values, ds.lon.values
            res = product["resolutionDegrees"]
            if index == 0:
                lat_ref, lon_ref = lat.copy(), lon.copy()
                rows = np.arange(spec["lat_slice"][0], spec["lat_slice"][1] + 1)
                cols = np.arange(spec["lon_slice"][0], spec["lon_slice"][1] + 1)
                if not (len(rows) == len(lat) and len(cols) == len(lon)
                        and np.allclose(lat, product["latOrigin"] + (rows + .5)*res, atol=1e-5, rtol=0)
                        and np.allclose(lon, -180 + (cols + .5)*res, atol=1e-5, rtol=0)):
                    raise ValueError("Coordinates do not match the native global grid indices")
                for iy, row in enumerate(rows):
                    for ix, col in enumerate(cols):
                        w = round(-180 + int(col)*res, 6)
                        s = round(product["latOrigin"] + int(row)*res, 6)
                        e, n = round(w + res, 6), round(s + res, 6)
                        rectangle = box(w, s, e, n)
                        intersect = rectangle.intersection(mask)
                        area = geometry_area(intersect, geod)
                        if area <= 0:
                            continue
                        selected.append((iy, ix))
                        cell_id = f"{product['id']}:r{row}:c{col}"
                        cells.append({"type": "Feature", "id": cell_id,
                                      "properties": {"id": cell_id, "gridId": product["id"], "row": int(row),
                                                     "column": int(col), "center": [round((w+e)/2, 6), round((s+n)/2, 6)],
                                                     "bounds": [w,s,e,n], "fractionInside": round(min(1, area/geometry_area(rectangle, geod)), 10),
                                                     "summary": None},
                                      "geometry": {"type": "Polygon", "coordinates": [[[w,s],[e,s],[e,n],[w,n],[w,s]]]}})
            elif not (np.array_equal(lat, lat_ref) and np.array_equal(lon, lon_ref)):
                raise ValueError("Native coordinates changed between granules")
            data = variable.isel(time=0).transpose("lat", "lon").values.astype(float)
            data[~np.isfinite(data) | (data < 0)] = np.nan
            if group:
                quality = ds["precipitationQualityIndex"].isel(time=0).transpose("lat", "lon").values
                invalid = ~np.isfinite(quality) | (quality < 0)
                quality_missing += int(invalid[tuple(np.array(selected).T)].sum())
                data[invalid] = np.nan
            monthly.append(data[tuple(np.array(selected).T)])
        if (index + 1) % 24 == 0:
            print(f"{product['id']}: {index+1}/288 verified months", flush=True)
    annual, coverage = annual_values(np.stack(monthly), YEARS, soil=product["indicator"] == "SOIL_SURFACE")
    notes = ["Dados reais; arquivos raw validados por SHA-256 antes da conversão.",
             "Ano disponível somente com 12 meses válidos; lacunas permanecem null.",
             "Seleção por interseção com PR/SC/RS (IBGE, malha simplificada); células nativas inteiras, sem interpolação.",
             "Fração de interseção por área geodésica WGS84; não é peso aplicado à série da célula.",
             "Análise estatística ainda não produzida; séries anuais não representam risco de inundação."]
    notes.append("Taxa mensal mm/hr × horas reais do mês; acumulado anual em mm. Índice de qualidade ausente/inválido excluído; nenhum limiar adicional imposto."
                 if group else "Média anual de SoilMoi0_10cm_inst ponderada pelos dias dos meses; kg/m². Umidade simulada, não observação direta.")
    metadata = {k: product[k] for k in ("unit", "productId", "version", "sourceDOI")}
    metadata.update(qualityNotes=notes, demonstrative=False)
    series = {f["id"]: {"values": [None if not np.isfinite(v) else round(float(v), 6) for v in annual[:, i]],
                          "validMonths": coverage[:, i].tolist()} for i, f in enumerate(cells)}
    definition = {k: product[k] for k in ("id", "name", "productId", "version", "resolutionDegrees")}
    definition.update(crs="EPSG:4326", indicators=[product["indicator"]], period=PERIOD,
                      revision=revision, available=True, cellCount=len(cells))
    write_checked(output/product["id"]/"cells.geojson", {"type": "FeatureCollection", "features": cells})
    write_checked(output/product["id"]/"series.json", {"revision": revision, "years": YEARS, "metadata": metadata, "cells": series})
    write_checked(output/product["id"]/"provenance.json", {"algorithm": ALGORITHM, "revision": revision,
                  "sourceManifestSHA256": digest(manifest_bytes), "sourceGridSpecSHA256": digest(spec_bytes),
                  "stateMaskSHA256": digest(mask_bytes), "sourceGranules": len(records),
                  "invalidQualityCellMonths": quality_missing, "variable": product["variable"],
                  "sourceUnit": product["sourceUnit"], "unit": product["unit"], "validAnnualValues": int(np.isfinite(annual).sum()),
                  "missingAnnualValues": int((~np.isfinite(annual)).sum()), "cellCount": len(cells)})
    print(f"{product['id']}: {len(cells)} cells, {np.isfinite(annual).sum()} valid cell-years", flush=True)
    return definition


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw-root", type=Path, default=ROOT/"data/raw")
    parser.add_argument("--output", type=Path, default=ROOT/"data/derived/grids")
    parser.add_argument("--regions-file", type=Path, default=ROOT/"data/reference/south-regions.geojson")
    args = parser.parse_args()
    grids = [prepare(args.raw_root, args.output, args.regions_file, p) for p in PRODUCTS]
    grids.insert(1, {"id": "imerg-daily-v07", "name": "IMERG Final diário", "productId": "GPM_3IMERGDF_07", "version": "07",
                     "resolutionDegrees": .1, "crs": "EPSG:4326", "indicators": ["RX1DAY", "R50MM"], "period": PERIOD,
                     "revision": "not-produced", "available": False,
                     "unavailableReason": "Recorte diário 2001–2024 incompleto; extremos anuais ainda não processados."})
    write_checked(args.output/"catalog.json", {"grids": grids})


if __name__ == "__main__":
    main()
