from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, FiniteFloat, model_validator

Number = Annotated[FiniteFloat, Field(strict=True)]
Nonnegative = Annotated[Number, Field(ge=0)]
Positive = Annotated[Number, Field(gt=0)]


class Model(BaseModel):
    model_config = ConfigDict(extra='forbid')


class BBox(Model):
    west: Number
    south: Number
    east: Number
    north: Number


class Source(Model):
    key: str = Field(min_length=1)
    product: str = Field(min_length=1)
    variable: str = Field(min_length=1)
    unit: str = Field(min_length=1)


class Metadata(Model):
    generated: datetime
    bbox: BBox
    sources: list[Source] = Field(min_length=1)
    notes: list[str]


class Grid(Model):
    lat: list[Number] = Field(min_length=1)
    lon: list[Number] = Field(min_length=1)
    res: Positive

    @model_validator(mode='after')
    def regular(self):
        for values in (self.lat, self.lon):
            if any(abs(b-a-self.res) > 1e-5 for a, b in zip(values, values[1:])):
                raise ValueError('Grid must be increasing and regular')
        return self


class LandMask(Grid):
    rows: list[str]


class Annual(Model):
    climatology: list[Positive]
    byYear: dict[str, list[Nonnegative]]
    regional: dict[str, Nonnegative]
    regionalClimatology: Positive


class Point(Model):
    t: str = Field(pattern=r'^\d{4}-(0[1-9]|1[0-2])$')
    v: Nonnegative


class Monthly(Model):
    precipitation: list[Point]
    soilMoisture: list[Point]


class Snapshot(Model):
    meta: Metadata
    grid: Grid
    landMask: LandMask
    years: list[Annotated[int, Field(strict=True)]] = Field(min_length=1)
    annual: Annual
    monthly: Monthly

    @model_validator(mode='after')
    def complete(self):
        years = self.years
        if years != list(range(years[0], years[-1]+1)):
            raise ValueError('Years must be unique, ordered and contiguous')
        expected = {str(y) for y in years}
        if set(self.annual.byYear) != expected or set(self.annual.regional) != expected:
            raise ValueError('Annual years do not match calendar')
        size = len(self.grid.lat)*len(self.grid.lon)
        if len(self.annual.climatology) != size or any(len(a) != size for a in self.annual.byYear.values()):
            raise ValueError('Annual field dimensions do not match grid')
        mask = self.landMask
        if len(mask.rows) != len(mask.lat) or any(len(r) != len(mask.lon) or set(r)-{'0','1'} for r in mask.rows):
            raise ValueError('Invalid land mask')
        b = self.meta.bbox
        if not (-180 <= b.west < b.east <= 180 and -90 <= b.south < b.north <= 90):
            raise ValueError('Invalid geographic extent')
        g = self.grid
        if any(abs(a-c)>1e-5 for a,c in [(g.lon[0]-g.res/2,b.west),(g.lon[-1]+g.res/2,b.east),(g.lat[0]-g.res/2,b.south),(g.lat[-1]+g.res/2,b.north)]):
            raise ValueError('Grid and extent do not match')
        calendar = {f'{y}-{m:02}' for y in years for m in range(1,13)}
        for name in ('precipitation','soilMoisture'):
            points = getattr(self.monthly,name)
            dates = [p.t for p in points]
            if len(dates) != len(set(dates)) or set(dates)-calendar:
                raise ValueError('Invalid monthly calendar')
            if name == 'precipitation' and set(dates) != calendar:
                raise ValueError('Precipitation calendar is incomplete')
        return self
