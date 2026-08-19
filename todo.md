# GestãoFérias - TODO

## Versão 1 - Entregue ✓

### Schema & Backend
- [x] Schema do banco: tabelas colaboradores, setores, planejamentos
- [x] Seed automático com dados das 35 planilhas (337 colaboradores)
- [x] API: listagem de colaboradores com filtros
- [x] API: detalhes do colaborador
- [x] API: edição de dados de férias
- [x] API: dashboard (totais, alertas, vencimentos)
- [x] API: listagem por setor
- [x] API: exportação de relatório (CSV)

### Frontend
- [x] Configurar tema elegante (cores, tipografia, CSS vars)
- [x] DashboardLayout com sidebar e navegação
- [x] Fontes Google (Inter + Playfair Display)
- [x] Dashboard: cards de resumo, alertas, gráficos
- [x] Listagem de colaboradores com filtros e busca
- [x] Detalhes do colaborador (todos os campos CLT)
- [x] Edição de dados de férias por colaborador
- [x] Conferência por setor (visão consolidada)
- [x] Relatório exportável por setor ou geral

### Segurança & Testes
- [x] Autenticação via Manus OAuth (protectedProcedure)
- [x] Controle de acesso para até 4 usuários RH
- [x] Vitest: cálculos CLT e validações
- [x] Correção de erro de duplicação de React (vite dedupe)

## Versão 2 - Entregue ✓

- [x] Schema: tabela empresas separada (Freire, Sudoeste, Joanes, Solar)
- [x] Schema: campo status (ativo/inativo) e dataDemissao na tabela colaboradores
- [x] Migrar banco com novos campos
- [x] Reimportar dados das 4 planilhas consolidadas com datas reais
- [x] Remover colaboradores duplicados
- [x] API: filtro por empresa na listagem
- [x] API: edição completa de perfil (nome, empresa, setor, datas)
- [x] API: toggle ativo/inativo por colaborador
- [x] Frontend: filtro por empresa + setor dependente na listagem
- [x] Frontend: exibir empresa e setor na tabela de colaboradores
- [x] Frontend: edição de empresa e setor no detalhe do colaborador
- [x] Frontend: botão Inativar/Reativar no detalhe do colaborador
- [x] Frontend: indicador visual de colaborador inativo
- [x] Frontend: datas exibidas corretamente (Date objects do banco)
- [x] Versão 2 salva como checkpoint

## Próximas melhorias sugeridas
- [x] Alertas automáticos por notificação (30 dias antes do vencimento, a cada 15 dias, por empresa)
- [x] Adicionar novos colaboradores pelo sistema
- [x] Filtro de inativos/ativos na listagem
- [x] Histórico de alterações por colaborador (feature futura - não solicitada pelo usuário)

## Backup completo para uso externo

- [x] Gerar backup portátil do sistema, incluindo código-fonte, estrutura do banco, dados e guia de restauração para uso por outra LLM

## Versão 7 - Relação de Férias

- [x] Schema: tabela historicoFerias (colaboradorId, dataSaida, dataRetorno, diasGozados, venda10, observacao, createdAt)
- [x] Migrar banco com nova tabela
- [x] API: listar histórico de férias com filtros por mês/ano, empresa, setor e colaborador
- [x] API: cadastrar novo registro de férias tiradas
- [x] API: editar registro de férias tiradas
- [x] API: excluir registro de férias tiradas
- [x] Frontend: nova aba "Relação de Férias" na sidebar
- [x] Frontend: página com filtro por mês/ano, empresa, setor e busca por colaborador
- [x] Frontend: tabela com colunas: Colaborador, Empresa, Setor, Saída, Retorno, Dias, Venda 10 dias, Observação
- [x] Frontend: modal para adicionar/editar registro de férias
- [x] Frontend: agrupamento visual por mês
- [x] Checkpoint Versão 7

## Relação de Atestados

- [x] Schema: tabela atestados (colaboradorId, empresaId, setorId, dataInicio, dataFim, diasAfastamento, tipo, cid, medico, observacao, createdAt)
- [x] Migrar banco com nova tabela
- [x] API: listar atestados com filtros por mês/ano, empresa, setor e colaborador
- [x] API: criar, editar e excluir atestado
- [x] Frontend: nova aba "Relação de Atestados" na sidebar
- [x] Frontend: filtros por mês/ano, empresa, setor e busca por colaborador
- [x] Frontend: tabela com colunas: Colaborador, Empresa, Setor, Início, Fim, Dias, Tipo, CID, Médico, Observação
- [x] Frontend: modal para adicionar/editar atestado com busca de colaborador por digitação
- [x] Checkpoint Relação de Atestados

## Relação Caju (sub-aba dentro de Relação de Atestados)

- [x] Frontend: sub-abas "Atestados" e "Relação Caju" dentro da página de Relação de Atestados
- [x] Frontend: aba Relação Caju mostra colaboradores com atestados do mês agrupados por colaborador
- [x] Frontend: colunas: Colaborador, Empresa, Setor, Total de Dias de Afastamento no mês
- [x] Frontend: ordenação por empresa e por total de dias
- [x] Frontend: rodapé com total geral de dias a descontar
- [x] Checkpoint Relação Caju

## Sistema de Autenticação Próprio e Auditoria

