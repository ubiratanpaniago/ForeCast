import json
import math
import shutil

import pytest
from fastapi.testclient import TestClient

from app.config import BACKEND_ROOT, Settings
from app.main import create_app

GRIDS = BACKEND_ROOT / 'data/derived/grids'


def client_for(root=GRIDS):
    return TestClient(create_app(Settings(BACKEND_ROOT/'data/derived/frontend/snapshot.json',
                                         ('http://localhost:5173',), root)), raise_server_exceptions=False)


def test_real_native_catalog_geometry_and_series():
    with client_for() as client:
        catalog = client.get('/api/grids').json()['grids']
        assert len(catalog) == 3
        for g in (g for g in catalog if g['available']):
            params = dict(indicator=g['indicators'][0], start=2001, end=2024)
            response = client.get(f"/api/grids/{g['id']}/cells", params=params)
            assert response.status_code == 200
            cells = response.json()
            assert len(cells['features']) == g['cellCount'] > 100
            assert not cells['truncated'] and cells['year'] == 2024
            assert len({f['properties']['id'] for f in cells['features']}) == len(cells['features'])
            for feature in cells['features']:
                p = feature['properties']
                w, s, e, n = p['bounds']
                assert math.isclose(e-w, g['resolutionDegrees'], abs_tol=1e-8)
                assert math.isclose(n-s, g['resolutionDegrees'], abs_tol=1e-8)
                assert p['center'] == [round((w+e)/2, 6), round((s+n)/2, 6)]
                assert 0 < p['fractionInside'] <= 1
                assert p['id'] == f"{g['id']}:r{p['row']}:c{p['column']}"
                assert feature['geometry']['coordinates'][0] == [[w,s],[e,s],[e,n],[w,n],[w,s]]
            first = cells['features'][0]['properties']
            detail = client.get(f"/api/grids/{g['id']}/cells/{first['id']}/timeseries", params=params).json()
            assert detail['revision'] == g['revision'] == cells['revision']
            assert [v['year'] for v in detail['series']] == list(range(2001,2025))
            assert detail['series'][-1]['value'] == first['annualValue']
            assert detail['statistics'] is None and detail['metadata']['demonstrative'] is False
            assert all(p['value'] is None or p['validMonths'] == 12 for p in detail['series'])
            subset = client.get(f"/api/grids/{g['id']}/cells/{first['id']}/timeseries",
                                params={**params, 'start':2013, 'end':2024}).json()
            assert subset['series'] == detail['series'][12:]
            clipped = client.get(f"/api/grids/{g['id']}/cells", params={**params, 'bbox':','.join(map(str, first['bounds']))}).json()
            assert [f['properties']['id'] for f in clipped['features']] == [first['id']]
            empty = client.get(f"/api/grids/{g['id']}/cells", params={**params, 'bbox':'0,0,1,1'}).json()
            assert empty['features'] == []


@pytest.mark.parametrize('query,code', [
    ({'indicator':'SOIL_SURFACE'}, 'INVALID_INDICATOR'),
    ({'start':2025}, 'INVALID_PERIOD'), ({'start':2024, 'end':2001}, 'INVALID_PERIOD'),
    ({'bbox':'nan,-34,-47,-22'}, 'INVALID_BBOX'), ({'bbox':'-47,-34,-58,-22'}, 'INVALID_BBOX'),
    ({'limit':1}, 'CELL_LIMIT_EXCEEDED'), ({'limit':20001}, 'INVALID_FILTER'),
])
def test_grid_filters_never_return_silent_partial_data(query, code):
    with client_for() as client:
        response = client.get('/api/grids/imerg-monthly-v07/cells', params={'indicator':'PRCP_ANNUAL', **query})
        assert response.status_code in (413, 422)
        assert response.json()['error']['code'] == code


def test_unavailable_unknown_and_cross_product_cell():
    with client_for() as client:
        assert client.get('/api/grids/missing/cells?indicator=PRCP_ANNUAL').status_code == 404
        daily = client.get('/api/grids/imerg-daily-v07/cells?indicator=RX1DAY')
        assert daily.status_code == 503 and daily.json()['error']['code'] == 'GRID_NOT_READY'
        first = client.get('/api/grids/imerg-monthly-v07/cells?indicator=PRCP_ANNUAL').json()['features'][0]['id']
        response = client.get(f'/api/grids/gldas-noah-monthly-v21/cells/{first}/timeseries?indicator=SOIL_SURFACE')
        assert response.status_code == 404 and response.json()['error']['code'] == 'CELL_NOT_FOUND'
        assert client.get('/api/grids', headers={'Origin':'http://localhost:5173'}).headers['access-control-allow-origin'] == 'http://localhost:5173'


def test_missing_and_changed_invalid_data_are_not_served_from_cache(tmp_path):
    with client_for(tmp_path) as client:
        assert client.get('/api/grids').status_code == 503
    shutil.copytree(GRIDS, tmp_path, dirs_exist_ok=True)
    with client_for(tmp_path) as client:
        params = {'indicator':'PRCP_ANNUAL'}
        assert client.get('/api/grids/imerg-monthly-v07/cells', params=params).status_code == 200
        (tmp_path/'imerg-monthly-v07/series.json').write_text('{"bad":NaN}')
        result = client.get('/api/grids/imerg-monthly-v07/cells', params=params)
        assert result.status_code == 503 and result.json()['error']['code'] == 'GRID_DATA_INVALID'
        assert str(tmp_path) not in result.text
