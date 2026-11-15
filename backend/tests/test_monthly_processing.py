import calendar
import importlib.util
import json
from pathlib import Path

import pytest

np=pytest.importorskip('numpy')
netCDF4=pytest.importorskip('netCDF4')
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('prepare_monthly',ROOT/'scripts/prepare_monthly_rainfall.py')
pipeline=importlib.util.module_from_spec(spec)
spec.loader.exec_module(pipeline)


def test_reference_is_per_calendar_month_with_strict_coverage_and_real_zero():
    values=np.tile(np.arange(12,dtype=float)[:,None],(24,2))
    values[1,1]=np.nan
    reference,counts=pipeline.monthly_reference(values)
    assert reference[0].tolist()==[0,0] and counts[0].tolist()==[24,24]
    assert reference[1,0]==1 and np.isnan(reference[1,1]) and counts[1,1]==23
    assert reference[11].tolist()==[11,11]


@pytest.mark.parametrize('stamp',['2001-01','2004-02','2024-12'])
def test_real_native_cell_matches_raw_rate_and_calendar_hours(stamp):
    output=ROOT/'data/derived/monthly-rainfall'
    manifest=json.loads((output/'manifest.json').read_bytes())
    record=next(json.loads(line) for line in (ROOT/'data/raw/imerg_monthly/manifest.jsonl').read_text().splitlines()
                if json.loads(line)['time_start'].startswith(stamp))
    year,month=map(int,stamp.split('-'))
    cell=manifest['cells'][0]
    index=cell['index']; width=len(manifest['grid']['lon'])
    lat,lon=manifest['grid']['lat'][index//width],manifest['grid']['lon'][index%width]
    with netCDF4.Dataset(ROOT/'data/raw'/record['file']) as nc:
        group=nc.groups['Grid']
        iy=int(np.argmin(abs(group.variables['lat'][:]-lat)))
        ix=int(np.argmin(abs(group.variables['lon'][:]-lon)))
        expected=float(group.variables['precipitation'][0,ix,iy])*calendar.monthrange(year,month)[1]*24
    frame=json.loads((output/f'{year}.json').read_bytes())['frames'][month-1]
    assert frame['t']==stamp and frame['values'][0]==pytest.approx(expected,abs=1e-6)


def test_checked_outputs_cannot_overwrite_existing_content(tmp_path):
    target=tmp_path/'x.json'
    pipeline.write_checked(target,{'value':0})
    pipeline.write_checked(target,{'value':0})
    with pytest.raises(ValueError):pipeline.write_checked(target,{'value':1})
