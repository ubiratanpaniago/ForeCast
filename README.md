# ForeCast

**Histórico de chuvas, análise territorial e preparação para eventos extremos no Sul do Brasil.**

O ForeCast é uma plataforma de investigação hidrometeorológica que aproxima dados científicos e leitura visual do território. O projeto reúne séries temporais de chuva, mapas, indicadores ambientais e informações de infraestrutura para ajudar o usuário a entender o que aconteceu em uma região e quais evidências merecem atenção.

A área inicial de estudo é formada por **Paraná, Santa Catarina e Rio Grande do Sul**. A visão de longo prazo é apoiar a população e as equipes de proteção e defesa civil na preparação para eventos extremos, conectando histórico, previsão meteorológica e informações operacionais necessárias ao planejamento de rotas de emergência.

> **Estado atual:** o MVP consolidado oferece análise histórica e territorial. Ainda não fornece previsão meteorológica operacional, detecção de ruas inundadas ou cálculo validado de rotas de evacuação. Este README descreve a versão de desenvolvimento consolidada; a execução de cada módulo depende também dos respectivos arquivos preparados.

## 1. O problema que queremos enfrentar

Em situações de chuva intensa, uma pessoa precisa compreender informações de naturezas diferentes: quanto está chovendo, como a região costuma responder, se existem registros de eventos anteriores, quais vias estão disponíveis e onde há apoio confirmado.

Essas informações normalmente estão distribuídas entre bases científicas, mapas, registros de desastres, serviços meteorológicos e órgãos locais. Um gráfico de chuva isolado não responde a todas essas perguntas.

O ForeCast começa pela organização das evidências históricas e territoriais. A proposta é tornar essa leitura acessível, sem apresentar uma anomalia de chuva como previsão de enchente ou uma característica do relevo como garantia sobre a situação de uma estrada.

O projeto procura responder a três grupos de perguntas:

| Pergunta | Papel do ForeCast |
| --- | --- |
| **O que aconteceu?** | Mostrar chuva histórica, sazonalidade, anomalias e resultados de análises temporais |
| **Onde precisamos investigar?** | Relacionar indicadores às células, regiões e características do território |
| **Como apoiar a preparação e o deslocamento?** | Objetivo futuro, dependente de previsão, alertas, vias atualizadas, abrigos e validação operacional |

## 2. Para quem o projeto está sendo desenvolvido

- **População:** compreender a evolução da chuva e as informações disponíveis sobre uma região.
- **Equipes municipais e de defesa civil:** explorar evidências históricas e territoriais como apoio à preparação e investigação.
- **Pesquisadores e estudantes:** consultar séries, fontes, unidades, períodos e limitações dos dados.
- **Equipe de desenvolvimento:** integrar aquisição científica, processamento, API e visualização mantendo contratos rastreáveis.

Esses públicos representam o uso pretendido. A existência do protótipo não implica validação ou parceria formal com órgãos de emergência.

## 3. O que está implementado e o que está planejado

| Recurso | Estado no MVP consolidado |
| --- | --- |
| Animação mensal de chuva, jan/2001–dez/2024 | Implementado |
| Anomalias por mês do calendário e por célula | Implementado |
| Seleção persistente de célula, gráfico e tabela mensal | Implementado |
| Comparações anuais e mapa agregado de 0,2° | Implementado como contexto separado |
| Exploração de grades nativas IMERG e GLDAS | Implementado |
| Consulta de resultados estatísticos regionais preparados pelo pipeline | Implementado, conforme os indicadores disponíveis |
| Camadas exploratórias de rodovias, relevo e passagens candidatas | Implementado |
| Histórico oficial de ocorrências de enchentes no mapa | Integração planejada |
| Continuação da linha temporal com previsão meteorológica | Integração planejada |
| Alertas operacionais e interdições atualizadas | Integração planejada |
| Abrigos confirmados e cálculo de rotas de evacuação | Desenvolvimento e validação futuros |

