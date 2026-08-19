#!/usr/bin/env python3
with open("client/src/pages/MovimentacaoMes.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# ─── AbaPlanoSaude: add competenciaMes/Ano to criar.mutate ───────────────────
content = content.replace(
    '''    criar.mutate({
      colaboradorId: form.colaborador.id, nomeColaborador: form.colaborador.nome,
      empresa: form.colaborador.empresa || empresa, tipo: form.tipo,
      tipoPlano: form.tipoPlano || undefined, categoria: form.categoria,
      dataNascimento: form.dataNascimento || undefined,
      valor: form.valor ? parseFloat(form.valor) : undefined,
      observacao: form.observacao || undefined,
    });''',
    '''    criar.mutate({
      colaboradorId: form.colaborador.id, nomeColaborador: form.colaborador.nome,
      empresa: form.colaborador.empresa || empresa, tipo: form.tipo,
      tipoPlano: form.tipoPlano || undefined, categoria: form.categoria,
      dataNascimento: form.dataNascimento || undefined,
      valor: form.valor ? parseFloat(form.valor) : undefined,
      observacao: form.observacao || undefined,
      competenciaMes: mes, competenciaAno: ano,
    });'''
)

# ─── AbaValeTransporte: find the criar.mutate call ───────────────────────────
# Need to read the file to find the exact ValeTransporte criar.mutate call
# Let's look for it by context
content = content.replace(
    '''    criar.mutate({
      colaboradorId: form.colaborador.id, nomeColaborador: form.colaborador.nome,
      empresa: form.colaborador.empresa || empresa, tipo: form.tipo,
      observacao: form.observacao || undefined,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{data?.length ?? 0} registro(s) no período</p>
        <Button size="sm" onClick={() => setModal(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Novo Registro
        </Button>
      </div>''',
    '''    criar.mutate({
      colaboradorId: form.colaborador.id, nomeColaborador: form.colaborador.nome,
      empresa: form.colaborador.empresa || empresa, tipo: form.tipo,
      observacao: form.observacao || undefined,
      competenciaMes: mes, competenciaAno: ano,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{data?.length ?? 0} registro(s) no período</p>
        <Button size="sm" onClick={() => setModal(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Novo Registro
        </Button>
      </div>'''
)

# ─── AbaAuxilioCreche: find the criar.mutate call ────────────────────────────
content = content.replace(
    '''    criar.mutate({
      colaboradorId: form.colaborador.id, nomeColaborador: form.colaborador.nome,
      empresa: form.colaborador.empresa || empresa, tipo: form.tipo,
      nomeFilho: form.nomeFilho, dataNascimentoFilho: form.dataNascimentoFilho || undefined,
      valor: form.valor ? parseFloat(form.valor) : undefined,
      observacao: form.observacao || undefined,
    });''',
    '''    criar.mutate({
      colaboradorId: form.colaborador.id, nomeColaborador: form.colaborador.nome,
      empresa: form.colaborador.empresa || empresa, tipo: form.tipo,
      nomeFilho: form.nomeFilho, dataNascimentoFilho: form.dataNascimentoFilho || undefined,
      valor: form.valor ? parseFloat(form.valor) : undefined,
      observacao: form.observacao || undefined,
      competenciaMes: mes, competenciaAno: ano,
    });'''
)

# ─── AbaBonusIndicacao: find the criar.mutate call ───────────────────────────
content = content.replace(
    '''    criar.mutate({
      indicadorId: form.indicador!.id, nomeIndicador: form.indicador!.nome,
      indicadoId: form.indicado?.id, nomeIndicado: form.indicado?.nome ?? form.nomeIndicado,
      empresa: form.indicador!.empresa || empresa,
      dataAdmissaoIndicado: form.dataAdmissaoIndicado,
      dataPagamentoPrevisto: form.dataPagamentoPrevisto || undefined,
      valorBonus: form.valorBonus ? parseFloat(form.valorBonus) : undefined,
      observacao: form.observacao || undefined,
    });''',
    '''    criar.mutate({
      indicadorId: form.indicador!.id, nomeIndicador: form.indicador!.nome,
      indicadoId: form.indicado?.id, nomeIndicado: form.indicado?.nome ?? form.nomeIndicado,
      empresa: form.indicador!.empresa || empresa,
      dataAdmissaoIndicado: form.dataAdmissaoIndicado,
      dataPagamentoPrevisto: form.dataPagamentoPrevisto || undefined,
      valorBonus: form.valorBonus ? parseFloat(form.valorBonus) : undefined,
      observacao: form.observacao || undefined,
      competenciaMes: mes, competenciaAno: ano,
    });'''
)

with open("client/src/pages/MovimentacaoMes.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Done - frontend updated")
