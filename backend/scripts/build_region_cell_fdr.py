"""Resume, por região, as tendências por célula já testadas com FDR pelo pipeline de dados.

Entrada: os GeoJSON de células com `summary` gerados por `export_grids.py` (feat/nasa-data):
  {grids}/imerg-monthly-v07/cells/PRCP_ANNUAL/2001-2024.geojson
  {grids}/imerg-daily-v07/cells/{RX1DAY,R50MM}/2001-2024.geojson
  {grids}/gldas-noah-monthly-v21/cells/SOIL_SURFACE/2001-2024.geojson

Para cada região de data/derived/regions/regions.geojson conta as células cujo CENTRO está dentro do
polígono, por resultado:
  increasing / decreasing   direção atribuída pelo pipeline: FDR Benjamini-Hochberg (q = 0,05) entre
                            todas as células do indicador E IC 95 % de Sen sem o zero
  raw_p_below_005           p bruto < 0,05 (indício, SEM correção para testes múltiplos)
  inconclusive / no_data    demais células / células sem resumo

Não recalcula estatística: apenas conta os resultados publicados. Saída:
  data/derived/regions/cell_fdr.json

Requer shapely (requirements-data.txt). Uso:
  python scripts/build_region_cell_fdr.py CAMINHO/grids [--source-ref feat/nasa-data@503f0d42]
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import shapely

ROOT = Path(__file__).resolve().parents[1]
REGIONS = ROOT / 'data/derived/regions'
SOURCES = {
    'PRCP_ANNUAL': 'imerg-monthly-v07',
    'RX1DAY': 'imerg-daily-v07',
    'R50MM': 'imerg-daily-v07',
    'SOIL_SURFACE': 'gldas-noah-monthly-v21',
}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('grids', type=Path, help='pasta grids/ gerada por export_grids.py')
    ap.add_argument('--source-ref', default='')
    args = ap.parse_args()

    catalog = json.loads((REGIONS / 'catalog.json').read_text(encoding='utf-8'))
    geo = json.loads((REGIONS / 'regions.geojson').read_text(encoding='utf-8'))
    polygons = {f['properties']['id']: shapely.geometry.shape(f['geometry']) for f in geo['features']}
    for p in polygons.values():
        shapely.prepare(p)

    out = {'revision': catalog['revision'], 'sourceRef': args.source_ref, 'indicators': {}}
    for ind, grid_id in SOURCES.items():
        path = args.grids / grid_id / 'cells' / ind / '2001-2024.geojson'
        cells = json.loads(path.read_text(encoding='utf-8'))
        first = next(f['properties']['summary'] for f in cells['features'] if f['properties']['summary'])
        counts = {rid: dict(cells=0, increasing=0, decreasing=0, inconclusive=0, raw_p_below_005=0, no_data=0)
                  for rid in polygons}
        for f in cells['features']:
            props = f['properties']
            pt = shapely.Point(props['center'])
            stats = (props['summary'] or {}).get('statistics')
            for rid, poly in polygons.items():
                if not poly.contains(pt):
                    continue
                c = counts[rid]
                c['cells'] += 1
                if not stats or stats['status'] == 'insufficient':
                    c['no_data'] += 1
                    continue
                c[stats['direction']] += 1
                if stats['pValue'] is not None and stats['pValue'] < 0.05:
                    c['raw_p_below_005'] += 1
        out['indicators'][ind] = {
            'gridId': grid_id,
            'resolutionDegrees': 0.25 if grid_id.startswith('gldas') else 0.1,
            'cellsTested': len(cells['features']),
            'gridRevision': cells.get('revision'),
            'method': first['statistics']['method'],
            'qualityNotes': first['metadata']['qualityNotes'],
            'regions': counts,
        }
        sig = sum(c['increasing'] + c['decreasing'] for c in counts.values())
        print(f"{ind:13s} {len(cells['features'])} células testadas; {sig} atribuições com direção após FDR")

    (REGIONS / 'cell_fdr.json').write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print('escrito', REGIONS / 'cell_fdr.json')


if __name__ == '__main__':
    main()
