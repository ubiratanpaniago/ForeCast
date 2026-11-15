"""Testes das funções estatísticas e espaciais do pipeline NASA (analyze_trends.py e export_grids.py).

Usam séries sintéticas com resultado conhecido; não leem dados raw. Precisam das dependências do pipeline
(requirements.txt): sem elas, o módulo é pulado.
"""
import sys
from pathlib import Path

import pytest

np = pytest.importorskip("numpy")
pytest.importorskip("scipy")
pytest.importorskip("shapely")
pytest.importorskip("pymannkendall")
pytest.importorskip("netCDF4")

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))
import analyze_trends as at  # noqa: E402
import export_grids as eg  # noqa: E402
import shapely  # noqa: E402

YEARS = np.arange(2001, 2025)


# ---------------------------------------------------------------- Theil-Sen e Mann-Kendall
def test_perfect_linear_trend_gives_exact_sen_slope_per_decade():
    values = 100 + 2.0 * (YEARS - 2001)            # 2 unidades/ano = 20/década
    st = eg.annual_stats(values.astype(float))
    assert st["slope"] == pytest.approx(20.0)
    assert st["lo"] == pytest.approx(20.0) and st["hi"] == pytest.approx(20.0)
    assert st["tau"] == pytest.approx(1.0)
    assert st["p"] < 1e-6


def test_sen_confidence_interval_contains_true_slope_with_noise():
    rng = np.random.default_rng(42)
    values = 50 + 1.5 * (YEARS - 2001) + rng.normal(0, 3, YEARS.size)
    st = eg.annual_stats(values)
    assert st["lo"] <= 15.0 <= st["hi"]
    assert st["lo"] <= st["slope"] <= st["hi"]


def test_sen_ci_is_symmetric_rank_interval_of_pairwise_slopes():
    x = np.array([1.0, 3.0, 2.0, 5.0, 4.0, 6.0, 8.0, 7.0])
    import pymannkendall as mk
    res = mk.original_test(x)
    lo, hi = at.sen_ci(x, res.var_s)
    i, j = np.triu_indices(x.size, k=1)
    slopes = (x[j] - x[i]) / (j - i)
    assert slopes.min() <= lo <= res.slope <= hi <= slopes.max()


def test_trendless_noise_is_not_significant():
    rng = np.random.default_rng(7)
    st = eg.annual_stats(rng.normal(1500, 200, YEARS.size))
    assert st["p"] > 0.05


@pytest.mark.parametrize("values", [
    np.full(24, 10.0),                                   # constante
    np.r_[np.arange(23.0), np.nan],                      # ano faltando
    np.arange(20.0),                                     # série curta
])
def test_annual_stats_refuses_constant_incomplete_or_short_series(values):
    assert eg.annual_stats(values) is None


# ---------------------------------------------------------------- direção publicada
def _st(slope, lo, hi, p=0.001):
    return {"slope": slope, "lo": lo, "hi": hi, "p": p, "tau": 0.5}


def test_direction_requires_fdr_and_interval_excluding_zero():
    assert eg.statistics_obj(_st(5, 1, 9), True, "m")["direction"] == "increasing"
    assert eg.statistics_obj(_st(-5, -9, -1), True, "m")["direction"] == "decreasing"
    assert eg.statistics_obj(_st(5, -1, 9), True, "m")["direction"] == "inconclusive"   # IC cruza zero
    assert eg.statistics_obj(_st(5, 1, 9), False, "m")["direction"] == "inconclusive"   # não passou no FDR


def test_missing_statistics_are_insufficient_and_fully_null():
    s = eg.statistics_obj(None, True, "m")
    assert s["status"] == "insufficient" and s["direction"] == "inconclusive"
    assert s["slopePerDecade"] is None and s["pValue"] is None and s["confidenceInterval95"] is None


def test_published_interval_always_contains_slope_after_rounding():
    s = eg.statistics_obj(_st(1.00004, 1.00001, 2.0), True, "m")
    lo, hi = s["confidenceInterval95"]
    assert lo <= s["slopePerDecade"] <= hi


# ---------------------------------------------------------------- FDR Benjamini-Hochberg
def test_bh_fdr_step_up_rule():
    # m = 5, q = 0,05: limiares 0,01 0,02 0,03 0,04 0,05. O maior k com p(k) <= limiar é 4.
    p = np.array([0.04, 0.001, 0.03, 0.2, 0.012])
    assert eg.at.bh_fdr(p).tolist() == [True, True, True, False, True]


def test_bh_fdr_ignores_nan_and_rejects_nothing_when_no_p_qualifies():
    p = np.array([np.nan, 0.5, 0.06, np.nan])
    assert not at.bh_fdr(p).any()
    p = np.array([np.nan, 0.001])
    assert at.bh_fdr(p).tolist() == [False, True]


def test_bh_fdr_is_stricter_than_raw_alpha():
    p = np.r_[np.full(10, 0.04), np.full(90, 0.5)]
    assert (p < 0.05).sum() == 10
    assert at.bh_fdr(p).sum() == 0


# ---------------------------------------------------------------- espaço
def test_cell_fraction_counts_partial_cells():
    lat = np.array([0.05, 0.15])
    lon = np.array([0.05, 0.15])
    half = shapely.box(0.0, 0.0, 0.05, 0.2)         # metade oeste da primeira coluna
    frac = at.cell_fraction(half, lat, lon)
    assert frac[:, 0] == pytest.approx([0.5, 0.5])
    assert frac[:, 1] == pytest.approx([0.0, 0.0])


def test_regional_mean_weights_by_cos_latitude_and_skips_missing_cells():
    lat = np.array([0.0, 60.0])
    frac = np.ones((2, 1))
    x = np.array([[[1.0], [3.0]]])                   # (tempo, lat, lon)
    expected = (1 * 1.0 + 3 * 0.5) / 1.5
    assert at.regional_mean(x, frac, lat)[0] == pytest.approx(expected)
    x_gap = np.array([[[1.0], [np.nan]]])
    assert at.regional_mean(x_gap, frac, lat)[0] == pytest.approx(1.0)


def test_regional_mean_is_nan_when_region_has_no_data():
    lat = np.array([-30.0])
    out = at.regional_mean(np.array([[[np.nan]]]), np.ones((1, 1)), lat)
    assert np.isnan(out[0])


# ---------------------------------------------------------------- agregação anual
def test_annual_sum_uses_nansum_so_export_must_mask_incomplete_years():
    """annual_values('sum') transforma lacuna em soma parcial; export_grids.load_annual mascara anos
    com menos de 12 meses válidos. Este teste documenta esse contrato."""
    monthly = np.ones((288, 1, 1))
    monthly[0] = np.nan
    yi = np.repeat(YEARS, 12)
    ann = at.annual_values(monthly, yi, "sum")
    assert ann[0, 0, 0] == 11 and ann[1, 0, 0] == 12


def test_series_obj_publishes_missing_and_negative_values_as_null():
    vals = np.r_[np.nan, -1.0, np.arange(22.0) + 0.123]
    s = eg.series_obj(vals)
    assert s[0]["value"] is None and s[1]["value"] is None
    assert s[2] == {"year": 2003, "value": 0.12}
