# Dashboard — comparação e cobertura

Branch feat/dashboard, derivada de feat/map. Somente frontend; nenhuma alteração de dados ou de backend.

## Funcionalidades

- Comparar dois anos com área e climatologia compartilhadas.
- Totais anuais, anomalia de cada ano contra a climatologia e diferença absoluta/relativa entre anos. Variação relativa usa o segundo ano como denominador, sem confundi-la com anomalia.
- Gráfico mensal com escala compartilhada e tabela acessível para o recorte BBOX/terra.
- Seleção persistente de bloco por clique, teclado ou índices linha/coluna. Comparador pode usar o mesmo bloco nos dois anos.
- No modo bloco, somente resultados anuais: o snapshot não contém séries mensais por bloco.
- Cobertura dos meses presentes por produto e por ano, com variável, unidade, fonte e data de geração.

Seleção manual de ano pausa a animação existente. O comparador usa o mesmo ano ativo da página, evitando estados duplicados. A referência de comparação permanece fixa enquanto o ano ativo avança. Os detalhes de cobertura podem ser expandidos independentemente para IMERG e GLDAS.

## Limites

Os blocos do snapshot são agregados de 0,2°, não células nativas. Linha/coluna são índices locais, não IDs NASA. O recorte regional usa BBOX e máscara de validade GLDAS, sem máscara estadual. Cobertura mensal não certifica qualidade espacial ou dos dados de origem. Esta entrega não calcula tendências, significância, extremos ou risco.

## Execução

Use a API em http://127.0.0.1:8000 e o frontend com npm run dev. Para demonstração sem API, configure VITE_SNAPSHOT_MODE=static explicitamente e reinicie o Vite.

Validação: npm test e npm run build. 53 testes, TypeScript/build aprovados. Conferência de navegador: comparação regional 2024/2020, seleção de bloco, diferença anual por bloco, retorno à comparação regional, tabela mensal e viewport móvel sem overflow horizontal. Console sem erros. Nenhum arquivo de dados foi modificado.