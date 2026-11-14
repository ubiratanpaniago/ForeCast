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
