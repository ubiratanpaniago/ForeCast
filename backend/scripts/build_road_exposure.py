"""Malha rodoviária de PR/SC/RS cruzada com a suscetibilidade preliminar do relevo (NASADEM).

Diagnóstico EXPLORATÓRIO de exposição: não é risco de interdição nem mapa de inundação.

Entradas
  * Rodovias: OpenStreetMap via Overpass API (ODbL), vias highway=motorway|trunk|primary|secondary
    com código oficial (ref) BR-xxx ou estadual (PR-, SC-; no RS, ERS- e RSC-). Resposta bruta em --cache.
  * Relevo: terrain.json de build_terrain.py (feat/nasa-data): classe de suscetibilidade por célula de
    0,1° (fração da terra com altura relativa ao fundo de vale < 15 m e declividade < 3°).
  * Regiões: data/derived/regions/regions.geojson (21 intermediárias do IBGE).

Método
  * Trecho = vias com o mesmo código principal dentro da mesma região intermediária (atribuição pelo
    ponto médio de cada via OSM). Ex.: "BR-101 · Joinville".
  * Extensão por classe: cada via é dividida em pedaços de ~100 m; o meio de cada pedaço recebe a classe
    da célula de 0,1° onde cai. Comprimento geodésico (haversine). Vias de mão única (pistas separadas
    de rodovias duplicadas) contam metade, para medir a extensão da rodovia e não a soma das pistas.
  * Travessia candidata: parte de um trecho dentro de uma célula de classe ALTA com pelo menos
    --min-crossing-km de extensão. Com células de ~10 km, isso aponta onde investigar, não o ponto exato.

Saída em data/derived/infrastructure/ (substituição atômica):
  roads.geojson       trechos (MultiLineString simplificada) com extensão por classe
  crossings.geojson   travessias candidatas (pontos)
  terrain.geojson     células de 0,1° com classe de suscetibilidade (somente terra)
  catalog.json        revisão, fontes, data da base OSM, parâmetros e limitações

Requer shapely. Uso:
  python scripts/build_road_exposure.py --terrain CAMINHO/terrain.json [--cache PASTA]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
import time
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

import shapely

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/derived/infrastructure'
REGIONS = ROOT / 'data/derived/regions/regions.geojson'
OVERPASS = 'https://overpass-api.de/api/interpreter'
UA = 'ForeCast-SpaceApps/0.1 (NASA Space Apps research prototype)'
CLASSES = {1: 'baixa', 2: 'media', 3: 'alta'}
# Prefixos estaduais oficiais: o RS usa ERS- (e RSC- em trechos coincidentes com BRs planejadas).
STATE_PREFIXES = {'PR': ('PR-',), 'SC': ('SC-',), 'RS': ('ERS-', 'RSC-', 'RS-')}
STEP_KM = 0.1


def fetch_state(uf: str, cache: Path) -> dict:
    path = cache / f'osm_roads_{uf}.json'
    if path.exists():
        return json.loads(path.read_text(encoding='utf-8'))
    prefixes = '|'.join(p.rstrip('-') for p in ('BR-',) + STATE_PREFIXES[uf])
    q = (f'[out:json][timeout:180];area["ISO3166-2"="BR-{uf}"]->.a;'
         f'way["highway"~"^(motorway|trunk|primary|secondary)$"]["ref"~"(^|;) ?({prefixes})-"](area.a);out tags geom;')
    req = urllib.request.Request(OVERPASS, data=urllib.parse.urlencode({'data': q}).encode(), headers={'User-Agent': UA})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                raw = r.read()
            break
        except Exception as e:  # Overpass limita a taxa; espera e tenta de novo
            print(f'  {uf}: tentativa {attempt + 1} falhou ({e}); aguardando')
            time.sleep(30 * (attempt + 1))
    else:
        raise SystemExit(f'Não foi possível baixar as rodovias de {uf}.')
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(raw)
    return json.loads(raw)


def haversine_km(a, b) -> float:
    lon1, lat1, lon2, lat2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 2 * 6371.0088 * math.asin(math.sqrt(h))


def main_ref(ref: str, uf: str) -> tuple[str, list[str]]:
    refs = [r.strip().replace(' ', '') for r in ref.split(';') if r.strip()]
    refs = [r for r in refs if r.startswith(('BR-',) + STATE_PREFIXES[uf])]
    federal = [r for r in refs if r.startswith('BR-')]
    return (federal or refs)[0], refs


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--terrain', type=Path, required=True)
    ap.add_argument('--cache', type=Path, default=ROOT / 'data/cache/osm_roads')  # não versionado (~40 MB)
    ap.add_argument('--terrain-ref', default='')
    ap.add_argument('--min-crossing-km', type=float, default=0.5)
    args = ap.parse_args()

    terrain = json.loads(args.terrain.read_text(encoding='utf-8'))
    lat0, lon0, res = terrain['lat'][0], terrain['lon'][0], terrain['resolution_deg']
    nlat, nlon = len(terrain['lat']), len(terrain['lon'])
    tclass = terrain['susceptibility_class']

    def cell_of(lon, lat):
        i = math.floor((lat - (lat0 - res / 2)) / res)
        j = math.floor((lon - (lon0 - res / 2)) / res)
        return (i, j) if 0 <= i < nlat and 0 <= j < nlon else None

    def class_of(cell):
        if cell is None:
            return None
        v = tclass[cell[0]][cell[1]]
        return int(v) if v is not None else None

    geo = json.loads(REGIONS.read_text(encoding='utf-8'))
    regions = {f['properties']['id']: (f['properties'], shapely.geometry.shape(f['geometry']))
               for f in geo['features'] if f['properties']['level'] == 'regiao_intermediaria'}
    for _, poly in regions.values():
        shapely.prepare(poly)

    def region_of(pt):
        for rid, (_, poly) in regions.items():
            if poly.contains(pt):
                return rid
        return min(regions, key=lambda rid: regions[rid][1].distance(pt))  # borda simplificada

    segs = defaultdict(lambda: {'lines': [], 'byClass': defaultdict(float), 'refs': set(), 'highway': set(),
                                'cells': defaultdict(lambda: [0.0, 0.0, 0.0, 0])})
    osm_base, n_ways = {}, 0
    for uf in ('PR', 'SC', 'RS'):
        data = fetch_state(uf, args.cache)
        osm_base[uf] = data.get('osm3s', {}).get('timestamp_osm_base')
        ways = [e for e in data['elements'] if e['type'] == 'way' and len(e.get('geometry', [])) > 1]
        print(f'{uf}: {len(ways)} vias OSM (base {osm_base[uf]})')
        n_ways += len(ways)
        for w in ways:
            coords = [(p['lon'], p['lat']) for p in w['geometry']]
            ref, refs = main_ref(w['tags']['ref'], uf)
            mid = shapely.LineString(coords).interpolate(0.5, normalized=True)
            rid = region_of(mid)
            s = segs[(ref, rid)]
            s['lines'].append(coords)
            s['refs'].update(refs)
            s['highway'].add(w['tags']['highway'])
            s['uf'] = uf
            # Pistas separadas aparecem como duas vias de mão única: cada uma conta metade, para que a
            # extensão seja de rodovia (eixo), não de pista.
            weight = 0.5 if w['tags'].get('oneway') in ('yes', '-1') else 1.0
            for a, b in zip(coords, coords[1:]):
                d = haversine_km(a, b) * weight
                n = max(1, math.ceil(d / STEP_KM))
                for k in range(n):
                    t = (k + 0.5) / n
                    lon, lat = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
                    cell = cell_of(lon, lat)
                    c = class_of(cell)
                    s['byClass'][CLASSES.get(c, 'sem_dado')] += d / n
                    if c == 3:
                        acc = s['cells'][cell]
                        acc[0] += d / n
                        acc[1] += lon * d / n
                        acc[2] += lat * d / n

    roads, crossings = [], []
    for (ref, rid), s in sorted(segs.items(), key=lambda kv: (kv[0][1], kv[0][0])):
        props, _ = regions[rid]
        sid = f'{ref}@{rid}'
        total = sum(s['byClass'].values())
        cands = []
        for (i, j), (km, lonw, latw, _) in s['cells'].items():
            if km < args.min_crossing_km:
                continue
            cid = f'{sid}#r{i}c{j}'
            cands.append(cid)
            crossings.append({'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [round(lonw / km, 5), round(latw / km, 5)]},
                              'properties': {'id': cid, 'segmentId': sid, 'ref': ref, 'regionId': rid,
                                             'regionName': props['name'], 'row': i, 'column': j,
                                             'lengthKm': round(km, 2),
                                             'susceptibleFraction': terrain['susceptible_fraction'][i][j],
                                             'elevationMeanM': terrain['elevation_mean_m'][i][j],
                                             'slopeMeanDeg': terrain['slope_mean_deg'][i][j]}})
        geom = shapely.MultiLineString(s['lines']).simplify(0.0003)
        geom = shapely.set_precision(geom, 1e-5)
        by_class = {k: round(s['byClass'].get(k, 0.0), 2) for k in ('alta', 'media', 'baixa', 'sem_dado')}
        roads.append({'type': 'Feature', 'geometry': shapely.geometry.mapping(geom),
                      'properties': {'id': sid, 'ref': ref, 'refs': sorted(s['refs']),
                                     'jurisdiction': 'federal' if ref.startswith('BR-') else 'estadual',
                                     'highway': sorted(s['highway']), 'uf': s['uf'], 'regionId': rid,
                                     'regionName': props['name'], 'lengthKm': round(total, 2),
                                     'lengthByClassKm': by_class,
                                     'shareHigh': round(by_class['alta'] / total, 4) if total else None,
                                     'crossingCount': len(cands)}})

    cells = []
    for i, la in enumerate(terrain['lat']):
        for j, lo in enumerate(terrain['lon']):
            c = class_of((i, j))
            if c is None:
                continue
            w, so = round(lo - res / 2, 5), round(la - res / 2, 5)
            e, n = round(w + res, 5), round(so + res, 5)
            cells.append({'type': 'Feature', 'geometry': {'type': 'Polygon', 'coordinates': [[[w, so], [e, so], [e, n], [w, n], [w, so]]]},
                          'properties': {'id': f'r{i}c{j}', 'class': c, 'label': CLASSES[c],
                                         'susceptibleFraction': terrain['susceptible_fraction'][i][j]}})

    h = hashlib.sha256()
    for uf in ('PR', 'SC', 'RS'):
        h.update((args.cache / f'osm_roads_{uf}.json').read_bytes())
    h.update(args.terrain.read_bytes())
    rev = h.hexdigest()[:20]
    tmp = OUT.with_name(OUT.name + '.tmp')
    shutil.rmtree(tmp, ignore_errors=True)
    tmp.mkdir(parents=True)

    def write(name, obj):
        (tmp / name).write_text(json.dumps(obj, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

    write('roads.geojson', {'type': 'FeatureCollection', 'revision': rev, 'features': roads})
    write('crossings.geojson', {'type': 'FeatureCollection', 'revision': rev, 'features': crossings})
    write('terrain.geojson', {'type': 'FeatureCollection', 'revision': rev, 'features': cells})
    total_km = sum(f['properties']['lengthKm'] for f in roads)
    write('catalog.json', {
        'revision': rev,
        'sources': {
            'roads': {'name': 'OpenStreetMap', 'license': 'ODbL 1.0', 'attribution': '© colaboradores do OpenStreetMap',
                      'query': 'highway=motorway|trunk|primary|secondary com ref BR-, PR-, SC-, ERS- ou RSC-', 'osmBase': osm_base},
            'terrain': {'name': terrain['source'], 'method': terrain['method'], 'sourceRef': args.terrain_ref,
                        'resolutionDegrees': res, 'classThresholds': terrain['class_thresholds']},
        },
        'parameters': {'stepKm': STEP_KM, 'minCrossingKm': args.min_crossing_km},
        'totals': {'segments': len(roads), 'osmWays': n_ways, 'lengthKm': round(total_km, 1),
                   'crossings': len(crossings), 'terrainCells': len(cells),
                   'lengthByClassKm': {k: round(sum(f['properties']['lengthByClassKm'][k] for f in roads), 1)
                                       for k in ('alta', 'media', 'baixa', 'sem_dado')}},
        'limitations': [
            'Diagnóstico exploratório de exposição; não estima risco de interdição, dano ou probabilidade de inundação.',
            'Suscetibilidade em células de 0,1° (~10 km): indica a fração de planície baixa na célula, não a posição exata da rodovia em relação ao rio.',
            'A camada de relevo é preliminar (aproximação do HAND com janela de ~15 km), sem rede de drenagem nem obras de arte (pontes, aterros).',
            'Malha do OpenStreetMap: cobertura e códigos podem estar incompletos; não é o SNV oficial do DNIT.',
            'Trechos são agrupados por código e região intermediária; vias com mais de um código usam o federal como principal.',
            'Pistas separadas (vias OSM de mão única) contam metade cada, para medir a rodovia e não as pistas; trechos urbanos de mão única ficam subestimados.',
        ],
    })
    old = OUT.with_name(OUT.name + '.old')
    shutil.rmtree(old, ignore_errors=True)
    if OUT.exists():
        OUT.rename(old)
    tmp.rename(OUT)
    shutil.rmtree(old, ignore_errors=True)
    print(f'{len(roads)} trechos, {total_km:.0f} km, {len(crossings)} travessias candidatas, {len(cells)} células de relevo')


if __name__ == '__main__':
    main()
