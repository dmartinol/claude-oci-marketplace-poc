# Repository Instructions

## Sources of truth

- Read `docs/requirements.md` and `docs/decisions.md` before changing the implementation.
- Treat `docs/requirements.md` as the normative product specification.
- Keep resolved product choices in `docs/decisions.md`; do not silently replace them when an API behaves differently.
- Use `docs/plan.md` for task order, dependencies, status, and completion evidence.
- Keep README links and developer guidance consistent with these documents.

## Required workflow

1. Execute the feasibility spike before implementing the full marketplace workflow.
2. Record concrete evidence: installed tool versions, commands exercised, observed APIs, output, and blockers.
3. Stop after the spike, report the evidence and blockers, and wait for explicit approval before continuing with full implementation.

Do not guess around failed feasibility checks or change the intended UX to make an implementation appear complete.

## Engineering constraints

- Run on stock Claude Code and preserve the in-Claude marketplace experience.
- Keep filesystem and registry operations in deterministic code, not model-generated shell actions.
- Never invent registry coordinates. Use only the locally supplied demo registry configuration.
- Never commit credentials, tokens, generated authentication files, or machine-local configuration.
- Validate changes in proportion to their risk and keep documentation traceable to the requirement IDs it implements.
- Keep the POC small. Do not add daemons, elaborate frameworks, or features listed as out of scope.

