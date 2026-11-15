"""Publica os resultados regionais do pipeline de dados no formato servido pela API.

Entrada: a pasta `regions/` gerada por `export_grids.py` (branch feat/nasa-data), com
  regions/south-intermediate-regions.geojson
  regions/{regionId}/{INDICADOR}/{inicio}-{fim}.json   (TrendResult)

Saída em data/derived/regions/ (substituição atômica da pasta inteira):
  catalog.json             revisão, período, indicadores e lista de regiões (sem séries)
  regions.geojson          21 regiões intermediárias + PR/SC/RS (malha de data/reference)
  summaries/{IND}.json     estatística de todas as regiões, sem séries (uma leitura por mapa)
  series/{regionId}/{IND}.json   TrendResult completo, lido sob demanda
  provenance.json          origem e SHA-256 de cada arquivo de entrada

Não recalcula nada: valida e copia valores. Uso:
  python scripts/import_region_results.py CAMINHO/regions [--source-ref feat/nasa-data@7e508bfb]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/derived/regions'
STATES = ROOT / 'data/reference/south-regions.geojson'
PERIOD = {'start': 2001, 'end': 2024}

# Escopo do MVP (docs/methodology.md). SOIL_ROOT existe na entrada mas fica fora do catálogo ativo.
INDICATORS = {
    'PRCP_ANNUAL': {'unit': 'mm', 'productId': 'GPM_3IMERGM_07', 'name': 'Precipitação anual'},
    'RX1DAY': {'unit': 'mm', 'productId': 'GPM_3IMERGDF_07', 'name': 'Máxima diária anual'},
    'R50MM': {'unit': 'dias', 'productId': 'GPM_3IMERGDF_07', 'name': 'Dias com chuva ≥ 50 mm'},
    'SOIL_SURFACE': {'unit': 'kg/m²', 'productId': 'GLDAS_NOAH025_M_2.1', 'name': 'Umidade superficial 0–10 cm'},
}


def finite(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x)


def check_result(d: dict, region_id: str, indicator: str) -> None:
    """Mesmas regras de frontend/src/services/trendContract.ts."""
    s, m = d['statistics'], d['metadata']
    years = list(range(PERIOD['start'], PERIOD['end'] + 1))
    assert d['regionId'] == region_id and d['indicator'] == indicator and d['period'] == PERIOD
    assert [p['year'] for p in d['series']] == years
    for p in d['series']:
        v = p['value']
        assert v is None or (finite(v) and v >= 0)
        if indicator == 'R50MM' and v is not None:
            assert float(v).is_integer() and v <= 366
    assert s['status'] in ('valid', 'exploratory', 'insufficient')
    assert s['direction'] in ('increasing', 'decreasing', 'inconclusive')
    for k in ('slopePerDecade', 'pValue', 'tau'):
        assert s[k] is None or finite(s[k])
    assert s['pValue'] is None or 0 <= s['pValue'] <= 1
    ci = s['confidenceInterval95']
    assert ci is None or (len(ci) == 2 and all(map(finite, ci)) and ci[0] <= ci[1])
    if s['status'] == 'valid':
        assert None not in (s['slopePerDecade'], s['pValue'], s['tau'], ci)
        assert ci[0] <= s['slopePerDecade'] <= ci[1]
    if s['direction'] == 'increasing':
        assert s['slopePerDecade'] > 0
    if s['direction'] == 'decreasing':
        assert s['slopePerDecade'] < 0
    spec = INDICATORS[indicator]
    assert m['unit'] == spec['unit'] and m['productId'] == spec['productId']
    assert m['demonstrative'] is False and m['sourceDOI'].startswith('10.')
    assert isinstance(m['qualityNotes'], list) and all(isinstance(n, str) for n in m['qualityNotes'])


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('source', type=Path, help='pasta regions/ gerada por export_grids.py')
    ap.add_argument('--source-ref', default='', help='origem dos arquivos, ex.: feat/nasa-data@7e508bfb')
    ap.add_argument('--output', type=Path, default=OUT)
    args = ap.parse_args()
    src: Path = args.source

    inter = json.loads((src / 'south-intermediate-regions.geojson').read_text(encoding='utf-8'))
    states = json.loads(STATES.read_text(encoding='utf-8'))
    features = [{'type': 'Feature', 'geometry': f['geometry'],
                 'properties': {'id': f['properties']['id'], 'name': f['properties']['name'],
                                'abbreviation': f['properties']['abbreviation'], 'level': 'regiao_intermediaria'}}
                for f in inter['features']]
    features += [{'type': 'Feature', 'geometry': f['geometry'],
                  'properties': {**f['properties'], 'level': 'estado'}} for f in states['features']]
    ids = [f['properties']['id'] for f in features]
    assert len(ids) == len(set(ids)) == 24, f'esperadas 21 regiões + 3 estados, recebidas {len(ids)}'

    tmp = args.output.with_name(args.output.name + '.tmp')
    shutil.rmtree(tmp, ignore_errors=True)
    inputs, summaries, revision = {}, {ind: {} for ind in INDICATORS}, hashlib.sha256()
    for rid in ids:
        for ind in INDICATORS:
            f = src / rid / ind / f"{PERIOD['start']}-{PERIOD['end']}.json"
            d = json.loads(f.read_text(encoding='utf-8'))
            try:
                check_result(d, rid, ind)
            except (AssertionError, KeyError, TypeError) as e:
                raise SystemExit(f'Resultado inválido em {f}: {e!r}') from None
            digest = sha(f)
            inputs[f'{rid}/{ind}'] = digest
            revision.update(digest.encode())
            write(tmp / 'series' / rid / f'{ind}.json', d)
            summaries[ind][rid] = d['statistics']
    rev = revision.hexdigest()[:20]

    for ind, stats in summaries.items():
        meta = json.loads((tmp / 'series' / ids[0] / f'{ind}.json').read_text(encoding='utf-8'))['metadata']
        write(tmp / 'summaries' / f'{ind}.json',
              {'revision': rev, 'indicator': ind, 'period': PERIOD, 'metadata': meta, 'regions': stats})
    write(tmp / 'regions.geojson', {'type': 'FeatureCollection', 'features': features})
    write(tmp / 'catalog.json', {
        'revision': rev, 'period': PERIOD,
        'indicators': [{'id': k, **v} for k, v in INDICATORS.items()],
        'regions': [f['properties'] for f in features],
    })
    write(tmp / 'provenance.json', {'algorithm': 'import-region-results-v1', 'revision': rev,
                                    'sourceRef': args.source_ref, 'inputsSHA256': inputs})

    old = args.output.with_name(args.output.name + '.old')
    shutil.rmtree(old, ignore_errors=True)
    if args.output.exists():
        args.output.rename(old)
    tmp.rename(args.output)
    shutil.rmtree(old, ignore_errors=True)
    print(f'{len(ids)} regiões × {len(INDICATORS)} indicadores publicados em {args.output} (revisão {rev})')


if __name__ == '__main__':
    main()
