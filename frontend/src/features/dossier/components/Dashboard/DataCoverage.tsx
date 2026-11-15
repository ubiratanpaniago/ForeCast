import type { Snapshot } from "../../types/climate";
import { monthlyCoverage } from "../../lib/comparison";
export function DataCoverage({ data }: { data: Snapshot }) {
  const expected = data.years.length * 12;
  return (
    <section
      className="exhibit data-coverage"
      aria-label="Fontes e cobertura dos dados"
    >
      <div className="exhibit-head">
        <p className="exhibit-tag">Dados</p>
        <h2>O que sustenta esta leitura.</h2>
      </div>
      <div className="coverage-cards">
        {(
          [
            {
              key: "precipitation",
              source: "imerg_monthly",
              title: "Precipitação · IMERG",
              description:
                "Taxas convertidas pelo exportador para acumulados mensais. Mapa anual agregado em blocos 0,2°.",
            },
            {
              key: "soilMoisture",
              source: "gldas_monthly",
              title: "Umidade superficial · GLDAS",
              description:
                "Estado simulado de umidade a 0–10 cm. Série mensal regional; não corresponde a cada bloco IMERG.",
            },
          ] as const
        ).map((item) => {
          const coverage = monthlyCoverage(data, item.key);
          const valid = coverage.reduce((sum, y) => sum + y.valid, 0);
          const source = data.meta.sources.find((s) => s.key === item.source);
          return (
            <article key={item.key}>
              <h3>{item.title}</h3>
              <p className="coverage-total">
                {valid}
                <span> / {expected} meses</span>
              </p>
              <p>
                {valid === expected
                  ? "Cobertura mensal completa no snapshot."
                  : "Cobertura parcial; meses ausentes não são zero."}
              </p>
              <dl>
                <dt>Produto</dt>
                <dd>{source?.product ?? "Não informado"}</dd>
                <dt>Variável</dt>
                <dd>{source?.variable ?? "Não informada"}</dd>
                <dt>Unidade</dt>
                <dd>{source?.unit ?? "Não informada"}</dd>
              </dl>
              <p>{item.description}</p>
              <details>
                <summary>Conferir cobertura por ano</summary>
                <ul className="coverage-years">
                  {coverage.map((y) => (
                    <li key={y.year}>
                      <span>{y.year}</span>
                      <strong>{y.valid}/12</strong>
                    </li>
                  ))}
                </ul>
              </details>
            </article>
          );
        })}
      </div>
      <p className="coverage-disclaimer">
        Cobertura conta meses presentes no snapshot, não certifica qualidade
        espacial, completude dos arquivos de origem ou validade estatística. O
        recorte usa máscara de validade GLDAS, sem máscara estadual. Gerado em{" "}
        {new Date(data.meta.generated).toLocaleString("pt-BR")}.
      </p>
    </section>
  );
}