- [x] Schema: tabela systemUsers (id, nome, email, passwordHash, role: admin|usuario, ativo, createdAt)
- [x] Schema: campo createdByUserId e createdByNome em historicoFerias, abonos, atestados
- [x] Migrar banco com novas colunas
- [x] Backend: procedure login (email + senha → JWT próprio em cookie)
- [x] Backend: procedure logout (limpa cookie)
- [x] Backend: procedure me (retorna usuário logado)
- [x] Backend: procedure listar usuários (admin only)
- [x] Backend: procedure criar usuário (admin only — gera senha aleatória)
- [x] Backend: procedure editar usuário (admin only — alterar role, ativo)
- [x] Backend: procedure remover usuário (admin only)
- [x] Backend: middleware de autenticação próprio (lê cookie JWT do sistema)
- [x] Backend: passar userId e nome nas mutations de férias, abonos, atestados
- [x] Frontend: página de Login com e-mail e senha
- [x] Frontend: aba Cadastros no sidebar (admin only)
- [x] Frontend: tabela de usuários com nome, e-mail, perfil, status
- [x] Frontend: modal de novo usuário (nome, e-mail, perfil) — exibe senha gerada
- [x] Frontend: modal de editar usuário (alterar perfil, ativar/inativar)
- [x] Frontend: exibir "Registrado por: [nome]" nas tabelas de férias, abonos, atestados
- [x] Checkpoint Sistema de Autenticação

## Correção de Validação de Lançamento de Férias

- [x] Frontend RelacaoFerias.tsx: remover qualquer bloqueio por coincidência de data com vencimento
- [x] Frontend RelacaoFerias.tsx: adicionar aviso informativo (não bloqueante) quando saída está dentro de 30 dias antes da data limite sem venda de 10 dias (penalidade de 2 dias)
- [x] Frontend RelacaoFerias.tsx: exibir aviso no card informativo do colaborador quando situação de penalidade se aplica
- [x] Verificar TypeScript e testes após correção

## Adição de Data de Fim das Férias (08/07/2026)

- [x] Schema: adicionada coluna dataFim na tabela historicoFerias
- [x] Banco migrado com pnpm db:push
- [x] Backend db.ts: dataFim incluído no select de getHistoricoFerias
- [x] Backend routers.ts: dataFim aceito nos procedures create e update
- [x] Frontend RelacaoFerias.tsx: calcDataFim (saida + dias - 1) e calcRetorno (primeiro dia útil após fim) implementados
- [x] Frontend RelacaoFerias.tsx: modal exibe 3 campos: Saída (editável), Fim (auto) e Retorno (auto)
- [x] Frontend RelacaoFerias.tsx: tabela exibe coluna Fim entre Saída e Retorno
- [x] Regra de retorno: pula sábado, domingo e feriados (nacionais + Bahia + Salvador)
- [x] TypeScript sem erros, 11 testes passando

## Varredura de Bugs (08/07/2026)

- [x] Bug: filtro de status na página Férias enviava valores errados ao backend ("urgente"/"critico"/"alerta"/"atencao" em vez de "vencida"/"vence30"/"vence60"/"vence90") — corrigido em Ferias.tsx
- [x] Bug: alertasHandler.ts usava new Date() sem ajuste UTC-3, podendo retornar dia errado após 21h em GMT-3 — corrigido com IIFE UTC-3
- [x] Validação de dia da semana e feriados em RelacaoFerias.tsx confirmada ativa para todas as datas (sem exceção retroativa)
- [x] TypeScript sem erros, 11 testes passando após todas as correções

## Regra de Negócio — Penalidade por Férias Próximas ao Vencimento (CLT)

Quando o colaborador sai de férias dentro de 1 mês antes do vencimento do período aquisitivo (menos de 30 dias de antecedência), aplicam-se as seguintes regras:

| Situação | Penalidade |
|---|---|
| Tira 30 dias corridos (sem venda, sem fracionamento) | Perde 2 dias → goza apenas 28 dias |
| Fraciona as férias (ex: 15 + 15 dias) | Perde 1 dia por período fracionado dentro dos 30 dias |
| Vende 10 dias (abono pecuniário) e tira os 20 restantes (inteiros ou fracionados) | Não perde nada — sai normalmente |
| Sai de férias no mesmo dia do vencimento do período aquisitivo | Não perde nada — pode sair tranquilamente, sem nenhuma restrição |

**Resumo:** a penalidade de 2 dias só se aplica quando o colaborador tira férias dentro de 30 dias antes do vencimento SEM vender 10 dias. O sistema NUNCA deve bloquear o lançamento por causa dessa regra — apenas informar/aplicar a penalidade quando cabível.

## Valor Fixo Quinzenal VR/VT (12/07/2026)

- [x] Schema: adicionar coluna valorFixoQuinzenal (decimal) na tabela colaboradores
- [x] Banco migrado com pnpm db:push
- [x] Backend db.ts: usar valorFixoQuinzenal quando preenchido (totalQ1 = totalQ2 = valorFixoQuinzenal, sem multiplicar por dias úteis)
- [x] Backend routers.ts: aceitar valorFixoQuinzenal no create/update de colaboradores
- [x] Frontend RelacaoBeneficios.tsx: campo "Valor Fixo Quinzenal" adicionado nos modais de edição e novo benefício
- [x] Banco: preencher valorFixoQuinzenal de Wedson (632), Marcley (632) e Kayla (442)
- [x] TypeScript sem erros, 11 testes passando

