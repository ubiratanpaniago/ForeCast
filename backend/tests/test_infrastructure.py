import json
import shutil

import pytest
from fastapi.testclient import TestClient

from app.config import BACKEND_ROOT, Settings
from app.main import create_app

INFRA = BACKEND_ROOT / 'data/derived/infrastructure'
REGIONS = BACKEND_ROOT / 'data/derived/regions'


def client_for(infra=INFRA):
    settings = Settings(BACKEND_ROOT/'data/derived/frontend/snapshot.json', ('http://localhost:5173',),
                        BACKEND_ROOT/'data/derived/grids', REGIONS, infra)
    return TestClient(create_app(settings), raise_server_exceptions=False)


def test_roads_cover_three_states_with_consistent_lengths():
    with client_for() as client:
        catalog = client.get('/api/infrastructure').json()
        roads = client.get('/api/infrastructure/roads').json()
        assert roads['revision'] == catalog['revision']
        assert catalog['sources']['roads']['license'] == 'ODbL 1.0'
        assert catalog['limitations']
        ufs = {(f['properties']['uf'], f['properties']['jurisdiction']) for f in roads['features']}
        assert ufs == {(uf, j) for uf in ('PR', 'SC', 'RS') for j in ('federal', 'estadual')}
        for f in roads['features']:
            p = f['properties']
            assert f['geometry']['type'] in ('LineString', 'MultiLineString')
            assert abs(sum(p['lengthByClassKm'].values()) - p['lengthKm']) < 0.05
            assert p['ref'] in p['refs'] and p['id'] == f"{p['ref']}@{p['regionId']}"
        assert len({f['properties']['id'] for f in roads['features']}) == len(roads['features'])
        assert catalog['totals']['segments'] == len(roads['features'])


def test_crossings_belong_to_high_class_cells_and_segments():
    with client_for() as client:
        roads = {f['properties']['id']: f['properties'] for f in client.get('/api/infrastructure/roads').json()['features']}
        terrain = {f['properties']['id']: f['properties'] for f in client.get('/api/infrastructure/terrain').json()['features']}
        crossings = client.get('/api/infrastructure/crossings').json()['features']
        assert crossings
        for c in crossings:
            p = c['properties']
            assert terrain[f"r{p['row']}c{p['column']}"]['class'] == 3
            assert p['lengthKm'] >= 0.5
        for sid, road in roads.items():
            assert road['crossingCount'] == sum(c['properties']['segmentId'] == sid for c in crossings)
        sid = crossings[0]['properties']['segmentId']
        detail = client.get(f'/api/infrastructure/segments/{sid}').json()
        assert detail['segment']['properties']['id'] == sid
        assert all(c['properties']['segmentId'] == sid for c in detail['crossings'])


@pytest.mark.parametrize('path,status,code', [
    ('/api/infrastructure/rivers', 404, 'LAYER_NOT_FOUND'),
    ('/api/infrastructure/segments/BR-999@4101', 404, 'SEGMENT_NOT_FOUND'),
])
def test_infrastructure_errors(path, status, code):
    with client_for() as client:
        response = client.get(path)
        assert response.status_code == status and response.json()['error']['code'] == code


def test_layer_with_other_revision_is_rejected(tmp_path):
    copy = tmp_path / 'infra'
    shutil.copytree(INFRA, copy)
    roads = json.loads((copy / 'roads.geojson').read_text(encoding='utf-8'))
    roads['revision'] = 'outra'
    (copy / 'roads.geojson').write_text(json.dumps(roads), encoding='utf-8')
    with client_for(copy) as client:
        response = client.get('/api/infrastructure/roads')
        assert response.status_code == 503 and response.json()['error']['code'] == 'GRID_DATA_INVALID'
