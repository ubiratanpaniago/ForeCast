# Deploy gratuito do ForeCast

O site tem duas partes, hospedadas separadamente:

| Parte | Onde | Por quê |
| --- | --- | --- |
| Frontend (`frontend/`, Vite + React) | **Cloudflare Pages** | Site estático: grátis, CDN rápida no Brasil, nunca hiberna |
| API (`backend/`, FastAPI) | **Render** (plano free) | Servidor Python grátis, configurado pelo `render.yaml` |
| Manter a API acordada | **UptimeRobot** | O Render desliga a API após ~15 min sem acesso; um acesso a cada 5 min impede isso |

Os dois serviços ficam ligados ao GitHub: **cada push na `main` publica de novo** sozinho.

Ordem: API primeiro (para ter a URL dela), depois o frontend, depois volta na API para liberar o CORS, e por último o UptimeRobot.

---

## 1. API no Render

1. Crie uma conta em <https://render.com> (dá para entrar com o GitHub).
2. No painel: **New → Blueprint** e escolha o repositório `ForeCast`.
3. O Render lê o [`render.yaml`](../render.yaml) e mostra o serviço `forecast-api`. Ele vai pedir o valor de **`FORECAST_CORS_ORIGINS`**: por enquanto coloque `http://localhost:5173` (troca no passo 3).
4. Clique em **Apply**. O primeiro build leva alguns minutos.
5. Quando terminar, copie a URL do serviço (algo como `https://forecast-api.onrender.com`) e teste no navegador:
   `https://forecast-api.onrender.com/api/health` → deve mostrar `"status":"ok"` e `"dataAvailable":true`.

O que o `render.yaml` já configura: pasta `backend`, instalação só de `requirements-api.txt` (FastAPI + Uvicorn, sem o pipeline científico), Python 3.12, verificação de saúde em `/api/health` e região Virgínia (a mais próxima do Brasil).

## 2. Frontend no Cloudflare Pages

1. Crie uma conta em <https://dash.cloudflare.com>.
2. **Workers & Pages → Create → Pages → Connect to Git** e escolha o repositório `ForeCast`.
3. Configuração do build:

   | Campo | Valor |
   | --- | --- |
   | Project name | `forecast` (o Cloudflare deu `forecast-4ub`; se mudar, ajuste `FORECAST_CORS_ORIGIN_REGEX` no `render.yaml`) |
   | Production branch | `main` |
   | Framework preset | `None` |
   | Root directory | `frontend` |
   | Build command | `npm run build && rm -rf dist/data/grids` |
   | Build output directory | `dist` |

   > O `rm -rf dist/data/grids` remove ~18 mil arquivos de grades que só são usados no modo local (`VITE_GRID_MODE=local`). Em produção as grades vêm da API, e o Cloudflare Pages aceita no máximo 20 mil arquivos por site.

4. **Environment variables** (em *Production* e *Preview*):

   | Variável | Valor |
   | --- | --- |
   | `VITE_API_BASE_URL` | a URL da API do passo 1, sem barra no final |
   | `VITE_DATA_MODE` | `api` |
   | `NODE_VERSION` | `22` |

5. **Save and Deploy**. A URL final será algo como `https://forecast.pages.dev`.

Rotas como `/grids`, `/regioes` e `/analise` funcionam ao recarregar a página sem configuração extra: sem um `404.html` no projeto, o Cloudflare Pages entrega o `index.html` para qualquer caminho.

**Variáveis `VITE_*` entram no build.** Se mudar alguma, faça um novo deploy (*Deployments → Retry deployment*) para ela valer.

## 3. Liberar o frontend na API (CORS)

No Render: serviço `forecast-api` → **Environment** → edite `FORECAST_CORS_ORIGINS` com a URL do Cloudflare, **sem barra no final**:

```
https://forecast.pages.dev
```

Para várias origens, separe por vírgula. Salve; o Render reinicia a API sozinho.

Na prática, a variável `FORECAST_CORS_ORIGIN_REGEX` do `render.yaml` já libera o site de produção (`https://forecast-4ub.pages.dev`) e os links de pré-visualização por branch (`https://<branch>.forecast-4ub.pages.dev`), então esta etapa só é necessária para outros endereços. Assim, quem estiver trabalhando numa branch (a tradução, por exemplo) vê a versão dela funcionando online antes do merge.

## 4. UptimeRobot (manter a API acordada)

1. Crie uma conta em <https://uptimerobot.com>.
2. **Add New Monitor**:
   - Monitor type: **HTTP(s)**
   - URL: `https://forecast-api.onrender.com/api/health`
   - Monitoring interval: **5 minutes**
3. Em *Alert contacts*, deixe o seu e-mail: você recebe um aviso se a API cair.

As 750 horas mensais grátis do Render bastam para **um** serviço ligado o mês inteiro. Não crie outro serviço gratuito no Render na mesma conta, ou o limite estoura.

## 5. Conferir

Abra a URL do Cloudflare e navegue por todas as páginas (`/`, `/regioes`, `/analise`, `/apoio`, `/entenda`, `/grids`). No navegador, *F12 → Console* não deve mostrar erros de CORS.

## Durante a avaliação

- **Evite novos deploys.** Cada deploy da API reinicia o servidor. O frontend já tenta de novo automaticamente (até ~30 s, mantendo a tela em "Carregando…"), mas é melhor não arriscar. Para travar, desligue o *Auto-Deploy* no Render e o *automatic deployments* no Cloudflare.
- **Trabalho novo vai numa branch**, não na `main`. O merge na `main` publica na hora.
- **Plano B:** se o Render der problema, a Microsoft oferece US$ 200 de crédito no Azure por 30 dias para equipes do NASA Space Apps. O App Service B1 com *Always On* roda a mesma API com o mesmo comando de start.
