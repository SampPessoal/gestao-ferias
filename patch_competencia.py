#!/usr/bin/env python3
with open("server/db.ts", "r", encoding="utf-8") as f:
    content = f.read()

# ─── 1. Fix getMovimentacaoPlanoSaude filter ───────────────────────────────────
content = content.replace(
    '''  if (filters.mes && filters.ano) {
    conditions.push(sql`MONTH(${movimentacaoPlanoSaude.createdAt}) = ${filters.mes}`);
    conditions.push(sql`YEAR(${movimentacaoPlanoSaude.createdAt}) = ${filters.ano}`);
  }''',
    '''  if (filters.mes && filters.ano) {
    conditions.push(eq(movimentacaoPlanoSaude.competenciaMes, filters.mes));
    conditions.push(eq(movimentacaoPlanoSaude.competenciaAno, filters.ano));
  }'''
)

# ─── 2. Fix createMovimentacaoPlanoSaude to save competencia ──────────────────
content = content.replace(
    '''export async function createMovimentacaoPlanoSaude(data: {
  colaboradorId: number; nomeColaborador?: string; empresa: string;
  tipo: "incluir" | "excluir"; tipoPlano?: string; categoria?: "titular" | "dependente";
  dataNascimento?: string; valor?: number; observacao?: string;
  createdByUserId?: number; createdByNome?: string;
})''',
    '''export async function createMovimentacaoPlanoSaude(data: {
  colaboradorId: number; nomeColaborador?: string; empresa: string;
  tipo: "incluir" | "excluir"; tipoPlano?: string; categoria?: "titular" | "dependente";
  dataNascimento?: string; valor?: number; observacao?: string;
  competenciaMes?: number; competenciaAno?: number;
  createdByUserId?: number; createdByNome?: string;
})'''
)
content = content.replace(
    '''    valor: data.valor != null ? String(data.valor) : undefined,
    observacao: data.observacao,
    createdByUserId: data.createdByUserId,
    createdByNome: data.createdByNome,
  });
}

export async function deleteMovimentacaoPlanoSaude''',
    '''    valor: data.valor != null ? String(data.valor) : undefined,
    observacao: data.observacao,
    competenciaMes: data.competenciaMes,
    competenciaAno: data.competenciaAno,
    createdByUserId: data.createdByUserId,
    createdByNome: data.createdByNome,
  });
}

export async function deleteMovimentacaoPlanoSaude'''
)

# ─── 3. Fix getMovimentacaoValeTransporte filter ───────────────────────────────
content = content.replace(
    '''  if (filters.mes && filters.ano) {
    conditions.push(sql`MONTH(${movimentacaoValeTransporte.createdAt}) = ${filters.mes}`);
    conditions.push(sql`YEAR(${movimentacaoValeTransporte.createdAt}) = ${filters.ano}`);
  }''',
    '''  if (filters.mes && filters.ano) {
    conditions.push(eq(movimentacaoValeTransporte.competenciaMes, filters.mes));
    conditions.push(eq(movimentacaoValeTransporte.competenciaAno, filters.ano));
  }'''
)

# ─── 4. Fix createMovimentacaoValeTransporte to save competencia ──────────────
content = content.replace(
    '''export async function createMovimentacaoValeTransporte(data: {
  colaboradorId: number; nomeColaborador?: string; empresa: string;
  tipo: "incluir" | "excluir"; observacao?: string;
  createdByUserId?: number; createdByNome?: string;
})''',
    '''export async function createMovimentacaoValeTransporte(data: {
  colaboradorId: number; nomeColaborador?: string; empresa: string;
  tipo: "incluir" | "excluir"; observacao?: string;
  competenciaMes?: number; competenciaAno?: number;
  createdByUserId?: number; createdByNome?: string;
})'''
)
content = content.replace(
    '''    tipo: data.tipo,
    observacao: data.observacao,
    createdByUserId: data.createdByUserId,
    createdByNome: data.createdByNome,
  });
}

export async function deleteMovimentacaoValeTransporte''',
    '''    tipo: data.tipo,
    observacao: data.observacao,
    competenciaMes: data.competenciaMes,
    competenciaAno: data.competenciaAno,
    createdByUserId: data.createdByUserId,
    createdByNome: data.createdByNome,
  });
}

export async function deleteMovimentacaoValeTransporte'''
)

