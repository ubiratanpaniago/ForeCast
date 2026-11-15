"""Scientific integrity checks; optional processing dependencies required."""
import calendar
import importlib.util
import json
import os
from pathlib import Path

import pytest

np = pytest.importorskip('numpy')
xr = pytest.importorskip('xarray')
pytest.importorskip('shapely')
pytest.importorskip('pyproj')
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('native_processing', ROOT/'scripts/prepare_native_grids.py')
pipeline = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pipeline)


def test_missing_month_never_becomes_zero_and_leap_year_weighting():
    # Synthetic values are used only to test the conversion algebra.
    monthly = np.ones((288, 2))
    monthly[0,0] = np.nan
    values, counts = pipeline.annual_values(monthly, pipeline.YEARS)
    assert np.isnan(values[0,0]) and counts[0,0] == 11
    assert values[0,1] == 365*24 and values[3,1] == 366*24
    soil, _ = pipeline.annual_values(monthly, pipeline.YEARS, soil=True)
    assert np.isnan(soil[0,0]) and soil[3,1] == 1


def test_output_cannot_be_overwritten(tmp_path):
    output = tmp_path/'file.json'
    pipeline.write_checked(output, {'a':1})
    pipeline.write_checked(output, {'a':1})
    with pytest.raises(ValueError):
        pipeline.write_checked(output, {'a':2})


@pytest.mark.skipif(not os.getenv('FORECAST_RAW_ROOT'), reason='Set FORECAST_RAW_ROOT for independent real-source verification')
@pytest.mark.parametrize('product', pipeline.PRODUCTS)
def test_annual_series_independently_matches_real_raw_months(product):
    raw = Path(os.environ['FORECAST_RAW_ROOT'])
    folder = ROOT/'data/derived/grids'/product['id']
    geometry = json.loads((folder/'cells.geojson').read_bytes())
    series = json.loads((folder/'series.json').read_bytes())
    # Choose a cell with valid values (GLDAS includes missing coastal cells).
    cell = next(f for f in geometry['features'] if series['cells'][f['id']]['values'][0] is not None)
    records = sorted([json.loads(line) for line in (raw/product['folder']/'manifest.jsonl').read_text().splitlines()], key=lambda r:r['time_start'])[:12]
    values = []
    for record in records:
        with xr.open_dataset(raw/record['file'], group='Grid' if product['indicator']=='PRCP_ANNUAL' else None) as ds:
            v = float(ds[product['variable']].sel(lon=cell['properties']['center'][0], lat=cell['properties']['center'][1], method='nearest').isel(time=0).values)
            values.append(v)
    days = np.array([calendar.monthrange(2001,m)[1] for m in range(1,13)])
    expected = sum(np.array(values)*days*24) if product['indicator']=='PRCP_ANNUAL' else sum(np.array(values)*days)/sum(days)
    assert series['cells'][cell['id']]['values'][0] == pytest.approx(expected, abs=1e-6)
