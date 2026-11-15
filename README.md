# ForeCast

**Histórico de chuvas e análise territorial para apoiar a preparação diante de eventos extremos no Sul do Brasil.**

O ForeCast é uma plataforma que reúne dados climáticos da NASA, séries temporais, mapas e informações sobre o território para ajudar as pessoas a compreender como a chuva varia e quais áreas merecem atenção.

O projeto concentra-se em **Paraná, Santa Catarina e Rio Grande do Sul**. Sua visão é evoluir para uma ferramenta de apoio à população e às equipes de proteção e defesa civil, conectando histórico de eventos, previsão meteorológica e informações necessárias ao planejamento de rotas de emergência.

**O MVP atual oferece investigação histórica e territorial. A previsão meteorológica e o cálculo de rotas de evacuação ainda não estão implementados.**

## Por que o projeto existe?

Durante chuvas intensas, compreender o contexto de uma região exige reunir informações que geralmente estão separadas: quanto choveu, como esse volume se compara ao histórico, quais características do relevo favorecem o acúmulo de água e quais vias podem exigir investigação.

O ForeCast aproxima essas informações em uma interface visual. A proposta é permitir que o usuário explore o passado, compreenda as evidências disponíveis e, nas próximas etapas, acompanhe condições previstas e informações operacionais de emergência.

O sistema busca responder:

- Como a chuva evoluiu ao longo dos meses?
- Um mês foi mais seco ou mais chuvoso que o habitual naquele local?
- Quais regiões apresentam mudanças nos indicadores históricos?
- Quais trechos rodoviários atravessam áreas de relevo que merecem atenção?
- Quais dados ainda faltam para apoiar decisões sobre deslocamento e evacuação?

## O que já funciona no MVP

### Dossiê climático com animação mensal

Na página principal, o usuário acompanha **288 meses de chuva, de janeiro de 2001 a dezembro de 2024**, em **5.458 células nativas IMERG de 0,1°** com interseção nos três estados.

A interface permite:

- Reproduzir, pausar, alterar a velocidade e repetir a animação.
- Avançar mês a mês ou escolher uma data diretamente.
- Alternar entre chuva acumulada mensal e anomalia percentual.
- Selecionar uma célula e mantê-la selecionada durante a reprodução.
- Consultar chuva, referência mensal, anomalia, gráfico e tabela da célula.
- Acessar comparações anuais e o mapa agregado de 0,2° em uma seção própria.

A referência respeita o calendário: **janeiro é comparado aos janeiros de 2001–2024**, fevereiro aos fevereiros, e assim por diante. Essa comparação é feita individualmente para cada célula.

### Exploração de grades nativas

O explorador de grades apresenta IMERG **0,1°** e GLDAS **0,25°** separadamente, com identificadores próprios e consulta de séries anuais por célula. As grades não são interpoladas para aparentar uma resolução maior.

### Investigação regional e infraestrutura

A investigação regional permite consultar indicadores e resultados estatísticos previamente preparados pelo pipeline, conforme sua disponibilidade. Também oferece camadas de rodovias, relevo e passagens candidatas a investigação.

O diagnóstico rodoviário é exploratório: cruza vias e características do terreno. Ele **não confirma inundação, interdição de estradas ou segurança de uma rota**.

| Página | Finalidade |
| --- | --- |
| `/` | Dossiê claro, mapa mensal, séries temporais e comparações anuais |
| `/grids` | Exploração das células nativas IMERG e GLDAS |
| `/regioes` | Investigação regional, indicadores e camadas de infraestrutura |

## Dados e interpretação

| Fonte | Uso no projeto |
| --- | --- |
| NASA GPM IMERG Final mensal V07, arquivos V07B | Histórico de precipitação e animação mensal na grade nativa de 0,1° |
| NASA GPM IMERG Final diário V07 | Indicadores de extremos, como RX1DAY e dias com chuva ≥50 mm, quando disponibilizados pelo pipeline |
| NASA GLDAS Noah mensal V2.1 | Umidade do solo simulada, em grade independente de 0,25° |
| NASADEM | Camada derivada de relevo para investigação territorial exploratória |
| IBGE | Limites estaduais e regiões geográficas |
| OpenStreetMap | Rodovias utilizadas no diagnóstico exploratório de exposição |

As taxas mensais de precipitação são convertidas em acumulados usando as horas reais de cada mês, incluindo anos bissextos. Os arquivos de origem usados na animação mensal são conferidos por SHA-256 antes da preparação.

