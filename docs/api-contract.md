# Contrato da API — protótipo integrado

Base local: `http://127.0.0.1:8000`. Somente GET; JSON UTF-8. GeoJSON WGS84, ordem longitude/latitude. Períodos anuais inclusivos. A API lê derivados locais; não baixa dados nem calcula tendências durante requisições.

| Endpoint | Resposta |
| --- | --- |
| `/api/health` | Estado do serviço e disponibilidade do snapshot |
| `/api/snapshot` | Snapshot agregado, com ETag e suporte a 304 |
| `/api/grids` | `{ grids: GridDefinition[] }` |
| `/api/grids/{gridId}/cells` | FeatureCollection das células inteiras do recorte |
| `/api/grids/{gridId}/cells/{cellId}/timeseries` | Série anual da célula, cobertura e proveniência |
| `/docs` | OpenAPI interativo |

## Catálogo

`GridDefinition`: `id`, `name`, `productId`, `version`, `resolutionDegrees` (0.1 ou 0.25), `crs` (`EPSG:4326`), `indicators`, `period: {start,end}`, `revision`, `available`. Grades disponíveis informam `cellCount`; indisponíveis, `unavailableReason`.

- `imerg-monthly-v07`: `PRCP_ANNUAL`, mm, 0,1°.
- `gldas-noah-monthly-v21`: `SOIL_SURFACE`, kg/m², 0,25°.
- `imerg-daily-v07`: `RX1DAY` e `R50MM`, ainda indisponível.

## Geometrias

Exemplo: `/api/grids/imerg-monthly-v07/cells?indicator=PRCP_ANNUAL&start=2001&end=2024&bbox=-58,-34,-47,-22&limit=20000`.

`indicator` obrigatório. Padrões: `start=2001`, `end=2024`, `bbox=-58,-34,-47,-22`, `limit=20000` (1–20000). Indicador deve pertencer à grade; período deve estar dentro da cobertura.

Resposta: `type: FeatureCollection`, `gridId`, `revision`, `indicator`, `period`, `year: end`, `truncated: false`, `features`. Cada feature tem Polygon retangular nativo, cinco vértices e propriedades:

```typescript
interface GridCell {
  id: string; // ex.: imerg-monthly-v07:r630:c1280
  gridId: string;
  row: number; // índice global do eixo de latitude do produto
  column: number; // índice global do eixo de longitude do produto
  center: [number, number];
  bounds: [number, number, number, number]; // west,south,east,north
  fractionInside: number; // fração geodésica nos três estados
  annualValue: number | null; // valor de year, sem ponderar pela fração
  summary: null; // reservado à análise estatística
}
```

`bbox` filtra por interseção, sem cortar polígonos ou reamostrar. Fora da área disponível retorna coleção vazia. `limit` insuficiente retorna 413, nunca uma grade silenciosamente truncada. Cor anual é magnitude, não tendência.

## Série da célula

Use o ID exato da geometria, codificado com `encodeURIComponent`. Mesmos filtros `indicator`, `start`, `end`; sem `bbox` ou `limit`.

```typescript
interface CellDetail {
  gridId: string;
  revision: string;
  cellId: string;
  indicator: 'PRCP_ANNUAL' | 'SOIL_SURFACE';
  period: { start: number; end: number };
  series: Array<{ year: number; value: number | null; validMonths: number }>;
  statistics: null;
  metadata: {
    unit: string;
    productId: string;
    version: string;
    sourceDOI: string;
    qualityNotes: string[];
    demonstrative: false;
  };
}
```

Todos os anos aparecem em ordem. Com menos de 12 meses válidos, `value: null`, nunca zero. IDs pertencem a uma grade. Revisão deve coincidir entre catálogo, geometrias e série; frontend rejeita incompatibilidades. Ausência de estatística não significa ausência de tendência.

## Erros

Envelope: `{ "error": { "code": "INVALID_PERIOD", "message": "..." } }`.

| HTTP | Códigos |
| --- | --- |
| 404 | `GRID_NOT_FOUND`, `CELL_NOT_FOUND`, `NOT_FOUND` |
| 413 | `CELL_LIMIT_EXCEEDED` |
| 422 | `INVALID_FILTER`, `INVALID_BBOX`, `INVALID_INDICATOR`, `INVALID_PERIOD` |
| 503 | `GRID_NOT_READY`, `GRID_DATA_UNAVAILABLE`, `GRID_DATA_INVALID`, `DATA_UNAVAILABLE`, `DATA_INVALID` |
| 500 | `INTERNAL_ERROR` |

CORS padrão: `http://localhost:5173`, `http://127.0.0.1:5173`. Sem fallback automático a dados simulados. `/api/health` descreve o snapshot; disponibilidade das grades vem de `/api/grids`.