## Integração automática de férias na Planilha VR/VT (13/07/2026)

- [x] Backend db.ts: criar função calcularDiasUteisFerias(dataSaida, dataFim, ano, mes, feriadosSet)
- [x] Backend db.ts: buscar férias que intersectam o mês na getPlanilhaVRVT
- [x] Backend db.ts: somar dias úteis de férias às ausências manuais do mês por colaborador
- [x] Backend db.ts: usar dataRetorno - 1 dia como fallback quando dataFim for nula
- [x] Verificar TypeScript e testes antes do checkpoint (TS: 0 erros, 11 testes passando)

## Regra de competência dos atestados na Planilha VR/VT (14/07/2026)

- [x] Backend db.ts: filtrar atestados pelo mês ANTERIOR ao mês da planilha (dataInicio no mês M-1 para planilha do mês M)
- [x] Verificar TypeScript e testes antes do checkpoint (TS: 0 erros, 11 testes passando)

## Campo diasDescontar nos atestados (14/07/2026)

- [x] Schema: adicionar coluna diasDescontar (int, nullable) na tabela atestados
- [x] Banco migrado com pnpm db:push
- [x] Backend db.ts: usar diasDescontar ?? diasAfastamento na getPlanilhaVRVT
- [x] Backend db.ts: incluir diasDescontar no select da getAtestados
- [x] Backend routers.ts: aceitar diasDescontar no create e update de atestados
- [x] Frontend: campo "Dias a Descontar" no modal de atestado (com hint explicativo)
- [x] Frontend: exibir diasDescontar na tabela quando diferente de diasAfastamento
- [x] Verificar TypeScript e testes antes do checkpoint (TS: 0 erros, 11 testes passando)

## Segurança máxima e correção de bugs (14/07/2026)

- [x] Auditar routers.ts: garantir que TODAS as rotas de dados usam protectedProcedure
- [x] Adicionar headers de segurança HTTP (helmet) no servidor Express
- [x] Implementar rate limiting nas rotas de autenticação (300 req/min geral, 10/15min no login)
- [x] Sanitizar inputs: validar e limitar tamanho de strings em todos os procedures
- [x] Remover console.log com dados sensíveis do backend
- [x] Garantir que CPF e dados sensíveis não aparecem em logs ou URLs
- [x] Auditar frontend: sem dados sensíveis em localStorage, sessionStorage ou console
- [x] Verificar que rotas de sistema (heartbeat, health) não expõem dados
- [x] Corrigir bugs encontrados durante a auditoria (storageProxy protegido com auth)
- [x] Verificar TypeScript e testes antes do checkpoint (TS: 0 erros, 11 testes passando)

## Bug: cálculo automático de dataFim e dataRetorno nas férias (14/07/2026)

- [x] Identificar o modal de lançamento de férias e onde o cálculo automático deveria ocorrer
- [x] Implementar: ao preencher dataSaida, calcular dataFim = dataSaida + diasFerias - 1 e dataRetorno = primeiro dia útil após dataFim
- [x] Garantir que o cálculo considera os dias de férias do colaborador selecionado
- [x] Verificar TypeScript e testes antes do checkpoint

## Bugs corrigidos (14/07/2026) — aguardando checkpoint

- [x] Ícone duplicado no menu lateral: "Exames Periódicos" agora usa `ClipboardList` em vez de `Stethoscope` (que é exclusivo de "Relação de Atestados")
- [x] Campo `diasGozados` não era preenchido automaticamente ao selecionar colaborador no modal de férias — agora é preenchido com o saldo do colaborador (`c.saldo ?? c.diasDireito ?? 30`), e `dataFim`/`dataRetorno` são recalculados automaticamente se `dataSaida` já estiver preenchida
- [x] TypeScript: 0 erros. Testes: 11 passando.

## Correção de textos cortados na sidebar (14/07/2026)

- [x] Diagnóstico: regra CSS global `.flex { min-width: 0; min-height: 0; }` estava comprimindo os containers flex da sidebar, cortando os textos dos itens do menu
- [x] Correção CSS: adicionada regra de restauração `min-width: unset` para `[data-slot="sidebar-wrapper"]` e seus filhos `.flex`
- [x] Correção DashboardLayout: substituído `<button>` customizado por `SidebarMenuButton` do shadcn/ui, que já trata corretamente o estado colapsado (overflow-hidden, size-8 no modo ícone, tooltip automático)
- [x] Adicionados `truncate` e `overflow-hidden` em todos os containers de texto da sidebar (header, footer, breadcrumb)
- [x] TypeScript: 0 erros. Testes: 11 passando.

## Varredura visual completa e correção de bugs (14/07/2026)

- [x] Corrigir indicador "Online" cortado na topbar do DashboardLayout
- [x] Varrer todas as telas: Dashboard, Colaboradores, Férias, Calendário, Relação de Férias, Relação de Abonos, Relação de Atestados, Seguro de Vida, Benefícios, Exames Periódicos, Planilha VR/VT, Setores, Relatórios, Feriados, Meu Perfil, Cadastros
- [x] Corrigir todos os bugs visuais encontrados (textos cortados, overflow, layout quebrado, etc.)

## Tooltip de detalhamento na Planilha VR/VT (14/07/2026)

