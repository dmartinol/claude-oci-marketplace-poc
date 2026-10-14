# Claude OCI Marketplace POC

Developer proof of concept for browsing, installing, using, and updating OCI-distributed skills entirely inside stock Claude Code.

The feasibility spike is complete (T001–T008), and full implementation was approved at G1 on 2026-10-14. The repository is being advanced through the MVP tasks in [docs/plan.md](docs/plan.md).

## Project documentation

- [Repository instructions](AGENTS.md)
- [Requirements and acceptance criteria](docs/requirements.md)
- [Product decisions and open questions](docs/decisions.md)
- [Prioritized implementation plan](docs/plan.md)
- [Feasibility evidence](docs/feasibility-report.md)
- [MVP implementation evidence](docs/implementation-report.md)

## Development setup

Clone and open the repository:

```bash
git clone git@github.com:dmartinol/claude-oci-marketplace-poc.git
cd claude-oci-marketplace-poc
```

Development requires macOS for the initial demo, stock Claude Code, `skillctl`, Git, and access to the locally configured demo registry. Registry coordinates and credentials are supplied locally and must never be committed.

Before making implementation changes, read [AGENTS.md](AGENTS.md), [docs/requirements.md](docs/requirements.md), and [docs/decisions.md](docs/decisions.md). The feasibility evidence and approval are recorded in [docs/feasibility-report.md](docs/feasibility-report.md) and [docs/plan.md](docs/plan.md).

## Installation

Verified installation instructions will be completed as part of T502. The feasibility report records the initial validated marketplace and plugin packaging flow.

## Usage

Manager usage instructions will be completed as part of T502. The feasibility report records the verified namespaced command, mod UI, permission flow, and skill reload behavior.

## References

- [SkillImage](https://skillimage.dev/)
- [`skillctl` source](https://github.com/redhat-et/skillimage)
- [OCI skill distribution slides](https://skillimage.dev/slides/oci-skill-distribution-deck.html)
- [Claude skills](https://code.claude.com/docs/en/skills)
- [Claude hooks](https://code.claude.com/docs/en/hooks)
- [Claude mods](https://code.claude.com/docs/en/plugins/mods/overview)
- [Claude marketplace reference](https://code.claude.com/docs/en/plugins/marketplace-reference)
- [Official Claude marketplace example](https://github.com/anthropics/claude-plugins-official/blob/main/.claude-plugin/marketplace.json)
