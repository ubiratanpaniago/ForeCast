# Contrato da API — protótipo integrado

## Chuva mensal nativa

- `GET /api/monthly-rainfall`: manifesto com 288 meses, eixos nativos, IDs/índices, referência por mês do calendário, cobertura e proveniência.
- `GET /api/monthly-rainfall/years/{year}?revision={revision}`: 12 quadros mensais do ano; `values` segue a ordem de células do manifesto. Revisão antiga retorna 409.
- `GET /api/monthly-rainfall/cells/{cellId}/timeseries`: 288 meses da célula, com acumulado, referência, contagem de anos válidos e anomalia percentual.

Unidade: mm acumulados no mês. Zero real é válido; ausência é `null`. Referência exige os 24 meses homólogos de 2001–2024. Referência zero não permite anomalia percentual. Os contratos anuais existentes continuam disponíveis. Consulte [o contrato e a metodologia completos](monthly-rainfall.md).

Base local: `http://127.0.0.1:8000`. Somente GET; JSON UTF-8. GeoJSON WGS84, ordem longitude/latitude. Períodos anuais inclusivos. A API lê derivados locais; não baixa dados nem calcula tendências durante requisições.

| Endpoint | Resposta |
| --- | --- |
| `/api/health` | Estado do serviço e disponibilidade do snapshot |
| `/api/snapshot` | Snapshot agregado, com ETag e suporte a 304 |
| `/api/grids` | `{ grids: GridDefinition[] }` |
| `/api/grids/{gridId}/cells` | FeatureCollection das células inteiras do recorte |
| `/api/grids/{gridId}/cells/{cellId}/timeseries` | Série anual da célula, cobertura e proveniência |
| `/api/regions` | GeoJSON das 21 regiões intermediárias do IBGE e de PR/SC/RS |
| `/api/regions/catalog` | Revisão, período, indicadores e lista de regiões, sem séries |
| `/api/regions/summary?indicator=` | Estatística de todas as regiões para um indicador, sem séries |
| `/api/regions/{regionId}/trends?indicator=&start=&end=` | `TrendResult` completo de uma região |
| `/api/regions/cell-fdr?indicator=` | Por região, células com tendência após FDR e com p bruto < 0,05 |
| `/api/infrastructure` | Fontes, parâmetros, totais e limitações do cruzamento rodovias × relevo |
| `/api/infrastructure/{roads,crossings,terrain}` | Trechos rodoviários, travessias candidatas e células de relevo (GeoJSON) |
| `/api/infrastructure/segments/{segmentId}` | Um trecho com suas travessias candidatas |
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

## Regiões

Resultados pré-calculados pelo pipeline de dados (`feat/nasa-data`, `export_grids.py`) e publicados em `backend/data/derived/regions/` por `scripts/import_region_results.py`, que valida cada arquivo com as regras de `frontend/src/services/trendContract.ts` e gera uma revisão SHA-256. A API não calcula estatística.

- Regiões: 21 intermediárias do IBGE (`level: "regiao_intermediaria"`, IDs `4101`…`4308`) e os três estados (`level: "estado"`, IDs `41`, `42`, `43`).
- Indicadores: `PRCP_ANNUAL`, `RX1DAY`, `R50MM`, `SOIL_SURFACE`. `SOIL_ROOT` existe no pipeline, mas está fora do escopo do catálogo ativo.
- Período fixo 2001–2024. `start`/`end` diferentes retornam 422 `INVALID_PERIOD`: recortar a série invalidaria a estatística calculada.

`/api/regions/{regionId}/trends` devolve o `TrendResult` de `frontend/src/types/geography.ts` (mesmo endpoint já usado por `climateMapApi.ts`): `regionId`, `indicator`, `period`, `series` (24 anos, `value` ou `null`), `statistics` (`slopePerDecade` por década, `pValue` bruto, `tau`, `confidenceInterval95`, `direction`, `status`, `method`) e `metadata` (`unit`, `productId`, `version`, `sourceDOI`, `qualityNotes`, `demonstrative: false`).