- [x] Analisar estrutura atual de ausências na PlanilhaVRVT.tsx e backend
- [x] Ajustar o backend para retornar o detalhamento de ausências (férias, atestado, falta manual) por colaborador/mês
- [x] Implementar tooltip no frontend ao passar o mouse na coluna de ausências
- [x] Testar e verificar TypeScript

## Bug: topbar cobre controles de mês/ano na Planilha VR/VT (14/07/2026)

- [x] Analisar estrutura de layout da PlanilhaVRVT — onde ficam os controles de mês/ano
- [x] Tornar a barra de controles (mês, ano, dias úteis, botões) sticky abaixo da topbar fixa
- [x] Garantir z-index correto para não conflitar com a topbar do DashboardLayout
- [x] Testar e verificar TypeScript

## Bug: fundo cortado ao rolar a Planilha VR/VT (14/07/2026)

- [x] Diagnosticar o corte no container da planilha ao rolar para baixo
- [x] Corrigir a altura mínima do container para cobrir toda a área visível
- [x] Garantir layout harmonioso e profissional sem cortes

## Bug: cabeçalho da tabela coberto pela barra sticky na Planilha VR/VT (14/07/2026)

- [x] Tornar o cabeçalho da tabela sticky abaixo da barra de controles
- [x] Calcular o top correto do thead considerando a altura da topbar + barra de controles

## Bug: sticky nos th do thead desorganizou a tabela VR/VT (14/07/2026)

- [x] Remover sticky dos th individuais do thead (incompatível com overflow-x-auto)
- [x] Restaurar layout original limpo da tabela

## Bug: gap entre topbar e barra de controles na Planilha VR/VT (14/07/2026)

- [x] Eliminar o espaço visível entre a topbar sticky e a barra de controles ao rolar

## Bug: topbar cobre barra de controles ao rolar na Planilha VR/VT (14/07/2026)

- [x] Barra de controles deve ficar sticky abaixo da topbar (top = altura da topbar), sem gap e sem ser coberta

## Bug: gap entre topbar e barra de controles na Planilha VR/VT — correção definitiva (14/07/2026)

