# Claude Marketplace Manager POC

Proof of concept for managing Claude marketplaces in stock Claude Code. The revised product specification targets complete Claude plugin bundles published as OCI artifacts with ORAS.

**Status:** Manager version 0.7.0 implements ORAS extraction into native-compatible local marketplaces, native plugin installation, approved digest-pinned updates, and configurable in-session update polling. Focused tests and the fresh-profile Linux and macOS rehearsals pass, including `/config`, same-session polling, pane rendering, and native `/plugin` installation. See [implementation evidence](docs/implementation-report.md) and the [plan](docs/plan.md).

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

The developer publishes a complete plugin with ORAS to Quay and a GitHub marketplace containing its raw tagged OCI reference in `plugins[].source`. For the POC, the bootstrap is on `main` and the demo marketplace is on the `oci-demo-marketplace` branch of the same repository.

`/marketplace-manager add <git-url>` pulls and extracts OCI plugins after approval, generates a Claude-compatible local marketplace with local plugin paths, and registers it. The marketplace and plugins are then visible and installable through both `/plugin` and `/marketplace-manager`. Use `/marketplace-manager list` for a compact text overview or fallback, and `/marketplace-manager browse` to select a marketplace and inspect details in a read-only pane. Browsing uses local registered data and does not refresh registry metadata. Session-start, manual, and periodic metadata checks detect a changed tag and offer an approved update; restarting Claude is sufficient for activation. The plugin's `/config` setting `marketplace-manager.poll_interval_minutes` defaults to five minutes; select one minute for a demo. The setting takes effect at the next session start.

The generated-marketplace flow and read-only browser passed the same-repository Linux and macOS rehearsals. They use installed Claude Code, ORAS, Git, and Python 3; no POC checkout or development scripts are required. The Mac run verified interactive confirmation and permission prompts, `/plugin`, `/config`, same-session update notices, and native plugin installation.

Copyable v1/v2 plugin files and direct ORAS publishing instructions are in [examples/oci-demo-plugin](examples/oci-demo-plugin/README.md). The [demo guide](docs/demo/README.md) describes the verified developer flow; its [Mac acceptance run](docs/demo/README.md#mac-acceptance-run-t613) has the exact steps for repeating the interactive rehearsal.

## Development

Read [AGENTS.md](AGENTS.md), [the requirements](docs/requirements.md), and [the decisions](docs/decisions.md) before changing implementation. Use [docs/plan.md](docs/plan.md) for task order, dependencies, status, and completion evidence.