A disponibilidade científica é informada pelos dados e catálogos de cada módulo. Ter resultados regionais não significa que todos os indicadores e testes estejam disponíveis para cada célula da grade nativa.

## 4. Como usar o site

### 4.1 Dossiê climático — `/`

A página principal mantém o visual claro do dossiê e apresenta o mapa mensal como ponto de entrada.

Um fluxo de uso possível é:

1. Escolher um mês entre janeiro de 2001 e dezembro de 2024.
2. Visualizar a chuva acumulada daquele mês no Sul do Brasil.
3. Alternar para o modo de anomalia e observar diferenças em relação à referência do mesmo mês.
4. Clicar em uma célula para consultar seu identificador, localização e valores.
5. Acionar o play para acompanhar os meses seguintes, mantendo a célula selecionada.
6. Consultar o gráfico e a tabela dos 288 meses para examinar a série completa.
7. Abrir as comparações anuais para analisar os anos no contexto agregado original.

**Controles disponíveis:** play/pausa, mês anterior e próximo, velocidade de 0,5×/1×/2×, repetição, seletor de mês e linha temporal com 288 posições.

O mapa mensal utiliza **5.458 células IMERG de 0,1°** com interseção em PR/SC/RS. O contexto anual preserva o snapshot agregado de **0,2°**, com identificação própria. As duas visualizações possuem seleções e agregações independentes; suas médias não devem ser tratadas como se fossem o mesmo recorte.

### 4.2 Explorador de grades — `/grids`

Permite escolher o produto, consultar sua disponibilidade e selecionar uma célula por clique ou identificador.

- **IMERG mensal:** grade nativa de 0,1°.
- **GLDAS mensal:** grade nativa independente de 0,25°.
- **IMERG diário:** a disponibilidade depende dos derivados publicados pelo pipeline; um produto indisponível deve permanecer identificado como tal.

Cada célula possui ID estável, centro, limites geográficos e índices da grade de origem. O explorador consulta séries anuais pela API. GLDAS não é interpolado para aparentar uma resolução maior.

### 4.3 Investigação regional — `/regioes`

A investigação regional apresenta regiões geográficas intermediárias e estados, indicadores disponíveis e resultados estatísticos previamente preparados.

O usuário pode selecionar uma região ou um trecho de rodovia, consultar o diagnóstico correspondente e ativar camadas de relevo, rodovias e passagens candidatas. O frontend lê os resultados entregues pela API; não executa os testes científicos no navegador.

Entre os indicadores presentes no catálogo regional estão:

| Indicador | Significado | Unidade |
| --- | --- | --- |
| `PRCP_ANNUAL` | Precipitação acumulada no ano | mm |
| `RX1DAY` | Maior precipitação diária de cada ano | mm |
| `R50MM` | Número anual de dias com precipitação ≥50 mm | dias |
| `SOIL_SURFACE` | Umidade superficial simulada do solo, 0–10 cm | kg/m² |

Os resultados devem ser lidos junto ao período, à fonte, à qualidade e às limitações fornecidas pelo pipeline.

## 5. Fontes de dados

| Fonte / produto | Informação utilizada | Papel no projeto |
| --- | --- | --- |
| NASA GPM IMERG Final mensal — `GPM_3IMERGM_07`, arquivos V07B | Taxa média mensal de precipitação, grade de 0,1° | Acumulados mensais, referências sazonais e animação histórica |
| NASA GPM IMERG Final diário — `GPM_3IMERGDF_07` | Precipitação diária, grade de 0,1° | Indicadores de chuva intensa quando preparados e publicados |
| NASA GLDAS Noah mensal — `GLDAS_NOAH025_M_2.1` | Umidade do solo simulada, grade de 0,25° | Contexto hidrológico e séries de umidade |
| NASADEM | Relevo, utilizado em uma camada derivada | Investigação territorial exploratória |
| IBGE | Limites estaduais e regiões geográficas | Contexto, recorte e organização regional |
| OpenStreetMap | Vias e códigos rodoviários selecionados | Diagnóstico exploratório de exposição da infraestrutura |

