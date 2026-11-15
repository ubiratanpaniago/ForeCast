import type { Snapshot } from "../types/climate";
export function parseSnapshot(input: unknown): Snapshot {
  const data = input as Snapshot;
  const number = (n: unknown): n is number =>
    typeof n === "number" && Number.isFinite(n);
  const increasing = (a: unknown): a is number[] =>
    Array.isArray(a) &&
    a.length > 0 &&
    a.every((v, i) => number(v) && (i === 0 || v > a[i - 1]));
  const fail = () => {
    throw new Error(
      "Snapshot inválido ou incompleto. Confira formato, cobertura e metadados com a equipe de dados.",
    );
  };
  if (
    !data?.meta ||
    !data.grid ||
    !data.annual ||
    !data.monthly ||
    !data.landMask
  )
    return fail();
  if (
    !increasing(data.years) ||
    !data.years.every(Number.isInteger) ||
    data.years.some((y, i) => i > 0 && y !== data.years[i - 1] + 1)
  )
    return fail();
  const { grid, landMask, annual, meta } = data;
  if (
    !increasing(grid.lat) ||
    !increasing(grid.lon) ||
    !number(grid.res) ||
    grid.res <= 0 ||
    !increasing(landMask.lat) ||
    !increasing(landMask.lon) ||
    !number(landMask.res) ||
    landMask.res <= 0
  )
    return fail();
  const regular = (a: number[], step: number) =>
    a.every((v, i) => i === 0 || Math.abs(v - a[i - 1] - step) < 1e-5);
  if (
    !regular(grid.lat, grid.res) ||
    !regular(grid.lon, grid.res) ||
    !regular(landMask.lat, landMask.res) ||
    !regular(landMask.lon, landMask.res)
  )
    return fail();
  const b = meta.bbox;
  if (
    !b ||
    ![b.west, b.east, b.south, b.north].every(number) ||
    b.west >= b.east ||
    b.south >= b.north ||
    b.west < -180 ||
    b.east > 180 ||
    b.south < -90 ||
    b.north > 90
  )
    return fail();
  if (
    Math.abs(grid.lon[0] - grid.res / 2 - b.west) > 1e-5 ||
    Math.abs(grid.lat[0] - grid.res / 2 - b.south) > 1e-5 ||
    Math.abs(grid.lon.at(-1)! + grid.res / 2 - b.east) > 1e-5 ||
    Math.abs(grid.lat.at(-1)! + grid.res / 2 - b.north) > 1e-5
  )
    return fail();
  const length = grid.lat.length * grid.lon.length;
  const field = (a: unknown) =>
    Array.isArray(a) &&
    a.length === length &&
    a.every((v) => number(v) && v >= 0);
  if (
    !field(annual.climatology) ||
    annual.climatology.some((v) => v <= 0) ||
    !annual.byYear ||
    !annual.regional ||
    !number(annual.regionalClimatology) ||
    annual.regionalClimatology <= 0 ||
    data.years.some(
      (y) =>
        !field(annual.byYear[y]) ||
        !number(annual.regional[y]) ||
        annual.regional[y] < 0,
    )
  )
    return fail();
  if (
    !Array.isArray(landMask.rows) ||
    landMask.rows.length !== landMask.lat.length ||
    landMask.rows.some(
      (r) =>
        typeof r !== "string" ||
        r.length !== landMask.lon.length ||
        /[^01]/.test(r),
    )
  )
    return fail();
  for (const key of ["precipitation", "soilMoisture"] as const) {
    const points = data.monthly[key];
    if (
      !Array.isArray(points) ||
      points.some(
        (p) =>
          !p ||
          typeof p.t !== "string" ||
          !/^\d{4}-(0[1-9]|1[0-2])$/.test(p.t) ||
          !data.years.includes(Number(p.t.slice(0, 4))) ||
          !number(p.v) ||
          p.v < 0,
      ) ||
      new Set(points.map((p) => p.t)).size !== points.length
    )
      return fail();
  }
  if (
    data.years.some(
      (y) =>
        data.monthly.precipitation.filter((p) => p.t.startsWith(`${y}-`))
          .length !== 12,
    )
  )
    return fail();
  if (
    typeof meta.generated !== "string" ||
    !Number.isFinite(Date.parse(meta.generated)) ||
    !Array.isArray(meta.sources) ||
    !meta.sources.length ||
    meta.sources.some(
      (s) =>
        !s ||
        [s.key, s.product, s.variable, s.unit].some(
          (v) => typeof v !== "string" || !v,
        ),
    ) ||
    !Array.isArray(meta.notes) ||
    meta.notes.some((n) => typeof n !== "string")
  )
    return fail();
  return data;
}
