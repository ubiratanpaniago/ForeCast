"""Baixa o MERRA-2 mensal de superfície terrestre (M2TMNXLND 5.12.4) recortado para o Sul do Brasil, 1980–2024.

Por que MERRA-2: é a reanálise da NASA com série CONSISTENTE desde 1980 (45 anos), quase o dobro
dos 24 anos de IMERG/GLDAS 2.1. Mais anos = mais poder estatístico para detectar tendências.

Variáveis (todas no mesmo arquivo):
  PRECTOTLAND  chuva total sobre terra (corrigida por pluviômetros)      kg m-2 s-1
  RUNOFF       escoamento superficial                                      kg m-2 s-1
  BASEFLOW     escoamento subterrâneo                                      kg m-2 s-1
  EVLAND       evapotranspiração                                           kg m-2 s-1
  SFMC         umidade do solo superficial                                 m3 m-3
  RZMC         umidade do solo da zona radicular                           m3 m-3
  GWETROOT     saturação da zona radicular (0 = seco, 1 = saturado)        1

Grade: 0,5° lat × 0,625° lon. Recorte: lat -34,0…-22,0 (índices 112:136), lon -58,125…-46,875 (195:213).
A lista de arquivos vem do catálogo CMR da NASA (público), porque alguns meses reprocessados têm
nome diferente (MERRA2_401).

AUTENTICAÇÃO: a mesma do IMERG diário (EARTHDATA_TOKEN ou ~/.netrc). Veja download_imerg_daily.py.

Uso:  python scripts/download_merra2.py [--start 1980-01 --end 2024-12 --workers 6]
Seguro para interromper e rodar de novo.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
import threading
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

import netCDF4
import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
from download_imerg_daily import NC_LOCK, make_session  # noqa: E402  (mesma autenticação Earthdata)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "raw" / "merra2_monthly"
COLLECTION = "C1276812856-GES_DISC"   # M2TMNXLND 5.12.4, DOI 10.5067/8S35XF81C28F
LAT = (112, 136)
LON = (195, 213)
VARS = ["PRECTOTLAND", "RUNOFF", "BASEFLOW", "EVLAND", "SFMC", "RZMC", "GWETROOT"]
CMR = "https://cmr.earthdata.nasa.gov/search/granules.umm_json"


def list_granules(start: str, end: str) -> list[str]:
    r = requests.get(CMR, params={
        "collection_concept_id": COLLECTION, "temporal": f"{start}-01T00:00:00Z,{end}-28T23:59:59Z",
        "page_size": 2000, "sort_key": "start_date"}, timeout=60)
    r.raise_for_status()
    urs = [i["umm"]["GranuleUR"] for i in r.json()["items"]]
    # um arquivo por mês; se houver duplicata (ex.: 400 e 401), fica o reprocessado (401)
    by_month = {}
    for ur in urs:
        by_month.setdefault(ur.split(".")[-2], []).append(ur)
    return [sorted(v)[-1] for _, v in sorted(by_month.items())]


def opendap_url(ur: str) -> str:
    ce = ";".join([f"/{v}[0:1:0][{LAT[0]}:1:{LAT[1]}][{LON[0]}:1:{LON[1]}]" for v in VARS]
                  + [f"/lat[{LAT[0]}:1:{LAT[1]}]", f"/lon[{LON[0]}:1:{LON[1]}]", "/time[0:1:0]"])
    return (f"https://opendap.earthdata.nasa.gov/collections/{COLLECTION}/granules/"
            f"{urllib.parse.quote(ur, safe='')}.dap.nc4?dap4.ce={urllib.parse.quote(ce, safe='/[]:;')}")


def target(ur: str) -> Path:
    name = ur.split(":", 1)[1].replace(".nc4", ".south_br.nc4")
    return OUT / name.split(".")[-3][:4] / name   # .../AAAA/MERRA2_xxx.tavgM_2d_lnd_Nx.AAAAMM.south_br.nc4


def valid_file(p: Path) -> bool:
    with NC_LOCK:   # HDF5 não é thread-safe (ver download_imerg_daily.py)
        try:
            with netCDF4.Dataset(p) as ds:
                return all(ds[v].shape == (1, LAT[1] - LAT[0] + 1, LON[1] - LON[0] + 1) for v in VARS)
        except Exception:
            return False


_lock = threading.Lock()


def fetch(session, ur: str, retries: int = 4) -> tuple[str, str]:
    p = target(ur)
    if p.exists() and valid_file(p):
        return ur, "existente"
    p.parent.mkdir(parents=True, exist_ok=True)
    url = opendap_url(ur)
    last = ""
    for attempt in range(retries):
        try:
            r = session.get(url, timeout=120)
            if r.status_code in (401, 403):
                return ur, f"ERRO {r.status_code}: credencial recusada ou app GES DISC não autorizado"
            if r.status_code == 404:
                return ur, "ERRO 404: granule inexistente"
            r.raise_for_status()
            tmp = p.with_suffix(".part")
            tmp.write_bytes(r.content)
            if not valid_file(tmp):
                tmp.unlink(missing_ok=True)
                raise ValueError("resposta não é NetCDF com as variáveis/recorte esperados")
            tmp.replace(p)
            with _lock, open(OUT / "manifest.jsonl", "a", encoding="utf-8") as f:
                f.write(json.dumps({
                    "granule_ur": ur, "opendap_url": url.split(".dap.nc4")[0],
                    "file": str(p.relative_to(OUT.parent)).replace("\\", "/"),
                    "sha256": hashlib.sha256(p.read_bytes()).hexdigest(), "bytes": p.stat().st_size,
                    "retrieved_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                    "variables": VARS,
                }) + "\n")
            return ur, "baixado"
        except Exception as e:  # noqa: BLE001
            last = str(e)[:200]
            time.sleep(2 ** attempt)
    return ur, f"ERRO após {retries} tentativas: {last}"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", default="1980-01")
    ap.add_argument("--end", default="2024-12")
    ap.add_argument("--workers", type=int, default=6)
    args = ap.parse_args()

    granules = list_granules(args.start, args.end)
    print(f"{len(granules)} meses no catálogo da NASA ({granules[0].split('.')[-2]} a {granules[-1].split('.')[-2]})")
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "grid_spec.json").write_text(json.dumps({
        "collection": "M2TMNXLND 5.12.4", "concept_id": COLLECTION, "doi": "10.5067/8S35XF81C28F",
        "lat_slice": list(LAT), "lon_slice": list(LON), "variables": VARS,
        "lat_values": [-90 + 0.5 * i for i in range(LAT[0], LAT[1] + 1)],
        "lon_values": [-180 + 0.625 * i for i in range(LON[0], LON[1] + 1)],
    }, indent=1), encoding="utf-8")

    session = make_session()
    _, status = fetch(session, granules[0])
    if status.startswith("ERRO"):
        sys.exit(f"{granules[0]}: {status}")

    counts = {"existente": 0, "baixado": 0, "erro": 0}
    errors = []
    t0 = time.time()
    with ThreadPoolExecutor(args.workers) as ex:
        futs = [ex.submit(fetch, session, g) for g in granules[1:]]
        for k, fut in enumerate(as_completed(futs), 1):
            ur, status = fut.result()
            key = "erro" if status.startswith("ERRO") else status
            counts[key] += 1
            if key == "erro":
                errors.append((ur, status))
            if k % 50 == 0 or k == len(futs):
                rate = k / (time.time() - t0)
                print(f"{k}/{len(futs)}  {counts}  ~{(len(futs) - k) / max(rate, 1e-9) / 60:.0f} min restantes",
                      flush=True)
    if errors:
        (OUT / "download_errors.json").write_text(json.dumps(errors, indent=1), encoding="utf-8")
        print(f"{len(errors)} meses com erro -> {OUT / 'download_errors.json'} (rode de novo)")
    print("ok", counts)


if __name__ == "__main__":
    main()
