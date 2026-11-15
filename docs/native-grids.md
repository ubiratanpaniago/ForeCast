# Grades nativas: reprodução

`backend/data/derived/grids/catalog.json` lista disponibilidade e revisão. Cada grade mensal contém `cells.geojson` (geometrias e IDs globais), `series.json` (24 valores anuais e cobertura por célula) e `provenance.json` (hashes, algoritmo e contagens).

GeoJSON é consumido pelo MapLibre. JSON compacto anual é suficiente para este recorte; raw NetCDF preserva séries mensais originais. A equipe pode produzir NetCDF/Zarr para processamento maior sem mudar os IDs.

## Preparação offline

Na raiz do projeto:

```powershell
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements-data.txt
backend/.venv/Scripts/python.exe backend/scripts/prepare_native_grids.py
```

Exige pastas raw `imerg_monthly` e `gldas_monthly`, cada uma com `grid_spec.json`, `manifest.jsonl` e 288 arquivos mensais. Tudo é verificado; nada é baixado. Pode usar outra cópia:

```powershell
backend/.venv/Scripts/python.exe backend/scripts/prepare_native_grids.py --raw-root 'C:\CAMINHO\backend\data\raw' --output backend/data/derived/grids-next
```

Saída existente idêntica é aceita; conteúdo diferente causa erro sem sobrescrita. Para nova revisão, gere em outra pasta, teste, configure `FORECAST_GRIDS_PATH` e reinicie a API. Não publique uma pasta enquanto é escrita. O catálogo só é escrito depois das duas grades.

Este processamento não exige Earthdata Login. Aquisição NASA pertence à ingestão e precisa de autenticação própria quando exigida; credenciais não entram no repositório. Raw ausente ou checksum diferente interrompe a preparação sem criar substitutos.

## API e frontend

```powershell
$env:FORECAST_GRIDS_PATH = 'data/derived/grids'
backend/.venv/Scripts/python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

Frontend usa API por padrão. Se existir `.env.local` antigo com `VITE_GRID_MODE=local`, altere para `api` e reinicie. O modo local antigo mantém o catálogo indisponível explicitamente.

Em `/grids`, escolha produto e célula para consultar a tabela anual. A cor corresponde ao último ano do período. Escala fixa: chuva 0–≥3000 mm; solo 0–≥50 kg/m². Cinza significa ano incompleto. `/` mantém a animação agregada 0,2°.

## Testar

```powershell
backend/.venv/Scripts/python.exe -m pytest backend/tests -q
$env:FORECAST_RAW_ROOT = 'C:\CAMINHO\backend\data\raw'
backend/.venv/Scripts/python.exe -m pytest backend/tests/test_native_processing.py -q
npm --prefix frontend test
npm --prefix frontend run build
```

Cobertura: coordenadas, resolução, IDs, calendário bissexto, lacunas, soma de chuva, média ponderada do solo, comparação independente com um ano real dos raw, filtros, erros e ausência de truncamento silencioso. Sem bibliotecas científicas, testes de processamento são pulados; testes da API permanecem obrigatórios.
