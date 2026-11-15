# Integração do dossiê e do explorador de grades

## Telas

- `/`: dossiê fornecido pela equipe (Claude), integrado em src/features/dossier, com timeline anual, mapa Canvas, seleção de blocos, séries mensais e painéis de extremos/estatística pendentes.
- `/grids`: explorador MapLibre existente, preservado em NativeGridExplorer, preparado para grades nativas independentes e séries via API. [Contrato](GRID-CONTRACT.md).

Os estilos são carregados por tela para evitar conflitos. O motor MapLibre e o dossiê são carregados separadamente. React/Vite e as dependências existentes foram mantidos, sem downgrade para as versões da outra cópia. Não incluir node_modules, dist, .env.local ou tsconfig.tsbuildinfo no Git.

## Snapshot recebido

public/data/snapshot.json foi copiado sem alterar os dados da versão recebida em Documents/climate-forensics. O snapshot inicial foi recebido pronto; na atualização temporal, o exportador existente foi executado sobre os raw locais já baixados, sem novas aquisições NASA. O script export_frontend_snapshot.py fica sob responsabilidade da equipe de dados e não foi incluído neste commit de frontend.

- 24 anos, 2001–2024.
- 288 meses de precipitação.
- 288 meses de umidade do solo (cobertura mensal de 2001–2024 após reexportação local).
- Matriz anual 60×55, passo 0,2°, agregada em blocos 2×2 de IMERG 0,1°.
- Recorte BBOX com máscara de validade GLDAS; não há máscara estadual nem ponderação de área certificada nesta visualização.
- Máscara de validade GLDAS não equivale a litoral oficial ou geometrias IBGE.

O dossiê é exploratório: anomalias relativas à média não são testes de tendência ou significância. Não confundir os blocos agregados com células nativas. A interface explicita esses limites e preserva a tela nativa separadamente.

O frontend valida dimensões, resolução, calendário, fontes e valores antes de usar o snapshot. Esta versão do contrato do dossiê exige precipitação mensal e anual completa, numérica e não negativa; snapshot incompleto/inválido é rejeitado com mensagem, não preenchido com zeros. Umidade mensal pode estar parcial ou vazia. A validação estrutural não certifica a metodologia científica do exportador.

## Execução

```sh
cd frontend
npm ci
npm run dev
```

Abra `/` para o dossiê, ou `/grids` para a integração de células nativas. O dossiê agora lê GET /api/snapshot do FastAPI por padrão. VITE_SNAPSHOT_MODE=static habilita explicitamente a leitura do arquivo local; não há fallback silencioso. Grades nativas/sob demanda continuam como etapa seguinte.

Verificações: npm test, npm run typecheck, npm run build. Testes cobrem o snapshot real fornecido, rejeição de inconsistências e o contrato anterior. Conferência visual: desktop/celular, troca de ano, total/anomalia, teclado/seleção persistente, gráfico de umidade parcial e navegação entre telas. Não há novos resultados estatísticos inventados.

SHA256 do snapshot atualizado: cf48c2d14045356a0163079ad1a4daf9a995d05a95d8c9986ab0ed66f263ae6e

## Reprodução temporal anual

Play/pausa percorre os anos disponíveis, 1 quadro/s por padrão, com 0,5× e 2×, repetição opcional, avanço manual e slider. No último ano, play começa no primeiro. Qualquer seleção manual de ano pausa a reprodução; ao ocultar a aba, a reprodução pausa. O timer é limpo ao desmontar o componente.

A mesma seleção controla mapa, sonda, resumo, linha do tempo e destaque no gráfico. Trocar total/anomalia preserva o ano e o estado de reprodução. Escalas de cor permanecem fixas entre quadros. Não há interpolação entre anos e os blocos de 0,2° continuam agregados. Não é animação de previsão nem deslocamento de tempestades.

A atualização dos dados usa o exportador local já existente da equipe de backend e arquivos raw previamente baixados; não faz download NASA. A validação do frontend continua obrigatória após exportar.

## API do protótipo

Backend em http://127.0.0.1:8000, frontend em http://127.0.0.1:5173. Consulte backend/README.md para instalação, publicação atômica e configuração. GET /api/health informa disponibilidade; GET /api/snapshot entrega o contrato existente com ETag/304. A tela identifica Dados via API e permite tentar novamente em falhas. Nenhuma requisição ocorre por quadro da animação.
