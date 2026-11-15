"""Auditoria científica dos dados pré-calculados exportados por export_grids.py.

Complementa validate_export.py (que confere o *formato* do contrato) com checagens de *conteúdo*:

  1. Integridade: todo arquivo de série existe, cobre 2001–2024 e bate com o resumo da célula no GeoJSON.
  2. Faixa física: valores dentro de limites plausíveis para cada indicador.
  3. Reprodutibilidade estatística: Mann-Kendall + Theil-Sen recalculados a partir da série publicada
     batem com o bloco `statistics`; a direção bate com FDR Benjamini-Hochberg recalculado.
  4. Coerência entre indicadores da mesma célula:
       R50MM > 0  <=>  RX1DAY >= 50 mm;   PRCP_ANNUAL >= RX1DAY;   SOIL_ROOT >= SOIL_SURFACE.
  5. Comparação independente: PRCP_ANNUAL e SOIL_SURFACE contra os derivados da API
     (backend/data/derived/grids, gerados por prepare_native_grids.py a partir dos mesmos raw).
  6. Regiões: mesmas checagens de faixa e estatística (direção por p < 0,05, sem FDR).
  7. Áreas seguras: metadados, legenda e validação contra a enchente de 2024 coerentes.

Não altera nenhum arquivo. Escreve um relatório Markdown (--report) e sai com código 1 se houver erro.

Uso:  python scripts/audit_export.py [--out ../frontend/public/data] [--report ../docs/data-audit.md]
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import export_grids as eg  # noqa: E402  (mesma estatística usada na exportação)
import analyze_trends as at  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DERIVED = ROOT / "data" / "derived" / "grids"
YEARS = list(range(2001, 2025))
PSTR = "2001-2024"

# Limites físicos plausíveis para o Sul do Brasil (amplos de propósito: pegam erro de unidade, não clima).
RANGES = {
    "PRCP_ANNUAL": (300.0, 5000.0),     # mm/ano
    "RX1DAY": (5.0, 600.0),             # mm/dia
    "R50MM": (0.0, 60.0),               # dias/ano
    "SOIL_SURFACE": (2.0, 60.0),        # kg/m² em 0–10 cm (porosidade ~0,5 => máx. ~50)
    "SOIL_ROOT": (20.0, 1000.0),        # kg/m² na zona radicular
}
# A série é publicada com 2 casas: cada valor pode ter mudado até 0,005, o que desloca uma inclinação
# entre anos vizinhos em até 0,01/ano = 0,1/década e pode criar ou desfazer empates no Mann-Kendall.
TOL_SLOPE = 0.1           # tolerância absoluta na inclinação/década
TOL_REL = 0.01            # ... ou 1 % relativo
TOL_DERIVED = 0.05        # mm ou kg/m²: diferença aceitável entre as duas cadeias de processamento


class Report:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []
        self.sections: list[tuple[str, list[str]]] = []

    def error(self, msg: str) -> None:
        self.errors.append(msg)

    def warn(self, msg: str) -> None:
        self.warnings.append(msg)

    def section(self, title: str, lines: list[str]) -> None:
        self.sections.append((title, lines))


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def close(a: float, b: float, tol_abs: float = TOL_SLOPE, tol_rel: float = TOL_REL) -> bool:
    return abs(a - b) <= max(tol_abs, tol_rel * max(abs(a), abs(b)))


def values_of(series: list[dict]) -> np.ndarray:
    return np.array([np.nan if p["value"] is None else p["value"] for p in series], dtype=float)


# --------------------------------------------------------------------------------------
def audit_grids(out: Path, rep: Report) -> dict[str, dict[str, dict[tuple[int, int], np.ndarray]]]:
    """Retorna {indicador: {gridId: {(row, col): valores}}} para as checagens cruzadas."""
    catalog = load(out / "grids" / "catalog.json")["grids"]
    by_ind: dict[str, dict[str, dict]] = defaultdict(dict)
    lines = ["| Grade | Indicador | Células | Com estatística | Aumento | Redução | Inconclusiva | Série constante |",
             "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |"]
    rounding_p: Counter = Counter()
    revisions = {g["revision"] for g in catalog if g["available"]}
    if len(revisions) > 1:
        rep.warn(f"Catálogo com revisões diferentes entre grades: {sorted(revisions)}")
    for g in catalog:
        if not g["available"]:
            rep.warn(f"Grade {g['id']} indisponível: {g.get('unavailableReason')}")
            continue
        for ind in g["indicators"]:
            fc = load(out / "grids" / g["id"] / "cells" / ind / f"{PSTR}.geojson")
            cells: dict[tuple[int, int], np.ndarray] = {}
            stats_for_fdr = []
            dirs = Counter()
            constant = 0
            lo_lim, hi_lim = RANGES[ind]
            out_of_range = []
            for f in fc["features"]:
                q = f["properties"]
                cid = q["id"]
                path = out / "grids" / g["id"] / "series" / cid / ind / f"{PSTR}.json"
                if not path.exists():
                    rep.error(f"{g['id']}/{ind}: série ausente para {cid}")
                    continue
                d = load(path)
                vals = values_of(d["series"])
                if [p["year"] for p in d["series"]] != YEARS:
                    rep.error(f"{cid}/{ind}: anos da série diferentes de 2001–2024")
                cells[(q["row"], q["column"])] = vals

                # 1. resumo do GeoJSON == bloco statistics da série
                summ = q["summary"]
                st_cell = None if summ is None else summ["statistics"]
                if st_cell != d["statistics"]:
                    rep.error(f"{cid}/{ind}: statistics do GeoJSON difere do arquivo de série")

                # 2. faixa física
                fin = vals[np.isfinite(vals)]
                bad = fin[(fin < lo_lim) | (fin > hi_lim)]
                if bad.size:
                    out_of_range.append((cid, float(bad.min()), float(bad.max())))
                if ind == "R50MM" and fin.size and not np.allclose(fin, np.round(fin)):
                    rep.error(f"{cid}/R50MM: contagem de dias não inteira")

                # 3. estatística recalculada
                st = d["statistics"]
                complete = fin.size == len(YEARS)
                if st is None:
                    if complete and np.std(vals) > 0:
                        rep.error(f"{cid}/{ind}: série completa e variável, mas statistics=null")
                    elif complete:
                        constant += 1
                    continue
                if not complete:
                    rep.error(f"{cid}/{ind}: statistics presente com série incompleta")
                    continue
                re = eg.annual_stats(vals)
                if re is None:
                    rep.error(f"{cid}/{ind}: série publicada é constante, mas tem statistics")
                    continue
                if not close(re["slope"], st["slopePerDecade"]):
                    rep.error(f"{cid}/{ind}: Sen recalculado {re['slope']:.4f} ≠ publicado {st['slopePerDecade']}")
                # p bruto não decide a direção sozinho (ela exige FDR); divergência aqui é efeito do
                # arredondamento. Conflitos de conclusão aparecem na checagem de FDR abaixo.
                if abs(re["p"] - st["pValue"]) > 0.02 or (re["p"] < 0.05) != (st["pValue"] < 0.05):
                    rounding_p[ind] += 1
                lo, hi = st["confidenceInterval95"]
                if not (lo <= st["slopePerDecade"] <= hi):
                    rep.error(f"{cid}/{ind}: inclinação fora do próprio IC 95 %")
                excludes_zero = lo > 0 or hi < 0
                if st["direction"] != "inconclusive" and not excludes_zero:
                    rep.error(f"{cid}/{ind}: direção {st['direction']} com IC cruzando zero")
                dirs[st["direction"]] += 1
                stats_for_fdr.append((cid, st))

            # 3b. FDR recalculado sobre os p publicados (arredondados a 6 casas: tolera fronteira)
            if stats_for_fdr:
                p = np.array([s["pValue"] for _, s in stats_for_fdr])
                sig = at.bh_fdr(p)
                ranked = np.sort(p)
                m = len(ranked)
                below = ranked <= 0.05 * np.arange(1, m + 1) / m
                cutoff = ranked[np.max(np.nonzero(below)[0])] if below.any() else 0.0
                mism = 0
                for (cid, s), sg in zip(stats_for_fdr, sig):
                    lo, hi = s["confidenceInterval95"]
                    expected = sg and (lo > 0 or hi < 0)
                    got = s["direction"] != "inconclusive"
                    if expected != got and abs(s["pValue"] - cutoff) > 1e-5:
                        mism += 1
                        if mism <= 5:
                            rep.error(f"{cid}/{ind}: direção {s['direction']} não confere com FDR recalculado")
                if mism > 5:
                    rep.error(f"{g['id']}/{ind}: {mism} células com direção divergente do FDR recalculado")
            if out_of_range:
                worst = sorted(out_of_range, key=lambda t: (t[1], -t[2]))[:3]
                rep.warn(f"{g['id']}/{ind}: {len(out_of_range)} células com valores fora de "
                         f"[{lo_lim}, {hi_lim}]; exemplos: " +
                         ", ".join(f"{c} ({a:.1f}–{b:.1f})" for c, a, b in worst))
            n_stats = len(stats_for_fdr)
            lines.append(f"| `{g['id']}` | {ind} | {len(fc['features'])} | {n_stats} | {dirs['increasing']} | "
                         f"{dirs['decreasing']} | {dirs['inconclusive']} | {constant} |")
            by_ind[ind][g["id"]] = cells
    for ind, n in rounding_p.items():
        rep.warn(f"{ind}: em {n} células o p recalculado da série publicada (2 casas) difere do publicado "
                 "(mais de 0,02 ou do outro lado de 0,05), sem mudar a direção após FDR. O arredondamento cria empates no Mann-Kendall; "
                 "publicar a série com mais casas tornaria a estatística reprodutível a partir do arquivo.")
    rep.section("Grades nativas", lines)
    return by_ind


# --------------------------------------------------------------------------------------
def cross_checks(by_ind: dict, rep: Report) -> None:
    lines = []

    def pairs(a_ind, a_grid, b_ind, b_grid):
        a, b = by_ind.get(a_ind, {}).get(a_grid), by_ind.get(b_ind, {}).get(b_grid)
        if a is None or b is None:
            return []
        return [(k, a[k], b[k]) for k in a.keys() & b.keys()]

    # R50MM x RX1DAY (mesma grade diária, mesmo dado)
    pr = pairs("RX1DAY", "imerg-daily-v07", "R50MM", "imerg-daily-v07")
    viol = 0
    checked = 0
    for k, rx, r50 in pr:
        ok = np.isfinite(rx) & np.isfinite(r50)
        checked += int(ok.sum())
        # tolera 0,005 mm de arredondamento em torno do limiar
        bad = ok & (((rx < 49.995) & (r50 > 0)) | ((rx >= 50.005) & (r50 == 0)))
        viol += int(bad.sum())
        if bad.any() and viol <= 3:
            y = YEARS[int(np.argmax(bad))]
            rep.error(f"célula r{k[0]}-c{k[1]} {y}: RX1DAY={rx[YEARS.index(y)]} incoerente com R50MM={r50[YEARS.index(y)]}")
    lines.append(f"- RX1DAY × R50MM: {checked} célula-anos conferidos, {viol} incoerências "
                 "(R50MM > 0 exige RX1DAY ≥ 50 mm e vice-versa).")
    if viol > 3:
        rep.error(f"RX1DAY × R50MM: {viol} célula-anos incoerentes no total")

    # PRCP_ANNUAL (IMERG mensal) >= RX1DAY (IMERG diário): produtos distintos, mesma grade 0,1°
    pr = pairs("PRCP_ANNUAL", "imerg-monthly-v07", "RX1DAY", "imerg-daily-v07")
    ratio = []
    viol = 0
    for k, tot, rx in pr:
        ok = np.isfinite(tot) & np.isfinite(rx)
        viol += int((ok & (rx > tot)).sum())
        ratio.extend((rx[ok] / tot[ok]).tolist())
    if pr:
        rq = np.percentile(ratio, [50, 99]) if ratio else [math.nan, math.nan]
        lines.append(f"- PRCP_ANNUAL ≥ RX1DAY: {len(pr)} células em comum, {viol} célula-anos em que a máxima diária "
                     f"supera o total anual; RX1DAY/total: mediana {rq[0]:.3f}, p99 {rq[1]:.3f}.")
        if viol:
            rep.error(f"PRCP_ANNUAL < RX1DAY em {viol} célula-anos")

    # SOIL_ROOT >= SOIL_SURFACE (a zona radicular inclui a camada 0–10 cm)
    pr = pairs("SOIL_ROOT", "gldas-noah-monthly-v21", "SOIL_SURFACE", "gldas-noah-monthly-v21")
    viol = 0
    for k, root, surf in pr:
        ok = np.isfinite(root) & np.isfinite(surf)
        viol += int((ok & (root + 0.01 < surf)).sum())
    if pr:
        lines.append(f"- SOIL_ROOT ≥ SOIL_SURFACE: {len(pr)} células, {viol} célula-anos violando.")
        if viol:
            rep.error(f"SOIL_ROOT < SOIL_SURFACE em {viol} célula-anos")
    rep.section("Coerência entre indicadores", lines)


def compare_derived(by_ind: dict, rep: Report) -> None:
    """Compara com os derivados da API, produzidos por outra cadeia (xarray, prepare_native_grids.py)."""
    lines = ["| Indicador | Células só aqui | Células só na API | Em comum | Dif. máx. | Célula-anos > tolerância |",
             "| --- | ---: | ---: | ---: | ---: | ---: |"]
    for ind, gid in (("PRCP_ANNUAL", "imerg-monthly-v07"), ("SOIL_SURFACE", "gldas-noah-monthly-v21")):
        path = DERIVED / gid / "series.json"
        mine = by_ind.get(ind, {}).get(gid)
        if not path.exists() or mine is None:
            rep.warn(f"Comparação com derivados da API pulada para {ind} (arquivo ausente)")
            continue
        api = load(path)
        if api["years"] != YEARS:
            rep.error(f"{gid}: anos dos derivados da API diferentes de 2001–2024")
            continue
        api_cells = {}
        for cid, c in api["cells"].items():
            _, r, cc = cid.split(":")
            api_cells[(int(r[1:]), int(cc[1:]))] = np.array(
                [np.nan if v is None else v for v in c["values"]], dtype=float)
        common = mine.keys() & api_cells.keys()
        diffs = []
        n_bad = 0
        nan_mismatch = 0
        for k in common:
            a, b = mine[k], api_cells[k]
            nan_mismatch += int((np.isfinite(a) != np.isfinite(b)).sum())
            ok = np.isfinite(a) & np.isfinite(b)
            d = np.abs(a[ok] - b[ok])
            diffs.extend(d.tolist())
            n_bad += int((d > TOL_DERIVED).sum())
        only_mine = len(mine.keys() - api_cells.keys())
        only_api = len(api_cells.keys() - mine.keys())
        dmax = max(diffs) if diffs else math.nan
        lines.append(f"| {ind} | {only_mine} | {only_api} | {len(common)} | {dmax:.4f} | {n_bad} |")
        if n_bad:
            rep.error(f"{ind}: {n_bad} célula-anos diferem dos derivados da API em mais de {TOL_DERIVED}")
        if nan_mismatch:
            rep.warn(f"{ind}: {nan_mismatch} célula-anos com dado em uma cadeia e ausente na outra")
        if only_mine or only_api:
            rep.warn(f"{ind}: seleção de células difere da API ({only_mine} só aqui, {only_api} só na API); "
                     "export_grids descarta interseções < 0,01 % da célula e usa área planar")
    lines += ["", "Causa conhecida da divergência em umidade do solo: `export_grids.py` faz a média simples dos 12 "
              "meses, enquanto `prepare_native_grids.py` (e `docs/methodology.md`) ponderam cada mês pelo número de "
              "dias. A diferença é pequena (até ~0,1 kg/m², ~0,3 %), mas as duas cadeias precisam usar o mesmo método."]
    rep.section("Comparação com os derivados da API (cadeia independente)", lines)


# --------------------------------------------------------------------------------------
def audit_regions(out: Path, rep: Report) -> None:
    root = out / "regions"
    counts = Counter()
    sig = Counter()
    region_ids = [p.name for p in root.iterdir() if p.is_dir()]
    inds_seen = Counter()
    for rdir in sorted(root.iterdir()):
        if not rdir.is_dir():
            continue
        for idir in sorted(rdir.iterdir()):
            ind = idir.name
            inds_seen[ind] += 1
            d = load(idir / f"{PSTR}.json")
            vals = values_of(d["series"])
            st = d["statistics"]
            lo_lim, hi_lim = RANGES[ind]
            fin = vals[np.isfinite(vals)]
            if fin.size < len(YEARS):
                rep.warn(f"região {rdir.name}/{ind}: {len(YEARS) - fin.size} anos sem valor")
            if ((fin < lo_lim) | (fin > hi_lim)).any() and not (ind == "RX1DAY" and fin.min() >= 1):
                rep.warn(f"região {rdir.name}/{ind}: valores fora de [{lo_lim}, {hi_lim}] "
                         f"({fin.min():.1f}–{fin.max():.1f})")
            counts[ind] += 1
            if st["status"] != "valid":
                continue
            re = eg.annual_stats(vals)
            if re is None:
                rep.error(f"região {rdir.name}/{ind}: statistics válida com série constante/incompleta")
                continue
            if not close(re["slope"], st["slopePerDecade"]):
                rep.error(f"região {rdir.name}/{ind}: Sen recalculado {re['slope']:.4f} ≠ {st['slopePerDecade']}")
            lo, hi = st["confidenceInterval95"]
            expected = re["p"] < 0.05 and (lo > 0 or hi < 0)
            if expected != (st["direction"] != "inconclusive") and abs(re["p"] - 0.05) > 1e-3:
                rep.error(f"região {rdir.name}/{ind}: direção {st['direction']} incoerente com p={re['p']:.4f}")
            if st["direction"] != "inconclusive":
                sig[ind] += 1
    n_tests = sum(counts.values())
    lines = [f"- {len(region_ids)} regiões (21 intermediárias + 3 estados) × {len(inds_seen)} indicadores = "
             f"{n_tests} séries.",
             "- Tendências com p < 0,05 e IC excluindo zero, por indicador: " +
             ", ".join(f"{k} {sig[k]}/{counts[k]}" for k in sorted(counts)) + ".",
             f"- Sem correção para testes múltiplos: com α = 0,05, cerca de {0.05 * n_tests:.0f} resultados "
             f"\"significativos\" seriam esperados por acaso entre {n_tests} testes; hoje há {sum(sig.values())}."]
    if len(region_ids) != 24:
        rep.error(f"esperadas 24 regiões, encontradas {len(region_ids)}")
    rep.section("Regiões", lines)


def audit_safe_areas(out: Path, rep: Report) -> None:
    root = out / "safe-areas"
    lines = []
    if not root.exists():
        rep.warn("safe-areas ausente")
        return
    for aoi in sorted(p for p in root.iterdir() if p.is_dir()):
        meta = load(aoi / "meta.json")
        for k, v in meta["layers"].items():
            if not (aoi / v).exists():
                rep.error(f"safe-areas/{aoi.name}: camada {k} aponta para {v}, ausente")
        sites = load(aoi / "sites.geojson")
        xs = [c[0] for c in meta["coordinates"]]
        ys = [c[1] for c in meta["coordinates"]]
        outside = 0
        for f in sites["features"]:
            x, y = f["geometry"]["coordinates"][:2]
            if not (min(xs) <= x <= max(xs) and min(ys) <= y <= max(ys)):
                outside += 1
        if outside:
            rep.error(f"safe-areas/{aoi.name}: {outside} locais fora do retângulo da AOI")
        val = meta.get("summary", meta).get("validation") if isinstance(meta.get("summary"), dict) else None
        val = val or _find(meta, "validation")
        share = val.get("observed_flood_share_by_class", {}) if val else {}
        if share and abs(sum(share.values()) - 1) > 0.01:
            rep.warn(f"safe-areas/{aoi.name}: frações por classe somam {sum(share.values()):.3f}")
        best = max(val["curve"], key=lambda c: c["f1"]) if val and val.get("curve") else None
        safe_flooded = val.get("share_of_safe_class_observed_flooded") if val else None
        lines.append(f"- **{aoi.name}** ({meta.get('name')}): {len(sites['features'])} locais no GeoJSON; "
                     f"área inundada observada em 2024 caindo na classe segura: "
                     f"{'n/d' if safe_flooded is None else f'{safe_flooded:.2%}'}; "
                     + (f"melhor F1 {best['f1']:.3f} com limiar de {best['height_above_main_water_threshold_m']} m "
                        f"(precisão {best['precision']:.2f}, recall {best['recall']:.2f})." if best else "sem curva."))
        if best and best["f1"] < 0.3:
            rep.warn(f"safe-areas/{aoi.name}: melhor F1 contra a mancha de 2024 é {best['f1']:.3f} "
                     f"(precisão {best['precision']:.2f}); a classe de suscetibilidade não reproduz a cheia observada "
                     "nesta área, só a classe segura foi validada")
        if safe_flooded is not None and safe_flooded > 0.01:
            rep.warn(f"safe-areas/{aoi.name}: {safe_flooded:.1%} da área inundada em 2024 está na classe segura")
    rep.section("Áreas seguras (POA e TAQ)", lines)


def _find(obj, key):
    if isinstance(obj, dict):
        if key in obj:
            return obj[key]
        for v in obj.values():
            r = _find(v, key)
            if r is not None:
                return r
    return None


# --------------------------------------------------------------------------------------
def write_report(rep: Report, out: Path, path: Path, revision: str) -> None:
    md = ["# Auditoria dos dados pré-calculados", "",
          f"Gerado por `backend/scripts/audit_export.py` em {date.today().isoformat()} sobre "
          f"`{out.relative_to(ROOT.parent).as_posix()}` (revisão `{revision}`).", "",
          "O script não altera dados. Recalcula as estatísticas a partir das séries publicadas e confronta "
          "os indicadores entre si e com a cadeia independente da API.", "",
          f"**Resultado: {len(rep.errors)} erros, {len(rep.warnings)} avisos.**", ""]
    for title, lines in rep.sections:
        md += [f"## {title}", "", *lines, ""]
    md += ["## Erros", ""] + ([f"- {e}" for e in rep.errors[:100]] or ["Nenhum."]) + [""]
    if len(rep.errors) > 100:
        md.append(f"... e mais {len(rep.errors) - 100}.\n")
    md += ["## Avisos", ""] + ([f"- {w}" for w in rep.warnings] or ["Nenhum."]) + [""]
    path.write_text("\n".join(md), encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=ROOT.parent / "frontend" / "public" / "data")
    ap.add_argument("--report", type=Path, default=ROOT.parent / "docs" / "data-audit.md")
    args = ap.parse_args()
    out = args.out.resolve()
    rep = Report()
    revision = load(out / "grids" / "catalog.json")["grids"][0]["revision"]
    by_ind = audit_grids(out, rep)
    cross_checks(by_ind, rep)
    compare_derived(by_ind, rep)
    audit_regions(out, rep)
    audit_safe_areas(out, rep)
    write_report(rep, out, args.report.resolve(), revision)
    print(f"{len(rep.errors)} erros, {len(rep.warnings)} avisos -> {args.report}")
    for e in rep.errors[:20]:
        print("ERRO", e)
    for w in rep.warnings[:20]:
        print("AVISO", w)
    return 1 if rep.errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
