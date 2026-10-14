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

The registration and install commands were repeated successfully with an isolated `CLAUDE_CONFIG_DIR` ([Claude Code environment variable reference](https://code.claude.com/docs/en/env-vars)); the resulting manager plugin was enabled at user scope. Skill installs follow the active config too: they go to `$CLAUDE_CONFIG_DIR/skills` when set, or `~/.claude/skills` otherwise. In Claude Code, `/plugin` also lists the marketplace and its manager plugin. The marketplace can be added from that UI as well.

If the marketplace is already registered, refresh it after publishing marketplace changes:

```bash
claude plugin marketplace update claude-oci-marketplace
claude plugin update oci-marketplace@claude-oci-marketplace
```

The OCI catalog is `oci-catalog.json` at the marketplace root. The main marketplace sample points to `quay.io/dmartino/claude-oci-demo:0.2.0-draft`. The second, uniquely named `claude-oci-guide` sample uses the same supplied Quay repository with tags `claude-oci-guide-0.1.0-draft` and `claude-oci-guide-0.2.0-draft`; its catalog fixture is [examples/claude-oci-guide-marketplace](examples/claude-oci-guide-marketplace). The tag selects the artifact; `skillctl inspect` supplies the SkillCard version and resolved digest. The registry host (`quay.io`) is the displayed source. No second registry repository or namespace is used.

## Usage

Use the manager inside Claude Code:

| Command | Action |
| --- | --- |
| `/oci-marketplace browse` | Inspect registered OCI catalogs and choose a skill. Browsing resolves metadata only; it does not pull artifact layers. |
| `/oci-marketplace add <git-url>` | Add a marketplace at user scope through Claude's standard `claude plugin marketplace add` command. A marketplace without `oci-catalog.json` remains usable in `/plugin` and contributes no OCI skills. |
| `/oci-marketplace install <skill@marketplace>` | Install or update the named catalog entry. |
| `/oci-marketplace updates` | Review available digest changes and select skills to update. |
| `/oci-marketplace installed` | Show each installed identity, version, source registry, and digest. |

### Rehearse two updates in a clean profile

Run this on macOS with Claude Code 2.1.299, `skillctl` 0.4.0, Git, and the locally configured Quay credentials. The OCI v1 and v2 tags below have already been published to the supplied repository; this rehearsal does not publish artifacts. The manager and skills use the isolated `CLAUDE_CONFIG_DIR` throughout.

From the repository root, create the clean profile, register the Git marketplace, and install the manager:

```bash
export CLAUDE_CONFIG_DIR="$(mktemp -d "${TMPDIR:-/tmp}/claude-oci-p5-config.XXXXXX")"
export REHEARSAL_DIR="$(mktemp -d "${TMPDIR:-/tmp}/claude-oci-p5-catalogs.XXXXXX")"
printf 'CLAUDE_CONFIG_DIR=%s\nREHEARSAL_DIR=%s\n' "$CLAUDE_CONFIG_DIR" "$REHEARSAL_DIR"

claude plugin validate --strict .
claude plugin validate --strict ./plugins/oci-marketplace
claude plugin marketplace add git@github.com:dmartinol/claude-oci-marketplace-poc.git --scope user
claude plugin install oci-marketplace@claude-oci-marketplace --scope user
```

Create two temporary local catalogs that start at v1. Their marketplace names keep the two skill identities distinct:

```bash
python3 - <<'PY'
import json
import os
from pathlib import Path

root = Path(os.environ["REHEARSAL_DIR"])
catalogs = [
    (
        "claude-oci-demo-rehearsal",
        "claude-oci-demo",
        "Demonstrates OCI skill distribution and reload behavior",
        "quay.io/dmartino/claude-oci-demo:0.1.1-draft",
    ),
    (
        "claude-oci-guide-rehearsal",
        "claude-oci-guide",
        "Demonstrates a second uniquely named OCI skill",
        "quay.io/dmartino/claude-oci-demo:claude-oci-guide-0.1.0-draft",
    ),
]

for marketplace, skill, description, repository in catalogs:
    directory = root / marketplace
    (directory / ".claude-plugin").mkdir(parents=True, exist_ok=True)
    (directory / ".claude-plugin/marketplace.json").write_text(json.dumps({
        "name": marketplace,
        "description": "Temporary OCI catalog for the P5 rehearsal",
        "owner": {"name": "dmartinol"},
        "plugins": [],
    }, indent=2) + "\n")
    (directory / "oci-catalog.json").write_text(json.dumps({
        "skills": [{"name": skill, "description": description, "repository": repository}],
    }, indent=2) + "\n")
PY

claude plugin marketplace add "$REHEARSAL_DIR/claude-oci-demo-rehearsal" --scope user
claude plugin marketplace add "$REHEARSAL_DIR/claude-oci-guide-rehearsal" --scope user
claude plugin marketplace list --json
claude
```

Keep the printed `CLAUDE_CONFIG_DIR` and `REHEARSAL_DIR` values for the second terminal below. In Claude Code, confirm `/plugin` lists the manager, then run `/oci-marketplace browse` and install `claude-oci-demo@claude-oci-demo-rehearsal` and `claude-oci-guide@claude-oci-guide-rehearsal`. Approve each native confirmation and Claude's standard Bash permission prompt. `/oci-marketplace installed` should show demo v0.1.1 with digest `sha256:3e842b281cf1d3bf0e8492ca6bcbd7e13b3cfb9c72e9383c1906d58b2d1802a3` and guide v0.1.0 with digest `sha256:53def93598a4af5848dbe4169dcf4aa67269fcc166e43030336e01ea87a5b3a5`. Run `/reload-skills`, then invoke both qualified names; expect `T005 sample skill ready.` and `T501 guide skill ready.` respectively.

In a second terminal, paste the same two values printed above when prompted, then change both local catalogs to their already-published v2 tags:

```bash
read -r -p "CLAUDE_CONFIG_DIR printed above: " CLAUDE_CONFIG_DIR
read -r -p "REHEARSAL_DIR printed above: " REHEARSAL_DIR
export CLAUDE_CONFIG_DIR REHEARSAL_DIR

python3 - <<'PY'
import json
import os
from pathlib import Path

root = Path(os.environ["REHEARSAL_DIR"])
repositories = {
    "claude-oci-demo-rehearsal": "quay.io/dmartino/claude-oci-demo:0.2.0-draft",
    "claude-oci-guide-rehearsal": "quay.io/dmartino/claude-oci-demo:claude-oci-guide-0.2.0-draft",
}

for marketplace, repository in repositories.items():
    path = root / marketplace / "oci-catalog.json"
    catalog = json.loads(path.read_text())
    catalog["skills"][0]["repository"] = repository
    path.write_text(json.dumps(catalog, indent=2) + "\n")
PY
```

Back in the Claude session, run `/oci-marketplace updates`, select both skills, and approve the native confirmation and Claude permission prompt. Because these catalogs are registered from local directories, the manager reads the edited files at their Claude-reported `installLocation` on refresh. Run `/oci-marketplace installed`; both entries should report v0.2.0 from `quay.io`, with demo digest `sha256:df8e88e3f80f14d821150ce419298bb849d4b9aabddab83b954462e08dfd2e9a` and guide digest `sha256:eed775096b6b1d87e7cde5ad255803f7952c8b83635e412f07cd15a2c96c19a1`. Run `/reload-skills`, then invoke `/claude-oci-demo@claude-oci-demo-rehearsal` and `/claude-oci-guide@claude-oci-guide-rehearsal`. Expected responses are `T005 sample skill updated to v0.2.0.` and `T501 guide skill updated to v0.2.0.`

The catalog-only fixtures have no plugins, so Claude may display its expected marketplace validation warning when registering them. A marketplace without `oci-catalog.json` remains supported and contributes no OCI skills.

For an install or update, choose the skill and continue through the manager's native confirmation. Claude then shows its standard Bash permission prompt for the deterministic installer. Artifact retrieval starts only after that permission is approved. After success, run `/reload-skills`; if Claude does not discover the replacement, start a new session. Invoke the marketplace-qualified skill, for example `/claude-oci-demo@claude-oci-marketplace`.

The published demo versions are `0.1.1-draft` and `0.2.0-draft`; v2 returns `T005 sample skill updated to v0.2.0.` The guide versions are `claude-oci-guide-0.1.0-draft` and `claude-oci-guide-0.2.0-draft`; guide v2 returns `T501 guide skill updated to v0.2.0.` The [implementation report](docs/implementation-report.md#t501--end-to-end-demo-rehearsal) records observed rehearsal evidence and remaining checks.

## References

- [SkillImage](https://skillimage.dev/)
- [`skillctl` source](https://github.com/redhat-et/skillimage)
- [OCI skill distribution slides](https://skillimage.dev/slides/oci-skill-distribution-deck.html)
- [Claude skills](https://code.claude.com/docs/en/skills)
- [Claude hooks](https://code.claude.com/docs/en/hooks)
- [Claude mods](https://code.claude.com/docs/en/plugins/mods/overview)
- [Claude marketplace reference](https://code.claude.com/docs/en/plugins/marketplace-reference)
- [Official Claude marketplace example](https://github.com/anthropics/claude-plugins-official/blob/main/.claude-plugin/marketplace.json)
