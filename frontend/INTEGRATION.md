# Integração do dossiê e do explorador de grades

## Telas

- `/`: dossiê fornecido pela equipe (Claude), integrado em src/features/dossier, com timeline anual, mapa Canvas, seleção de blocos, séries mensais e painéis de extremos/estatística pendentes.
- `/grids`: explorador MapLibre existente, preservado em NativeGridExplorer, preparado para grades nativas independentes e séries via API. [Contrato](GRID-CONTRACT.md).

Os estilos são carregados por tela para evitar conflitos. O motor MapLibre e o dossiê são carregados separadamente. React/Vite e as dependências existentes foram mantidos, sem downgrade para as versões da outra cópia. Não incluir node_modules, dist, .env.local ou tsconfig.tsbuildinfo no Git.

## Snapshot recebido

public/data/snapshot.json foi copiado sem alterar os dados da versão recebida em Documents/climate-forensics. Não foi executado nenhum pipeline/exportador nesta integração. O script export_frontend_snapshot.py fica sob responsabilidade da equipe de dados e não foi incluído neste commit de frontend.

- 24 anos, 2001–2024.
- 288 meses de precipitação.
- 89 meses de umidade do solo neste snapshot: cobertura parcial, mesmo que novos raw já tenham sido baixados.
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

Abra `/` para o dossiê, ou `/grids` para a integração de células nativas. Nesta etapa o dossiê lê snapshot local e não consome a API de grades; a migração futura para dados nativos/sob demanda pertence ao contrato de integração.

Verificações: npm test, npm run typecheck, npm run build. Testes cobrem o snapshot real fornecido, rejeição de inconsistências e o contrato anterior. Conferência visual: desktop/celular, troca de ano, total/anomalia, teclado/seleção persistente, gráfico de umidade parcial e navegação entre telas. Não há novos resultados estatísticos inventados.

SHA256 do snapshot recebido: `0e53e467e6c3a170a035a4b4d5af54f424fc812b39a9b5c4c1cf966dde7340a7`.