# ─── 5. Fix getMovimentacaoAuxilioCreche filter ────────────────────────────────
content = content.replace(
    '''  if (filters.mes && filters.ano) {
    conditions.push(sql`MONTH(${movimentacaoAuxilioCreche.createdAt}) = ${filters.mes}`);
    conditions.push(sql`YEAR(${movimentacaoAuxilioCreche.createdAt}) = ${filters.ano}`);
  }''',
    '''  if (filters.mes && filters.ano) {
    conditions.push(eq(movimentacaoAuxilioCreche.competenciaMes, filters.mes));
    conditions.push(eq(movimentacaoAuxilioCreche.competenciaAno, filters.ano));
  }'''
)

# ─── 6. Fix createMovimentacaoAuxilioCreche to save competencia ───────────────
content = content.replace(
    '''export async function createMovimentacaoAuxilioCreche(data: {
  colaboradorId: number; nomeColaborador?: string; empresa: string;
  tipo: "incluir" | "excluir"; nomeFilho: string; dataNascimentoFilho?: string;
  valor?: number; observacao?: string;
  createdByUserId?: number; createdByNome?: string;
})''',
    '''export async function createMovimentacaoAuxilioCreche(data: {
  colaboradorId: number; nomeColaborador?: string; empresa: string;
  tipo: "incluir" | "excluir"; nomeFilho: string; dataNascimentoFilho?: string;
  valor?: number; observacao?: string;
  competenciaMes?: number; competenciaAno?: number;
  createdByUserId?: number; createdByNome?: string;
})'''
)
content = content.replace(
    '''    valor: data.valor != null ? String(data.valor) : undefined,
    observacao: data.observacao,
    createdByUserId: data.createdByUserId,
    createdByNome: data.createdByNome,
  });
}

export async function deleteMovimentacaoAuxilioCreche''',
    '''    valor: data.valor != null ? String(data.valor) : undefined,
    observacao: data.observacao,
    competenciaMes: data.competenciaMes,
    competenciaAno: data.competenciaAno,
    createdByUserId: data.createdByUserId,
    createdByNome: data.createdByNome,
  });
}

export async function deleteMovimentacaoAuxilioCreche'''
)

# ─── 7. Fix getMovimentacaoBonusIndicacao filter ───────────────────────────────
content = content.replace(
    '''  if (filters.mes && filters.ano) {
    conditions.push(sql`MONTH(${movimentacaoBonusIndicacao.createdAt}) = ${filters.mes}`);
    conditions.push(sql`YEAR(${movimentacaoBonusIndicacao.createdAt}) = ${filters.ano}`);
  }''',
    '''  if (filters.mes && filters.ano) {
    conditions.push(eq(movimentacaoBonusIndicacao.competenciaMes, filters.mes));
    conditions.push(eq(movimentacaoBonusIndicacao.competenciaAno, filters.ano));
  }'''
)

# ─── 8. Fix createMovimentacaoBonusIndicacao to save competencia ──────────────
content = content.replace(
    '''export async function createMovimentacaoBonusIndicacao(data: {
  indicadorId: number; nomeIndicador?: string; indicadoId?: number; nomeIndicado: string;
  empresa: string; dataAdmissaoIndicado: string; dataPagamentoPrevisto?: string;
  dataPagamentoEfetivo?: string; valorBonus?: number; status?: "pendente" | "pago" | "cancelado";
  observacao?: string; createdByUserId?: number; createdByNome?: string;
})''',
    '''export async function createMovimentacaoBonusIndicacao(data: {
  indicadorId: number; nomeIndicador?: string; indicadoId?: number; nomeIndicado: string;
  empresa: string; dataAdmissaoIndicado: string; dataPagamentoPrevisto?: string;
  dataPagamentoEfetivo?: string; valorBonus?: number; status?: "pendente" | "pago" | "cancelado";
  observacao?: string; competenciaMes?: number; competenciaAno?: number;
  createdByUserId?: number; createdByNome?: string;
})'''
)
content = content.replace(
    '''    status: data.status ?? "pendente",
    observacao: data.observacao,
    createdByUserId: data.createdByUserId,
    createdByNome: data.createdByNome,
  });
}

export async function updateMovimentacaoBonusIndicacao''',
    '''    status: data.status ?? "pendente",
    observacao: data.observacao,
    competenciaMes: data.competenciaMes,
    competenciaAno: data.competenciaAno,
    createdByUserId: data.createdByUserId,
    createdByNome: data.createdByNome,
  });
}

export async function updateMovimentacaoBonusIndicacao'''
)

with open("server/db.ts", "w", encoding="utf-8") as f:
    f.write(content)

print("Done - db.ts updated")
