# fixtures_req — descrições de REQUISITOS (não de demandas)

Usadas pelos testes que simulam gravação (`test_v35_13_7_changelog_h2.js` e `e2e_212039.js`).
O `run_tests.js` NÃO lê esta pasta (ele trata `fixtures/` como descrições de demanda).

| Arquivo | Origem | Observação |
|---|---|---|
| 60592.txt | Redmine real (12/11/2026) | `h2. CHANGELOG` (caso da v35.13.7) |
| 31468.txt | Redmine real (12/11/2026) | tem `h3. RN94774-1/-2` (sub-numeração) + changelog #212039 já registrado |
| 31059.txt | Redmine real (12/11/2026) | `h1. CHANGELOG`, changelog #212039 já registrado |
| 79.txt    | Redmine real (12/11/2026) | RN96 (#212039) e changelog já registrados |
| 32745.txt | RÉPLICA ESTRUTURAL do real | mesmos cabeçalhos RN1–RN84 (inclui RN81 duplicada), `{{collapse}}`, `---`, `h1. INTEGRAÇÃO`, `h1. CHANGELOG` dentro do collapse; corpo das regras resumido |
