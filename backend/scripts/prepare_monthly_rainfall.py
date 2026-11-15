"""Export native IMERG monthly frames from locally verified NASA subsets.

Annual products and raw inputs are never modified. Publish the manifest last.
"""
import argparse
import calendar
import hashlib
import json
from pathlib import Path

import netCDF4
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
GRID_ID = 'imerg-monthly-v07'
ALGORITHM = 'imerg-native-monthly-frames-v1'


def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode('utf-8')


def sha(data):
    return hashlib.sha256(data).hexdigest()


def write_checked(path, value):
    content = encode(value)
    if path.exists():
        if path.read_bytes() != content:
            raise ValueError(f'Existing output differs: {path}. Choose a new output directory.')
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('xb') as stream:
        stream.write(content)


def nullable(values):
    return [None if not np.isfinite(v) else round(float(v), 6) for v in values]


def monthly_reference(values):
    """A reference needs every one of the 24 matching calendar months."""
    cube = values.reshape(24, 12, -1)
    counts = np.isfinite(cube).sum(axis=0)
    means = np.sum(np.where(np.isfinite(cube), cube, 0), axis=0) / 24
    return np.where(counts == 24, means, np.nan), counts


def prepare(raw_root, grids_root, output):
    manifest_bytes = (raw_root/'imerg_monthly/manifest.jsonl').read_bytes()
    spec_bytes = (raw_root/'imerg_monthly/grid_spec.json').read_bytes()
    cells_bytes = (grids_root/GRID_ID/'cells.geojson').read_bytes()
    definition = next(g for g in json.loads((grids_root/'catalog.json').read_bytes())['grids'] if g['id'] == GRID_ID)
    features = json.loads(cells_bytes)['features']
    records = sorted((json.loads(line) for line in manifest_bytes.splitlines() if line.strip()), key=lambda r: r['time_start'])
    months = [f'{y}-{m:02d}' for y in range(2001,2025) for m in range(1,13)]
    if [r['time_start'][:7] for r in records] != months:
        raise ValueError('Need exactly 288 unique calendar months, 2001–2024')
    spec = json.loads(spec_bytes)
    row0, row1 = spec['lat_slice']
    col0, col1 = spec['lon_slice']
    rows = np.array([f['properties']['row']-row0 for f in features])
    columns = np.array([f['properties']['column']-col0 for f in features])
    if not (np.all((rows >= 0) & (rows <= row1-row0)) and np.all((columns >= 0) & (columns <= col1-col0))):
        raise ValueError('Cells outside raw native grid')
    revision = sha(encode({'algorithm':ALGORITHM, 'manifest':sha(manifest_bytes),
                          'spec':sha(spec_bytes), 'cells':sha(cells_bytes)}))[:20]
    frames = []
    lat_ref = lon_ref = None
    invalid_count = 0
    for i, record in enumerate(records):
        path = (raw_root/record['file']).resolve()
        if not path.is_relative_to((raw_root/'imerg_monthly').resolve()):
            raise ValueError('Unsafe source path')
        if sha(path.read_bytes()) != record['sha256']:
            raise ValueError(f'SHA-256 mismatch: {path.name}')
        with netCDF4.Dataset(path) as nc:
            group = nc.groups['Grid']
            var = group.variables['precipitation']
            if getattr(var, 'units', None) != 'mm/hr':
                raise ValueError('Expected precipitation in mm/hr')
            lat = np.asarray(group.variables['lat'][:], dtype=float)
            lon = np.asarray(group.variables['lon'][:], dtype=float)
            time = group.variables['time']
            stamp = netCDF4.num2date(time[0], time.units, calendar=getattr(time, 'calendar', 'standard'))
            if f'{stamp.year}-{stamp.month:02d}' != months[i]:
                raise ValueError('Granule timestamp differs from manifest')
            if i == 0:
                lat_ref, lon_ref = lat, lon
                if not (np.allclose(lat, -90+(np.arange(row0,row1+1)+.5)*.1, atol=1e-5, rtol=0)
                        and np.allclose(lon, -180+(np.arange(col0,col1+1)+.5)*.1, atol=1e-5, rtol=0)):
                    raise ValueError('Native grid alignment mismatch')
                for f, r, c in zip(features, rows, columns):
                    if not np.allclose(f['properties']['center'], [lon[c],lat[r]], atol=1e-5, rtol=0):
                        raise ValueError('Geometry and data cell centers differ')
            elif not (np.array_equal(lat, lat_ref) and np.array_equal(lon, lon_ref)):
                raise ValueError('Coordinates changed between granules')
            def field(variable):
                data = np.asarray(np.ma.filled(variable[0], np.nan), dtype=float)
                dims = variable.dimensions[1:]
                if dims == ('lon','lat'):
                    return data.T
                if dims != ('lat','lon'):
                    raise ValueError(f'Unexpected dimensions: {dims}')
                return data
            rate = field(var)[rows,columns]
            quality = field(group.variables['precipitationQualityIndex'])[rows,columns]
            invalid = ~np.isfinite(rate) | (rate < 0) | ~np.isfinite(quality) | (quality < 0)
            invalid_count += int(invalid.sum())
            rate[invalid] = np.nan
            frames.append(rate * calendar.monthrange(stamp.year, stamp.month)[1] * 24)
        if (i+1) % 24 == 0:
            print(f'IMERG monthly: {i+1}/288 verified', flush=True)
    values = np.stack(frames)
    reference, counts = monthly_reference(values)
    # All chunks must exist before the public manifest is written.
    for year in range(2001,2025):
        start = (year-2001)*12
        write_checked(output/f'{year}.json', {'gridId':GRID_ID, 'revision':revision, 'year':year, 'unit':'mm',
                      'frames':[{'t':months[i], 'values':nullable(values[i])} for i in range(start,start+12)]})
    result = {'schemaVersion':1, 'gridId':GRID_ID, 'revision':revision, 'nativeRevision':definition['revision'],
              'months':months, 'unit':'mm', 'resolutionDegrees':.1,
              'grid':{'lat':[round(float(x),6) for x in lat_ref], 'lon':[round(float(x),6) for x in lon_ref], 'res':.1},
              'cells':[{'id':f['properties']['id'], 'index':int(r*len(lon_ref)+c)} for f,r,c in zip(features,rows,columns)],
              'referencePeriod':{'start':2001,'end':2024}, 'requiredReferenceYears':24,
              'climatology':{f'{m+1:02d}':nullable(reference[m]) for m in range(12)},
              'referenceCounts':{f'{m+1:02d}':counts[m].tolist() for m in range(12)},
              'metadata':{'productId':'GPM_3IMERGM_07','version':'07B','sourceDOI':'10.5067/GPM/IMERG/3B-MONTH/07',
                          'demonstrative':False, 'qualityNotes':[
                              'Taxas mensais mm/hr convertidas em acumulados mm pelas horas reais do mês, incluindo anos bissextos.',
                              'Células nativas inteiras selecionadas por interseção com PR/SC/RS; sem interpolação.',
                              'Referência por mês do calendário e célula; exige 24 anos válidos de 2001–2024.',
                              'Anomalia percentual indisponível para referência zero, ausente ou incompleta; lacunas não viram zero.',
                              'Média do mapa: média simples das células válidas selecionadas, sem ponderação pela área de interseção.',
                              'Valores históricos observados; não são previsão, probabilidade de enchente ou indicação de rota segura.']},
              'provenance':{'algorithm':ALGORITHM,'sourceManifestSHA256':sha(manifest_bytes),
                            'sourceGridSpecSHA256':sha(spec_bytes),'cellsSHA256':sha(cells_bytes),
                            'sourceGranules':288,'invalidCellMonths':invalid_count}}
    write_checked(output/'manifest.json',result)
    print(f'Published {len(features)} native cells × 288 months at {output}', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--raw-root', type=Path, default=ROOT/'data/raw')
    parser.add_argument('--grids-root', type=Path, default=ROOT/'data/derived/grids')
    parser.add_argument('--output', type=Path, default=ROOT/'data/derived/monthly-rainfall')
    args = parser.parse_args()
    prepare(args.raw_root, args.grids_root, args.output)
