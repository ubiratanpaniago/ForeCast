# Organização das branches

| Branch | Uso |
| --- | --- |
| `main` | Versão integrada do protótipo; dossiê claro como interface principal |
| `feat/map` | Frontend do mapa, animação e seleção de células |
| `feat/dashboard` | Painéis, gráficos, comparação e cobertura |
| `feat/api` | API, contratos e testes do serviço |
| `feat/nasa-data` | Pipeline científico, aquisições e exportações NASA |

As branches de trabalho recebem atualizações de `main` por merge, preservando o histórico. Commits novos devem conter apenas a frente correspondente. Ter o frontend na base compartilhada de uma branch da API não significa incluir mudanças de interface nos commits da API.

A integração do trabalho científico da `feat/nasa-data` à `main` continua separada da sincronização das branches e exige revisar dados, contratos e métodos. Não se publica resultado científico apenas para zerar o contador de commits pendentes.

`codex/archive-local-docs` é um arquivo local dos rascunhos anteriores à integração, preservados sem substituir os documentos atuais. Branches temporárias já integradas podem ser removidas; branches com trabalho exclusivo são mantidas.

Não reescrever o histórico publicado nem usar force push para esconder commits de correção. Antes de publicar, conferir `git diff --cached --stat` e os arquivos alterados em relação à base.
