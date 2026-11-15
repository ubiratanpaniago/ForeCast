# Auditoria dos dados pré-calculados

Gerado por `backend/scripts/audit_export.py` em 2026-11-15 sobre `frontend/public/data` (revisão `2026-11-15-9a5e7074`).

O script não altera dados. Recalcula as estatísticas a partir das séries publicadas e confronta os indicadores entre si e com a cadeia independente da API.

**Resultado: 1 erros, 5 avisos.**

## Grades nativas

| Grade | Indicador | Células | Com estatística | Aumento | Redução | Inconclusiva | Série constante |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `imerg-monthly-v07` | PRCP_ANNUAL | 5462 | 5462 | 0 | 0 | 5462 | 0 |
| `imerg-daily-v07` | RX1DAY | 5462 | 5462 | 0 | 0 | 5462 | 0 |
| `imerg-daily-v07` | R50MM | 5462 | 5462 | 2 | 1 | 5459 | 0 |
| `gldas-noah-monthly-v21` | SOIL_SURFACE | 935 | 883 | 0 | 0 | 883 | 0 |
| `gldas-noah-monthly-v21` | SOIL_ROOT | 935 | 883 | 0 | 0 | 883 | 0 |

## Coerência entre indicadores

- RX1DAY × R50MM: 131088 célula-anos conferidos, 0 incoerências (R50MM > 0 exige RX1DAY ≥ 50 mm e vice-versa).
- PRCP_ANNUAL ≥ RX1DAY: 5462 células em comum, 0 célula-anos em que a máxima diária supera o total anual; RX1DAY/total: mediana 0.051, p99 0.095.
- SOIL_ROOT ≥ SOIL_SURFACE: 935 células, 0 célula-anos violando.

## Comparação com os derivados da API (cadeia independente)

| Indicador | Células só aqui | Células só na API | Em comum | Dif. máx. | Célula-anos > tolerância |
| --- | ---: | ---: | ---: | ---: | ---: |
| PRCP_ANNUAL | 19 | 15 | 5443 | 0.0042 | 0 |
| SOIL_SURFACE | 2 | 2 | 933 | 0.0819 | 551 |

Causa conhecida da divergência em umidade do solo: `export_grids.py` faz a média simples dos 12 meses, enquanto `prepare_native_grids.py` (e `docs/methodology.md`) ponderam cada mês pelo número de dias. A diferença é pequena (até ~0,1 kg/m², ~0,3 %), mas as duas cadeias precisam usar o mesmo método.

## Regiões

- 24 regiões (21 intermediárias + 3 estados) × 5 indicadores = 120 séries.
- Tendências com p < 0,05 e IC excluindo zero, por indicador: PRCP_ANNUAL 0/24, R50MM 0/24, RX1DAY 1/24, SOIL_ROOT 5/24, SOIL_SURFACE 5/24.
- Sem correção para testes múltiplos: com α = 0,05, cerca de 6 resultados "significativos" seriam esperados por acaso entre 120 testes; hoje há 11.

## Áreas seguras (POA e TAQ)

- **POA** (Porto Alegre e região): 50 locais no GeoJSON; área inundada observada em 2024 caindo na classe segura: 0.01%; melhor F1 0.564 com limiar de 2 m (precisão 0.45, recall 0.76).
- **TAQ** (Vale do Taquari): 50 locais no GeoJSON; área inundada observada em 2024 caindo na classe segura: 0.01%; melhor F1 0.047 com limiar de 1 m (precisão 0.03, recall 0.37).

## Erros

- SOIL_SURFACE: 551 célula-anos diferem dos derivados da API em mais de 0.05

## Avisos

- RX1DAY: em 3 células o p recalculado da série publicada (2 casas) difere do publicado (mais de 0,02 ou do outro lado de 0,05), sem mudar a direção após FDR. O arredondamento cria empates no Mann-Kendall; publicar a série com mais casas tornaria a estatística reprodutível a partir do arquivo.
- SOIL_SURFACE: em 29 células o p recalculado da série publicada (2 casas) difere do publicado (mais de 0,02 ou do outro lado de 0,05), sem mudar a direção após FDR. O arredondamento cria empates no Mann-Kendall; publicar a série com mais casas tornaria a estatística reprodutível a partir do arquivo.
- PRCP_ANNUAL: seleção de células difere da API (19 só aqui, 15 só na API); export_grids descarta interseções < 0,01 % da célula e usa área planar
- SOIL_SURFACE: seleção de células difere da API (2 só aqui, 2 só na API); export_grids descarta interseções < 0,01 % da célula e usa área planar
- safe-areas/TAQ: melhor F1 contra a mancha de 2024 é 0.047 (precisão 0.03); a classe de suscetibilidade não reproduz a cheia observada nesta área, só a classe segura foi validada
