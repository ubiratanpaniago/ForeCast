"""Baixa da API do IBGE os limites usados na análise:

  data/regions.geojson               PR, SC e RS
  data/regions_intermediate.geojson  21 regiões geográficas intermediárias do Sul (PR 6, SC 7, RS 8)

Uso:  python scripts/build_regions.py
"""
import gzip
import json
import urllib.request
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / "data"
API = "https://servicodados.ibge.gov.br/api"
MESH = API + "/v3/malhas/{kind}/{code}?formato=application/vnd.geo%2Bjson&qualidade=intermediaria"

STATES = [
    {"id": "PR", "code": 41, "name": "Paraná"},
    {"id": "SC", "code": 42, "name": "Santa Catarina"},
    {"id": "RS", "code": 43, "name": "Rio Grande do Sul"},
]


def get_json(url: str):
    with urllib.request.urlopen(url, timeout=60) as r:
        raw = r.read()
    if raw[:2] == b"\x1f\x8b":  # a API do IBGE às vezes responde em gzip
        raw = gzip.decompress(raw)
    return json.loads(raw)


def geometry(kind: str, code: int):
    return get_json(MESH.format(kind=kind, code=code))["features"][0]["geometry"]


def write(path: Path, features) -> None:
    path.write_text(json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False),
                    encoding="utf-8")
    print(f"ok -> {path} ({len(features)} feições)")


def main() -> None:
    states = [{"type": "Feature", "properties": dict(st), "geometry": geometry("estados", st["code"])}
              for st in STATES]
    write(DATA / "regions.geojson", states)

    regions = []
    for st in STATES:
        for r in get_json(f"{API}/v1/localidades/estados/{st['code']}/regioes-intermediarias"):
            regions.append({
                "type": "Feature",
                "properties": {"id": str(r["id"]), "name": r["nome"], "abbreviation": st["id"],
                               "state": st["id"], "level": "regiao_intermediaria"},
                "geometry": geometry("regioes-intermediarias", r["id"]),
            })
    write(DATA / "regions_intermediate.geojson", regions)


if __name__ == "__main__":
    main()
