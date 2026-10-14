# Claude OCI Marketplace POC

Developer proof of concept for browsing, installing, using, and updating OCI-distributed skills entirely inside stock Claude Code.

The feasibility spike is complete (T001–T008). The report recommends proceeding to G1 review; full workflow implementation remains gated by explicit approval.

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

Installation instructions for the maintained manager will be added after G1 approves the full implementation. The feasibility report records the validated marketplace and plugin packaging flow.

## Usage

Full manager usage instructions will be added after G1 approval. The feasibility report records the verified namespaced command, mod UI, permission flow, and skill reload behavior.

## References

- [SkillImage](https://skillimage.dev/)
- [`skillctl` source](https://github.com/redhat-et/skillimage)
- [OCI skill distribution slides](https://skillimage.dev/slides/oci-skill-distribution-deck.html)
- [Claude skills](https://code.claude.com/docs/en/skills)
- [Claude hooks](https://code.claude.com/docs/en/hooks)
- [Claude mods](https://code.claude.com/docs/en/plugins/mods/overview)
- [Claude marketplace reference](https://code.claude.com/docs/en/plugins/marketplace-reference)
- [Official Claude marketplace example](https://github.com/anthropics/claude-plugins-official/blob/main/.claude-plugin/marketplace.json)
