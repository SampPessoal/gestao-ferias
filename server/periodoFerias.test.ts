import { describe, it, expect } from "vitest";
import { periodoInicialPelaAdmissao } from "../shared/periodoFerias";

describe("Período de férias a partir da admissão (admissão preenchida depois)", () => {
  const hoje = "2026-10-30";
  it("admissão há menos de 1 ano ou no futuro: começa na admissão", () => {
    expect(periodoInicialPelaAdmissao("2026-09-10", hoje)).toBe("2026-09-10");
    expect(periodoInicialPelaAdmissao("2026-11-03", hoje)).toBe("2026-11-03");
    expect(periodoInicialPelaAdmissao("2025-11-15", hoje)).toBe("2025-11-15");
  });
  it("admissão antiga: começa no último aniversário da admissão", () => {
    expect(periodoInicialPelaAdmissao("1997-03-01", hoje)).toBe("2026-03-01");
    expect(periodoInicialPelaAdmissao("2003-09-03", hoje)).toBe("2026-09-03");
    expect(periodoInicialPelaAdmissao("1999-11-01", hoje)).toBe("2025-11-01");
    expect(periodoInicialPelaAdmissao("2002-08-14", hoje)).toBe("2026-08-14");
  });
  it("aniversário no próprio dia e 29 de fevereiro", () => {
    expect(periodoInicialPelaAdmissao("2010-10-30", hoje)).toBe("2026-10-30");
    expect(periodoInicialPelaAdmissao("2016-02-29", hoje)).toBe("2026-02-28");
  });
});