A janela histórica inicial da animação é **2001–2024**. A resolução em graus é angular e não corresponde a uma distância constante em quilômetros.

IMERG e GLDAS são produtos diferentes, com grades independentes. A umidade GLDAS é resultado de um modelo e não deve ser descrita como medição direta do solo.

Fontes e métodos detalhados: [metodologia](docs/methodology.md), [grades nativas](docs/native-grids.md) e [chuva mensal](docs/monthly-rainfall.md).

## 6. Como a animação mensal é construída

### 6.1 Preparação dos acumulados

O pipeline utiliza os **288 arquivos mensais IMERG** já recortados para a área de estudo. Antes de converter os valores, confere o SHA-256 de cada arquivo contra o manifesto de origem, o mês representado, a unidade e o alinhamento das coordenadas nativas.

A variável mensal de origem é uma taxa em `mm/hr`. O acumulado é calculado por célula:

```text
chuva do mês (mm) = taxa média do mês (mm/h) × dias do mês × 24
```

O número de dias respeita o calendário. Fevereiro de um ano bissexto utiliza 29 dias.

### 6.2 Referência do mesmo mês

Cada célula tem **12 referências**, uma para cada mês do calendário:

- Referência de janeiro: média dos janeiros de 2001–2024.
- Referência de fevereiro: média dos fevereiros de 2001–2024.
- O mesmo procedimento é aplicado até dezembro.

Isso permite separar a sazonalidade da comparação histórica. Um mês normalmente chuvoso não é comparado à média de todos os meses do ano.

A implementação atual exige **24 anos válidos** para publicar a referência de cada mês e célula. A contagem de anos válidos acompanha os dados.

### 6.3 Anomalia percentual

```text
anomalia (%) = ((chuva observada − referência do mesmo mês) / referência) × 100
```

- Valor positivo: mês mais chuvoso que a referência daquela célula.
- Valor negativo: mês mais seco que a referência.
- Valor zero: chuva igual à referência, dentro da precisão dos valores apresentados.
- Referência ausente, incompleta ou igual a zero: anomalia percentual indisponível.

A anomalia descreve uma diferença histórica. Ela não é um teste de tendência, uma previsão meteorológica ou uma probabilidade de enchente.

### 6.4 Valores ausentes e cores

Valores de preenchimento, valores não finitos, taxas negativas e indicadores de qualidade ausentes ou negativos são tratados como ausentes. **Zero real é preservado; lacunas não viram zero.**

O mapa usa escalas fixas para permitir a comparação entre quadros:

| Modo | Escala visual | Interpretação |
| --- | --- | --- |
| Chuva acumulada mensal | 0 a ≥600 mm/mês | Magnitude do acumulado |
| Anomalia percentual | ≤−50% a ≥+50% | Diferença em relação à referência do mesmo mês |
| Cinza | Sem escala numérica | Valor ou anomalia indisponível, conforme o modo |

As cores saturam nos extremos da legenda. Os valores numéricos completos continuam disponíveis no painel.

### 6.5 Recorte e leitura espacial

As células são selecionadas por interseção com os limites estaduais. O retângulo nativo permanece inteiro, inclusive quando apenas uma parte dele está dentro dos estados.

A média mensal exibida no painel é simples, nas células que possuem chuva e referência válidas no quadro. Ela não é ponderada pela fração de interseção com os estados.

Essas escolhas, a simplificação dos limites IBGE e a resolução espacial devem ser consideradas ao interpretar resultados próximos de costas e fronteiras.

## 7. O que significa a camada de infraestrutura

O módulo atual investiga onde rodovias selecionadas atravessam células com características de relevo que podem justificar análise adicional.

- **Trecho rodoviário:** agrupamento de vias com o mesmo código principal dentro de uma região intermediária.
- **Camada de terreno:** aproximação exploratória baseada em altura relativa ao fundo de vale local e declividade, derivada do NASADEM.
- **Passagem candidata:** indicação de uma célula atravessada por um trecho e que merece investigação; não é a localização confirmada de uma ponte ou travessia de rio.

