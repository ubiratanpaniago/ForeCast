# Rodovias × relevo — diagnóstico exploratório de exposição

**O que é:** quanto de cada trecho rodoviário de PR, SC e RS passa por áreas de relevo suscetível a acúmulo de água, segundo uma camada preliminar derivada do NASADEM, e onde estão essas passagens.

**O que não é:** risco de interdição, probabilidade de inundação ou dano. Não usa vazão, rede de drenagem, cota de pontes ou aterros, nem histórico de ocorrências.

## Dados

| Camada | Fonte | Resolução | Observação |
|---|---|---|---|
| Rodovias | OpenStreetMap (Overpass API), © colaboradores do OSM, ODbL 1.0 | vetorial | `highway=motorway\|trunk\|primary\|secondary` com `ref` BR-, PR-, SC-, ERS- ou RSC-. Data da base em `/api/infrastructure`. Não é o SNV oficial do DNIT. |
| Relevo | NASA NASADEM via Microsoft Planetary Computer (`build_terrain.py`, feat/nasa-data) | 0,1° (~10 km), a partir de ~240 m | Fração da terra de cada célula com altura relativa ao fundo de vale local (janela ~15 km) < 15 m e declividade < 3°. Aproximação do HAND. Classes: baixa < 2 %, média 2–15 %, alta ≥ 15 %. |
| Regiões | IBGE, regiões geográficas intermediárias | — | Agrupam os trechos. |

## Método (`backend/scripts/build_road_exposure.py`)

1. **Trecho** = vias OSM com o mesmo código principal na mesma região intermediária (atribuição pelo ponto médio da via). Vias com mais de um código usam o federal como principal; os demais ficam em `refs`.
2. **Extensão por classe**: cada via é dividida em pedaços de ~100 m; o meio de cada pedaço recebe a classe da célula de relevo. Comprimento geodésico (haversine). Vias de mão única contam metade, porque rodovias duplicadas aparecem no OSM como uma via por pista.
3. **Travessia candidata**: passagem de um trecho por uma célula de classe alta com ≥ 0,5 km. O ponto é o centro da passagem, ponderado pela extensão. Indica a célula a investigar, não o ponto exato de cruzamento com um rio.

Reprodução:

```powershell
cd backend
# terrain.json vem de feat/nasa-data (backend/data/historical/terrain.json)
python scripts/build_road_exposure.py --terrain CAMINHO\terrain.json
```

Requer `shapely`. As respostas da Overpass ficam em `data/cache/osm_roads/` (não versionado) e são reaproveitadas.

## Resultado atual (base OSM de 15/11/2026)

696 trechos, 38.453 km de rodovia; 5.505 km (14 %) em células de classe alta, 5.705 km (15 %) em média; 731 travessias candidatas.

## Limitações

- Células de 0,1° são grosseiras para rodovias: uma célula com 15 % de planície baixa é "alta" mesmo que a rodovia passe pela parte elevada.
- A camada de relevo é preliminar e não considera rios, obras de arte ou diques.
- O OSM pode ter códigos ausentes ou desatualizados; trechos urbanos de mão única ficam subestimados pela regra das pistas separadas.
- Nenhuma ponderação de criticidade (tráfego, rotas alternativas) foi aplicada.