- [x] Identificar causa raiz: bg-background branco do SidebarInset vazando entre topbar e container bg-slate-950
- [x] Solução: main com bg-[#080d15] quando noPadding ativo, cobrindo o espaço entre topbar e barra de controles
- [x] TypeScript: 0 erros. Testes: 11 passando.

## Bug definitivo: topbar e barra de controles separadas na Planilha VR/VT (14/07/2026)

- [x] Unificar topbar e barra de controles em bloco sticky único — sem gap, sem cobrir conteúdo

## Campo "Enviado para Contabilidade" nos Exames Periódicos (14/07/2026)

- [x] Schema: adicionar colunas enviadoContabilidade (boolean) e dataEnvioContabilidade (date, nullable) na tabela examesPeriodicos
- [x] Banco migrado com pnpm db:push
- [x] Backend db.ts: incluir novos campos no select e no upsert de examesPeriodicos
- [x] Backend routers.ts: aceitar enviadoContabilidade e dataEnvioContabilidade no upsert
- [x] Frontend ExamesPeriodicos.tsx: adicionar toggle "Enviado para Contabilidade" e campo de data no Sheet lateral
- [x] Frontend ExamesPeriodicos.tsx: exibir badge/indicador "Enviado" nos cards de colaborador quando marcado
- [x] Corrigir textos em inglês no sidebar mobile (sidebar.tsx: "Sidebar" e "Displays the mobile sidebar.")
- [x] TypeScript: 0 erros. Testes: 11 passando.

## Isenção de Exames Periódicos para colaboradores específicos (14/07/2026)

- [x] Schema: adicionar coluna examePeriodicoIsento (boolean, default false) na tabela colaboradores
- [x] Banco migrado com pnpm db:push
- [x] Marcar como isentos: LÁZARO RAMON (150001), THIAGO LIMA CEDRAZ (150004), CLÁUDIO LUIZ OLIVEIRA (150003), IRAMIR FREIRE RIBEIRO (8), MARCLEY LUIS ANDRADE VIANA (150002), WEDSON ANDRADE FREIRE (150005)
- [x] Backend db.ts: filtrar colaboradores com examePeriodicoIsento = false na listagem de exames
- [x] TypeScript: 0 erros

## Aba Plano de Saúde AMIL (14/07/2026)

- [x] Extrair dados das 4 faturas AMIL (Freire, Joanes, Sudoeste, Solar) via pdfplumber
- [x] Schema: tabela planoSaude com todos os campos (empresa, beneficiário, nome, CPF, matrícula, plano, tipo, idade, dependência, mensalidade, totalFamília)
- [x] Banco migrado com pnpm db:push
- [x] 201 registros inseridos (Freire 38, Joanes 11, Sudoeste 148, Solar 4)
- [x] Backend db.ts: funções getPlanoSaude e getPlanoSaudeResumo
- [x] Backend routers.ts: rotas planoSaude.list e planoSaude.resumo
- [x] Frontend PlanoSaude.tsx: cards de resumo por empresa, tabela com titulares/dependentes expansíveis, filtros, exportação Excel
- [x] Rota /plano-saude registrada no App.tsx
- [x] Item "Plano de Saúde" adicionado ao menu lateral (DashboardLayout)
- [x] TypeScript: 0 erros

## Correção de vínculos titular-dependente no Plano de Saúde (14/07/2026)

- [x] Corrigir totalFamilia de cada titular com base na lista fornecida pelo usuário
- [x] Verificar que os dependentes aparecem expandidos corretamente abaixo do titular correto
- [x] TypeScript: 0 erros

## Correção definitiva de agrupamento titular-dependente no Plano de Saúde (14/07/2026)

- [x] Schema: adicionar coluna titularId (varchar, nullable) na tabela planoSaude
- [x] Banco: popular titularId de cada dependente com o numeroBeneficiario do titular correto
- [x] Backend db.ts: retornar dependentes agrupados por titularId
- [x] Frontend PlanoSaude.tsx: agrupar por titularId e exibir dados corretos (plano, idade, valor)
- [x] TypeScript: 0 erros

## Aba Valores - Tabela de Preços Plano de Saúde (14/07/2026)

- [x] Extrair dados das 4 tabelas DOCX (Freire, Joanes, Sudoeste, Solar)
- [x] Schema: criar tabela tabelaPrecos com empresa, codigoPlano, nomePlano, faixaInicio, faixaFim, valorTitular, valorDependente
- [x] Banco: popular com 130 registros (13 planos × 10 faixas etárias)
- [x] Backend: criar rotas tabelaPrecos.list e tabelaPrecos.valorPorIdade
- [x] Frontend: sub-aba "Valores dos Planos" dentro do Plano de Saúde com tabela por empresa/categoria/faixa
- [x] Frontend: indicador de alerta (⚠️) nos titulares que mudarão de faixa etária no próximo aniversário
- [x] TypeScript: 0 erros

## Modernização visual da aba Plano de Saúde (14/07/2026)

- [x] PlanoSaude.tsx: modernizar header, cards de resumo, tabela e sub-aba Valores no padrão do sistema (preto/cinza/branco com detalhes âmbar)
- [x] TypeScript: 0 erros

## Coparticipação mensal Plano de Saúde (15/07/2026)

- [x] Schema: tabela coparticipacaoPlanoSaude (numeroBeneficiario, empresa, nomeBeneficiario, tipoBeneficiario, mes, ano, valor, observacao, auditoria)
- [x] Banco migrado com pnpm db:push
- [x] Backend db.ts: funções getCoparticipacao, getCoparticipacaoResumo, createCoparticipacao, updateCoparticipacao, deleteCoparticipacao
- [x] Backend routers.ts: rotas coparticipacao.list, .resumo, .create, .update, .delete (protectedProcedure)
- [x] Frontend PlanoSaude.tsx: sub-aba "Coparticipação" com seletor de competência (mês/ano), cards de resumo por empresa, card total geral, tabela de lançamentos, filtros, exportação Excel
- [x] Frontend: modal de novo lançamento com busca de beneficiário inline (nome/nº), campo valor, observação
- [x] Frontend: modal de edição (valor + observação), botão de exclusão com confirmação
- [x] TypeScript: 0 erros. Testes: 11 passando.

## Folha do Mês (15/07/2026)

- [x] Schema: tabela folhaMes (colaboradorId, empresa, mes, ano, descontoVT, descontoVR, descontoPlanoSaude, totalDescontos, observacao, geradoEm)
- [x] Schema: tabela folhaMesExcecoes (colaboradorId, mes, ano, subsidio70PorcentoPlanoSuperior: bool)
- [x] Banco migrado com pnpm db:push
- [x] Backend db.ts: função calcularDescontoPlanoSaude (30% do Prata Enfermaria para titular, diferença para plano superior, 100% para dependentes, exceções)
- [x] Backend db.ts: função gerarFolhaMes (busca VT/VR do mês, plano de saúde, calcula descontos, salva na tabela)
- [x] Backend routers.ts: rotas folhaMes.gerar, .list, .resumo, .marcarExcecao
- [x] Frontend: nova aba "Folha do Mês" na sidebar
- [x] Frontend: seletor de mês/ano e filtro por empresa
- [x] Frontend: botão "Gerar Folha" (calcula automaticamente a partir dos dados do mês)
- [x] Frontend: cards de resumo por empresa (total descontos VT, VR, Plano de Saúde)
- [x] Frontend: tabela com colaborador, desconto VT, desconto VR, desconto plano de saúde, total
- [x] Frontend: botão Imprimir (layout limpo sem sidebar/topbar)
- [x] Frontend: botão Exportar Excel
- [x] TypeScript: 0 erros. Testes passando.

## Melhorias Folha do Mês (15/07/2026)

- [x] Backend: incluir desconto de Seguro de Vida na gerarFolhaMes (buscar valor por colaborador/empresa da tabela seguroVida)
- [x] Backend: adicionar campo descontoSeguroVida na tabela folhaMes e recalcular totalDescontos
- [x] Backend: gerarFolhaMes deve incluir TODOS os colaboradores ativos da empresa (não só quem tem desconto)
- [x] Backend: adicionar campo setorNome na folhaMes para agrupamento por setor
- [x] Frontend: agrupar tabela por setor dentro de cada empresa
- [x] Frontend: adicionar coluna Seguro de Vida na tabela e no modal de detalhe
- [x] Frontend: exibir todos os colaboradores (inclusive quem tem R$0 em todos os descontos)
- [x] TypeScript: 0 erros. Testes passando.

## Correção competência VR na Folha do Mês (15/07/2026)
- [x] gerarFolhaMes: buscar planilha VR do mês anterior (mes-1, ano ajustado se janeiro)
- [x] Frontend FolhaMes.tsx: exibir label indicando que o VR é do mês anterior
- [x] TypeScript: 0 erros. Testes passando.

## Movimentação do Mês (15/07/2026)

- [x] Schema: tabela movimentacaoSeguroVida (id, colaboradorId, empresa, tipo incluir/excluir, data, observacao, criadoEm)
- [x] Schema: tabela movimentacaoAuxilioNotebook (id, colaboradorId, empresa, tipo incluir/excluir, dataInicio, observacao, criadoEm)
- [x] Schema: tabela movimentacaoPlanoSaude (id, colaboradorId, empresa, tipo incluir/excluir, tipoPlano, categoria, idade, valor, observacao, criadoEm)
- [x] Schema: tabela movimentacaoValeTransporte (id, colaboradorId, empresa, tipo incluir/excluir, observacao, criadoEm)
- [x] Schema: tabela movimentacaoAuxilioCreche (id, colaboradorId, empresa, tipo incluir/excluir, nomeFilho, idadeFilho, dataNascimentoFilho, valor, criadoEm)
- [x] Schema: tabela movimentacaoBonusIndicacao (id, indicadorId, indicadoId, empresa, dataAdmissaoIndicado, dataPagamentoPrevisto, dataPagamentoEfetivo, valorBonus, status, observacao, criadoEm)
- [x] Backend: funções CRUD em db.ts para cada tabela de movimentação
- [x] Backend: routers tRPC para cada tipo de movimentação
- [x] Frontend: página MovimentacaoMes.tsx com 6 sub-abas
- [x] Frontend: sub-aba Seguro de Vida (nome, incluir/excluir, empresa, data)
- [x] Frontend: sub-aba Auxílio Notebook (nome, incluir/excluir, empresa, data, valor R$150)
- [x] Frontend: sub-aba Plano de Saúde (nome, incluir/excluir, tipo plano, categoria, idade, valor)
- [x] Frontend: sub-aba Vale Transporte (nome, incluir/excluir, observação)
- [x] Frontend: sub-aba Auxílio Creche (nome, nome do filho, incluir/excluir, idade, data nascimento, valor)
- [x] Frontend: sub-aba Bônus por Indicação (indicador, indicado, data admissão, data pagamento previsto 3 meses, status, valor R$1.000)
- [x] Rota /movimentacao-mes registrada no App.tsx
- [x] Item no sidebar com ícone Activity

## Correção: Relação de Férias não mostrava Janeiro e Fevereiro 2026 (16/07/2026)

- [x] Identificado: TiDB Cloud voltou a funcionar mas tinha apenas 100 registros (Mar-Ago 2026), sem Jan e Fev
- [x] Identificado: senha do admin `joao.cerqueira@solarinfo.com.br` estava diferente no TiDB Cloud
- [x] Corrigido: senha "Joao123" atualizada no TiDB Cloud para coincidir com o banco local
- [x] Migrado: 23 registros de Jan (16) e Fev (7) do banco local para o TiDB Cloud
- [x] TiDB Cloud agora tem 123 registros (Jan=16, Fev=7, Mar=11, Abr=16, Mai=10, Jun=29, Jul=17, Ago=17)
- [x] Corrigido: token de autenticação mudado de sessionStorage para localStorage em SystemLogin.tsx e main.tsx
- [x] Corrigido: logout agora limpa o token do localStorage em DashboardLayout.tsx
- [x] API retorna todos os 123 registros com autenticação correta

## Máscaras automáticas de formatação (16/07/2026)

- [x] Colaboradores.tsx: funções maskCPF (000.000.000-00), maskRG (00.000.000-0), maskCelular ((71) 9 8177-0000), maskTelefone ((71) 3177-0000) adicionadas
- [x] Colaboradores.tsx: máscara aplicada nos campos CPF, RG, Celular e Telefone do modal de novo colaborador
- [x] ColaboradorDetalhe.tsx: mesmas funções de máscara adicionadas
- [x] ColaboradorDetalhe.tsx: máscara aplicada nos campos CPF, RG, Telefone, Celular e Telefone de Emergência no modo de edição
- [x] TypeScript: 0 erros após as mudanças

## VR/VT no cadastro e proporcional por admissão (16/07/2026)

- [x] Campos de valor VR (R$) e VT (R$) no modal de novo colaborador (aparecem quando os checkboxes estão marcados)
- [x] Valores VR/VT salvos diretamente no banco ao cadastrar (já aparecem na Planilha VR/VT)
- [x] Função createColaborador aceita valorVR, valorVT e campos de ficha técnica
- [x] Cálculo proporcional de dias úteis para admitidos no mês corrente (conta dias úteis a partir da data de admissão)
- [x] Dias editáveis na Planilha VR/VT já implementados (clicar no número de dias abre campo de edição inline)

## Tipo de Recebimento Caju editável (16/07/2026)

- [x] Backend routers.ts: aceitar tipoRecebimentoCaju no procedure beneficios.update
- [x] Backend db.ts: incluir tipoRecebimentoCaju no updateBeneficio
- [x] Frontend RelacaoBeneficios.tsx: campo Select "Tipo Recebimento Caju" no modal de edição
- [x] Frontend RelacaoBeneficios.tsx: campo Select "Tipo Recebimento Caju" no modal de novo benefício
- [x] Frontend RelacaoBeneficios.tsx: exibir tipo atual na tabela (badge colorido)

## Correção de Layout da Ficha do Colaborador (Jul/2026)

- [x] Remover max-w-4xl que cortava a tela no meio
- [x] Reescrever layout em 3 colunas (dados pessoais | perfil+contato | naturalidade+emergência)
- [x] Hero banner escuro moderno com gradiente e avatar colorido
- [x] Botões de ação movidos para o topo (breadcrumb + ações na mesma linha)
- [x] Seções compactas com InfoRow e SectionBlock seguindo padrão do sistema
- [x] Modo de edição inline em cada seção, campos menores (h-8) e compactos

## Correção de Layout do FeriasDetalhe (Jul/2026)

- [x] Remover max-w-4xl que cortava a tela no meio
- [x] Reescrever layout em 3 colunas (Datas de Férias | Saldo e Direitos | Planejamento)
- [x] Hero banner escuro moderno com gradiente igual ao ColaboradorDetalhe
- [x] Botões de ação no topo ao lado do breadcrumb
- [x] Remover abas desnecessárias — todo conteúdo visível de uma vez
- [x] InfoRow e SectionCard compactos seguindo padrão do sistema
- [x] TypeScript: 0 erros

## Correção Relação de Férias - Nomes e Modal (Jul/2026)

- [x] Corrigir nomes cortados na tabela: aumentar maxChars e definir min-w na coluna
- [x] Redesenhar modal de edição: compacto, grid 2 colunas, inputs h-8, max-h com scroll

## Plano de Saúde - Correções (Jul/2026)

- [x] Corrigir autocomplete de colaboradores existentes no modal de novo beneficiário
- [x] Adicionar campo Titular/Dependente no schema, backend e frontend
- [x] Adicionar botão de editar nome e dados do beneficiário já cadastrado

## Correção: Duplicatas de empresa no filtro por setor (Jul/2026)

- [x] Investigar por que "Sudoeste" aparece 3x no filtro por setor da planilha VR/VT
- [x] Corrigir a query/lógica de agrupamento por setor em todas as abas afetadas

## Impressão Folha do Mês (Jul/2026)

- [x] Implementar impressão limpa: botão "Imprimir" abre nova janela com HTML puro (sem sidebar/header do sistema)
- [x] Gerar uma página por empresa com quebra de página entre elas (@media print: page-break-after: always)
- [x] Mostrar apenas os dados da folha (tabela de colaboradores por empresa, agrupados por setor)

## Varredura Visual Completa (Jul/2026)

- [x] Login: corrigir nomes cortados no rodapé/cards da tela de login
- [x] Todas as telas: filtros "Todas empresas" e "Todo setor" com texto cortado
- [x] Todas as telas: verificar padrão azul marinho/branco/cinza
- [x] Marca d'água "Gestão de RH": deixar em azul fraco visível no fundo
- [x] Dashboard: verificar layout e padrão visual
- [x] Colaboradores: verificar layout e padrão visual
- [x] Férias: verificar layout e padrão visual
- [x] Relação de Férias: verificar layout e padrão visual
- [x] Relação de Atestados: verificar layout e padrão visual
- [x] Planilha VR/VT: verificar layout e padrão visual
- [x] Plano de Saúde: verificar layout e padrão visual
- [x] Folha do Mês: verificar layout e padrão visual
- [x] Movimentação do Mês: verificar layout e padrão visual
- [x] Benefícios: verificar layout e padrão visual
- [x] Seguro de Vida: verificar layout e padrão visual
- [x] Exames Periódicos: verificar layout e padrão visual
- [x] Relatórios: verificar layout e padrão visual
- [x] Cadastros: verificar layout e padrão visual

## Correção da regra de cálculo do período aquisitivo (21/07/2026)

- [x] Corrigir cálculo automático no modal de novo colaborador: período aquisitivo = data de admissão (não admissão + 1 ano)
- [x] Vencimento = admissão + 1 ano - 1 dia (ex: 20/07/2026 → 19/07/2027)
- [x] Data limite = vencimento + 11 meses + 1 dia (ex: 19/07/2027 → 20/06/2028)
- [x] Adicionar cálculo automático no backend (fallback) ao criar colaborador sem os campos preenchidos
- [x] Adicionar recálculo automático no FeriasDetalhe ao editar a data de admissão
- [x] TypeScript: 0 erros

## Regra CLT de período aquisitivo — aplicação em todo o sistema (21/07/2026)

- [x] Criar função centralizada calcPeriodoFerias no client/src/lib/ferias.ts
- [x] Criar função centralizada calcPeriodoFeriasBackend no server/routers.ts
- [x] Refatorar Colaboradores.tsx para usar calcPeriodoFerias (modal de novo colaborador)
- [x] Refatorar FeriasDetalhe.tsx para usar calcPeriodoFerias (edição de admissão e PA)
- [x] FeriasDetalhe: ao editar PA manualmente, recalcula vencimento e data limite automaticamente
- [x] Backend recalcularSaldoColaborador: ao zerar saldo, avança PA em 1 ano e recalcula tudo automaticamente
- [x] Atualizar testes CLT para refletir nova regra (PA = admissão, não admissão + 1 ano)
- [x] 12 testes passando, TypeScript: 0 erros

## Bloqueio do botão de registro na Relação de Férias (21/07/2026)

- [x] Botão "Registrar"/"Atualizar" fica desabilitado quando a data de saída viola as regras CLT
- [x] Validação em tempo real: dia da semana (seg-qua), feriados e 48h antes de feriado
- [x] Mensagem de erro exibida no rodapé do modal junto ao botão bloqueado
- [x] Campos obrigatórios vazios também bloqueiam o botão
- [x] TypeScript: 0 erros

## Correção do bug de alteração de senha (21/07/2026)

- [x] Bug identificado: updateSystemUser() ignorava o passwordHash por proteção de segurança, fazendo a nova senha nunca ser salva
- [x] Criada função dedicada changeSystemUserPassword() no db.ts que salva o hash corretamente
- [x] changePassword no systemUsersRouter atualizado para usar changeSystemUserPassword()
- [x] Cache do usuário invalidado após troca de senha para forçar releitura do banco
- [x] 12 testes passando, TypeScript: 0 erros

## Correções na Movimentação do Mês (22/07/2026)

- [x] Bug: mês padrão incorreto — getMonth() retorna 0-11, corrigido para getMonth() + 1
- [x] Bug: datas exibidas com dia anterior por fuso UTC — fmtDate corrigido para usar getUTC*() em Date objects
- [x] Bug: filtro de mês/ano nas 6 tabelas de movimentação usando MONTH() e YEAR() do MySQL
- [x] Bug: campo "Registrado por" exibia email em vez do nome real — corrigido para usar ctx.systemUser?.nome
- [x] Botão de edição (lápis) adicionado em todas as 6 abas da Movimentação do Mês:
  - [x] Seguro de Vida: editandoId state, mutation atualizar, abrirEdicao(), botão lápis, modal dinâmico
  - [x] Auxílio Notebook: mesmo padrão
  - [x] Plano de Saúde: mesmo padrão (campos: tipo, tipoPlano, categoria, dataNascimento, valor, observacao)
  - [x] Vale Transporte: mesmo padrão (campos: tipo, observacao)
  - [x] Auxílio Creche: mesmo padrão (campos: tipo, nomeFilho, dataNascimentoFilho, valor, observacao)
  - [x] Bônus por Indicação: mesmo padrão (campos: nomeIndicado, empresa, dataAdmissaoIndicado, valorBonus, observacao)
- [x] Procedure update adicionado no router movimentacao.bonusIndicacao
- [x] TypeScript: 0 erros

## Exportação e correção de filtro na Movimentação do Mês (22/07/2026)

- [x] Verificar filtro de mês/ano em todas as 6 funções do backend (getMovimentacao*)
- [x] Garantir que cada aba mostra apenas registros lançados no mês/ano selecionado
- [x] Adicionar procedure no backend para buscar todas as 6 abas de uma vez (para exportação completa)
- [x] Implementar exportação Excel (aba atual) com cabeçalho: empresa, mês, ano, colaborador, tipo, campos específicos
- [x] Implementar exportação Excel (todas as abas) com uma planilha por aba
- [x] Implementar exportação PDF (aba atual) com layout formatado
- [x] Implementar exportação PDF (todas as abas) com seções por aba
- [x] Botão "Exportar" no header da Movimentação do Mês com dropdown: PDF (aba atual), PDF (todas), Excel (aba atual), Excel (todas)
- [x] TypeScript: 0 erros

## Correção do filtro de competência na Movimentação do Mês (22/07/2026 v2)

- [x] Adicionar colunas competenciaMes e competenciaAno nas tabelas: movimentacaoPlanoSaude, movimentacaoValeTransporte, movimentacaoAuxilioCreche, movimentacaoBonusIndicacao
- [x] Atualizar seguroVida e auxNotebook para também salvar competenciaMes/Ano (já filtram por data de negócio, mas padronizar)
- [x] Atualizar db.ts: filtrar por competenciaMes/Ano nas 4 tabelas sem data de negócio
- [x] Atualizar routers.ts: passar mes/ano no create para salvar como competência
- [x] Atualizar frontend: passar mes/ano ao criar registro em cada aba
- [x] TypeScript: 0 erros

## Excluir Planilha VR/VT (22/07/2026)

- [x] Verificar procedure delete no backend para planilhas VR/VT
- [x] Adicionar botão de excluir (ícone lixeira) em cada planilha na lista
- [x] Diálogo de confirmação: "Deseja apagar a planilha de [Mês/Ano]?"
- [x] Após confirmar, excluir a planilha e atualizar a lista
- [x] TypeScript: 0 erros

## Filtro por tipo VR/VT na aba Benefícios (22/07/2026)

- [x] Verificar campos de tipo VR/VT no schema e na query de benefícios
- [x] Adicionar filtro visual com legendas: VR Normal, VR Saldo Livre, VT Normal, VT Saldo Livre
- [x] Filtrar a lista de colaboradores conforme o tipo selecionado
- [x] TypeScript: 0 erros

## Correção do modal Gerenciar Colaboradores VR/VT (22/07/2026)

- [x] Identificar e corrigir bugs de layout no modal de Gerenciar Colaboradores
- [x] TypeScript: 0 erros

## Preenchimento automático no formulário de Seguro de Vida (22/07/2026)

- [x] Ao selecionar colaborador, preencher automaticamente o campo empresa
- [x] Ao selecionar colaborador, buscar o valor do seguro de vida da empresa e preencher o campo valor
- [x] Exibir empresa como campo somente leitura (não editável) no formulário
- [x] TypeScript: 0 erros
