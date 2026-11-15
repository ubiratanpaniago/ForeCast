# Metodologia do protótipo

## Produtos e unidades

| Produto | Variável | Unidade original | Resultado anual |
| --- | --- | --- | --- |
| GPM_3IMERGM_07, arquivos V07B, 0,1° | `precipitation` | mm/hr | Soma de taxa mensal × horas reais de cada mês, em mm |
| GLDAS_NOAH025_M_2.1, 0,25° | `SoilMoi0_10cm_inst` | kg m-2 | Média ponderada pelos dias dos meses, em kg/m² |

Período: 2001–2024, 288 arquivos por produto. Conferimos SHA-256 contra o manifesto raw, datas contra o calendário e unidades antes da conversão. Anos bissextos usam 366 dias.

Fontes: [catálogo IMERG mensal](https://disc.gsfc.nasa.gov/datasets/GPM_3IMERGM_07/summary), [documentação técnica IMERG](https://gpm.nasa.gov/sites/default/files/2023-07/IMERG_TechnicalDocumentation_final_230713.pdf), [catálogo GLDAS](https://disc.gsfc.nasa.gov/datasets/GLDAS_NOAH025_M_2.1/summary), [README GLDAS](https://hydro1.gesdisc.eosdis.nasa.gov/data/GLDAS/README_GLDAS2.pdf).

DOIs: IMERG `10.5067/GPM/IMERG/3B-MONTH/07`; GLDAS `10.5067/SXAVCZFAQLNO`. Umidade GLDAS é simulada por modelo, não uma medição direta do solo.

## Espaço

Recorte raw: oeste −58°, sul −34°, leste −47°, norte −22°. Índices globais e coordenadas são conferidos contra `grid_spec.json`. Origem de latitude: IMERG −90°, GLDAS −60°; longitude −180° para ambos, centros a meia célula.

Máscara: limites oficiais simplificados do IBGE em `backend/data/reference/south-regions.geojson`, códigos 41, 42 e 43; cópia idêntica no frontend para contexto. Fonte: API de malhas [Paraná](https://servicodados.ibge.gov.br/api/v3/malhas/estados/41?formato=application/vnd.geo%2Bjson&qualidade=minima), mesmas opções para 42/43. A cópia não informa edição da malha; o hash em `provenance.json` fixa a geometria utilizada. A simplificação limita a exatidão costeira e de fronteira; não é máscara cadastral de alta precisão.

Selecionamos células com interseção de área positiva. Cada retângulo nativo é preservado integralmente: a série representa a célula inteira, inclusive sua parcela exterior. A fração de área usa elipsoide WGS84 e não altera valores. Grades independentes, sem interpolação ou média estadual.

## Qualidade e cobertura

xarray decodifica `_FillValue`. Valores não finitos e negativos ficam ausentes. IMERG também exclui índice de qualidade ausente ou negativo; nenhum limiar científico adicional foi inventado. Proveniência registra exclusões. Lacunas não viram zero.

Exigimos 12 meses válidos por célula para publicar um ano. API fornece `validMonths`. Células GLDAS sem dados de terra continuam selecionáveis com valores nulos: geometria e disponibilidade são distintas.

## Interpretação

Cor anual é magnitude de chuva ou umidade, não tendência ou risco. As anomalias do dossiê agregado usam sua própria média espacial 2001–2024 e não representam células nativas.

Módulo estatístico futuro: Mann-Kendall, Theil-Sen, intervalos de confiança, autocorrelação e limitações de múltiplas comparações. Nesta entrega, `statistics` e `summary` nativos são `null`. IMERG diário, RX1DAY e R50MM aguardam cobertura e validação. CMIP6, previsão de 72 horas, atribuição causal e risco de inundação ficam fora do MVP.