A malha utilizada vem do OpenStreetMap e reúne categorias rodoviárias selecionadas. Ela não representa uma malha completa de navegação para carros, pedestres ou evacuação.

O diagnóstico não incorpora, de forma operacional, vazão dos rios, cota de pontes, obras de proteção ou interdições atualizadas. Por isso, uma classificação de relevo não pode ser convertida diretamente em risco de interdição, dano ou segurança de passagem.

Consulte [o método e as limitações da exposição rodoviária](docs/infrastructure-exposure.md).

## 8. Caminho até o apoio a emergências

A evolução proposta conecta quatro camadas de informação:

```text
Histórico climático + registros de eventos
                    ↓
Condições recentes + previsão + alertas
                    ↓
Território + vias + interdições + abrigos confirmados
                    ↓
Apoio ao planejamento de rotas, com validação operacional
```

| Etapa | Entrega necessária | Condição para uso |
| --- | --- | --- |
| Histórico de eventos | Ocorrências oficiais de inundações, enxurradas e alagamentos | Registrar fonte, data e precisão espacial; um registro municipal não delimita ruas atingidas |
| Previsão meteorológica | Dados de curto prazo e incerteza | Mostrar horário de emissão, validade e atualização |
| Contexto hidrológico | Níveis dos rios e áreas inundáveis, onde disponíveis | Respeitar cobertura local e limitações dos modelos |
| Situação das vias | Interdições e condições de ruas, estradas e pontes | Atualização operacional e origem identificada |
| Destinos de apoio | Abrigos e pontos de apoio confirmados | Disponibilidade, localização e regras de acesso verificadas |
| Rotas | Malha adequada ao modo de deslocamento e às restrições | Validação com os órgãos responsáveis e tratamento de dados desatualizados |

Registros anteriores ajudam a identificar áreas que merecem atenção, mas não fornecem, sozinhos, uma probabilidade de recorrência. Uma estimativa numérica exige método próprio e validação contra eventos reais.

A linha temporal futura deverá separar explicitamente **observações** de **previsões**. A navegação mensal serve à compreensão do histórico; o apoio a uma emergência exige acompanhamento em escala de horas e dias e informações operacionais atualizadas. Lacunas entre o fim do histórico e o presente não devem ser preenchidas artificialmente.

Enquanto essas integrações não forem validadas, o protótipo não deve orientar uma evacuação real nem substituir alertas e orientações oficiais.

## 9. Arquitetura e fluxo dos dados

O processamento científico é separado do atendimento da API. Os scripts preparam e validam os derivados; a API lê esses arquivos; o frontend apresenta os resultados.

```text
Subsets NASA + limites geográficos + outras fontes territoriais
                              ↓
                  Scripts Python de preparação
                              ↓
          Dados derivados + cobertura + revisão + proveniência
                              ↓
                     API FastAPI local
                              ↓
          React: mapa, player, painéis, gráficos e tabelas
```

Uma consulta no navegador não inicia downloads de décadas de arquivos NASA nem executa testes científicos. Essa separação permite reproduzir o processamento, controlar as versões e manter a interação mais rápida.

### Estrutura principal

```text
forecast-consolidate/
├── frontend/
│   ├── src/
│   │   ├── features/dossier/          # Dossiê claro e animação mensal
│   │   ├── features/regional/         # Investigação regional e infraestrutura
│   │   ├── NativeGridExplorer.tsx     # Explorador de grades nativas
│   │   ├── services/                  # Comunicação e validação dos contratos
│   │   └── types/                     # Tipos compartilhados
│   └── package.json
├── backend/
│   ├── app/
│   │   ├── routers/                   # Endpoints da API
│   │   ├── services/                  # Leitura, cache e validação dos derivados
│   │   └── config.py                  # Caminhos e configurações
│   ├── scripts/
│   │   ├── prepare_monthly_rainfall.py # Quadros mensais e referências
│   │   └── prepare_native_grids.py    # Grades e séries anuais nativas
│   ├── data/
│   │   ├── raw/                      # Arquivos científicos de origem
│   │   └── derived/
│   │       ├── monthly-rainfall/      # Manifesto e blocos de 12 meses
│   │       ├── grids/                # Geometrias e séries nativas
│   │       ├── regions/              # Resultados regionais
│   │       ├── infrastructure/       # Rodovias, terreno e passagens
│   │       └── frontend/             # Snapshot anual do dossiê
│   └── tests/
└── docs/                             # Contratos, métodos e limitações
```

