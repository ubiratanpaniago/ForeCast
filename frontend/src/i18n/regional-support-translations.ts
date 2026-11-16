/**
 * English strings used by the regional-analysis route and SupportMap.
 * Literal keys match the Portuguese text passed to t(). Placeholder patterns
 * are kept intact for any caller that interpolates API-generated messages.
 */
export const REGIONAL_SUPPORT_ENGLISH: Record<string, string> = {
  // Regional page: navigation, heading, and controls
  "Investigação regional": "Regional analysis",
  "Navegação principal": "Main navigation",
  "Dossiê": "Home",
  "Grades nativas": "Native grids",
  "Idioma": "Language",
  "Onde a chuva extrema está mudando no Sul — e por onde passam as rodovias.":
    "Where extreme rainfall is changing in southern Brazil — and where the highways run.",
  "Tendências 2001–2024 (Mann-Kendall, Theil-Sen, FDR por célula) em 21 regiões intermediárias do IBGE, sobre dados NASA IMERG e GLDAS, cruzadas com BRs e rodovias estaduais e a suscetibilidade preliminar do relevo (NASADEM). Evidência de mudança no perigo, não risco de desastre.":
    "Trends from 2001–2024 (Mann-Kendall, Theil-Sen, cell-level FDR) across 21 IBGE intermediate regions, using NASA IMERG and GLDAS data, compared with federal and state highways and preliminary terrain susceptibility (NASADEM). This is evidence of changing hazard, not disaster risk.",
  "Indicador": "Indicator",
  "Camadas": "Layers",
  "Relevo NASADEM": "NASADEM terrain",
  "Rodovias": "Highways",
  "Travessias candidatas": "Candidate crossings",
  "carregando": "Loading",

  // Indicator labels, questions, products, and units
  "Maior chuva diária do ano": "Highest daily rainfall of the year",
  "Os maiores acumulados diários estão aumentando?": "Are the highest daily rainfall totals increasing?",
  "GPM IMERG Final diário V07 · 0,1°": "GPM IMERG Final daily V07 · 0.1°",
  "Dias com chuva ≥ 50 mm": "Days with rainfall ≥ 50 mm",
  "Dias de chuva muito forte estão mais frequentes?": "Are very heavy rainfall days becoming more frequent?",
  "Precipitação anual": "Annual precipitation",
  "O total de chuva do ano está mudando?": "Is the year's total rainfall changing?",
  "GPM IMERG Final mensal V07 · 0,1°": "GPM IMERG Final monthly V07 · 0.1°",
  "Umidade do solo 0–10 cm": "Soil moisture at 0–10 cm",
  "A água armazenada na camada superficial está mudando?": "Is the water stored in the top soil layer changing?",
  "GLDAS Noah mensal V2.1 · 0,25° · modelado": "GLDAS Noah monthly V2.1 · 0.25° · modeled",
  "RX1DAY": "RX1DAY",
  "R50MM": "R50MM",
  "PRCP": "PRCP",
  "Solo": "Soil",
  "mm": "mm",
  "dias": "days",
  "kg/m²": "kg/m²",

  // Trend classes and their accessible descriptions
  "Agravamento detectado": "Worsening detected",
  "Redução detectada": "Decrease detected",
  "Aumento significativo": "Significant increase",
  "Redução significativa": "Significant decrease",
  "Sem tendência significativa": "No significant trend",
  "Dados insuficientes": "Insufficient data",
  "Tendência significativa na direção desfavorável (mais chuva extrema).":
    "A significant trend in the unfavorable direction (more extreme rainfall).",
  "Tendência significativa na direção oposta à desfavorável.":
    "A significant trend in the opposite of the unfavorable direction.",
  "Aumento significativo; o indicador não tem uma direção desfavorável única.":
    "A significant increase; this indicator has no single unfavorable direction.",
  "Redução significativa; o indicador não tem uma direção desfavorável única.":
    "A significant decrease; this indicator has no single unfavorable direction.",
  "A evidência não basta para afirmar mudança monotônica — não significa estabilidade.":
    "The evidence is not enough to establish a monotonic change; this does not mean conditions are stable.",
  "Não há dados suficientes para concluir.": "There is not enough data to draw a conclusion.",

  // Map labels, tooltips, and loading/error states
  "Travessia candidata": "Candidate crossing",
  "em célula de relevo alta": "in a high-susceptibility terrain cell",
  "Relevo (fração de planície baixa por célula de 0,1°):":
    "Terrain (share of low-lying land per 0.1° cell):",
  "alta": "high",
  "média": "medium",
  "baixa": "low",
  "BR (federal)": "Federal highway",
  "estadual": "state highway",
  "travessia candidata": "candidate crossing",
  "limites das regiões": "region boundaries",
  "Limites: IBGE · Rodovias: © colaboradores do OpenStreetMap (ODbL) · Relevo: NASA NASADEM":
    "Boundaries: IBGE · Highways: © OpenStreetMap contributors (ODbL) · Terrain: NASA NASADEM",
  "Mapa de PR, SC e RS": "Map of Paraná, Santa Catarina, and Rio Grande do Sul",
  "Carregando mapa…": "Loading map…",
  "Este navegador não conseguiu iniciar o mapa (WebGL indisponível).":
    "This browser could not start the map (WebGL is unavailable).",
  "Falha ao desenhar o mapa.": "The map could not be rendered.",
  "Pontos de apoio e camadas do sistema": "Support points and system layers",
  "Selecionar ponto de apoio": "Select support point",
  "Estradas indisponíveis.": "Highways are unavailable.",
  "Relevo indisponível.": "Terrain data is unavailable.",
  "Carregando camada do sistema…": "Loading system layer…",
  "Carregando o mapa do Sul…": "Loading the map of southern Brazil…",

  // Regional summary, diagnosis, table, and chart
  "resultados de": "results for",
  "síntese": "summary",
  "Síntese": "Summary",
  "de": "of",
  "regiões com tendência significativa": "regions with a significant trend",
  "Período 2001–2024. Direção atribuída pelo pipeline quando p < 0,05 e o IC 95 % de Sen exclui o zero, sem correção para testes múltiplos entre regiões. Clique numa região para o diagnóstico completo, com o teste FDR por célula.":
    "Period: 2001–2024. The pipeline assigns a direction when p < 0.05 and Sen's 95% confidence interval excludes zero; no multiple-testing correction is applied across regions. Select a region for the full diagnosis, including the cell-level FDR test.",
  "Rodovias × relevo": "Highways × terrain",
  "em": "in",
  "trechos": "segments",
  "em células de suscetibilidade alta": "in high-susceptibility cells",
  "Ligue “Rodovias” e clique num trecho para ver a exposição. Diagnóstico exploratório.":
    "Turn on “Highways” and select a segment to view exposure. Exploratory assessment.",
  "Ligue “Rodovias” ou “Relevo NASADEM” para o diagnóstico exploratório de exposição dos trechos.":
    "Turn on “Highways” or “NASADEM terrain” to explore segment exposure.",
  "Diagnóstico de": "Diagnosis for",
  "Estado": "State",
  "Região intermediária": "Intermediate region",
  "Fechar diagnóstico": "Close diagnosis",
  "Evidência de mudança no perigo hidrometeorológico, 2001–2024. Não é risco de desastre.":
    "Evidence of a change in hydrometeorological hazard from 2001–2024. This is not a disaster-risk assessment.",
  "Carregando a classificação dos indicadores…": "Loading indicator classifications…",
  "Classificação": "Classification",
  "série histórica": "historical series",
  "década": "decade",
  "IC 95 %": "95% CI",
  "a": "to",
  "p bruto": "raw p-value",
  "Método e notas de qualidade": "Method and quality notes",
  "Células dentro da região, após FDR": "Cells within the region, after FDR",
  "resultados por célula": "cell-level results",
  "Nenhuma célula com centro dentro desta região.": "No cell centers fall within this region.",
  "Barra: fração das células com p < 0,05 sem correção; o traço marca 5 %, o esperado ao acaso. A correção Benjamini-Hochberg (q = 0,05) foi aplicada pelo pipeline entre as":
    "Bar: share of cells with p < 0.05 before correction; the marker shows 5%, the rate expected by chance. The pipeline applied the Benjamini-Hochberg correction (q = 0.05) across",
  "células do indicador.": "cells for this indicator.",
  "O que estes dados não permitem afirmar": "What these data cannot tell us",
  "Risco de enchente ou de desastre: faltam exposição, vulnerabilidade, relevo detalhado e drenagem.":
    "Flood or disaster risk: exposure, vulnerability, detailed terrain, and drainage data are missing.",
  "Causa da mudança: 24 anos não separam tendência de longo prazo de variabilidade (El Niño/La Niña).":
    "Cause of the change: 24 years cannot separate a long-term trend from natural variability (El Niño/La Niña).",
  "Resultado regional sem correção para testes múltiplos: com 24 áreas e 4 indicadores, alguns p < 0,05 surgem por acaso.":
    "Regional results are not corrected for multiple testing: with 24 areas and 4 indicators, some p-values below 0.05 may occur by chance.",
  "Umidade do solo é saída do modelo GLDAS, não medição.": "Soil moisture is a GLDAS model output, not a direct measurement.",
  "Série anual": "Annual series",
  "com reta de Theil-Sen": "with Theil-Sen trend line",
  "sem dado": "no data",
  "valor anual": "annual value",
  "não significativa": "not significant",
  "IC 95 % da inclinação": "95% slope confidence interval",

  // Road-segment exposure panel
  "Trecho": "Segment",
  "Rodovia": "Highway",
  "federal": "federal",
  "Também": "Also",
  "Fechar trecho": "Close segment",
  "do trecho passam por células de suscetibilidade alta.": "of the segment cross high-susceptibility cells.",
  "Diagnóstico exploratório de exposição do relevo. Não é risco de interdição.":
    "Exploratory terrain-exposure assessment. This is not a road-closure risk estimate.",
  "Extensão por classe do relevo": "Length by terrain class",
  "Distribuição da extensão por classe de suscetibilidade": "Segment length by susceptibility class",
  "Alta": "High",
  "Média": "Medium",
  "Baixa": "Low",
  "Sem dado": "No data",
  "Total": "Total",
  "em célula com": "in a cell with",
  "de planície baixa": "low-lying land",
  "Nenhuma passagem de": "No crossing of",
  "ou mais por célula de classe alta.": "or more through a high-susceptibility cell.",
  "Como foi calculado e limitações": "How this was calculated and its limitations",
  "Rodovia dividida em pedaços de": "Highways were divided into segments of",
  "cada pedaço recebe a classe da célula de 0,1° do relevo onde cai. Travessia candidata: ao menos":
    "Each segment is assigned the class of the 0.1° terrain cell it crosses. A candidate crossing is at least",
  "dentro de uma célula de classe alta.": "within a high-susceptibility cell.",

  // Loading/error component and actual API error messages
  "Carregando": "Loading",
  "Não foi possível carregar": "Could not load",
  "Inicie a API em backend/ (uvicorn app.main:app --port 8000).":
    "Start the API from the backend folder (uvicorn app.main:app --port 8000).",
  "Os arquivos derivados não estão publicados no backend.": "The derived data files are not available on the backend.",
  "API indisponível. Verifique se o backend está rodando.": "API unavailable. Check that the backend is running.",
  "Catálogo de regiões incompatível com o contrato.": "The region catalog does not match the expected contract.",
  "GeoJSON de regiões inválido.": "The region GeoJSON is invalid.",
  "Resumo regional incompatível com o catálogo.": "The regional summary does not match the catalog.",
  "Resumo de células incompatível com o catálogo.": "The cell summary does not match the catalog.",

  // Quality notes and infrastructure limitations currently returned by the API
  "Índice calculado sobre a chuva diária média da região (ponderada por área), não sobre cada célula.":
    "The index uses area-weighted regional mean daily rainfall, not individual cells.",
  "Média regional ponderada pela área de cada célula dentro da região (cos lat × fração).":
    "Regional mean weighted by each cell's area within the region (cos latitude × fraction).",
  "Sem correção para testes múltiplos entre regiões: com 24 regiões e 5 indicadores, alguns resultados com p < 0,05 são esperados por acaso.":
    "No multiple-testing correction is applied across regions: with 24 regions and 5 indicators, some p-values below 0.05 are expected by chance.",
  "Diagnóstico exploratório de exposição; não estima risco de interdição, dano ou probabilidade de inundação.":
    "Exploratory exposure assessment; it does not estimate road-closure risk, damage, or flood probability.",
  "Suscetibilidade em células de 0,1° (~10 km): indica a fração de planície baixa na célula, não a posição exata da rodovia em relação ao rio.":
    "Susceptibility is shown on 0.1° cells (~10 km): it indicates the share of low-lying land in each cell, not the highway's exact position relative to a river.",
  "A camada de relevo é preliminar (aproximação do HAND com janela de ~15 km), sem rede de drenagem nem obras de arte (pontes, aterros).":
    "The terrain layer is preliminary (a HAND approximation with a ~15 km window) and does not include drainage networks or structures such as bridges and embankments.",
  "Malha do OpenStreetMap: cobertura e códigos podem estar incompletos; não é o SNV oficial do DNIT.":
    "OpenStreetMap coverage and road codes may be incomplete; this is not the official DNIT road network.",
  "Trechos são agrupados por código e região intermediária; vias com mais de um código usam o federal como principal.":
    "Segments are grouped by road code and intermediate region; roads with multiple codes use the federal code as the primary one.",
  "Pistas separadas (vias OSM de mão única) contam metade cada, para medir a rodovia e não as pistas; trechos urbanos de mão única ficam subestimados.":
    "Separate one-way OSM carriageways count as half each, so the measure reflects the highway rather than the carriageways; urban one-way segments may be underestimated.",

  // API-generated patterns: preserve placeholders for interpolation by callers
  "Camada {name} incompatível com o catálogo.": "The {name} layer does not match the catalog.",
  "HTTP {status}": "HTTP {status}",
  "não encontrado.": "not found.",
  "rodovias": "roads",
  "travessias candidatas": "candidate crossings",
};
