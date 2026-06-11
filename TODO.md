# TITAN OS / UABL — TODO

## Status: em execução

### Planejamento aprovado (passo a passo)
- [x] Inspecionar implementações base de UABL: `lib/uabl_context.js`, `lib/uabl_guardrails.js`, `lib/uabl_report.js`, `routes/chat_uabl.js`
- [x] Inspecionar rotas críticas: `routes/chat.js`, `routes/terminal.js`, `routes/planner.js`, `routes/scheduler.js`, `routes/skills_runtime.js`, `routes/scheduler_skills_bridge.js`, `server.js`

### Integração (edições)
- [ ] Corrigir/normalizar `routes/chat.js` para usar o mesmo endpoint/proxy UABL com consistência (sem sobrescrever `chat_uabl`).
- [x] Atualizar `routes/terminal.js` para aplicar guardrails e anexar `uabl_report` (principalmente em delete destrutivo e writes sensíveis).
- [x] Atualizar `routes/planner.js` para aplicar guardrails e anexar `uabl_report` por step (planner_write_file e comandos destrutivos).
- [x] Atualizar `routes/skills_runtime.js` para aplicar guardrails em `autonomous-run` (skill_autonomous_run) e anexar `uabl_report`.
- [x] Atualizar `routes/scheduler_skills_bridge.js` para propagar `task.approved` quando existir (evitar executar sem aprovação).
- [ ] Atualizar `routes/scheduler.js` para padronizar `uabl_report` (já existe guardrail + makeUablReport, mas validar consistência com evidência e status).


### Testes / validação
- [ ] Smoke test manual via endpoints:
  - [ ] `POST /api/chat_uabl` (ou integração equivalente via `routes/chat.js`)
  - [ ] `POST /api/terminal/delete` com `approved:false` deve bloquear
  - [ ] `POST /api/planner/execute-step` com `write_file` em dir sensível deve bloquear
  - [ ] `POST /api/scheduler/create` + aguardar execução de `execute/skill_autonomous_run` com comandos destrutivos