`/api/regions/summary` devolve `{ revision, indicator, period, metadata, regions: { [regionId]: statistics } }`, para colorir um mapa com uma requisição em vez de uma por região. `revision` deve coincidir com o catálogo.

Método regional (do pipeline): Mann-Kendall na série anual da média regional ponderada por área, Theil-Sen e IC 95 % (Gilbert, 1987); `direction` exige p < 0,05 e IC sem zero; **sem correção para testes múltiplos entre regiões**, conforme `qualityNotes`. RX1DAY e R50MM regionais são calculados sobre a chuva diária média da região, não sobre cada célula.

Leitura no frontend: `frontend/src/services/regionApi.ts` (cache por URL, sem carregar todas as séries) e `frontend/src/hooks/useRegionalTrends.ts`.

### Células após FDR, por região

`/api/regions/cell-fdr?indicator=` resume os resultados por célula do pipeline (`export_grids.py`), em que a direção `increasing`/`decreasing` só existe quando a célula passa na correção Benjamini-Hochberg (q = 0,05) entre todas as células do indicador e o IC 95 % de Sen exclui o zero. Gerado por `scripts/build_region_cell_fdr.py`, que só conta (célula pertence à região se o centro está no polígono):

```typescript
interface CellFdr {
  revision: string; // igual ao catálogo de regiões
  indicator: IndicatorId;
  gridId: string;
  resolutionDegrees: number;
  cellsTested: number; // células do indicador em todo o Sul (base da correção)
  method: string;
  qualityNotes: string[];
  regions: Record<string, { cells: number; increasing: number; decreasing: number;
                            inconclusive: number; raw_p_below_005: number; no_data: number }>;
}
```

`raw_p_below_005` é indício sem correção para testes múltiplos; ~5 % das células o atingem por acaso.

## Infraestrutura (diagnóstico exploratório)

Gerado por `scripts/build_road_exposure.py`; método e limitações em [infrastructure-exposure.md](infrastructure-exposure.md). Todas as camadas trazem `revision`, que deve coincidir com `/api/infrastructure`.

- `roads`: `MultiLineString` por trecho = código principal (BR, PR, SC, ERS, RSC) × região intermediária. Propriedades: `id` (`"BR-101@4202"`), `ref`, `refs`, `jurisdiction` (`federal`/`estadual`), `highway`, `uf`, `regionId`, `regionName`, `lengthKm`, `lengthByClassKm` (`alta`, `media`, `baixa`, `sem_dado`), `shareHigh`, `crossingCount`.
- `crossings`: `Point` no centro (ponderado pela extensão) da passagem do trecho por uma célula de classe alta. Propriedades: `id`, `segmentId`, `ref`, `regionId`, `regionName`, `row`, `column`, `lengthKm`, `susceptibleFraction`, `elevationMeanM`, `slopeMeanDeg`.
- `terrain`: `Polygon` de cada célula de 0,1° com `class` (1 baixa, 2 média, 3 alta), `label` e `susceptibleFraction`.

Erros próprios: 404 `LAYER_NOT_FOUND`, `SEGMENT_NOT_FOUND`.

## Erros

Envelope: `{ "error": { "code": "INVALID_PERIOD", "message": "..." } }`.

| HTTP | Códigos |
| --- | --- |
| 404 | `GRID_NOT_FOUND`, `CELL_NOT_FOUND`, `REGION_NOT_FOUND`, `LAYER_NOT_FOUND`, `SEGMENT_NOT_FOUND`, `NOT_FOUND` |
| 413 | `CELL_LIMIT_EXCEEDED` |
| 422 | `INVALID_FILTER`, `INVALID_BBOX`, `INVALID_INDICATOR`, `INVALID_PERIOD` |
| 503 | `GRID_NOT_READY`, `GRID_DATA_UNAVAILABLE`, `GRID_DATA_INVALID`, `DATA_UNAVAILABLE`, `DATA_INVALID` |
| 500 | `INTERNAL_ERROR` |

CORS padrão: `http://localhost:5173`, `http://127.0.0.1:5173`. Sem fallback automático a dados simulados. `/api/health` descreve o snapshot; disponibilidade das grades vem de `/api/grids`.