### Tecnologias

| Camada | Tecnologias |
| --- | --- |
| Interface | React, TypeScript e Vite |
| Mapas | Canvas no mapa mensal do dossiê; MapLibre GL nos exploradores |
| API | Python e FastAPI |
| Processamento | numpy, netCDF4, xarray e bibliotecas geoespaciais, conforme o módulo |
| Armazenamento | NetCDF de origem e derivados JSON/GeoJSON |
| Testes | pytest e Vitest |

## 10. Como os dados mensais chegam ao player

A preparação mensal produz um manifesto e 24 arquivos anuais, cada um contendo 12 quadros mensais.

| Arquivo | Conteúdo |
| --- | --- |
| `manifest.json` | Meses disponíveis, eixos da grade, IDs/índices, referências mensais, cobertura e proveniência |
| `2001.json` até `2024.json` | Acumulados das células em cada um dos 12 meses daquele ano |

A ordem das células é definida pelo manifesto e mantida nos quadros. Os polígonos não precisam ser baixados novamente a cada mês.

O frontend compartilha requisições em andamento, mantém até quatro anos em memória e antecipa anos vizinhos. Dentro de um ano já carregado, o play reutiliza os dados locais.

Se o próximo bloco ainda estiver carregando, a reprodução aguarda o quadro correto. Erros pausam o player e oferecem nova tentativa; o sistema não apresenta valores do mês anterior sob uma data nova.

A série completa da célula é consultada quando ela é selecionada. A API e o frontend conferem a revisão para evitar mistura de arquivos de versões diferentes.

## 11. API disponível

Base local usada nos exemplos: `http://127.0.0.1:8010`.

| GET | Finalidade |
| --- | --- |
| `/api/health` | Estado do serviço e disponibilidade do snapshot anual |
| `/api/snapshot` | Snapshot agregado usado no contexto anual |
| `/api/monthly-rainfall` | Manifesto da chuva mensal |
| `/api/monthly-rainfall/years/{year}` | Doze quadros mensais do ano |
| `/api/monthly-rainfall/cells/{cellId}/timeseries` | Série mensal completa da célula |
| `/api/grids` | Catálogo e disponibilidade das grades nativas |
| `/api/grids/{gridId}/cells` | Geometrias das células, com filtros |
| `/api/grids/{gridId}/cells/{cellId}/timeseries` | Série anual da célula |
| `/api/regions` | Geometrias regionais |
| `/api/regions/catalog` | Regiões e indicadores disponíveis |
| `/api/regions/summary` | Resumos estatísticos regionais por indicador |
| `/api/regions/cell-fdr` | Contagem regional das células com tendência após correção de múltiplas comparações |
| `/api/regions/{regionId}/trends` | Série e resultado da região selecionada |
| `/api/infrastructure` | Catálogo, fontes e limitações da infraestrutura |
| `/api/infrastructure/roads` | Rodovias em GeoJSON |
| `/api/infrastructure/crossings` | Passagens candidatas em GeoJSON |
| `/api/infrastructure/terrain` | Camada exploratória de terreno |
| `/api/infrastructure/segments/{segmentId}` | Detalhes de um trecho e suas passagens candidatas |

Exemplo de consulta no PowerShell:

