# Metodologia do protótipo

## Produtos e unidades

| Produto | Variável | Unidade original | Resultado anual |
| --- | --- | --- | --- |
| GPM_3IMERGM_07, arquivos V07B, 0,1° | `precipitation` | mm/hr | Soma de taxa mensal × horas reais de cada mês, em mm |
| GLDAS_NOAH025_M_2.1, 0,25° | `SoilMoi0_10cm_inst` | kg m-2 | Média ponderada pelos dias dos meses, em kg/m² (`SOIL_SURFACE`) |
| GLDAS_NOAH025_M_2.1, 0,25° | `RootMoist_inst` | kg m-2 | Média anual da zona radicular, em kg/m² (`SOIL_ROOT`) |
| GPM_3IMERGDF_07, arquivos V07B, 0,1° | `precipitation` | mm/dia | Maior chuva diária do ano (`RX1DAY`, mm) e dias com ≥ 50 mm (`R50MM`, dias) |

Período: 2001–2024, 288 arquivos por produto mensal e 8.766 arquivos diários (todos os dias de 2001 a 2024). Conferimos SHA-256 contra o manifesto raw, datas contra o calendário e unidades antes da conversão. Anos bissextos usam 366 dias.

Fontes: [catálogo IMERG mensal](https://disc.gsfc.nasa.gov/datasets/GPM_3IMERGM_07/summary), [documentação técnica IMERG](https://gpm.nasa.gov/sites/default/files/2023-07/IMERG_TechnicalDocumentation_final_230713.pdf), [catálogo GLDAS](https://disc.gsfc.nasa.gov/datasets/GLDAS_NOAH025_M_2.1/summary), [README GLDAS](https://hydro1.gesdisc.eosdis.nasa.gov/data/GLDAS/README_GLDAS2.pdf).

DOIs: IMERG `10.5067/GPM/IMERG/3B-MONTH/07`; IMERG diário `10.5067/GPM/IMERGDF/DAY/07`; GLDAS `10.5067/SXAVCZFAQLNO`. Umidade GLDAS é simulada por modelo, não uma medição direta do solo.

## Espaço

Recorte raw: oeste −58°, sul −34°, leste −47°, norte −22°. Índices globais e coordenadas são conferidos contra `grid_spec.json`. Origem de latitude: IMERG −90°, GLDAS −60°; longitude −180° para ambos, centros a meia célula.

Máscara: limites oficiais simplificados do IBGE em `backend/data/reference/south-regions.geojson`, códigos 41, 42 e 43; cópia idêntica no frontend para contexto. Fonte: API de malhas [Paraná](https://servicodados.ibge.gov.br/api/v3/malhas/estados/41?formato=application/vnd.geo%2Bjson&qualidade=minima), mesmas opções para 42/43. A cópia não informa edição da malha; o hash em `provenance.json` fixa a geometria utilizada. A simplificação limita a exatidão costeira e de fronteira; não é máscara cadastral de alta precisão.

Selecionamos células com interseção de área positiva. Cada retângulo nativo é preservado integralmente: a série representa a célula inteira, inclusive sua parcela exterior. A fração de área usa elipsoide WGS84 e não altera valores. Grades independentes, sem interpolação ou média estadual.

## Qualidade e cobertura

xarray decodifica `_FillValue`. Valores não finitos e negativos ficam ausentes. IMERG também exclui índice de qualidade ausente ou negativo; nenhum limiar científico adicional foi inventado. Proveniência registra exclusões. Lacunas não viram zero.

Exigimos 12 meses válidos por célula para publicar um ano. API fornece `validMonths`. Células GLDAS sem dados de terra continuam selecionáveis com valores nulos: geometria e disponibilidade são distintas.

## Interpretação

Cor anual é magnitude de chuva ou umidade, não tendência ou risco. As anomalias do dossiê agregado usam sua própria média espacial 2001–2024 e não representam células nativas.

CMIP6, previsão de 72 horas e atribuição causal ficam fora do MVP. As áreas seguras (abaixo) descrevem suscetibilidade do relevo validada com um evento, não probabilidade de inundação.

## Dados pré-calculados (`frontend/public/data`)

`backend/scripts/export_grids.py` gera os arquivos estáticos que o frontend lê nos modos `VITE_GRID_MODE=local` e `VITE_SNAPSHOT_MODE=static`, sem API. É uma segunda cadeia de processamento, com netCDF4 em vez de xarray, sobre os mesmos raw. `backend/scripts/validate_export.py` confere o formato do contrato. `backend/scripts/audit_export.py` confere o conteúdo e grava o relatório em [data-audit.md](data-audit.md).

Diferenças conhecidas em relação aos derivados da API:

- Seleção de células: descarta interseções menores que 0,01 % da célula e mede a fração por área planar em graus. A API usa área geodésica WGS84 sem limite mínimo. Ficam de 2 a 19 células diferentes, todas na borda.
- Umidade anual: `export_grids.py` usa a média simples dos 12 meses, e a API pondera os meses pelos dias. A diferença chega a ~0,1 kg/m² (~0,3 %). Precisa ser unificada antes da integração; o método documentado acima é o ponderado.
- Valores publicados com 2 casas decimais. A estatística é calculada antes do arredondamento, então recalcular a partir do arquivo pode dar p ligeiramente diferente quando o arredondamento cria empates (sobretudo `SOIL_SURFACE`).

### Indicadores diários

`download_imerg_daily.py` baixa o IMERG Final diário via OPeNDAP, com recorte no servidor (mesma grade 0,1° do mensal). Um ano só é calculado se todos os seus dias estiverem presentes, e uma célula só recebe valor no ano se não tiver nenhum dia ausente.

- `RX1DAY`: maior acumulado diário do ano, em mm.
- `R50MM`: número de dias do ano com chuva diária ≥ 50 mm. Contagem com muitos empates; o Mann-Kendall corrige a variância para empates, mas o poder do teste é baixo.
- Nas regiões, os índices são calculados sobre a chuva diária média da região, ponderada por área. Por isso o RX1DAY regional é menor que o RX1DAY das células: a média espacial suaviza os picos.

IMERG é estimativa por satélite, calibrada com pluviômetros no produto Final. Pode subestimar picos convectivos locais; os extremos devem ser lidos como do pixel de 0,1° (~11 km), não como de uma estação.

### Tendências

Para cada célula e indicador, sobre a série anual completa (24 anos):

1. Mann-Kendall original (`pymannkendall.original_test`), com correção de variância para empates.
2. Inclinação de Theil-Sen, publicada por década (`slopePerDecade`).
3. IC 95 % da inclinação pelo método de ranks de Gilbert (1987), usando a variância do teste. O IC sempre contém a inclinação publicada.
4. Correção para múltiplas comparações: Benjamini-Hochberg com q = 0,05, entre todas as células do mesmo indicador e grade.
5. `direction` é `increasing` ou `decreasing` só se a célula passa no FDR **e** o IC exclui zero. Caso contrário é `inconclusive`. `pValue` é o p bruto, antes do FDR.

Séries incompletas ou constantes recebem `status: insufficient` e todos os campos nulos. Nas regiões (21 intermediárias do IBGE + 3 estados) não há FDR: a direção usa p < 0,05 e IC excluindo zero, e as notas de qualidade avisam que, entre 120 testes, cerca de 6 resultados assim são esperados por acaso.

Limitações: 24 anos é uma série curta, sobretudo para extremos; o teste anual não corrige autocorrelação. Na revisão de 2026-11-15, nenhuma célula de `PRCP_ANNUAL`, `RX1DAY`, `SOIL_SURFACE` ou `SOIL_ROOT` passa no FDR, e só 3 de `R50MM` passam. A leitura correta é "não há tendência detectável célula a célula neste período", não "não há mudança".

`backend/scripts/analyze_trends.py` gera em `backend/data/historical/` uma análise exploratória separada, por região: anomalias mensais com Mann-Kendall modificado de Hamed-Rao (corrige autocorrelação), Mann-Kendall sazonal e regressão linear anual. Ela não é lida pelo frontend.

## Áreas seguras (POA e TAQ)

`backend/scripts/build_safe_areas.py` classifica, em ~30 m, as áreas de Porto Alegre e região (POA) e do Vale do Taquari (TAQ). Todas as fontes são abertas: GLO-30 HAND (ASF), Copernicus DEM GLO-30, ESA WorldCover 2021 e Sentinel-1 RTC de 11/05/2024.

- **Suscetível ao rio/lago principal:** altura acima do corpo d'água principal (≥ 1 km², até 15 km) menor que a subida da cheia de referência. A subida é de 5 m no Guaíba e 20 m no Taquari em Lajeado, a partir das cotas de pico de maio de 2024.
- **Baixada de arroio:** HAND < 5 m, fora da cheia do rio principal.
- **Segura:** HAND ≥ 15 m e acima da cheia de referência mais 5 m de margem.
- **Intermediária:** o restante. **Água permanente:** WorldCover classe 80.
- **Candidatos a ponto de apoio:** classe segura, declividade < 8°, uso do solo utilizável, área ≥ 5 ha e até 3 km de área urbana suscetível. São publicados no máximo 50 por área.

Validação: água no radar (limiar de Otsu em VV dB) menos a água permanente dá a mancha observada em 11/05/2024. Essa mancha é cruzada com as classes e com uma curva de limiares.

- Nas duas áreas, só 0,01 % da área alagada observada caiu na classe segura. Essa é a afirmação que a validação sustenta.
- Em POA a classe suscetível reproduz razoavelmente a mancha: F1 0,56 com limiar de 2 m.
- Em TAQ a concordância é baixa: F1 máximo 0,05 e precisão 0,03. A classe suscetível não deve ser apresentada como validada no Vale do Taquari.

O radar subestima alagamento em área urbana densa (reflexão dupla) e registra uma data só, já depois do pico em parte da região. Classes e pontos indicam relevo favorável, não abrigo verificado em campo.

