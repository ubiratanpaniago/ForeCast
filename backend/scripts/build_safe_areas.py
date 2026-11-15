"""Mapa de áreas suscetíveis a alagamento e de áreas seguras (candidatas a pontos de auxílio), em ~30 m,
para Porto Alegre e o Vale do Taquari, validado com a enchente de maio de 2024.

Fontes (todas abertas, sem login):
  HAND 30 m      GLO-30 HAND (ASF, a partir do Copernicus DEM)  s3://glo-30-hand  (AWS Open Data)
  Elevação 30 m  Copernicus DEM GLO-30 (ESA)                    Microsoft Planetary Computer
  Uso do solo    ESA WorldCover 10 m 2021 v200                  Microsoft Planetary Computer
  Água em 2024   Sentinel-1 RTC (radar, VV), 11/05/2024         Microsoft Planetary Computer

HAND (Height Above Nearest Drainage) = altura do terreno acima do curso d'água mais próximo para onde ele
drena. É o indicador clássico de suscetibilidade a alagamento.

Classes (limites usuais da literatura de HAND, conferidos na validação):
  1 suscetível      HAND < 5 m
  2 intermediária   5 m <= HAND < 15 m
  3 segura          HAND >= 15 m
  4 água permanente (WorldCover classe 80)
Candidato a ponto de auxílio: segura + declividade < 8° + uso urbano/campo/lavoura/solo exposto
  + a até 3 km de área URBANA suscetível (onde estão as pessoas a atender).

Validação: água no radar em 11/05/2024 (limiar de Otsu em VV dB) menos água permanente = área alagada
observada; comparada com as classes do HAND (precisão, recall, F1 por limiar).
Limitação conhecida: o radar subestima alagamento em área urbana densa (reflexão dupla nos prédios).

Saídas:
  data/historical/safe_areas/<aoi>.json               estatísticas e validação
  frontend/public/data/safe-areas/<aoi>/meta.json     limites, legenda, pontos candidatos
  frontend/public/data/safe-areas/<aoi>/classes.png   camada de classes (para image source do MapLibre)
  frontend/public/data/safe-areas/<aoi>/flood_2024.png  alagamento observado em 11/05/2024
  frontend/public/data/safe-areas/<aoi>/sites.geojson pontos candidatos a auxílio

Uso:  python scripts/build_safe_areas.py [--aoi POA TAQ]
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import numpy as np
import planetary_computer as pc
import pystac_client
import rasterio
from PIL import Image
from rasterio.merge import merge
from rasterio.transform import from_origin
from rasterio.warp import Resampling, reproject
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
OUT_HIST = ROOT / "data" / "historical" / "safe_areas"
OUT_WEB = ROOT.parent / "frontend" / "public" / "data" / "safe-areas"
RES = 1 / 3600  # 1 arcsec, grade do Copernicus DEM / GLO-30 HAND

# flood_rise_m = quanto a água subiu acima do nível normal no evento de referência (maio de 2024):
#   Guaíba: pico de 5,35 m em 05/05/2024 no Gasômetro; cota de inundação 3 m
#     (https://www.agrolink.com.br/noticias/apos-recorde-de-5-35m--nivel-do-guaiba-cai-para-3-95m_491407.html)
#   Taquari em Lajeado: pico de ~33,4 m (33,35 m no Jornal do Comércio; 33,66 m citado pelo SGB), nível normal
#     13 m, cota de inundação 19 m -> ~20 m acima do normal
#     (https://www.jornaldocomercio.com/jornal-cidades/2024/05/1156244-mes-de-maio-ja-e-o-mais-chuvoso-da-historia-em-lajeado.html)
AOIS = {
    "POA": {"name": "Porto Alegre e região", "bbox": (-51.45, -30.25, -50.95, -29.65), "flood_rise_m": 5.0,
            "flood_ref": "Guaíba, pico de 5,35 m no Gasômetro em 05/05/2024; cota de inundação 3 m"},
    "TAQ": {"name": "Vale do Taquari", "bbox": (-52.15, -29.55, -51.75, -29.05), "flood_rise_m": 20.0,
            "flood_ref": "Taquari em Lajeado, pico de ~33,4 m em maio/2024 vs. 13 m normal"},
}
MAIN_WATER_MIN_KM2 = 1.0     # só rios/lagos grandes; descarta açudes
MAIN_WATER_MAX_DIST_M = 15_000
SAFE_MARGIN_M = 5.0          # margem acima da cheia de referência para considerar seguro
S1_DATE = "2024-05-11"
HAND_SUSC, HAND_SAFE = 5.0, 15.0
SLOPE_MAX = 8.0
SITE_RADIUS_M = 3000
SITE_MIN_HA = 5.0
MAX_SITES = 50
# Limiar de água no radar (VV, dB). O Otsu automático falhou no Taquari (-7,6 dB) porque a água é uma
# fração pequena da cena. Calibrado com a água permanente da própria imagem: mediana -19,6 dB (POA),
# e menos de 5 % da terra seca fica abaixo de -18 dB.
VV_WATER_DB = -18.0
WC_WATER, WC_BUILT = 80, 50
WC_USABLE = {30, 40, 50, 60}   # campo, lavoura, urbano, solo exposto
WC_NAMES = {10: "floresta", 20: "arbustos", 30: "campo", 40: "lavoura", 50: "urbano", 60: "solo exposto",
            70: "neve", 80: "água", 90: "área úmida", 95: "mangue", 100: "musgo"}

PALETTE = {  # RGBA
    1: (215, 48, 31, 170),    # suscetível
    2: (253, 174, 97, 90),    # intermediária
    3: (0, 0, 0, 0),          # segura (transparente; destaque fica para os candidatos)
    4: (43, 140, 190, 140),   # água permanente
    5: (26, 152, 80, 230),    # candidato a auxílio
    6: (244, 165, 130, 110),  # baixada de arroio (HAND < 5 m, fora da cheia do rio principal)
}


def catalog():
    return pystac_client.Client.open("https://planetarycomputer.microsoft.com/api/stac/v1",
                                     modifier=pc.sign_inplace)


def grid(bbox):
    w, s, e, n = bbox
    width, height = round((e - w) / RES), round((n - s) / RES)
    return from_origin(w, n, RES, RES), height, width


def hand_tiles(bbox):
    w, s, e, n = bbox
    urls = []
    for lat in range(math.floor(s), math.ceil(n)):
        for lon in range(math.floor(w), math.ceil(e)):
            ns = f"S{abs(lat):02d}" if lat < 0 else f"N{lat:02d}"
            ew = f"W{abs(lon):03d}" if lon < 0 else f"E{lon:03d}"
            urls.append(f"/vsicurl/https://glo-30-hand.s3.amazonaws.com/v1/2021/"
                        f"Copernicus_DSM_COG_10_{ns}_00_{ew}_00_HAND.tif")
    return urls


def mosaic(hrefs, bbox, nodata=np.nan):
    dss = [rasterio.open(h) for h in hrefs]
    arr, _ = merge(dss, bounds=bbox, res=RES, nodata=nodata, resampling=Resampling.nearest)
    for d in dss:
        d.close()
    return arr[0].astype("float32")


def warp_items(hrefs, transform, shape, resampling, dtype="float32", nodata=np.nan):
    dst = np.full(shape, nodata, dtype=dtype)
    for h in hrefs:
        tmp = np.full(shape, nodata, dtype=dtype)
        with rasterio.open(h) as src:
            reproject(rasterio.band(src, 1), tmp, dst_transform=transform, dst_crs="EPSG:4326",
                      resampling=resampling, src_nodata=src.nodata, dst_nodata=nodata)
        fill = np.isnan(dst) if np.isnan(nodata) else (dst == nodata)
        dst[fill] = tmp[fill]
    return dst


def otsu(x: np.ndarray) -> float:
    hist, edges = np.histogram(x, bins=256)
    p = hist / hist.sum()
    centers = (edges[:-1] + edges[1:]) / 2
    w0 = np.cumsum(p)
    m0 = np.cumsum(p * centers)
    mt = m0[-1]
    with np.errstate(invalid="ignore", divide="ignore"):
        var = (mt * w0 - m0) ** 2 / (w0 * (1 - w0))
    return float(centers[np.nanargmax(var)])


def to_png(rgba: np.ndarray, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba, "RGBA").save(path, optimize=True)


def build(aoi_id: str, cfg: dict, cat) -> dict:
    bbox = cfg["bbox"]
    transform, h, w = grid(bbox)
    shape = (h, w)
    print(f"[{aoi_id}] grade {h}×{w} (~30 m)")

    hand = mosaic(hand_tiles(bbox), bbox)
    dem_items = list(cat.search(collections=["cop-dem-glo-30"], bbox=list(bbox)).items())
    dem = mosaic([i.assets["data"].href for i in dem_items], bbox)
    hand, dem = hand[:h, :w], dem[:h, :w]

    wc_items = [i for i in cat.search(collections=["esa-worldcover"], bbox=list(bbox)).items()
                if i.properties.get("esa_worldcover:product_version") == "2.0.0"]
    wc = warp_items([i.assets["map"].href for i in wc_items], transform, shape, Resampling.mode,
                    dtype="uint8", nodata=0)

    s1_items = list(cat.search(collections=["sentinel-1-rtc"], bbox=list(bbox), datetime=S1_DATE).items())
    vv = warp_items([i.assets["vv"].href for i in s1_items], transform, shape, Resampling.average)
    with np.errstate(divide="ignore", invalid="ignore"):
        vv_db = 10 * np.log10(vv)
    valid_s1 = np.isfinite(vv_db)
    thr = VV_WATER_DB
    otsu_thr = otsu(np.clip(vv_db[valid_s1], -30, 5))   # registrado só para referência
    water_s1 = valid_s1 & (vv_db < thr)

    # declividade (graus)
    lat_c = transform.f - (np.arange(h) + 0.5) * RES
    dy = RES * 111_320.0
    dx = RES * 111_320.0 * np.cos(np.deg2rad(lat_c))[:, None]
    gy, gx = np.gradient(np.where(np.isfinite(dem), dem, 0.0))
    slope = np.degrees(np.arctan(np.hypot(gx / dx, gy / dy)))

    perm_water = wc == WC_WATER
    valid = np.isfinite(hand) & (wc > 0)
    px_m = (dy, float(np.mean(dx)))
    px_ha = px_m[0] * px_m[1] / 10_000

    # altura acima do rio/lago PRINCIPAL mais próximo (o HAND usa qualquer arroio, o que subestima
    # cheias de rio grande como a do Taquari, onde a água sobe ~20 m)
    wlab, nw = ndimage.label(perm_water, structure=np.ones((3, 3)))
    wsize = ndimage.sum(perm_water, wlab, index=np.arange(1, nw + 1)) * px_ha / 100
    main_water = np.isin(wlab, np.nonzero(wsize >= MAIN_WATER_MIN_KM2)[0] + 1)
    dist_w, (ii, jj) = ndimage.distance_transform_edt(~main_water, sampling=px_m, return_indices=True)
    hapw = dem - dem[ii, jj]
    hapw[dist_w > MAIN_WATER_MAX_DIST_M] = np.nan
    rise = cfg["flood_rise_m"]

    cls = np.zeros(shape, dtype="uint8")
    river_susc = valid & np.isfinite(hapw) & (hapw < rise)
    local_low = valid & ~river_susc & (hand < HAND_SUSC)
    safe = valid & (hand >= HAND_SAFE) & ~(np.isfinite(hapw) & (hapw < rise + SAFE_MARGIN_M))
    cls[valid] = 2                      # intermediária
    cls[local_low] = 6                  # baixada de arroio (HAND < 5 m)
    cls[safe] = 3
    cls[river_susc] = 1                 # suscetível à cheia do rio principal
    cls[perm_water] = 4

    # candidatos: seguros, planos, uso acessível, perto de área urbana suscetível
    urban_susc = (cls == 1) & (wc == WC_BUILT)
    dist_urban = ndimage.distance_transform_edt(~urban_susc, sampling=px_m)
    usable = np.isin(wc, list(WC_USABLE))
    cand = (cls == 3) & (slope < SLOPE_MAX) & usable & (dist_urban <= SITE_RADIUS_M)
    cls_vis = cls.copy()
    cls_vis[cand] = 5

    # pontos candidatos: componentes conectados >= SITE_MIN_HA
    lab, n = ndimage.label(cand, structure=np.ones((3, 3)))
    sizes = ndimage.sum(cand, lab, index=np.arange(1, n + 1)) * px_ha
    keep = np.nonzero(sizes >= SITE_MIN_HA)[0] + 1
    sites = []
    if len(keep):
        cent = ndimage.center_of_mass(cand, lab, keep)
        for k, (ci, cj) in zip(keep, cent):
            m = lab == k
            vals, cnt = np.unique(wc[m], return_counts=True)
            sites.append({
                "lat": round(float(transform.f - (ci + 0.5) * RES), 5),
                "lon": round(float(transform.c + (cj + 0.5) * RES), 5),
                "area_ha": round(float(sizes[k - 1]), 1),
                "hand_mean_m": round(float(np.nanmean(hand[m])), 1),
                "height_above_main_water_m": None if not np.isfinite(hapw[m]).any()
                else round(float(np.nanmean(hapw[m])), 1),
                "slope_mean_deg": round(float(np.mean(slope[m])), 1),
                "dist_to_flood_prone_urban_m": round(float(np.min(dist_urban[m]))),
                "landcover": WC_NAMES.get(int(vals[np.argmax(cnt)]), "outro"),
            })
    sites.sort(key=lambda s: -s["area_ha"])
    n_sites_total = len(sites)
    sites = sites[:MAX_SITES]

    # validação com o alagamento observado
    observed = water_s1 & ~perm_water & valid
    eval_mask = valid & valid_s1 & ~perm_water
    curve = []
    for t in [1, 2, 3, 5, 7, 10, 15, 20, 25]:
        pred = eval_mask & np.isfinite(hapw) & (hapw < t)
        tp = int((pred & observed).sum())
        prec = tp / max(int(pred.sum()), 1)
        rec = tp / max(int((observed & eval_mask).sum()), 1)
        f1 = 2 * prec * rec / max(prec + rec, 1e-9)
        curve.append({"height_above_main_water_threshold_m": t, "precision": round(prec, 3), "recall": round(rec, 3), "f1": round(f1, 3)})
    obs_by_class = {
        name: round(float((observed & (cls == c)).sum() / max(int(observed.sum()), 1)), 3)
        for c, name in ((1, "suscetivel"), (6, "baixada_local"), (2, "intermediaria"), (3, "segura"))
    }
    flooded_in_safe_class = round(float((observed & (cls == 3)).sum() / max(int((eval_mask & (cls == 3)).sum()), 1)), 4)

    area = lambda m: round(float(m.sum()) * px_ha / 100, 1)  # noqa: E731  km²
    stats = {
        "aoi": aoi_id, "name": cfg["name"], "bbox": bbox, "pixel_m": [round(px_m[0], 1), round(px_m[1], 1)],
        "reference_flood": {"rise_m": rise, "source": cfg["flood_ref"], "safe_margin_m": SAFE_MARGIN_M},
        "area_km2": {"suscetivel": area(cls == 1), "baixada_local": area(cls == 6),
                     "intermediaria": area(cls == 2), "segura": area(cls == 3),
                     "agua_permanente": area(perm_water), "urbano_suscetivel": area(urban_susc),
                     "candidatos_auxilio": area(cand), "alagado_observado_2024_05_11": area(observed),
                     "urbano_alagado_observado": area(observed & (wc == WC_BUILT))},
        "s1": {"date": S1_DATE, "items": [i.id for i in s1_items], "water_threshold_vv_db": thr,
               "otsu_reference_db": round(otsu_thr, 2),
               "permanent_water_vv_db_median": round(float(np.nanmedian(vv_db[valid_s1 & perm_water])), 1),
               "coverage": round(float(valid_s1.mean()), 3)},
        "validation": {"curve": curve, "observed_flood_share_by_class": obs_by_class,
                       "share_of_safe_class_observed_flooded": flooded_in_safe_class},
        "n_sites": n_sites_total, "n_sites_listed": len(sites),
    }

    # ---------------- saídas ----------------
    web = OUT_WEB / aoi_id
    rgba = np.zeros((h, w, 4), dtype="uint8")
    for c, col in PALETTE.items():
        rgba[cls_vis == c] = col
    to_png(rgba, web / "classes.png")
    fl = np.zeros((h, w, 4), dtype="uint8")
    fl[observed] = (8, 81, 156, 200)
    to_png(fl, web / "flood_2024.png")
    w_, s_, e_, n_ = transform.c, transform.f - h * RES, transform.c + w * RES, transform.f
    corners = [[w_, n_], [e_, n_], [e_, s_], [w_, s_]]   # ordem do MapLibre image source
    (web / "sites.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": [
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [s["lon"], s["lat"]]}, "properties": s}
        for s in sites]}, ensure_ascii=False), encoding="utf-8")
    (web / "meta.json").write_text(json.dumps({
        "aoi": aoi_id, "name": cfg["name"], "coordinates": corners,
        "layers": {"classes": "classes.png", "flood_2024": "flood_2024.png", "sites": "sites.geojson"},
        "legend": [
            {"class": 1, "label": f"Suscetível à cheia do rio/lago principal (até {rise:.0f} m acima do nível normal)",
             "rgba": PALETTE[1]},
            {"class": 6, "label": "Baixada de arroio (HAND < 5 m)", "rgba": PALETTE[6]},
            {"class": 2, "label": "Intermediária", "rgba": PALETTE[2]},
            {"class": 4, "label": "Água permanente", "rgba": PALETTE[4]},
            {"class": 5, "label": "Área segura candidata a ponto de auxílio", "rgba": PALETTE[5]},
        ],
        "flood_2024_legend": {"label": f"Alagamento observado por radar em {S1_DATE}", "rgba": [8, 81, 156, 200]},
        "notes": [
            "HAND: GLO-30 HAND (ASF, Copernicus DEM). Uso do solo: ESA WorldCover 2021. Radar: Sentinel-1 RTC.",
            f"Suscetível = até {rise:.0f} m acima do rio/lago principal mais próximo ({cfg['flood_ref']}).",
            f"Candidatos = HAND >= 15 m, mais de {rise + SAFE_MARGIN_M:.0f} m acima do rio principal, declividade < 8°, "
            "uso urbano/campo/lavoura, a até 3 km de área urbana suscetível. É apoio à decisão: acesso viário, "
            "população e Defesa Civil definem o local real.",
            "O radar subestima alagamento em área urbana densa; a validação é conservadora.",
        ],
        "stats": stats,
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    OUT_HIST.mkdir(parents=True, exist_ok=True)
    (OUT_HIST / f"{aoi_id}.json").write_text(json.dumps({**stats, "sites": sites}, ensure_ascii=False, indent=1),
                                             encoding="utf-8")
    best = max(curve, key=lambda c: c["f1"])
    print(f"[{aoi_id}] áreas km²: {stats['area_km2']}")
    print(f"[{aoi_id}] alagado observado por classe: {obs_by_class}; "
          f"fração da classe segura alagada: {flooded_in_safe_class}; "
          f"melhor F1 {best['f1']} em altura<{best['height_above_main_water_threshold_m']} m; "
          f"candidatos {n_sites_total}")
    print(f"[{aoi_id}] curva: {curve}")
    return stats


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--aoi", nargs="*", default=list(AOIS))
    args = ap.parse_args()
    cat = catalog()
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", GDAL_HTTP_MULTIPLEX="YES",
                      AWS_NO_SIGN_REQUEST="YES"):
        for a in args.aoi:
            build(a, AOIS[a], cat)


if __name__ == "__main__":
    main()
