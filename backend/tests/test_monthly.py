import json
import shutil

import pytest
from fastapi.testclient import TestClient

from app.config import BACKEND_ROOT, Settings
from app.main import create_app

DATA = BACKEND_ROOT/'data/derived/monthly-rainfall'


def client_for(path=DATA):
    return TestClient(create_app(Settings(BACKEND_ROOT/'data/derived/frontend/snapshot.json',
                                         ('http://localhost:5180',), monthly_path=path)), raise_server_exceptions=False)


def test_real_manifest_year_frames_and_full_cell_series():
    with client_for() as client:
        response = client.get('/api/monthly-rainfall')
        assert response.status_code == 200
        m = response.json()
        assert m['months'][0]=='2001-01' and m['months'][-1]=='2024-12' and len(m['months'])==288
        assert m['grid']['res']==.1 and len(m['cells'])==5458
        assert m['requiredReferenceYears']==24 and m['metadata']['demonstrative'] is False
        year = client.get('/api/monthly-rainfall/years/2001',params={'revision':m['revision']})
        assert year.status_code==200 and 'immutable' in year.headers['cache-control']
        frames=year.json()['frames']
        assert [f['t'] for f in frames]==[f'2001-{i:02d}' for i in range(1,13)]
        assert all(len(f['values'])==len(m['cells']) for f in frames)
        cell_id=m['cells'][0]['id']
        detail=client.get(f'/api/monthly-rainfall/cells/{cell_id}/timeseries').json()
        assert len(detail['series'])==288
        assert [p['t'] for p in detail['series']]==m['months']
        assert detail['series'][0]['value']==frames[0]['values'][0]
        january=[p['value'] for p in detail['series'] if p['t'].endswith('-01')]
        assert m['climatology']['01'][0]==pytest.approx(sum(january)/24,abs=1e-6)
        assert detail['series'][11]['t']=='2001-12' and detail['series'][12]['t']=='2002-01'
        for p in detail['series']:
            reference=m['climatology'][p['t'][5:7]][0]
            assert p['climatology']==reference
            if reference and p['value'] is not None:
                assert p['anomalyPct']==pytest.approx((p['value']-reference)/reference*100)
        annual=json.loads((BACKEND_ROOT/'data/derived/grids/imerg-monthly-v07/series.json').read_bytes())
        for i,year in enumerate(range(2001,2025)):
            assert sum(p['value'] for p in detail['series'][i*12:(i+1)*12])==pytest.approx(annual['cells'][cell_id]['values'][i],abs=1e-5)
        assert client.get('/api/monthly-rainfall',headers={'Origin':'http://localhost:5180'}).headers['access-control-allow-origin']=='http://localhost:5180'


@pytest.mark.parametrize('path,status,code',[
    ('/years/2000',422,'INVALID_PERIOD'),('/years/2025',422,'INVALID_PERIOD'),
    ('/years/no-year',422,'INVALID_FILTER'),('/years/2001?revision=old',409,'MONTHLY_REVISION_CHANGED'),
    ('/cells/gldas-noah-monthly-v21:r1:c1/timeseries',404,'CELL_NOT_FOUND')])
def test_invalid_monthly_queries(path,status,code):
    with client_for() as client:
        response=client.get('/api/monthly-rainfall'+path)
        assert response.status_code==status and response.json()['error']['code']==code


def test_missing_monthly_data_keeps_other_api_routes_available(tmp_path):
    with client_for(tmp_path) as client:
        assert client.get('/api/monthly-rainfall').status_code==503
        assert client.get('/api/snapshot').status_code==200


def test_missing_zero_negative_and_stale_frames(tmp_path):
    shutil.copyfile(DATA/'manifest.json',tmp_path/'manifest.json')
    original=json.loads((DATA/'2001.json').read_bytes())
    path=tmp_path/'2001.json'
    original['frames'][0]['values'][0]=None
    original['frames'][0]['values'][1]=0
    path.write_text(json.dumps(original),encoding='utf-8')
    with client_for(tmp_path) as client:
        response=client.get('/api/monthly-rainfall/years/2001').json()
        assert response['frames'][0]['values'][:2]==[None,0]
        original['frames'][0]['values'][0]=-1
        path.write_text(json.dumps(original),encoding='utf-8')
        assert client.get('/api/monthly-rainfall/years/2001').status_code==503
        original['frames'][0]['values'][0]=1
        original['revision']='stale'
        path.write_text(json.dumps(original),encoding='utf-8')
        assert client.get('/api/monthly-rainfall/years/2001').status_code==503


def test_invalid_reference_is_rejected(tmp_path):
    m=json.loads((DATA/'manifest.json').read_bytes())
    m['referenceCounts']['01'][0]=23
    (tmp_path/'manifest.json').write_text(json.dumps(m),encoding='utf-8')
    with client_for(tmp_path) as client:
        response=client.get('/api/monthly-rainfall')
        assert response.status_code==503 and response.json()['error']['code']=='MONTHLY_DATA_INVALID'
