import json
import shutil

import pytest
from fastapi.testclient import TestClient

from app.config import BACKEND_ROOT, Settings
from app.main import create_app

REGIONS = BACKEND_ROOT / 'data/derived/regions'
INDICATORS = ['PRCP_ANNUAL', 'RX1DAY', 'R50MM', 'SOIL_SURFACE']


def client_for(root=REGIONS):
    settings = Settings(BACKEND_ROOT/'data/derived/frontend/snapshot.json', ('http://localhost:5173',),
                        BACKEND_ROOT/'data/derived/grids', root)
    return TestClient(create_app(settings), raise_server_exceptions=False)


def test_catalog_lists_21_intermediate_regions_and_3_states():
    with client_for() as client:
        catalog = client.get('/api/regions/catalog').json()
        levels = [r['level'] for r in catalog['regions']]
        assert levels.count('regiao_intermediaria') == 21 and levels.count('estado') == 3
        assert [i['id'] for i in catalog['indicators']] == INDICATORS
        assert catalog['period'] == {'start': 2001, 'end': 2024}
        geo = client.get('/api/regions').json()
        assert geo['type'] == 'FeatureCollection'
        assert {f['properties']['id'] for f in geo['features']} == {r['id'] for r in catalog['regions']}
        assert all(f['geometry']['type'] in ('Polygon', 'MultiPolygon') for f in geo['features'])


@pytest.mark.parametrize('indicator', INDICATORS)
def test_summary_and_trend_agree_for_every_region(indicator):
    with client_for() as client:
        catalog = client.get('/api/regions/catalog').json()
        summary = client.get('/api/regions/summary', params={'indicator': indicator}).json()
        assert summary['revision'] == catalog['revision']
        assert set(summary['regions']) == {r['id'] for r in catalog['regions']}
        assert 'series' not in json.dumps(summary)
        for region in catalog['regions']:
            trend = client.get(f"/api/regions/{region['id']}/trends", params={'indicator': indicator}).json()
            assert trend['regionId'] == region['id'] and trend['indicator'] == indicator
            assert [p['year'] for p in trend['series']] == list(range(2001, 2025))
            assert trend['statistics'] == summary['regions'][region['id']]
            assert trend['metadata']['demonstrative'] is False


@pytest.mark.parametrize('path,params,status,code', [
    ('/api/regions/9999/trends', {'indicator': 'RX1DAY'}, 404, 'REGION_NOT_FOUND'),
    ('/api/regions/4301/trends', {'indicator': 'SOIL_ROOT'}, 422, 'INVALID_INDICATOR'),
    ('/api/regions/4301/trends', {'indicator': 'RX1DAY', 'start': 2010}, 422, 'INVALID_PERIOD'),
    ('/api/regions/4301/trends', {}, 422, 'INVALID_FILTER'),
    ('/api/regions/summary', {'indicator': 'TEMP'}, 422, 'INVALID_INDICATOR'),
])
def test_region_errors(path, params, status, code):
    with client_for() as client:
        response = client.get(path, params=params)
        assert response.status_code == status
        assert response.json()['error']['code'] == code


def test_missing_or_mismatched_data_is_503(tmp_path):
    with client_for(tmp_path / 'nada') as client:
        response = client.get('/api/regions/catalog')
        assert response.status_code == 503
        assert response.json()['error']['code'] == 'GRID_DATA_UNAVAILABLE'
    copy = tmp_path / 'regions'
    shutil.copytree(REGIONS, copy)
    summary = copy / 'summaries/RX1DAY.json'
    data = json.loads(summary.read_text(encoding='utf-8'))
    data['revision'] = 'outra'
    summary.write_text(json.dumps(data), encoding='utf-8')
    with client_for(copy) as client:
        response = client.get('/api/regions/summary', params={'indicator': 'RX1DAY'})
        assert response.status_code == 503 and response.json()['error']['code'] == 'GRID_DATA_INVALID'


@pytest.mark.parametrize('indicator', INDICATORS)
def test_cell_fdr_counts_are_consistent(indicator):
    with client_for() as client:
        data = client.get('/api/regions/cell-fdr', params={'indicator': indicator}).json()
        catalog = client.get('/api/regions/catalog').json()
        assert data['revision'] == catalog['revision'] and 'FDR' in data['method']
        assert set(data['regions']) == {r['id'] for r in catalog['regions']}
        for c in data['regions'].values():
            assert c['cells'] == c['increasing'] + c['decreasing'] + c['inconclusive'] + c['no_data']
            assert c['raw_p_below_005'] <= c['cells'] - c['no_data']
            assert c['cells'] > 0
