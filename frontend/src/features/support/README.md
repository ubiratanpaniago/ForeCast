# Tela de apoio

Rota `/apoio`, na branch `feat/map-simple-home`. Layout desktop de uma janela sem rolagem, seguindo a referência: mapa do Sul à esquerda; local mais próximo, resumo da região e botão separado **Como apoiar** à direita. A paleta e o estilo editorial do sistema permanecem.

## Dados já conectados

- Mapa: grades nativas IMERG e anomalia mensal de dezembro de 2024, pelos endpoints existentes `/api/monthly-rainfall` e `/api/monthly-rainfall/years/2024`. Referência: o mesmo mês de 2001–2024. Não representa a chuva de hoje.
- Ponto inicial: célula real `imerg-monthly-v07:r619:c1275`, aproximadamente 28,05° S e 52,45° O. Clique ou use as setas no mapa para escolher outra célula. Selecionar um ponto muda as barras e a identificação regional.
- Regiões: `/api/regions`, limites IBGE.
- Estradas: `/api/infrastructure/roads`, vias OSM pré-processadas pelo sistema. Relevo: `/api/infrastructure/terrain`, classificação exploratória derivada do NASADEM. São carregados sob demanda. O relevo indica suscetibilidade a acúmulo de água, não altitude absoluta nem segurança de um ponto.
- Não há consulta externa ao Overpass, busca por estabelecimentos ou substituição de pontos calculados por hospitais e bombeiros cadastrados.
- Como apoiar permanece um painel separado com orientações de doação, voluntariado e recursos.

## Fonte dos pontos calculados: pendente

A cópia local em `forecast-consolidate`, a cópia `climate-forensics`, as referências Git disponíveis e as APIs locais 8010/8011 foram examinadas. Há dados de rodovias, relevo e 731 **travessias candidatas para investigação**, descritos em `docs/infrastructure-exposure.md`; eles não representam pontos de apoio e não foram reaproveitados como abrigos.

É necessário localizar o arquivo, branch ou endpoint dos pontos de apoio calculados que o usuário mencionou. Nenhum endpoint foi inventado e nenhum novo cálculo foi criado. Por enquanto, a página mostra **Pontos de apoio indisponíveis**, em vez de afirmar que não existem locais na região.

`SupportPage` recebe opcionalmente um modelo de apresentação `calculatedPoints`; o adaptador para o formato real do produtor será feito após receber a fonte. A página ainda não recebe esses resultados em execução. Os testes com resultados usam somente fixtures sintéticas identificadas, sem dados de demonstração na aplicação.

Quando forem fornecidos, os resultados serão ordenados por distância geodésica ao ponto selecionado; critérios, fonte e data recebidos podem ser exibidos em **Por que este ponto foi indicado?**. Isso não confirma funcionamento ou acesso. O link de rota abre Google Maps com o destino, sem inventar uma rota segura.

## Execução e verificação

Na raiz: `npm --prefix frontend run dev -- --host 127.0.0.1 --port 5181 --strictPort`. Abrir `http://127.0.0.1:5181/apoio`. Definir `VITE_API_BASE_URL` para a API existente (na prévia local, `http://127.0.0.1:8011`).

Verificações: `npm --prefix frontend test` e `npm --prefix frontend run build`. Backend e dados científicos não foram alterados.
