# Claude Marketplace Manager POC

Proof of concept for managing Claude marketplaces in stock Claude Code. The revised product specification targets complete Claude plugin bundles published as OCI artifacts with ORAS.

**Status:** The current manager implementation still uses skillctl for individual skill artifacts and does not satisfy the revised full-plugin contract. Local complete-plugin validation and persistent CLI installation have passed; registry-backed ORAS behavior remains unverified because this Linux sandbox cannot install ORAS or reach the registry. Full implementation remains gated by T607 and Gate G3 in the [plan](docs/plan.md).

## Project documentation

- [Repository instructions](AGENTS.md)
- [Product requirements](docs/requirements.md)
- [Product decisions](docs/decisions.md)
- [Ordered implementation plan and evidence status](docs/plan.md)
- [Feasibility evidence](docs/feasibility-report.md)
- [Implementation evidence](docs/implementation-report.md)
- [Project-owned v1/v2 OCI demo plugin](examples/oci-demo-plugin/README.md)

## Install the manager bootstrap

The repository root is the bootstrap marketplace. Its manager plugin can be validated and installed independently of the pending ORAS plugin-bundle workflow:

    claude plugin validate --strict .
    claude plugin validate --strict ./plugins/oci-marketplace
    claude plugin marketplace add https://github.com/dmartinol/claude-oci-marketplace-poc.git --scope user
    claude plugin install marketplace-manager@claude-oci-marketplace --scope user

The demo setup supplies registry configuration and credentials; the project supplies the complete plugin source, packaging instructions, and artifact tags. Never substitute an individual skill artifact reference for a complete plugin bundle or invent registry coordinates.

## OCI plugin workflow status

The product contract uses raw tagged OCI references in marketplace plugin source fields. The manager will own parsing and ORAS operations; Claude's built-in strict validator is not expected to accept that source value. The manager must retrieve and activate a complete validated plugin bundle through a supported Claude path.

The current manager install path is still skill-specific. Do not use it as proof of full-plugin installation. The ORAS feasibility spike must establish artifact metadata, authenticated retrieval, validation, and persistent Claude activation before implementation resumes.

The complete v1/v2 demo plugin source and reproducible archive script are in [examples/oci-demo-plugin](examples/oci-demo-plugin/README.md). Registry publishing remains pending the T607 ORAS and registry checks.

## Development

Read [AGENTS.md](AGENTS.md), [the requirements](docs/requirements.md), and [the decisions](docs/decisions.md) before changing implementation. Use [docs/plan.md](docs/plan.md) for task order, dependencies, status, and completion evidence.
