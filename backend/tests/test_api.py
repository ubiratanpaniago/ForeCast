import json
import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings, BACKEND_ROOT
from app.main import create_app


@pytest.fixture
def data_path(tmp_path):
    target = tmp_path / 'snapshot.json'
    shutil.copyfile(BACKEND_ROOT / 'data/derived/frontend/snapshot.json', target)
    return target


def client_for(path):
    return TestClient(create_app(Settings(path, ('http://localhost:5173', 'http://127.0.0.1:5173'))), raise_server_exceptions=False)


def test_real_snapshot_and_health(data_path):
    with client_for(data_path) as client:
        result = client.get('/api/snapshot')
        assert result.status_code == 200
        assert result.content == data_path.read_bytes()
        assert len(result.json()['years']) == 24
        assert len(result.json()['monthly']['soilMoisture']) == 288
        health = client.get('/api/health').json()
        assert health['status'] == 'ok' and health['dataAvailable']
        assert health['dataRevision'] == result.headers['etag'].strip('"')


@pytest.mark.parametrize('style', ['plain', 'weak', 'list', 'wildcard'])
def test_conditional_get(data_path, style):
    with client_for(data_path) as client:
        tag = client.get('/api/snapshot').headers['etag']
        candidate = {'plain':tag, 'weak':'W/'+tag, 'list':'"old", '+tag, 'wildcard':'*'}[style]
        response = client.get('/api/snapshot', headers={'If-None-Match':candidate})
        assert response.status_code == 304 and response.content == b''
        assert response.headers['etag'] == tag


def test_update_and_invalid_revision_never_serve_stale_data(data_path):
    with client_for(data_path) as client:
        first = client.get('/api/snapshot').headers['etag']
        data = json.loads(data_path.read_bytes())
        data_path.write_text('broken', encoding='utf-8')
        failed = client.get('/api/snapshot', headers={'If-None-Match':first})
        assert failed.status_code == 503
        assert failed.json()['error']['code'] == 'DATA_INVALID'
        data['meta']['notes'].append('Test revision')
        next_file = data_path.with_suffix('.tmp')
        next_file.write_text(json.dumps(data), encoding='utf-8')
        next_file.replace(data_path)
        updated = client.get('/api/snapshot', headers={'If-None-Match':first})
        assert updated.status_code == 200 and updated.headers['etag'] != first


def test_missing_file_does_not_stop_api(tmp_path):
    with client_for(tmp_path/'missing.json') as client:
        assert client.get('/api/health').json()['dataAvailable'] is False
        response = client.get('/api/snapshot')
        assert response.status_code == 503
        assert response.json()['error']['code'] == 'DATA_UNAVAILABLE'
        assert str(tmp_path) not in response.text


@pytest.mark.parametrize('invalid', ['dimension', 'month', 'negative', 'nonfinite', 'grid'])
def test_scientific_structure_is_checked(data_path, invalid):
    data = json.loads(data_path.read_bytes())
    if invalid == 'dimension': data['annual']['byYear']['2001'].pop()
    if invalid == 'month': data['monthly']['precipitation'].pop()
    if invalid == 'negative': data['annual']['byYear']['2001'][0] = -9999
    if invalid == 'nonfinite': data['monthly']['precipitation'][0]['v'] = float('nan')
    if invalid == 'grid': data['grid']['res'] = 0.1
    data_path.write_text(json.dumps(data), encoding='utf-8')
    with client_for(data_path) as client:
        assert client.get('/api/snapshot').json()['error']['code'] == 'DATA_INVALID'


def test_cors_and_errors(data_path):
    with client_for(data_path) as client:
        for origin in ('http://localhost:5173', 'http://127.0.0.1:5173'):
            preflight = client.options('/api/snapshot', headers={'Origin':origin, 'Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'If-None-Match'})
            assert preflight.status_code == 200
            assert preflight.headers['access-control-allow-origin'] == origin
        assert 'access-control-allow-origin' not in client.get('/api/snapshot', headers={'Origin':'http://unapproved.test'}).headers
        assert client.get('/unknown').json()['error']['code'] == 'NOT_FOUND'
        def fail(): raise RuntimeError('private server details')
        client.app.state.snapshots.get = fail
        response = client.get('/api/snapshot')
        assert response.status_code == 500 and 'private server details' not in response.text


def test_cache_uses_memory(data_path, monkeypatch):
    with client_for(data_path) as client:
        cached = client.app.state.snapshots.get()
        def fail(*args, **kwargs): raise AssertionError('Should use memory cache')
        monkeypatch.setattr(Path, 'read_bytes', fail)
        assert client.app.state.snapshots.get() is cached


def test_configured_relative_path(monkeypatch):
    monkeypatch.setenv('FORECAST_SNAPSHOT_PATH', 'data/custom.json')
    assert Settings.from_env().snapshot_path == (BACKEND_ROOT/'data/custom.json').resolve()


def test_atomic_publisher_preserves_previous_file_on_invalid_input(data_path, tmp_path):
    from scripts.publish_snapshot import publish
    from pydantic import ValidationError
    target = tmp_path / 'published.json'
    publish(data_path, target)
    before = target.read_bytes()
    data_path.write_text('{}', encoding='utf-8')
    with pytest.raises(ValidationError):
        publish(data_path, target)
    assert target.read_bytes() == before
