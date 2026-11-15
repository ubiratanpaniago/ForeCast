# ForeCast — Earth Systems Trend Detective

Plataforma de investigação hidrometeorológica para Paraná, Santa Catarina e Rio Grande do Sul. React + MapLibre no frontend, FastAPI no backend e produtos científicos NASA como fonte. O protótipo distingue valores históricos, anomalias e tendências estatísticas; não classifica risco de inundação.

## Versão integrada

- `/`: dossiê com animação anual, chuva, anomalias, comparação entre anos e cobertura dos dados. Essa visão preserva o snapshot agregado IMERG 0,2°, claramente identificado.
- `/grids`: células reais independentes IMERG **0,1°** e GLDAS **0,25°**, selecionadas por interseção com PR/SC/RS. Cor pelo valor anual do último ano do período; clique ou busca pelo ID consulta a série anual da célula via API.
- Os 288 arquivos mensais de 2001–2024 de cada produto são verificados por SHA-256 antes do processamento. Dados ausentes permanecem ausentes.
- IMERG diário continua indisponível enquanto cobertura e extremos estiverem incompletos. As tendências nativas aguardam o módulo estatístico (`statistics: null`).

## Executar

Na raiz do repositório, em um terminal PowerShell:

```powershell
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements-dev.txt
backend/.venv/Scripts/python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

Em outro terminal:

```powershell
npm --prefix frontend ci
npm --prefix frontend run dev
```

Abra [o dossiê](http://localhost:5173) ou [as grades nativas](http://localhost:5173/grids). [Documentação interativa da API](http://127.0.0.1:8000/docs).

Os derivados já estão versionados em `backend/data/derived/`; executar a API não exige credenciais NASA nem processamento dos raw. Veja [como reproduzir os derivados](docs/native-grids.md). Os `.env.example` são referências e não são carregados automaticamente.

## Arquitetura

```text
climate-forensics/
├── frontend/
│   ├── src/
│   │   ├── NativeGridExplorer.tsx     # /grids
│   │   ├── components/Map/           # MapLibre, seleção, legenda e série
│   │   ├── features/dossier/         # /, animação e comparação anual
│   │   ├── hooks/useGridExplorer.ts
│   │   ├── services/gridApi.ts
│   │   └── types/grid.ts
│   ├── public/data/
│   └── package.json
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── routers/                 # health, snapshot, grids
│   │   ├── services/                # Repositórios de derivados
│   │   └── schemas/
│   ├── scripts/prepare_native_grids.py
│   ├── data/
│   │   ├── raw/                     # Subsets NASA + manifests
│   │   └── derived/
│   │       ├── frontend/snapshot.json
│   │       └── grids/               # Catálogo, células, séries e proveniência
│   ├── tests/
│   ├── requirements.txt
│   └── requirements-data.txt
└── docs/
    ├── api-contract.md
    ├── methodology.md
    └── native-grids.md
```

## Frentes de trabalho

| Branch | Responsabilidade |
| --- | --- |
| `feat/map` | Mapa, células nativas e interação |
| `feat/dashboard` | Comparação, gráficos e cobertura |
| `feat/api` | API, integração e validação |
| `feat/nasa-data` | Aquisição e preparação NASA |
| `feat/statistics` | Mann-Kendall, Theil-Sen, incerteza e qualidade |
| `feat/extremes` | RX1DAY e dias com precipitação ≥50 mm |

Mapa, dashboard e API estão integrados nesta entrega. Projeções CMIP6, previsão de 72 horas e alertas de enchentes estão fora do MVP.

## Verificação

```powershell
backend/.venv/Scripts/python.exe -m pytest backend/tests -q
npm --prefix frontend test
npm --prefix frontend run build
```

Os testes científicos opcionais precisam de `requirements-data.txt`. A comparação independente com raw usa `FORECAST_RAW_ROOT`, conforme [a documentação](docs/native-grids.md).
