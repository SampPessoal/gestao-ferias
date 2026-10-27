# Plano de aplicação — esquema obrigatório de produção

## Estado de execução

Aplicada em produção no projeto Supabase `gestaoferias`
(`awfnmplzmpzedyaslyej`) em 2026-10-27T18:45Z, com transação concluída.
A pós-checagem retornou zero divergências de colunas/tipos, e o papel
`gestaoferias_app` manteve SELECT/INSERT/UPDATE na nova coluna. Nenhum dado,
privilégio ou proprietário foi alterado.

O endurecimento de runtime foi reaplicado sobre a `main` `d7f93177` (PR #20):
a descoberta dinâmica de campos foi preservada como leitura de catálogo, enquanto
DDL, retries e normalização de dados foram removidos. Candidato local não publicado;
68 testes, typecheck e build aprovados em 2026-10-27.

## Escopo

Esta mudança separa migração e runtime. A aplicação deixa de executar `ALTER TABLE`,
`CREATE TABLE` e `CREATE INDEX` na inicialização. Em produção, ela faz apenas uma
checagem de catálogo e encerra com código diferente de zero se o esquema necessário
estiver incompleto.

Nenhum privilégio adicional deve ser concedido ao usuário de runtime.

## Preparação e autorização

1. Confirmar backup/PITR disponível no Supabase e uma janela curta de manutenção.
2. Executar `20261027_required_schema_pre_postcheck.sql` no SQL Editor com um papel
   proprietário/administrador. O arquivo é somente leitura e consulta apenas o
   catálogo PostgreSQL; não acessa dados de funcionários.
3. Revisar as divergências. A pré-checagem de produção de 2026-10-27 encontrou somente
   `public.colaboradores.cidadeInterior` ausente. Todos os demais tipos e objetos
   esperados estavam compatíveis.
4. Se uma nova execução produzir resultado diferente, parar e revisar a migração;
   este artefato não converte tipos nem corrige outros objetos automaticamente.
5. Autorizar explicitamente o DDL antes do próximo passo.

## Aplicação proposta

Executar `20261027_required_schema.sql` como uma única transação. Efeitos:

- adiciona somente `public.colaboradores.cidadeInterior varchar(100)`, se ausente;
- usa `lock_timeout=15s` e aborta toda a transação em qualquer erro;
- recusa executar se o papel não administrar `public.colaboradores`;
- recusa converter uma coluna preexistente com tipo incompatível.

Esta migração não altera valores de negócio; contém somente DDL estrutural.

Comandos equivalentes propostos (não executados), usando uma URL de conexão de
administrador fornecida fora de logs e do histórico do shell:

```sh
psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/20261027_required_schema_pre_postcheck.sql
psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/20261027_required_schema.sql
psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/20261027_required_schema_pre_postcheck.sql
```

O primeiro e o terceiro comandos são somente leitura. O segundo executa o DDL
transacional descrito acima e exige autorização específica de produção.

## Pós-checagem

1. Executar novamente `20261027_required_schema_pre_postcheck.sql`.
2. Exigir zero divergências no primeiro resultado, `owner_access=true` para o papel
   executor e todos os indicadores estruturais do terceiro resultado em `true`
   (índice, nulabilidade/defaults, chave primária e FK com cascade).
3. A consulta real confirmou que `gestaoferias_app` já possui SELECT/INSERT/UPDATE/DELETE
   em `dependentes` e USAGE na sequência. A migração não contém `GRANT`; reconfirmar
   esses indicadores após a aplicação.
4. Manter a versão atualmente publicada ativa. Publicar a versão corrigida somente
   depois que a pré-checagem real tiver sido revisada, o DDL autorizado e a
   pós-checagem estiver verde; assim o fail-fast não causa indisponibilidade.
5. Configurar `/healthz` como Healthcheck Path de forma coordenada com o deployment
   candidato, não antecipadamente sobre o SHA atual (que ainda não tem essa rota).
   O endpoint só fica disponível depois que a pré-checagem do banco passa.
6. Fazer QA autenticado sem usar dados reais nos testes automatizados: login, abertura
   da ficha, leitura/gravação de `cidadeInterior`, dependentes e exportação PDF/Excel.
7. Antes desta versão, executar também `20261027_system_user_session_version.sql` e
   confirmar `20261027_system_user_session_version_check.sql`. A coluna começa em zero,
   mantendo tokens legados das demais contas compatíveis. Revogar uma conta exige
   incrementar somente a versão daquela conta ou usar a mutation administrativa.
8. Para a revogação emergencial, resolver primeiro um único `id` pelo identificador já
   confirmado, exigir exatamente uma linha e então incrementar `sessionVersion` apenas
   desse `id`. Verificar somente contagens/versões; não consultar hashes nem credenciais.
   Nunca decrementar a versão durante rollback, pois isso reativaria tokens antigos.

## Recuperação

- Antes do `COMMIT`: qualquer erro faz rollback automático.
- Depois do `COMMIT`: as novas colunas/tabela são aditivas. Não removê-las durante uma
  recuperação, pois podem já conter dados. Reimplantar temporariamente o SHA anterior
  é compatível com os objetos adicionais.
- Se a pós-checagem falhar, não publicar; manter a versão anterior ativa e investigar
  propriedade/tipo do objeto sem ampliar privilégios do runtime.
- Reimplantar o SHA anterior continua compatível com a coluna `sessionVersion`, mas não
  reverte uma revogação já aplicada. Não remover a coluna nem reduzir seu valor.