```powershell
Invoke-RestMethod "http://127.0.0.1:8010/api/monthly-rainfall"
Invoke-RestMethod "http://127.0.0.1:8010/api/monthly-rainfall/years/2001"
Invoke-RestMethod "http://127.0.0.1:8010/api/regions/summary?indicator=PRCP_ANNUAL"
```

As consultas de grade exigem o indicador correspondente. Os contratos detalhados explicam filtros, unidades e erros. A API distingue parâmetros inválidos, célula inexistente, revisão incompatível e dados ausentes; não substitui uma falha por valores simulados.

O endpoint de saúde informa a situação do snapshot anual. A disponibilidade dos demais módulos deve ser verificada nos respectivos catálogos e respostas.

## 12. Requisitos e execução no PowerShell

### Requisitos

- Python com suporte a ambientes virtuais; o serviço utiliza recursos de Python 3.10 ou superior. Os comandos desta cópia foram usados com Python 3.11.
- Node.js compatível com o Vite instalado: `^20.19.0` ou `>=22.12.0`, além do npm.
- Código dos módulos e seus respectivos arquivos derivados em `backend/data/derived/`.
- Para regenerar dados científicos, dependências adicionais e os subsets de origem.

Não é necessário acesso à NASA para servir derivados locais já preparados. Uma aquisição nova pode exigir autenticação própria; credenciais não devem ser incluídas no repositório.

### Preparação inicial

```powershell
cd "C:\Users\Camille\Documents\forecast-consolidate"
python -m venv backend/.venv
.\backend\.venv\Scripts\python.exe -m pip install -r backend/requirements-dev.txt
npm --prefix frontend ci
```

Se as dependências já estiverem instaladas, basta iniciar os dois serviços.

### Terminal 1 — backend

```powershell
cd "C:\Users\Camille\Documents\forecast-consolidate"
$env:FORECAST_CORS_ORIGINS="http://127.0.0.1:5180,http://localhost:5180"
.\backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8010
```

### Terminal 2 — frontend

```powershell
cd "C:\Users\Camille\Documents\forecast-consolidate"
$env:VITE_API_BASE_URL="http://127.0.0.1:8010"
npm --prefix frontend run dev -- --host 127.0.0.1 --port 5180 --strictPort
```

Mantenha os dois terminais abertos. Use `Ctrl+C` para encerrar cada serviço.

