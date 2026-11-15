# Tela de apoio

Rota `/apoio`. Layout desktop de uma altura de janela, com lista paginada (dois locais por página), detalhes em abas e painel modal separado para **Como apoiar**. A página inicial aponta para esta rota. Não altera backend, séries históricas ou a tela `/entenda`.

## Dados e comportamento

- Quatro centros urbanos públicos de exemplo em PR, SC e RS. Nenhuma geolocalização pessoal é coletada. Trocar a cidade descarta a resposta anterior e limpa a seleção. Consultas iguais são compartilhadas e guardadas por 15 minutos na memória da página; falhas não ficam em cache.
- Consulta ao [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API), raio de 15 km, com hospitais, clínicas, bombeiros e instalações cadastradas como `amenity=social_facility` + `social_facility=shelter`. A documentação de [acolhimento do OSM](https://wiki.openstreetmap.org/wiki/Tag:social_facility%3Dshelter) descreve o cadastro; não confirma ativação como abrigo para um evento.
- Resultados ordenados por distância geodésica em linha reta ao centro da cidade. Não é distância rodoviária nem localização do usuário. Sem valores inventados para telefones, lotação, horários ou acessibilidade.
- Busca na instância pública Private.coffee do Overpass, com timeout, descarte de respostas antigas, estado vazio, erro e nova tentativa. O serviço externo pode estar indisponível ou ter cadastro incompleto. O horário mostrado é o da consulta; não representa confirmação de funcionamento.
- Estradas: raster do OpenStreetMap, com atribuição. Relevo: hillshade de [Terrain Tiles / Mapzen](https://registry.opendata.aws/terrain-tiles/), Terrarium em S3, com [atribuição das fontes de elevação](https://github.com/tilezen/joerd/blob/master/docs/attribution.md). Camadas carregadas quando ativadas. Não são dados de bloqueios, relevo em tempo real ou avaliação de segurança.
- Acesso: link explícito para Google Maps, com destino selecionado e sem origem pessoal. Não desenha uma rota inventada ou garante uma rota segura.
- `Por que aparece?` explica o critério real (categoria e proximidade), a consulta, a revisão disponível do cadastro e as verificações ausentes. Link ao cadastro OSM para consultar ou corrigir a informação.
- `Como apoiar`: orientações para doações, voluntariado e recursos. Não publica campanhas, vagas ou dados bancários presumidos.

## Integração pendente

É necessária uma fonte oficial com abrigos ativados por evento, responsável, fonte verificável, data de confirmação e expiração, horário, serviços, acessibilidade, contato e lotação. Uma fonte de bloqueios atualizados e um serviço de roteamento são necessários para avaliar acesso. Os pontos atuais são **referências a verificar**, não abrigos confirmados.

Para produção, avaliar provedor/proxy/cache próprio para pontos e tiles, capacidade e políticas de uso dos serviços. Não fazer varredura global nem baixar tiles em massa.

## Execução

Na raiz do projeto: `npm --prefix frontend run dev -- --host 127.0.0.1 --port 5181 --strictPort`. Abrir `http://127.0.0.1:5181/apoio`. A busca e as camadas usam fontes públicas; a tela de apoio não depende do backend NASA.

Validação: `npm --prefix frontend test` e `npm --prefix frontend run build`.
