"""Camada de suscetibilidade do relevo a partir do NASADEM (NASA), via Microsoft Planetary Computer.

Ideia: enchentes acontecem em áreas planas e baixas EM RELAÇÃO AO RIO/VALE mais próximo,
não necessariamente baixas em relação ao nível do mar. Sem tempo para calcular o HAND
(Height Above Nearest Drainage) completo, usamos um aproximador:

  altura relativa = elevação - menor elevação num raio de ~7 km  (fundo de vale local)
  pixel suscetível = altura relativa < REL_MAX_M  e  declividade < SLOPE_MAX_DEG

Para cada célula de 0,1° (mesma grade do IMERG) calculamos a FRAÇÃO de terra suscetível.

Saídas:
  data/terrain/nasadem_8arcsec.npz      mosaico de elevação (cache local, não versionar)
  data/historical/terrain.json          grade 0,1° com elevação, declividade e suscetibilidade

Uso:  python scripts/build_terrain.py
"""
from __future__ import annotations

import json
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
import planetary_computer as pc
import pystac_client
import rasterio
import shapely
from rasterio.merge import merge
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "data" / "terrain" / "nasadem_8arcsec.npz"
OUT = ROOT / "data" / "historical" / "terrain.json"
REGIONS_FILE = ROOT / "data" / "regions.geojson"

BBOX = (-58.0, -34.0, -47.0, -22.0)        # oeste, sul, leste, norte
OVERVIEW_LEVEL = 2                          # pirâmide 1/8 -> 8 arcsec (~240 m)
RES = 8 / 3600
CELL = 0.1                                  # grade do IMERG
WINDOW_PX = 61                              # ~14 km de lado (raio ~7 km)
REL_MAX_M = 15.0
SLOPE_MAX_DEG = 3.0
# classes fixas (fração da terra da célula que é planície baixa); tercis não funcionam
# porque ~40 % das células têm fração zero
CLASS_MEDIUM = 0.02
CLASS_HIGH = 0.15
MIN_LAND = 0.10                             # mantém células costeiras como Porto Alegre
WATER_MAX_M = 0.5                           # superfícies d'água ficam ~0 m no NASADEM


def fetch_mosaic() -> tuple[np.ndarray, rasterio.Affine]:
    if CACHE.exists():
        z = np.load(CACHE)
        return z["elev"], rasterio.Affine(*z["transform"])
    cat = pystac_client.Client.open("https://planetarycomputer.microsoft.com/api/stac/v1", modifier=pc.sign_inplace)
    items = list(cat.search(collections=["nasadem"], bbox=list(BBOX)).items())
    print(f"{len(items)} tiles NASADEM")

    def _open(it):
        return rasterio.open(it.assets["elevation"].href, overview_level=OVERVIEW_LEVEL)

    t0 = time.time()
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", GDAL_HTTP_MULTIPLEX="YES"):
        with ThreadPoolExecutor(8) as ex:
            dss = list(ex.map(_open, items))
        arr, transform = merge(dss, bounds=BBOX, res=RES, nodata=-32768)
        for d in dss:
            d.close()
    elev = arr[0].astype("float32")
    elev[elev == -32768] = np.nan
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(CACHE, elev=elev, transform=np.array(transform)[:6])
    print(f"mosaico {elev.shape} em {time.time() - t0:.0f}s")
    return elev, transform