| Endereço | Uso |
| --- | --- |
| [http://127.0.0.1:5180](http://127.0.0.1:5180/) | Dossiê e animação mensal |
| [http://127.0.0.1:5180/grids](http://127.0.0.1:5180/grids) | Grades nativas |
| [http://127.0.0.1:5180/regioes](http://127.0.0.1:5180/regioes) | Investigação regional |
| [http://127.0.0.1:8010/docs](http://127.0.0.1:8010/docs) | Documentação interativa da API |

As portas 8010 e 5180 seguem a configuração usada no novo MVP. Se forem alteradas, atualize também o endereço da API no frontend e as origens permitidas no backend.

## 13. Configuração e preparação dos dados

Os caminhos relativos de dados são resolvidos a partir da pasta `backend/`.

| Variável | Padrão / finalidade |
| --- | --- |
| `FORECAST_SNAPSHOT_PATH` | `data/derived/frontend/snapshot.json` |
| `FORECAST_MONTHLY_PATH` | `data/derived/monthly-rainfall` |
| `FORECAST_GRIDS_PATH` | `data/derived/grids` |
| `FORECAST_REGIONS_PATH` | `data/derived/regions` |
| `FORECAST_INFRASTRUCTURE_PATH` | `data/derived/infrastructure` |
| `FORECAST_CORS_ORIGINS` | Origens do frontend autorizadas a consultar a API |
| `VITE_API_BASE_URL` | Endereço do backend usado pelo frontend |

Os arquivos `.env.example` são referências de configuração; o backend não os carrega automaticamente. Variáveis do frontend devem ser definidas antes de iniciar ou construir o Vite. Reinicie o serviço correspondente após mudar a configuração.

Para reproduzir a chuva mensal:

```powershell
.\backend\.venv\Scripts\python.exe -m pip install -r backend/requirements-data.txt
.\backend\.venv\Scripts\python.exe backend/scripts/prepare_monthly_rainfall.py
```

O script exige os 288 subsets IMERG, o manifesto de origem, a especificação da grade e as geometrias nativas existentes. A cópia local atual já contém os derivados mensais preparados.

Arquivos existentes idênticos são aceitos; conteúdo diferente causa erro, sem sobrescrita. Para gerar uma nova revisão, use outra pasta:

```powershell
.\backend\.venv\Scripts\python.exe backend/scripts/prepare_monthly_rainfall.py --output backend/data/derived/monthly-rainfall-next
```

Depois de validar a pasta completa, aponte `FORECAST_MONTHLY_PATH` para ela e reinicie a API. Não exponha uma pasta enquanto os arquivos ainda estão sendo escritos.

## 14. Verificação e testes

```powershell
.\backend\.venv\Scripts\python.exe -m pytest backend/tests -q
npm --prefix frontend test
npm --prefix frontend run build
```

Os testes científicos exigem as dependências de `backend/requirements-data.txt`. Em um ambiente contendo apenas a API, esses testes podem ser pulados por falta das bibliotecas científicas; isso não equivale a validar o processamento.

As verificações da animação mensal incluem:

- Comparação de meses reais com os arquivos NASA de origem.
- Conversão de taxas e tratamento de fevereiro em ano bissexto.
- Referências por mês do calendário, com cobertura explícita.
- Preservação de zeros e valores ausentes.
- Compatibilidade entre soma mensal e produtos anuais existentes.
- Ordem dos 288 meses e transição de dezembro para janeiro.
- Play, pausa, velocidade, repetição e espera por dados.
- Reutilização de requisições e rejeição de revisões incompatíveis.
- Erros de período, células inexistentes e arquivos inválidos.

## 15. Problemas comuns ao iniciar

| Situação | O que verificar |
| --- | --- |
| `Port 5180 is already in use` | O frontend pode já estar rodando. Abra o endereço e confira a versão antes de iniciar outro processo |
| Erro ao ocupar a porta 8010 | Verifique se a API já está ativa em `/docs`; evite encerrar processos sem identificar sua origem |
| Página abre, mas os dados não carregam | API em execução, `VITE_API_BASE_URL`, origens CORS e disponibilidade dos derivados |
| API retorna 503 | Arquivos necessários ausentes, inválidos ou incompletos; consulte o módulo afetado |
| Erro de revisão mensal | Recarregue o manifesto; confirme que todos os arquivos pertencem à mesma preparação |
| Comando Python ou npm não encontrado | Instalação e configuração das ferramentas no computador |
| Testes científicos aparecem como pulados | Bibliotecas científicas ausentes no ambiente usado para os testes |

Os mapas não devem ser preenchidos com dados fictícios para esconder falhas de configuração ou ausência de fontes.

## 16. Contribuição e documentação

Novas entregas devem explicitar fonte, versão, unidade, período, cobertura e limitações. Mudanças no transporte dos dados precisam atualizar o contrato compartilhado entre frontend e backend.

Mantenha commits focados, confira os arquivos preparados para o commit e preserve os raw. Antes de disponibilizar uma análise nova, valide os dados, os métodos e sua representação na interface.

Documentação complementar:

- [Animação mensal: preparação, referência, API e reprodução](docs/monthly-rainfall.md)
- [Grades nativas e reprodução dos derivados](docs/native-grids.md)
- [Metodologia científica](docs/methodology.md)
- [Contrato da API](docs/api-contract.md)
- [Exposição de rodovias: método, fontes e limitações](docs/infrastructure-exposure.md)

O ForeCast está em desenvolvimento. Sua contribuição atual é tornar evidências históricas e territoriais mais compreensíveis e rastreáveis. A evolução para apoio operacional a emergências depende de novas integrações e validação técnica e institucional.