Valores ausentes permanecem ausentes: **não são substituídos por zero**. A referência mensal exige 24 anos válidos para aquele mês. Quando a referência é zero, ausente ou incompleta, a anomalia percentual fica indisponível.

Aumento de chuva, anomalia, tendência estatística, suscetibilidade do terreno e risco de inundação são conceitos distintos. Os resultados atuais não devem ser interpretados como previsão de enchentes ou orientação operacional de evacuação.

## Próximas etapas

Para avançar em direção ao objetivo de apoiar rotas de emergência, o projeto precisa integrar:

1. Registros oficiais de inundações, enxurradas e alagamentos anteriores.
2. Previsão meteorológica e alertas, com fonte, horário de atualização e incerteza.
3. Níveis dos rios, áreas inundáveis e informações locais de suscetibilidade.
4. Abrigos confirmados, interdições e condições de vias e pontes.
5. Uma malha de navegação adequada ao modo de deslocamento do usuário.
6. Rotas de evacuação e procedimentos validados com os órgãos responsáveis.

A linha temporal futura deverá distinguir claramente **observações históricas** de **previsões**. A animação mensal serve à compreensão do histórico; o apoio a emergências exige acompanhamento de curto prazo e informações atualizadas.

## Tecnologias e organização

- **Frontend:** React, TypeScript, Vite, MapLibre GL e Canvas.
- **Backend:** Python e FastAPI.
- **Processamento científico:** scripts Python, numpy, netCDF4, xarray e bibliotecas geoespaciais, conforme o módulo.
- **Dados:** subsets NetCDF de origem e derivados JSON/GeoJSON preparados para a aplicação.

```text
forecast-consolidate/
├── frontend/          # Interface, mapas, gráficos e controles temporais
├── backend/
│   ├── app/           # API, validação e leitura dos dados preparados
│   ├── scripts/       # Preparação e exportação dos dados
│   ├── data/
│   │   ├── raw/       # Arquivos científicos de origem
│   │   └── derived/   # Dados preparados para a API
│   └── tests/         # Testes da API e do processamento
└── docs/              # Contratos, metodologia e limitações
```

## Como executar no PowerShell

Os comandos abaixo partem da pasta do novo MVP. Mantenha o backend e o frontend em terminais separados.

**Primeira execução:** crie o ambiente Python e instale as dependências da aplicação.

```powershell
cd "C:\Users\Camille\Documents\forecast-consolidate"
python -m venv backend/.venv
.\backend\.venv\Scripts\python.exe -m pip install -r backend/requirements-dev.txt
npm --prefix frontend ci
```

**Terminal 1 — backend:**

```powershell
cd "C:\Users\Camille\Documents\forecast-consolidate"
$env:FORECAST_CORS_ORIGINS="http://127.0.0.1:5180,http://localhost:5180"
.\backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8010
```

**Terminal 2 — frontend:**

```powershell
cd "C:\Users\Camille\Documents\forecast-consolidate"
$env:VITE_API_BASE_URL="http://127.0.0.1:8010"
npm --prefix frontend run dev -- --host 127.0.0.1 --port 5180 --strictPort
```

- **Site:** [http://127.0.0.1:5180](http://127.0.0.1:5180/)
- **Documentação interativa da API:** [http://127.0.0.1:8010/docs](http://127.0.0.1:8010/docs)

A aplicação precisa dos derivados correspondentes em `backend/data/derived/`. A cópia local atual já contém os arquivos da animação mensal. Para reproduzir essa preparação em outro ambiente, siga a [documentação da chuva mensal](docs/monthly-rainfall.md). A API lê os derivados locais; não baixa dados da NASA durante uma consulta.

## Testes

```powershell
.\backend\.venv\Scripts\python.exe -m pytest backend/tests -q
npm --prefix frontend test
npm --prefix frontend run build
```

Os testes científicos exigem as dependências de `backend/requirements-data.txt`; podem ser pulados em um ambiente que contenha apenas as dependências da API.

## Documentação complementar

- [Animação mensal: preparação, referência e endpoints](docs/monthly-rainfall.md)
- [Grades nativas e reprodução dos derivados](docs/native-grids.md)
- [Metodologia científica](docs/methodology.md)
- [Contrato da API](docs/api-contract.md)
- [Diagnóstico de exposição de rodovias e suas limitações](docs/infrastructure-exposure.md)

O ForeCast está em desenvolvimento. Sua evolução para apoio operacional a emergências depende de validação técnica, atualização das fontes e integração com informações oficiais de proteção e defesa civil.
