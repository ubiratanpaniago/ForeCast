# Integração das grades nativas — contrato frontend v0.3

## Escopo

Somente frontend. Não foram executados Earthdata Login, download NASA, subset, conversões, cálculos anuais ou ingestão. A análise do plano é compatível com a UI desde que IDs, alinhamento, máscara e metadados sejam explícitos. Nenhuma célula nem dado climático foi criado para a tela.

PR/SC/RS continuam como limites reais do IBGE. A seleção científica passa a ser uma célula da grade ativa. IMERG mensal, diário e GLDAS são produtos separados no catálogo: resolução nominal igual não prova alinhamento entre as coordenadas mensal/diária. O pipeline deve verificá-lo antes de compartilhar IDs. GLDAS nunca é interpolado para IMERG.

## Entrega P0 para habilitar a tela

1. Um catálogo marcando o IMERG mensal como disponível, com resolução, produto, versão, período e revisão do processamento.
2. GeoJSON real de células nativas do Sul, com IDs estáveis, índices da grade global, centros, bounds e cobertura/interseção.
3. Uma série anual por célula, com anos ausentes null e proveniência. Estatísticas são opcionais: o pipeline de ingestão não precisa implementar Mann-Kendall para a série ser consultável.

A UI inicia sem células porque `frontend/public/data/grids/catalog.json` marca todos os produtos como indisponíveis. Esse catálogo contém planejamento, não resultados de aquisição. Não altere available para true antes de entregar os arquivos reais.

## Transporte

MapLibre consome GeoJSON nesta versão. NetCDF/Zarr/Parquet continuam no processamento/armazenamento; não são lidos diretamente pelo navegador. GeoParquet precisa de um exportador GeoJSON ou de adaptação no backend. Não colocar décadas de dados globais no bundle.

### Modo API

Em `frontend/.env.local`:

```dotenv
VITE_GRID_MODE=api
VITE_API_BASE_URL=http://localhost:8000
```

Reiniciar Vite. Endpoints propostos:

- `GET /api/grids` → `{ grids: GridDefinition[] }`.
- `GET /api/grids/{gridId}/cells?indicator=PRCP_ANNUAL&start=2001&end=2024&bbox=-58,-34,-47,-22&limit=20000` → GridCells.
- `GET /api/grids/{gridId}/cells/{cellId}/timeseries?indicator=PRCP_ANNUAL&start=2001&end=2024` → CellDetail.

Grade e resumos são carregados uma vez por produto/indicador/período; apenas a célula selecionada dispara consulta de série. Não há uma requisição de tendência por célula do mapa. Trocas cancelam requisições anteriores e invalidam a seleção ao trocar de produto.

O recorte atual é o BBOX completo de estudo, limitado a 20 mil células por resposta. A UI rejeita truncated=true explicitamente. Grades maiores exigirão paginação ou vector tiles antes de aumentar o limite. Não há tiles, paginação nem carregamento por viewport implementados nesta versão.

### Modo de arquivos reais locais

`VITE_GRID_MODE=local` é o padrão. O pipeline/exportador pode fornecer:

```text
frontend/public/data/grids/
├── catalog.json
└── {gridId}/
    ├── cells/{indicator}/{start}-{end}.geojson
    └── series/{cellId}/{indicator}/{start}-{end}.json
```

Não é um modo mock. A mesma validação de dados reais é usada. Arquivo ausente produz indisponibilidade e botão de tentar novamente. Essa exportação local é uma opção inicial; grandes séries devem ficar fora do repositório e ser servidas pela API.

## Tipos e invariantes

A fonte dos tipos é `frontend/src/types/grid.ts`:

- GridDefinition: id, name, productId, version, resolutionDegrees (0.1 ou 0.25), crs=EPSG:4326, indicators, period, revision, available e motivo de indisponibilidade opcional.
- GridCells: FeatureCollection de Polygon com gridId, revision, indicator, period, truncated. Células sem dados continuam presentes com summary=null quando a geometria existe.
- GridCell (properties): id string estável, gridId, row/column globais não negativos, center=[longitude,latitude], bounds=[west,south,east,north], fractionInside (0–1 ou null), summary.
- summary: indicador, período, statistics e metadata do contrato TrendResult, sem series ou regionId. Opcional por célula; null significa análise não fornecida. Nenhum resumo exige baixar séries.
- CellDetail: gridId, revision, cellId, indicator, period, series (todos os anos inclusivos, value numérico ou null), statistics (objeto estatístico ou null), metadata (unidade, produto, versão, DOI, notas de qualidade, demonstrative=false).

Os objetos statistics/metadata seguem os tipos em geography.ts e as regras em api-contract.md. sourceDOI deve ser DOI puro. Unit é mm, dias ou kg/m², conforme indicador; Sen e IC são nessa unidade por década. Estatísticas opcionais não são calculadas no browser. Notas devem conter completude e limitações; contagens de dias/meses válidos devem ser adicionadas pela equipe a um campo estruturado versionado, se necessário.

A geometria é o retângulo NATIVO completo da célula, derivado de coordinate bounds oficiais ou dos centros e passo verificados no arquivo. Não usar uma malha nova ancorada no BBOX de recorte. Não recalcular IDs por posição no array do subset. IDs devem identificar produto/grade e índice nativo estável; revision identifica a versão dos derivados. A UI mantém a grade ativa separada dos IDs.

A máscara determina inclusão/interseção com PR/SC/RS. Células costeiras/fronteiriças podem manter a geometria completa e fractionInside; isso preserva a grade, sem fingir maior resolução. O backend deve documentar se a máscara usa centro ou interseção, a fração elegível e a política de qualidade. O cliente valida largura/altura nominal, centro, retângulo fechado, IDs duplicados, recorte, revisão e unidades. Não certifica origem NASA ou integridade científica.

Frações e polígonos não podem ser fabricados pelo frontend. A malha IBGE simplificada local serve ao CONTEXTO; a máscara científica deve usar geometria apropriada obtida pelo pipeline e ter sua própria proveniência.

## Prioridades e pendências

- P0: IMERG mensal / PRCP_ANNUAL; mapa de células e consulta de série sem exigir estatística.
- P1: IMERG diário / RX1DAY e R50MM; extremos calculados por célula ao longo dos dias do ano, antes de qualquer agregação regional futura.
- P2: GLDAS mensal / SOIL_SURFACE; grade de 0.25° independente. SOIL_ROOT saiu do catálogo ativo porque não está no escopo fornecido.
- Confirmar com a equipe: IDs e alinhamento entre produtos, origem de bounds, máscara, revisão dos derivados, unidade e cobertura anual, estatísticas opcionais, formato dos erros, CORS e cache.

Os endpoints estaduais anteriores continuam documentados como legado. O App atual usa somente gridApi, não importa mockClimateData e não chama endpoints de projeção, previsão ou tendência por estado. Os antigos fixtures/testes de contrato foram preservados como material de desenvolvimento, sem conexão à interface ativa.
