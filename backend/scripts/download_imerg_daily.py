"""Baixa o IMERG Final diário (GPM_3IMERGDF V07) recortado para o Sul do Brasil, 2001–2024.

Usa o OPeNDAP da NASA (opendap.earthdata.nasa.gov): o recorte é feito no servidor, então cada dia
baixa ~140 KB em vez do arquivo global. Mesmo recorte e mesmo nome de arquivo do que já está em
data/raw/imerg_daily (lat 560:679, lon 1220:1329 da grade global de 0,1°).

AUTENTICAÇÃO (Earthdata Login, conta gratuita em https://urs.earthdata.nasa.gov):
  Opção 1 — token: gere em urs.earthdata.nasa.gov > "Generate Token" e, no terminal:
      PowerShell:  $env:EARTHDATA_TOKEN = "<token>"
      bash:        export EARTHDATA_TOKEN=<token>
  Opção 2 — arquivo ~/.netrc (Windows: %USERPROFILE%\\_netrc) com a linha:
      machine urs.earthdata.nasa.gov login <usuario> password <senha>
  A conta precisa ter autorizado o aplicativo "NASA GESDISC DATA ARCHIVE" (Applications > Authorized Apps).

Uso:
  python scripts/download_imerg_daily.py                 # 2001–2024, pula o que já existe
  python scripts/download_imerg_daily.py --start 2024-05-01 --end 2024-05-31
  python scripts/download_imerg_daily.py --workers 8

É seguro interromper e rodar de novo: dias já baixados e válidos são pulados.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import netrc
import os
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import netCDF4
import numpy as np
import requests

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "raw" / "imerg_daily"
COLLECTION = "C2723754864-GES_DISC"          # GPM_3IMERGDF.07 (conferido no manifesto existente)
LAT = (560, 679)
LON = (1220, 1329)
EDL_HOST = "urs.earthdata.nasa.gov"


def granule(d: date) -> str:
    return f"3B-DAY.MS.MRG.3IMERG.{d:%Y%m%d}-S000000-E235959.V07B.nc4"


def opendap_url(d: date) -> str:
    g = granule(d)
    # dimensões do arquivo diário: precipitation(time, lon, lat)
    ce = (f"/precipitation[0:1:0][{LON[0]}:1:{LON[1]}][{LAT[0]}:1:{LAT[1]}];"
          f"/lat[{LAT[0]}:1:{LAT[1]}];/lon[{LON[0]}:1:{LON[1]}];/time[0:1:0]")
    return (f"https://opendap.earthdata.nasa.gov/collections/{COLLECTION}/granules/"
            f"GPM_3IMERGDF.07%3A{g}.dap.nc4?dap4.ce={requests.utils.quote(ce, safe='/[]:;')}")


def target(d: date) -> Path:
    return OUT / f"{d:%Y}" / granule(d).replace(".nc4", ".south_br.nc4")


class EDLSession(requests.Session):
    """Mantém a autenticação nos redirecionamentos para o Earthdata Login (padrão da NASA)."""

    def rebuild_auth(self, prepared_request, response):
        headers = prepared_request.headers
        url = prepared_request.url
        if "Authorization" in headers:
            orig = requests.utils.urlparse(response.request.url).hostname
            new = requests.utils.urlparse(url).hostname
            if orig != new and new != EDL_HOST and orig != EDL_HOST and not os.environ.get("EARTHDATA_TOKEN"):
                del headers["Authorization"]


def make_session() -> EDLSession:
    s = EDLSession()
    token = os.environ.get("EARTHDATA_TOKEN")
    if token:
        s.headers["Authorization"] = f"Bearer {token}"
        return s
    for name in (".netrc", "_netrc"):
        p = Path.home() / name
        if p.exists():
            auth = netrc.netrc(p).authenticators(EDL_HOST)
            if auth:
                s.auth = (auth[0], auth[2])
                return s
    sys.exit("Sem credenciais do Earthdata: defina EARTHDATA_TOKEN ou crie ~/.netrc (veja o topo deste arquivo).")


# A biblioteca HDF5 por trás do netCDF4 NÃO é thread-safe: abrir arquivos em várias threads ao mesmo
# tempo gera erros "HDF5-DIAG" e pode derrubar o processo. Toda leitura NetCDF passa por este lock;
# só os downloads (rede) rodam em paralelo.
NC_LOCK = threading.Lock()


def valid_file(p: Path) -> bool:
    with NC_LOCK:
        try:
            with netCDF4.Dataset(p) as ds:
                a = ds["precipitation"][:]
                return a.shape == (1, LON[1] - LON[0] + 1, LAT[1] - LAT[0] + 1)
        except Exception:
            return False


_lock = threading.Lock()


def fetch(session: EDLSession, d: date, retries: int = 4) -> tuple[date, str]:
    p = target(d)
    if p.exists() and valid_file(p):
        return d, "existente"
    p.parent.mkdir(parents=True, exist_ok=True)
    url = opendap_url(d)
    last = ""
    for attempt in range(retries):
        try:
            r = session.get(url, timeout=120)
            if r.status_code in (401, 403):
                return d, f"ERRO {r.status_code}: credencial recusada ou app GES DISC não autorizado"
            if r.status_code == 404:
                return d, "ERRO 404: granule inexistente"
            r.raise_for_status()
            tmp = p.with_suffix(".part")
            tmp.write_bytes(r.content)
            if not valid_file(tmp):
                last = "arquivo inválido (resposta não é NetCDF com o recorte esperado)"
                tmp.unlink(missing_ok=True)
                raise ValueError(last)
            tmp.replace(p)
            entry = {
                "granule_ur": f"GPM_3IMERGDF.07:{granule(d)}", "time_start": f"{d.isoformat()}T00:00:00.000Z",
                "opendap_url": url.split(".dap.nc4")[0], "file": str(p.relative_to(OUT.parent)).replace("\\", "/"),
                "sha256": hashlib.sha256(p.read_bytes()).hexdigest(), "bytes": p.stat().st_size,
                "retrieved_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "n_lat": LAT[1] - LAT[0] + 1, "n_lon": LON[1] - LON[0] + 1,
            }
            with _lock, open(OUT / "manifest.jsonl", "a", encoding="utf-8") as f:
                f.write(json.dumps(entry) + "\n")
            return d, "baixado"
        except Exception as e:  # noqa: BLE001
            last = str(e)[:200]
            time.sleep(2 ** attempt)
    return d, f"ERRO após {retries} tentativas: {last}"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", default="2001-01-01")
    ap.add_argument("--end", default="2024-12-31")
    ap.add_argument("--workers", type=int, default=6)
    args = ap.parse_args()
    d0, d1 = date.fromisoformat(args.start), date.fromisoformat(args.end)
    days = [d0 + timedelta(n) for n in range((d1 - d0).days + 1)]

    session = make_session()
    # teste rápido com 1 dia antes de disparar tudo
    _, status = fetch(session, days[0])
    if status.startswith("ERRO"):
        sys.exit(f"{days[0]}: {status}")

    counts = {"existente": 0, "baixado": 0, "erro": 0}
    errors = []
    t0 = time.time()
    with ThreadPoolExecutor(args.workers) as ex:
        futs = [ex.submit(fetch, session, d) for d in days[1:]]
        for k, fut in enumerate(as_completed(futs), 1):
            d, status = fut.result()
            key = "erro" if status.startswith("ERRO") else status
            counts[key] += 1
            if key == "erro":
                errors.append((d.isoformat(), status))
            if k % 200 == 0 or k == len(futs):
                rate = k / (time.time() - t0)
                print(f"{k}/{len(futs)}  {counts}  ~{(len(futs) - k) / max(rate, 1e-9) / 60:.0f} min restantes",
                      flush=True)
    if errors:
        (OUT / "download_errors.json").write_text(json.dumps(errors, indent=1), encoding="utf-8")
        print(f"{len(errors)} dias com erro -> {OUT / 'download_errors.json'} (rode de novo para tentar só esses)")
    print("ok", counts)


if __name__ == "__main__":
    main()
