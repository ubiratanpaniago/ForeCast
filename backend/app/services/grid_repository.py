"""Read precomputed native cells; never download NASA data inside a request."""
import json
import math
from pathlib import Path
from threading import RLock

from app.services.snapshot_repository import DataError


class GridRequestError(Exception):
    def __init__(self, status, code, message):
        self.status, self.code, self.message = status, code, message


class JsonFileCache:
    """Lê JSON derivado com cache invalidado por metadados do arquivo (compartilhado por grades e regiões)."""

    def __init__(self, label='Grade'):
        self.label = label
        self._cache = {}
        self._lock = RLock()

    def read(self, path):
        with self._lock:
            try:
                stat = path.stat()
                signature = (stat.st_mtime_ns, stat.st_ctime_ns, stat.st_size, stat.st_ino)
                if stat.st_size > 32 * 1024 * 1024:
                    raise ValueError('Oversized grid file')
                cached = self._cache.get(path)
                if cached and cached[0] == signature:
                    return cached[1]
                value = json.loads(path.read_bytes(), parse_constant=lambda x: (_ for _ in ()).throw(ValueError(x)))
                self._cache[path] = (signature, value)
                return value
            except OSError:
                self._cache.pop(path, None)
                raise DataError('GRID_DATA_UNAVAILABLE', f'{self.label} ainda não processada ou indisponível.') from None
            except (ValueError, TypeError):
                self._cache.pop(path, None)
                raise DataError('GRID_DATA_INVALID', f'Arquivo de {self.label.lower()} inválido; execute novamente a preparação em uma nova pasta.') from None


class GridRepository:
    def __init__(self, root: Path):
        self.root = root
        self._files = JsonFileCache('Grade')

    def _read(self, path):
        return self._files.read(path)

    def catalog(self):
        catalog = self._read(self.root / 'catalog.json')
        try:
            grids = catalog['grids']
            if not isinstance(grids, list) or len({g['id'] for g in grids}) != len(grids):
                raise ValueError()
            for g in grids:
                if (not isinstance(g['id'], str) or not g['id'] or
                        any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-' for c in g['id']) or
                        g['resolutionDegrees'] not in (.1, .25) or g['crs'] != 'EPSG:4326'):
                    raise ValueError()
            return catalog
        except (KeyError, TypeError, ValueError):
            raise DataError('GRID_DATA_INVALID', 'Catálogo de grades inválido.') from None

    def definition(self, grid_id):
        grid = next((g for g in self.catalog()['grids'] if g['id'] == grid_id), None)
        if grid is None:
            raise GridRequestError(404, 'GRID_NOT_FOUND', 'Grade não encontrada.')
        if not grid['available']:
            raise GridRequestError(503, 'GRID_NOT_READY', grid['unavailableReason'])
        return grid

    @staticmethod
    def validate_query(grid, indicator, start, end):
        if indicator not in grid['indicators']:
            raise GridRequestError(422, 'INVALID_INDICATOR', 'Indicador incompatível com a grade selecionada.')
        if not grid['period']['start'] <= start <= end <= grid['period']['end']:
            raise GridRequestError(422, 'INVALID_PERIOD', 'Período fora da cobertura da grade.')

    def cells(self, grid_id, indicator, start, end, bbox, limit):
        grid = self.definition(grid_id)
        self.validate_query(grid, indicator, start, end)
        try:
            bounds = [float(x) for x in bbox.split(',')]
            w, s, e, n = bounds
            if not all(math.isfinite(x) for x in bounds) or not (-180 <= w < e <= 180 and -90 <= s < n <= 90):
                raise ValueError()
        except (ValueError, TypeError):
            raise GridRequestError(422, 'INVALID_BBOX', 'bbox deve conter west,south,east,north válidos.') from None
        data = self._read(self.root / grid_id / 'cells.geojson')
        try:
            if data['type'] != 'FeatureCollection' or len(data['features']) != grid['cellCount']:
                raise ValueError()
            selected = [f for f in data['features'] if
                        f['properties']['bounds'][0] < e and f['properties']['bounds'][2] > w and
                        f['properties']['bounds'][1] < n and f['properties']['bounds'][3] > s]
        except (KeyError, ValueError, TypeError):
            raise DataError('GRID_DATA_INVALID', 'Geometrias da grade inválidas.') from None
        if len(selected) > limit:
            raise GridRequestError(413, 'CELL_LIMIT_EXCEEDED', 'Recorte excede o limite solicitado; reduza bbox ou aumente limit.')
        series = self._read(self.root / grid_id / 'series.json')
        try:
            if series['revision'] != grid['revision']:
                raise ValueError()
            index = series['years'].index(end)
            selected = [{**f, 'properties': {**f['properties'], 'annualValue': series['cells'][f['properties']['id']]['values'][index]}}
                        for f in selected]
        except (KeyError, IndexError, TypeError, ValueError):
            raise DataError('GRID_DATA_INVALID', 'Revisão ou valores anuais incompatíveis com a grade.') from None
        return {'type': 'FeatureCollection', 'gridId': grid_id, 'revision': grid['revision'],
                'indicator': indicator, 'period': {'start': start, 'end': end},
                'year': end, 'truncated': False, 'features': selected}

    def detail(self, grid_id, cell_id, indicator, start, end):
        grid = self.definition(grid_id)
        self.validate_query(grid, indicator, start, end)
        data = self._read(self.root / grid_id / 'series.json')
        try:
            if data['revision'] != grid['revision'] or data['years'] != list(range(grid['period']['start'], grid['period']['end']+1)):
                raise ValueError()
            cell = data['cells'].get(cell_id)
            if cell is None:
                raise GridRequestError(404, 'CELL_NOT_FOUND', 'Célula não encontrada nesta grade.')
            if len(cell['values']) != len(data['years']) or len(cell['validMonths']) != len(data['years']):
                raise ValueError()
            if any(v is not None and (not isinstance(v, (int, float)) or not math.isfinite(v) or v < 0)
                   for v in cell['values']):
                raise ValueError()
            if any(not isinstance(c, int) or not 0 <= c <= 12 or (c < 12 and v is not None)
                   for c, v in zip(cell['validMonths'], cell['values'])):
                raise ValueError()
            metadata = data['metadata']
            if metadata['demonstrative'] is not False or metadata['productId'] != grid['productId']:
                raise ValueError()
            series = [{'year': year, 'value': cell['values'][i], 'validMonths': cell['validMonths'][i]}
                      for i, year in enumerate(data['years']) if start <= year <= end]
            return {'gridId': grid_id, 'revision': grid['revision'], 'cellId': cell_id,
                    'indicator': indicator, 'period': {'start': start, 'end': end},
                    'series': series, 'statistics': None, 'metadata': metadata}
        except (KeyError, ValueError, TypeError):
            raise DataError('GRID_DATA_INVALID', 'Série de célula inválida ou revisão incompatível.') from None
