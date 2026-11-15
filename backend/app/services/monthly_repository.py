"""Serve verified monthly frames independently of the legacy annual snapshot."""
import math
from pathlib import Path

from app.services.grid_repository import JsonFileCache, GridRequestError
from app.services.snapshot_repository import DataError


def valid_value(value):
    return value is None or (type(value) in (int, float) and math.isfinite(value) and value >= 0)


class MonthlyRainfallRepository:
    def __init__(self, root: Path):
        self.root = root
        self.files = JsonFileCache('Chuva mensal')

    def manifest(self):
        data = self.files.read(self.root/'manifest.json')
        try:
            expected = [f'{y}-{m:02d}' for y in range(2001,2025) for m in range(1,13)]
            cells, grid = data['cells'], data['grid']
            if (data['schemaVersion'] != 1 or data['gridId'] != 'imerg-monthly-v07'
                    or data['months'] != expected or data['unit'] != 'mm'
                    or data['resolutionDegrees'] != .1 or grid['res'] != .1
                    or data['requiredReferenceYears'] != 24 or data['referencePeriod'] != {'start':2001,'end':2024}
                    or not isinstance(data['revision'],str) or not data['revision']
                    or data['metadata']['demonstrative'] is not False
                    or not 0 < len(cells) <= 20000):
                raise ValueError()
            for axis in ('lat','lon'):
                coords = grid[axis]
                if not coords or any(not isinstance(v,(float,int)) or not math.isfinite(v) for v in coords):
                    raise ValueError()
                # Source coordinates are float32; keep their precision tolerance.
                if any(not math.isclose(b-a,.1,abs_tol=1e-5) for a,b in zip(coords,coords[1:])):
                    raise ValueError()
            if (len({c['id'] for c in cells}) != len(cells) or len({c['index'] for c in cells}) != len(cells)
                    or any(not isinstance(c['id'],str) or not c['id'].startswith(data['gridId']+':')
                           or type(c['index']) is not int or not 0 <= c['index'] < len(grid['lat'])*len(grid['lon']) for c in cells)):
                raise ValueError()
            for month in range(1,13):
                values = data['climatology'][f'{month:02d}']
                counts = data['referenceCounts'][f'{month:02d}']
                if len(values) != len(cells) or len(counts) != len(cells):
                    raise ValueError()
                if any(not valid_value(v) or type(c) is not int or not 0 <= c <= 24 or (c < 24 and v is not None)
                       for v,c in zip(values,counts)):
                    raise ValueError()
            return data
        except (KeyError, TypeError, ValueError):
            raise DataError('MONTHLY_DATA_INVALID','Manifesto mensal inválido ou incompleto.') from None

    def year(self, year, revision=None):
        manifest = self.manifest()
        if revision is not None and revision != manifest['revision']:
            raise GridRequestError(409,'MONTHLY_REVISION_CHANGED','Os dados mensais foram atualizados. Recarregue o mapa.')
        if year not in range(2001,2025):
            raise GridRequestError(422,'INVALID_PERIOD','Ano fora da cobertura mensal 2001–2024.')
        data = self.files.read(self.root/f'{year}.json')
        try:
            if (data['revision'] != manifest['revision'] or data['gridId'] != manifest['gridId']
                    or data['year'] != year or data['unit'] != 'mm'
                    or [f['t'] for f in data['frames']] != [f'{year}-{m:02d}' for m in range(1,13)]
                    or any(len(f['values']) != len(manifest['cells']) or any(not valid_value(v) for v in f['values'])
                           for f in data['frames'])):
                raise ValueError()
            return data
        except (KeyError, TypeError, ValueError):
            raise DataError('MONTHLY_DATA_INVALID','Quadros mensais inválidos ou de outra revisão.') from None

    def detail(self, cell_id):
        manifest = self.manifest()
        index = next((i for i,c in enumerate(manifest['cells']) if c['id'] == cell_id),None)
        if index is None:
            raise GridRequestError(404,'CELL_NOT_FOUND','Célula não encontrada na grade mensal.')
        series = []
        for year in range(2001,2025):
            for frame in self.year(year, manifest['revision'])['frames']:
                month = frame['t'][5:7]
                value = frame['values'][index]
                reference = manifest['climatology'][month][index]
                anomaly = None if value is None or reference is None or reference == 0 else (value-reference)/reference*100
                series.append({'t':frame['t'], 'value':value, 'climatology':reference,
                               'referenceCount':manifest['referenceCounts'][month][index], 'anomalyPct':anomaly})
        return {'gridId':manifest['gridId'],'revision':manifest['revision'],'cellId':cell_id,
                'unit':'mm','referencePeriod':manifest['referencePeriod'],'series':series,'metadata':manifest['metadata']}
