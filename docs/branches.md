# Organização das branches

| Branch | Responsabilidade |
| --- | --- |
| `main` | Base compartilhada e destino das integrações revisadas |
| `feat/map` | Camadas geográficas, estradas, relevo e interação do mapa |
| `feat/map-simple-home` | Interface principal simplificada, tela de Apoio e tela de análise |
| `feat/dashboard` | Linha do tempo mensal, gráficos e análise regional |
| `feat/api` | Endpoints, contratos e serviços da API |
| `feat/nasa-data` | Acesso NASA, dados brutos recortados e preparação das grades |
| `feat/statistics` | Séries regionais, tendências e resumo de significância |
| `consolidate/nasa-data` | Cópia integrada para conferência conjunta; não é branch de trabalho por frente |

As branches de trabalho recebem atualizações de `main` por merge, preservando o histórico. Commits novos devem conter apenas a frente correspondente. Mudanças de interface ficam nas branches de frontend; não devem entrar nos commits da API.

O mapa de estradas/relevo e as análises regionais dependem dos dados e contratos correspondentes. A integração em `main` deve ocorrer por pull requests e na ordem necessária para que os endpoints encontrem seus arquivos publicados.

Os indicadores `RX1DAY` e `R50MM` estão agrupados em `feat/statistics`; não há uma branch separada `feat/extremes` nesta organização. A branch `consolidate/nasa-data` serve para conferir o conjunto, enquanto as integrações oficiais devem vir das branches de responsabilidade acima.

Não reescrever histórico publicado nem usar force push. Antes de publicar, conferir os arquivos alterados e o resumo do commit. Branches temporárias podem ser removidas depois que sua integração estiver confirmada.
