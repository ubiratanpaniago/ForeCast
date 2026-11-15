"""Resultados regionais pré-calculados (scripts/import_region_results.py); nada é calculado na requisição.

Leitura sob demanda: o catálogo e o resumo de um indicador são arquivos pequenos; a série completa
de uma região só é lida quando aquela região é pedida.
"""
from pathlib import Path

from app.services.grid_repository import GridRequestError, JsonFileCache
from app.services.snapshot_repository import DataError


class RegionRepository:
    def __init__(self, root: Path):
        self.root = root
        self._files = JsonFileCache('Região')

    def catalog(self):
        data = self._files.read(self.root / 'catalog.json')
        try:
            ids = [r['id'] for r in data['regions']]
            if len(ids) != len(set(ids)) or not data['indicators'] or not isinstance(data['revision'], str):
                raise ValueError()
            return data
        except (KeyError, TypeError, ValueError):
            raise DataError('GRID_DATA_INVALID', 'Catálogo de regiões inválido.') from None

    def geometry(self):
        return self._files.read(self.root / 'regions.geojson')

    def _check(self, indicator, start=None, end=None, region_id=None):
        catalog = self.catalog()
        if indicator not in {i['id'] for i in catalog['indicators']}:
            raise GridRequestError(422, 'INVALID_INDICATOR', 'Indicador sem resultados regionais.')
        if region_id is not None and region_id not in {r['id'] for r in catalog['regions']}:
            raise GridRequestError(404, 'REGION_NOT_FOUND', 'Região não encontrada.')
        # Os resultados são de um período fixo: recortar a série invalidaria a estatística.
        if (start, end) not in ((None, None), (catalog['period']['start'], catalog['period']['end'])):
            raise GridRequestError(422, 'INVALID_PERIOD',
                                   f"Resultados disponíveis apenas para {catalog['period']['start']}–{catalog['period']['end']}.")
        return catalog

    def summary(self, indicator):
        catalog = self._check(indicator)
        data = self._files.read(self.root / 'summaries' / f'{indicator}.json')
        if data.get('revision') != catalog['revision'] or data.get('indicator') != indicator:
            raise DataError('GRID_DATA_INVALID', 'Resumo regional com revisão incompatível.')
        return data

    def trend(self, region_id, indicator, start, end):
        self._check(indicator, start, end, region_id)
        data = self._files.read(self.root / 'series' / region_id / f'{indicator}.json')
        if data.get('regionId') != region_id or data.get('indicator') != indicator:
            raise DataError('GRID_DATA_INVALID', 'Série regional inconsistente com o pedido.')
        return data

    def cell_fdr(self, indicator):
        catalog = self._check(indicator)
        data = self._files.read(self.root / 'cell_fdr.json')
        if data.get('revision') != catalog['revision'] or indicator not in data.get('indicators', {}):
            raise DataError('GRID_DATA_INVALID', 'Resumo de células por região incompatível com o catálogo.')
        return {'revision': data['revision'], 'sourceRef': data.get('sourceRef'), 'indicator': indicator,
                **data['indicators'][indicator]}
