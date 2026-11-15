# API do protótipo ForeCast

Esta entrega serve o snapshot agregado e as grades nativas IMERG 0,1° e GLDAS 0,25°, sem ler raw, baixar NASA ou executar análises científicas durante requisições. Veja [preparação das grades](../docs/native-grids.md), [metodologia](../docs/methodology.md) e [contrato completo](../docs/api-contract.md).

## Executar no PowerShell

Dentro de `backend/`:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Em outro terminal, dentro de `frontend/`: `npm ci` e `npm run dev`.

Frontend usa API por padrão. Configure `VITE_API_BASE_URL=http://127.0.0.1:8000` em `.env.local` se necessário. Para demonstração sem servidor, configure explicitamente `VITE_SNAPSHOT_MODE=static` e reinicie Vite. Não existe fallback automático.

## Configuração

Variáveis do processo (o arquivo .env.example é referência; não é carregado automaticamente):

```powershell
$env:FORECAST_SNAPSHOT_PATH = 'data/derived/frontend/snapshot.json'
$env:FORECAST_GRIDS_PATH = 'data/derived/grids'
$env:FORECAST_CORS_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173'
```

Caminhos relativos são resolvidos a partir de backend/, independentemente do terminal. Reinicie a API após mudar configurações. Credenciais NASA não são necessárias neste serviço. Os valores padrão funcionam na cópia do projeto em qualquer computador.

## Endpoints

- `GET /api/health`: liveness HTTP 200 com status=ok, contractVersion=0.3, dataAvailable, dataRevision (SHA256) e dataError. A API pode estar funcionando mesmo sem dados.
- `GET /api/snapshot`: o JSON original validado, sem envelope adicional; preserva meta, grid, landMask, years, annual e monthly. ETag baseado nos bytes, Cache-Control public/no-cache e X-Data-Generated. If-None-Match permite resposta 304 vazia. O navegador administra seu cache HTTP.
- `/docs`: documentação OpenAPI.
- `GET /api/grids`: catálogo e disponibilidade das grades.
- `GET /api/grids/{gridId}/cells?indicator=PRCP_ANNUAL`: células nativas e valores anuais, com filtros de bbox e período.
- `GET /api/grids/{gridId}/cells/{cellId}/timeseries?indicator=PRCP_ANNUAL`: série anual da célula. Para GLDAS, use `SOIL_SURFACE`.

Erros: `{ "error": { "code": "DATA_UNAVAILABLE", "message": "..." } }`. 503 para arquivo ausente/inacessível/em atualização; DATA_INVALID para arquivo inválido; 404 NOT_FOUND; 422 INVALID_FILTER; 500 INTERNAL_ERROR sem stack trace ou caminhos privados.

## Dados e atualização

O snapshot inicial é uma cópia dos dados já preparados pelo backend, com 24 anos de IMERG e 288 meses de IMERG e GLDAS. Blocos 0,2° agregados, recorte BBOX, sem máscara estadual: não são grades nativas nem resultados de tendência. O arquivo estático do frontend permanece disponível somente para o modo explícito static.

Para publicar uma nova entrega da equipe de dados:

```powershell
.\.venv\Scripts\python.exe scripts/publish_snapshot.py CAMINHO_DO_SNAPSHOT_PREPARADO.json
```

O utilitário valida e usa substituição atômica, preservando bytes e valores. Não transforma dados científicos. Pode usar `--output` para corresponder ao caminho configurado no servidor. Não editar o JSON servido enquanto o escreve; produzir outro arquivo e substituí-lo.

A API compara metadados do arquivo a cada chamada; enquanto não mudam, responde com os bytes validados em memória. Na troca, valida a nova revisão e recalcula ETag. Se a revisão ficar inválida ou desaparecer, descarta o cache e retorna 503; não serve dados antigos como atuais. A validação é estrutural e de cobertura/unidades numéricas, não certificação científica. O contrato do dossiê exige precipitação completa e finita; ausências nesse produto devem ser resolvidas com a equipe antes de publicar. Umidade parcial é aceita e identificada no frontend.

## Testar

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

Testes usam o snapshot real como base e cópias temporárias. Cobrem entrega, cache, ETag/304, atualização, arquivo ausente/inválido, dimensões, calendário, valores inválidos, CORS e erros. Nenhum teste altera os dados de origem.

Placeholders vazios dos routers/serviços científicos antigos foram removidos. A implementação científica futura deve ser integrada pelas respectivas equipes.
