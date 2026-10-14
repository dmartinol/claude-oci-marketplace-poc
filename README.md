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

The demo was exercised on macOS with Claude Code 2.1.299, `skillctl` 0.4.0, and Git. It requires stock Claude Code, `skillctl`, Git, and access to the locally configured demo registry. Registry credentials stay in the supported local container credential store; never put credentials, auth files, or machine-local settings in this repository.

Before making implementation changes, read [AGENTS.md](AGENTS.md), [docs/requirements.md](docs/requirements.md), and [docs/decisions.md](docs/decisions.md). The feasibility evidence and approval are recorded in [docs/feasibility-report.md](docs/feasibility-report.md) and [docs/plan.md](docs/plan.md).

## Installation

Validate and register the repository, then install its manager plugin at user scope:

```bash
claude plugin validate --strict .
claude plugin validate --strict ./plugins/oci-marketplace
claude plugin marketplace add git@github.com:dmartinol/claude-oci-marketplace-poc.git --scope user
claude plugin install oci-marketplace@claude-oci-marketplace --scope user
claude plugin list
```

The registration and install commands were repeated successfully with an isolated `CLAUDE_CONFIG_DIR`; the resulting manager plugin was enabled at user scope. In Claude Code, `/plugin` also lists the marketplace and its manager plugin. The marketplace can be added from that UI as well.

If the marketplace is already registered, refresh it after publishing marketplace changes:

```bash
claude plugin marketplace update claude-oci-marketplace
claude plugin update oci-marketplace@claude-oci-marketplace
```

The OCI catalog is `oci-catalog.json` at the marketplace root. The current sample entry points to `quay.io/dmartino/claude-oci-demo:0.2.0-draft`. The tag selects the artifact; `skillctl inspect` supplies the SkillCard version and resolved digest. The registry host (`quay.io`) is the displayed source. Registry coordinates are limited to the locally supplied namespace.

## Usage

Use the manager inside Claude Code:

| Command | Action |
| --- | --- |
| `/oci-marketplace browse` | Inspect registered OCI catalogs and choose a skill. Browsing resolves metadata only; it does not pull artifact layers. |
| `/oci-marketplace add <git-url>` | Add a marketplace at user scope through Claude's standard `claude plugin marketplace add` command. A marketplace without `oci-catalog.json` remains usable in `/plugin` and contributes no OCI skills. |
| `/oci-marketplace install <skill@marketplace>` | Install or update the named catalog entry. |
| `/oci-marketplace updates` | Review available digest changes and select skills to update. |
| `/oci-marketplace installed` | Show each installed identity, version, source registry, and digest. |

For an install or update, choose the skill and continue through the manager's native confirmation. Claude then shows its standard Bash permission prompt for the deterministic installer. Artifact retrieval starts only after that permission is approved. After success, run `/reload-skills`; if Claude does not discover the replacement, start a new session. Invoke the marketplace-qualified skill, for example `/claude-oci-demo@claude-oci-marketplace`.

The published sample versions are `0.1.1-draft` (v0.1.1) and `0.2.0-draft` (v0.2.0). The latter returns `T005 sample skill updated to v0.2.0.` A repeatable v1-to-v2 update demo requires the marketplace catalog to advertise v1 for the initial install, then v2 for digest detection. The interaction tests cover multi-skill selection and dismissal. The supplied registry currently contains only this unique skill, so the live demo uses one installed update at a time and avoids loading duplicate skill names; see the [implementation report](docs/implementation-report.md#t501--end-to-end-demo-rehearsal) for the remaining acceptance limit.

## References

- [SkillImage](https://skillimage.dev/)
- [`skillctl` source](https://github.com/redhat-et/skillimage)
- [OCI skill distribution slides](https://skillimage.dev/slides/oci-skill-distribution-deck.html)
- [Claude skills](https://code.claude.com/docs/en/skills)
- [Claude hooks](https://code.claude.com/docs/en/hooks)
- [Claude mods](https://code.claude.com/docs/en/plugins/mods/overview)
- [Claude marketplace reference](https://code.claude.com/docs/en/plugins/marketplace-reference)
- [Official Claude marketplace example](https://github.com/anthropics/claude-plugins-official/blob/main/.claude-plugin/marketplace.json)