def main() -> None:
    elev, tr = fetch_mosaic()
    nrow, ncol = elev.shape
    lats = tr.f + (np.arange(nrow) + 0.5) * tr.e          # centro dos pixels (norte -> sul)
    lons = tr.c + (np.arange(ncol) + 0.5) * tr.a

    water = ~np.isfinite(elev) | (elev <= WATER_MAX_M)
    e = np.where(water, np.nan, elev)

    # declividade (graus) com espaçamento em metros
    dy = abs(tr.e) * 111_320.0
    dx = tr.a * 111_320.0 * np.cos(np.deg2rad(lats))[:, None]
    filled = np.where(np.isfinite(e), e, 0.0)
    gy, gx = np.gradient(filled)
    slope = np.degrees(np.arctan(np.hypot(gx / dx, gy / dy)))

    # altura relativa ao fundo de vale local
    big = np.where(np.isfinite(e), e, 1e6)
    local_min = ndimage.minimum_filter(big, size=WINDOW_PX, mode="nearest")
    rel = e - local_min

    suscept = (rel < REL_MAX_M) & (slope < SLOPE_MAX_DEG) & ~water
    land = ~water

    # agrega para a grade de 0,1° alinhada ao IMERG (centros em -33.95 ... -22.05)
    f = int(round(CELL / RES))                                # 45 pixels por célula
    nr, nc = nrow // f, ncol // f

    def block(a, fn):
        return fn(a[: nr * f, : nc * f].reshape(nr, f, nc, f), axis=(1, 3))

    land_frac = block(land.astype("float32"), np.mean)
    with np.errstate(invalid="ignore", divide="ignore"):
        sus_frac = block(suscept.astype("float32"), np.sum) / block(land.astype("float32"), np.sum)
        elev_mean = block(np.where(land, elev, 0.0), np.sum) / block(land.astype("float32"), np.sum)
        slope_mean = block(np.where(land, slope, 0.0), np.sum) / block(land.astype("float32"), np.sum)
    cell_lat = tr.f + (np.arange(nr) + 0.5) * CELL * np.sign(tr.e)
    cell_lon = tr.c + (np.arange(nc) + 0.5) * CELL

    # ordena sul -> norte para casar com o IMERG
    order = np.argsort(cell_lat)
    cell_lat = cell_lat[order]
    land_frac, sus_frac, elev_mean, slope_mean = (a[order] for a in (land_frac, sus_frac, elev_mean, slope_mean))

    # células fora dos 3 estados ou quase só água ficam nulas
    fc = json.loads(REGIONS_FILE.read_text(encoding="utf-8"))
    union = shapely.union_all([shapely.geometry.shape(ft["geometry"]) for ft in fc["features"]])
    lon2, lat2 = np.meshgrid(cell_lon, cell_lat)
    inside = shapely.contains_xy(union, lon2, lat2)
    valid = inside & (land_frac >= MIN_LAND)
    for a in (sus_frac, elev_mean, slope_mean):
        a[~valid] = np.nan

    t1, t2 = CLASS_MEDIUM, CLASS_HIGH
    cls = np.full(sus_frac.shape, np.nan)
    cls[valid] = np.where(sus_frac[valid] >= t2, 3, np.where(sus_frac[valid] >= t1, 2, 1))

    def g(a, nd):
        return [[None if not np.isfinite(x) else round(float(x), nd) for x in row] for row in a]

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "source": "NASA NASADEM (SRTM reprocessado), lido via Microsoft Planetary Computer a ~240 m",
        "method": (f"Fração de terra de cada célula de {CELL}° com altura relativa ao fundo de vale local "
                   f"(janela de ~{WINDOW_PX * RES * 111:.0f} km) < {REL_MAX_M:.0f} m e declividade < {SLOPE_MAX_DEG:.0f}°. "
                   "Aproximação do HAND; não é um mapa de inundação."),
        "lat": [round(float(x), 4) for x in cell_lat],
        "lon": [round(float(x), 4) for x in cell_lon],
        "resolution_deg": CELL,
        "susceptible_fraction": g(sus_frac, 3),
        "susceptibility_class": g(cls, 0),
        "class_thresholds": {"medium_from": round(float(t1), 3), "high_from": round(float(t2), 3),
                             "labels": {"1": "baixa", "2": "média", "3": "alta"}},
        "elevation_mean_m": g(elev_mean, 0),
        "slope_mean_deg": g(slope_mean, 2),
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    counts = {k: int((cls == k).sum()) for k in (1, 2, 3)}
    print(f"ok -> {OUT}  células válidas: {int(valid.sum())}  baixa/média/alta: {counts}")


if __name__ == "__main__":
    main()
