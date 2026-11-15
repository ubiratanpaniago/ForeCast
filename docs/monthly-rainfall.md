# Chuva mensal no dossiê claro

O mapa principal reproduz 288 meses, de janeiro/2001 a dezembro/2024, nas 5.458 células nativas IMERG 0,1° já selecionadas por interseção com PR/SC/RS. O contexto anual agregado continua disponível numa seção recolhida. A seleção mensal e a seleção anual são independentes.

## Preparação reproduzível

Na raiz do projeto, com as dependências científicas instaladas:

```powershell
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements-data.txt
backend/.venv/Scripts/python.exe backend/scripts/prepare_monthly_rainfall.py
```

O script usa os 288 subsets em `backend/data/raw/imerg_monthly`, seus manifestos e a geometria existente em `backend/data/derived/grids/imerg-monthly-v07/cells.geojson`. Confere SHA-256, calendário, unidade `mm/hr`, índices e coordenadas nativas em cada arquivo. Usa netCDF4 diretamente, sem novos downloads ou alteração dos raw e dos produtos anuais.

Saída: `backend/data/derived/monthly-rainfall/manifest.json` e 24 arquivos `AAAA.json`, cada um com 12 quadros. A geometria é representada por eixos e índices nativos; cada valor mantém a posição do mesmo ID de célula. Não se repetem polígonos em cada quadro. O manifesto só é publicado após todos os anos. Saída existente diferente causa erro; para uma revisão nova, use `--output backend/data/derived/monthly-rainfall-next` e configure `FORECAST_MONTHLY_PATH` após validar a pasta completa.

## Conversão e referência

- Acumulado mensal = taxa média mensal × número real de dias do mês × 24 horas. Anos bissextos são respeitados.
- `_FillValue`, taxas negativas/não finitas e índice de qualidade ausente/negativo ficam ausentes (`null`). Zero real é preservado. Não foi criado um limiar adicional de qualidade.
- Cada célula tem 12 referências: janeiro é a média dos 24 janeiros de 2001–2024, fevereiro dos 24 fevereiros, e assim por diante.
- A referência exige os 24 anos válidos para aquele mês. A contagem efetiva é disponibilizada; cobertura insuficiente produz referência nula.
- Anomalia percentual = `(valor − referência) / referência × 100`. Referência ausente, zero ou incompleta resulta em anomalia indisponível.
- Células de fronteira representam o retângulo inteiro, não apenas sua parcela nos estados. A média do painel é simples, nas células com chuva e referência disponíveis no quadro, sem ponderação pela fração de interseção.
- Os eixos originais usam float32; a validação admite tolerância angular de `1e-5` grau para o passo nativo de 0,1°. Não há reamostragem.

DOI IMERG: [10.5067/GPM/IMERG/3B-MONTH/07](https://doi.org/10.5067/GPM/IMERG/3B-MONTH/07), versão dos arquivos V07B.

## API

| Endpoint GET | Conteúdo |
| --- | --- |
| `/api/monthly-rainfall` | Meses, grade, IDs/índices, 12 referências por célula, cobertura, unidade e proveniência |
| `/api/monthly-rainfall/years/{year}?revision={revision}` | 12 quadros `{t: AAAA-MM, values: (number|null)[]}`, na ordem das células do manifesto |
| `/api/monthly-rainfall/cells/{cellId}/timeseries` | 288 registros `{t,value,climatology,referenceCount,anomalyPct}` |

Todos incluem `gridId`, `revision` e unidade `mm`. Ano fora de 2001–2024 retorna 422; célula desconhecida, 404; revisão solicitada antiga, 409; arquivos ausentes/inválidos, 503. Manifesto e quadros passam por validação antes da entrega. A API não baixa nem processa arquivos NASA durante requisições. GZip reduz o tráfego dos JSON.

O frontend compartilha requisições em andamento, mantém até quatro anos em memória e antecipa os anos vizinhos. Trocar o mês dentro do mesmo ano não baixa novamente a grade. O player aguarda o quadro correto quando um bloco ainda está carregando. Erros pausam a reprodução, oferecem nova tentativa e não exibem o quadro antigo sob uma data nova. A série completa de uma célula é solicitada somente quando ela é selecionada.

## Interface e verificações

Play/pausa, velocidades 0,5×/1×/2×, repetição, mês anterior/próximo, seletor de mês e slider de 288 posições. Uma célula permanece selecionada ao mudar mês, ano ou modo de cores. Clique no mapa, use o teclado ou procure pelo ID; a tabela de 288 meses permite navegar para um mês específico.

Escalas fixas: acumulado 0–≥600 mm/mês; anomalia ≤−50% a ≥+50%. A cor satura nos extremos, mas o painel conserva o valor numérico completo. Cinza significa valor ou anomalia indisponível, conforme o modo.

```powershell
backend/.venv/Scripts/python.exe -m pytest backend/tests -q
backend/.venv/Scripts/python.exe -m pytest backend/tests/test_monthly_processing.py -q
npm --prefix frontend test
npm --prefix frontend run build
```

Os testes científicos exigem numpy e netCDF4; se executados num ambiente só da API, são pulados. A verificação independente inclui meses reais e fevereiro de 2004, contagem de referências, preservação de zeros/lacunas e soma dos 12 meses compatível com os derivados anuais existentes.

Esta entrega apresenta observações históricas. Previsão meteorológica e navegação de emergência continuam sendo módulos separados.
