# ForeCast

## Arquitetura

```text
climate-forensics/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Map/
│   │   │   │   ├── ClimateMap.tsx
│   │   │   │   └── MapLayers.tsx
│   │   │   ├── Charts/
│   │   │   │   ├── HistoricalChart.tsx
│   │   │   │   └── ProjectionChart.tsx
│   │   │   └── Dashboard/
│   │   │       ├── RegionPanel.tsx
│   │   │       └── ForecastCard.tsx
│   │   ├── hooks/
│   │   │   └── useRegionData.ts
│   │   ├── services/
│   │   │   └── api.ts
│   │   ├── types/
│   │   │   └── climate.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── routers/
│   │   │   ├── regions.py
│   │   │   ├── historical.py
│   │   │   ├── projections.py
│   │   │   └── forecast.py
│   │   ├── services/
│   │   │   ├── nasa.py
│   │   │   ├── climate.py
│   │   │   ├── statistics.py
│   │   │   └── weather.py
│   │   └── schemas/
│   │       └── climate.py
│   ├── scripts/
│   │   ├── prepare_historical.py
│   │   └── prepare_projections.py
│   ├── data/
│   │   ├── regions.geojson
│   │   ├── historical/
│   │   └── projections/
│   └── requirements.txt
│
├── docs/
│   ├── methodology.md
│   └── api-contract.md
│
└── README.md
```

## Frentes de trabalho

Vamos dividir o projeto em 6 branches, uma para cada frente de trabalho. Assim conseguimos desenvolver em paralelo sem ficar alterando os mesmos arquivos.

A `main` será nossa branch principal, onde vamos integrar as funcionalidades depois que estiverem funcionando.

### 1. `feat/map` — Mapa interativo (Frontend)

- Desenvolver o mapa do Sul do Brasil usando React e MapLibre.
- Exibir Paraná, Santa Catarina e Rio Grande do Sul.
- Permitir selecionar regiões no mapa.
- Implementar camadas visuais para os indicadores climáticos.
- Criar a legenda de cores e os controles do mapa.
- Integrar os dados recebidos da API.

**Entrega:** mapa navegável, com regiões selecionáveis e capacidade de exibir dados climáticos.

### 2. `feat/dashboard` — Interface e gráficos (Frontend)

- Desenvolver os painéis de informações que aparecem quando o usuário seleciona uma região.
- Criar os gráficos de temperatura e precipitação ao longo dos anos.
- Exibir comparações entre dados históricos e projeções futuras.
- Implementar filtros de períodos e cenários climáticos.
- Mostrar indicadores de tendência, variações percentuais e informações estatísticas.
- Exibir as previsões de chuva para as próximas 72 horas.

**Entrega:** dashboard funcional, preparado para consumir os dados da API.

### 3. `feat/nasa-data` — Dados históricos da NASA (Python)

- Coletar e preparar os dados históricos utilizados nas análises.
- Integrar fontes como NASA POWER ou GPM.
- Obter séries históricas de temperatura e precipitação.
- Organizar os dados por região e período.
- Tratar dados ausentes e padronizar unidades.
- Gerar arquivos JSON ou CSV para o backend.

**Entrega:** dados históricos reais, organizados e documentados, prontos para análise.

### 4. `feat/projections` — Projeções climáticas e estatística (Python)

- Desenvolver o núcleo científico que investiga quais regiões podem apresentar aumento de perigo climático nas próximas décadas.
- Integrar projeções climáticas, preferencialmente CMIP6.
- Comparar o clima histórico com períodos futuros, como 2041–2060.
- Calcular mudanças projetadas de temperatura e precipitação.
- Implementar testes estatísticos, como Mann-Kendall e Theil-Sen, para tendências históricas.
- Identificar regiões com aumento projetado de indicadores de perigo climático.
- Documentar os cenários, métodos e incertezas.

**Entrega:** resultados científicos que permitam identificar áreas com mudanças climáticas potencialmente preocupantes.

> **Importante:** aumento de precipitação não significa automaticamente aumento do risco de inundação. A classificação precisa respeitar as limitações dos dados.

### 5. `feat/forecast` — Previsão de chuva para 72 horas (Python)

- Desenvolver o módulo meteorológico de curto prazo.
- Integrar uma API meteorológica.
- Consultar previsões de precipitação para as regiões selecionadas.
- Calcular o acumulado previsto para 72 horas.
- Identificar os maiores acumulados em intervalos de 24 horas.
- Retornar os resultados em JSON.
- Informar fonte e horário de atualização da previsão.

**Entrega:** módulo que fornece previsões de precipitação para o mapa e o dashboard.

### 6. `feat/api` — Backend e integração (Python/FastAPI)

- Construir a API que conecta os módulos científicos ao frontend.
- Configurar o servidor FastAPI.
- Criar endpoints para regiões, dados históricos, projeções e previsões.
- Padronizar as respostas JSON.
- Integrar os módulos desenvolvidos pelas outras pessoas.
- Implementar tratamento de erros.
- Configurar CORS ou proxy de desenvolvimento.
- Auxiliar nos testes e no deploy.

**Entrega:** API funcional que permita ao React acessar todos os dados.

## Regras para o desenvolvimento

- Cada pessoa trabalha na sua branch e evita modificar arquivos de outras frentes sem combinar.
- Os contratos JSON e os nomes dos endpoints precisam ser definidos em conjunto antes da implementação.
- Cada funcionalidade deve ser testada individualmente antes de ser integrada à `main`.
- Façam commits pequenos e frequentes, com mensagens descritivas.
- Avisem o grupo assim que uma funcionalidade estiver pronta para integração.
- Se alguma fonte de dados não funcionar, comuniquem imediatamente para definirmos uma alternativa.

## Objetivo do MVP

Construir uma plataforma que permita visualizar mudanças climáticas históricas, explorar projeções futuras e identificar regiões do Sul do Brasil com possível aumento de perigo associado à precipitação, além de mostrar a previsão de chuva para as próximas 72 horas.
