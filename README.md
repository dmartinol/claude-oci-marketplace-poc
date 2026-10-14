# Claude OCI Marketplace POC

Developer proof of concept for browsing, installing, using, and updating OCI-distributed skills entirely inside stock Claude Code.

The project is currently in the feasibility-spike phase. T001–T007 are complete; T008 remains pending. Full workflow implementation remains gated by G1.

## Project documentation

- [Repository instructions](AGENTS.md)
- [Requirements and acceptance criteria](docs/requirements.md)
- [Product decisions and open questions](docs/decisions.md)
- [Prioritized implementation plan](docs/plan.md)
- [Feasibility evidence](docs/feasibility-report.md)

## Development setup

Clone and open the repository:

```bash
git clone git@github.com:dmartinol/claude-oci-marketplace-poc.git
cd claude-oci-marketplace-poc
```

Development requires macOS for the initial demo, stock Claude Code, `skillctl`, Git, and access to the locally configured demo registry. Registry coordinates and credentials are supplied locally and must never be committed.

Before making implementation changes, read [AGENTS.md](AGENTS.md). Begin with the feasibility spike in [docs/requirements.md](docs/requirements.md), record concrete evidence, and stop for review before implementing the full workflow.

## Installation

Installation instructions will be added after the feasibility spike validates the marketplace and plugin packaging flow.

## Usage

Usage instructions will be added after the feasibility spike establishes the actual namespaced command, mod UI, permission flow, and reload behavior.

## References

- [SkillImage](https://skillimage.dev/)
- [`skillctl` source](https://github.com/redhat-et/skillimage)
- [OCI skill distribution slides](https://skillimage.dev/slides/oci-skill-distribution-deck.html)
- [Claude skills](https://code.claude.com/docs/en/skills)
- [Claude hooks](https://code.claude.com/docs/en/hooks)
- [Claude mods](https://code.claude.com/docs/en/plugins/mods/overview)
- [Claude marketplace reference](https://code.claude.com/docs/en/plugins/marketplace-reference)
- [Official Claude marketplace example](https://github.com/anthropics/claude-plugins-official/blob/main/.claude-plugin/marketplace.json)
