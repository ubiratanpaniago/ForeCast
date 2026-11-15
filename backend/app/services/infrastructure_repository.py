"""Rodovias, relevo e travessias pré-processados (scripts/build_road_exposure.py)."""
from pathlib import Path

from app.services.grid_repository import GridRequestError, JsonFileCache
from app.services.snapshot_repository import DataError

LAYERS = {'roads', 'crossings', 'terrain'}


class InfrastructureRepository:
    def __init__(self, root: Path):
        self.root = root
        self._files = JsonFileCache('Infraestrutura')

    def catalog(self):
        data = self._files.read(self.root / 'catalog.json')
        if not isinstance(data.get('revision'), str) or 'limitations' not in data:
            raise DataError('GRID_DATA_INVALID', 'Catálogo de infraestrutura inválido.')
        return data

    def layer(self, name):
        if name not in LAYERS:
            raise GridRequestError(404, 'LAYER_NOT_FOUND', 'Camada de infraestrutura inexistente.')
        data = self._files.read(self.root / f'{name}.geojson')
        if data.get('type') != 'FeatureCollection' or data.get('revision') != self.catalog()['revision']:
            raise DataError('GRID_DATA_INVALID', 'Camada com revisão incompatível com o catálogo.')
        return data

    def segment(self, segment_id):
        road = next((f for f in self.layer('roads')['features'] if f['properties']['id'] == segment_id), None)
        if road is None:
            raise GridRequestError(404, 'SEGMENT_NOT_FOUND', 'Trecho rodoviário não encontrado.')
        crossings = [f for f in self.layer('crossings')['features'] if f['properties']['segmentId'] == segment_id]
        return {'revision': self.catalog()['revision'], 'segment': road, 'crossings': crossings}
