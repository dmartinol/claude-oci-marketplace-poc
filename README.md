# Claude Marketplace Manager POC

Proof of concept for managing Claude marketplaces in stock Claude Code. The revised product specification targets complete Claude plugin bundles published as OCI artifacts with ORAS.

**Status:** Manager version 0.6.0 implements ORAS extraction into native-compatible local marketplaces, native plugin installation, and approved digest-pinned updates. Helper/CLI integration and focused tests pass; the final macOS developer rehearsal is pending. See [implementation evidence](docs/implementation-report.md) and the [plan](docs/plan.md).

## Project documentation

- [Repository instructions](AGENTS.md)
- [Product requirements](docs/requirements.md)
- [Product decisions](docs/decisions.md)
- [Ordered implementation plan and evidence status](docs/plan.md)
- [Feasibility evidence](docs/feasibility-report.md)
- [Implementation evidence](docs/implementation-report.md)
- [Project-owned v1/v2 OCI demo plugin](examples/oci-demo-plugin/README.md)

## Install the manager bootstrap

Install the manager by URL using your installed Claude CLI. No clone or commands run from this repository are required:

    claude plugin marketplace add https://github.com/dmartinol/claude-oci-marketplace-poc.git --scope user
    claude plugin install marketplace-manager@claude-oci-marketplace --scope user

The demo setup supplies registry configuration and credentials; the project supplies the complete plugin source and artifact tags. ORAS publishes the plugin directory directly, so no intermediate archive or packager script is used. Never substitute an individual skill artifact reference for a complete plugin bundle or invent registry coordinates.

## OCI plugin workflow status

The developer publishes a complete plugin with ORAS to Quay and a GitHub marketplace containing its raw tagged OCI reference in `plugins[].source`.

The intended `/marketplace-manager add <git-url>` flow pulls and extracts OCI plugins after approval, generates a Claude-compatible local marketplace with local plugin paths, and registers it. The marketplace and plugins are then visible and installable through both `/plugin` and `/marketplace-manager`. Session-start or manual metadata checks detect a changed tag and offer an approved update; restarting Claude is sufficient for activation.

The generated-marketplace flow is implemented. It uses installed Claude Code, ORAS, Git, and Python 3; no POC checkout or development scripts are required. The remaining work is the full developer rehearsal and verified final guidance.

Copyable v1/v2 plugin files and direct ORAS publishing instructions are in [examples/oci-demo-plugin](examples/oci-demo-plugin/README.md). The [demo guide](docs/demo/README.md) describes the target developer flow and its current validation status.

## Development

Read [AGENTS.md](AGENTS.md), [the requirements](docs/requirements.md), and [the decisions](docs/decisions.md) before changing implementation. Use [docs/plan.md](docs/plan.md) for task order, dependencies, status, and completion evidence.
