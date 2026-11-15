const MONTHS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

export const monthLabel = (t: string) => {
  const [y, m] = t.split("-");
  return `${MONTHS[Number(m) - 1]} ${y}`;
};

export const mm = (v: number) => `${Math.round(v).toLocaleString("pt-BR")} mm`;

export const pct = (v: number) =>
  `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v).toFixed(1).replace(".", ",")}%`;

export const coord = (v: number, pos: string, neg: string) =>
  `${Math.abs(v).toFixed(1).replace(".", ",")}°${v >= 0 ? pos : neg}`;
