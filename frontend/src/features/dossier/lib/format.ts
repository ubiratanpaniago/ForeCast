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

export const monthLabel = (t: string, language: "pt" | "en" = "pt") => {
  const [y, m] = t.split("-");
  if (language === "en") {
    const month = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" })
      .format(new Date(Date.UTC(Number(y), Number(m) - 1, 1)));
    return `${month} ${y}`;
  }
  return `${MONTHS[Number(m) - 1]} ${y}`;
};

export const mm = (v: number, language: "pt" | "en" = "pt") => `${Math.round(v).toLocaleString(language === "pt" ? "pt-BR" : "en-US")} mm`;

export const pct = (v: number, language: "pt" | "en" = "pt") =>
  `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v).toLocaleString(language === "pt" ? "pt-BR" : "en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

export const coord = (v: number, pos: string, neg: string, language: "pt" | "en" = "pt") =>
  `${Math.abs(v).toLocaleString(language === "pt" ? "pt-BR" : "en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}°${v >= 0 ? pos : neg}`;
