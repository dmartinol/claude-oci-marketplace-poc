# Demo: publish and install a Claude plugin with OCI

This walkthrough uses stock Claude Code, ORAS, Git, and Python 3 on macOS. You do not clone the POC repository or run its scripts. Copying the example plugin files is expected. The installed manager retrieves the marketplace branch, pulls and extracts OCI plugins with ORAS, then registers a regular Claude marketplace.

The bootstrap marketplace is on `main`; the OCI demo marketplace is on the `oci-demo-marketplace` branch of the same GitHub repository. The project rehearsal uses the supplied Quay reference `quay.io/dmartino/claude-oci-demo:oci-demo-plugin-draft` and existing local Quay credentials.

## 1. Copy the plugin and publish v1

Copy the four files below into local `v1` and `v2` plugin directories, preserving the paths:

- [v1 plugin manifest](https://github.com/dmartinol/claude-oci-marketplace-poc/blob/main/examples/oci-demo-plugin/v1/.claude-plugin/plugin.json)
- [v1 skill](https://github.com/dmartinol/claude-oci-marketplace-poc/blob/main/examples/oci-demo-plugin/v1/skills/demo/SKILL.md)
- [v2 plugin manifest](https://github.com/dmartinol/claude-oci-marketplace-poc/blob/main/examples/oci-demo-plugin/v2/.claude-plugin/plugin.json)
- [v2 skill](https://github.com/dmartinol/claude-oci-marketplace-poc/blob/main/examples/oci-demo-plugin/v2/skills/demo/SKILL.md)

From the copied v1 plugin root, validate and publish directly with ORAS:

```bash
export OCI_REF="quay.io/dmartino/claude-oci-demo:oci-demo-plugin-draft"
claude plugin validate --strict .
oras push "$OCI_REF" \
  --artifact-type application/vnd.dmartino.claude.plugin.v1 \
  --annotation org.opencontainers.image.title=oci-demo-plugin \
  --annotation org.opencontainers.image.version=0.1.0 .
oras manifest fetch "$OCI_REF" --format json
```

ORAS creates the gzip directory layer; there is no archive or package script. For your own plugin, use its actual repository, name, and version. The example's short publish instructions are in [the plugin guide](../../examples/oci-demo-plugin/README.md).

## 2. Publish or use the marketplace branch

For the project rehearsal, use the already published [marketplace branch](https://github.com/dmartinol/claude-oci-marketplace-poc/tree/oci-demo-marketplace). Its manifest is named `claude-oci-demo-marketplace` and puts the raw tagged Quay reference in the normal `plugins[].source` field. The branch URL is:

```json
{
  "name": "claude-oci-demo-marketplace",
  "owner": { "name": "dmartinol" },
  "plugins": [
    {
      "name": "oci-demo-plugin",
      "description": "Demonstrates complete OCI plugin distribution and updates",
      "source": "quay.io/dmartino/claude-oci-demo:oci-demo-plugin-draft"
    }
  ]
}
```

This exact file is published in the branch. Edit it with GitHub's web editor if you are publishing a different OCI reference.

```text
https://github.com/dmartinol/claude-oci-marketplace-poc.git#oci-demo-marketplace
```

No second repository or local checkout is needed. If you publish a different OCI reference, update `.claude-plugin/marketplace.json` in a branch you can publish using GitHub's web editor or your existing Git tools. Keep the raw tagged OCI reference in `source` and use `<repository>.git#<branch>` when adding that marketplace.

## 3. Install the manager and add the marketplace

Install the manager from the repository's default branch with your existing Claude CLI:

```bash
claude plugin marketplace add https://github.com/dmartinol/claude-oci-marketplace-poc.git --scope project
claude plugin install marketplace-manager@claude-oci-marketplace --scope project
claude
```

In Claude, add and inspect the demo marketplace:

```text
/marketplace-manager add https://github.com/dmartinol/claude-oci-marketplace-poc.git#oci-demo-marketplace
/marketplace-manager list
```

Approve the manager's download confirmation and Claude permission prompt. The manager retrieves the branch, pulls and validates the OCI plugin, and registers a generated local marketplace named `claude-oci-demo-marketplace`. The published Git marketplace keeps its raw OCI source; the generated marketplace points to the extracted plugin directory.

Open `/plugin` and verify the marketplace and `oci-demo-plugin` appear. Install the plugin there, or through the manager:

```text
/marketplace-manager install oci-demo-plugin@claude-oci-demo-marketplace
/marketplace-manager installed
```

Restart Claude and invoke `/oci-demo-plugin:demo`; v1 responds `OCI demo plugin version 0.1.0`. The manager also lists standard-only marketplaces, including the bootstrap marketplace.

For a demo, open Claude's `/config` panel and set `marketplace-manager.poll_interval_minutes` to `1` before restarting. The default is `5`; interval changes apply to sessions started afterward.

## 4. Publish v2 to the same tag

From the copied v2 plugin root, set `OCI_REF` to the same value and publish:

```bash
export OCI_REF="quay.io/dmartino/claude-oci-demo:oci-demo-plugin-draft"
claude plugin validate --strict .
oras push "$OCI_REF" \
  --artifact-type application/vnd.dmartino.claude.plugin.v1 \
  --annotation org.opencontainers.image.title=oci-demo-plugin \
  --annotation org.opencontainers.image.version=0.2.0 .
oras manifest fetch "$OCI_REF" --format json
```

Keep the Claude session open while publishing v2 from the copied v2 plugin directory in another terminal. With the one-minute setting, the running session should show an update notice within about a minute; the default five-minute interval checks less often. You can also run `/marketplace-manager updates` for an immediate check. Select and approve the update, then approve Claude's permission prompt. Restart Claude and invoke `/oci-demo-plugin:demo`; v2 responds `OCI demo plugin version 0.2.0`. Periodic checks inspect metadata only; layer downloads happen when adding the marketplace or applying an approved update.

The failed-update preservation path is covered by the recorded live CLI rehearsal and focused helper checks; the previously working plugin remains usable after a failed pull or validation.

## Cleanup

Remove the demo plugin and marketplace with Claude's native commands:

```bash
claude plugin uninstall oci-demo-plugin@claude-oci-demo-marketplace --scope project
claude plugin marketplace remove claude-oci-demo-marketplace --scope project
```

If you also want to remove the extracted files, delete the manager-owned `marketplace-manager/marketplaces/claude-oci-demo-marketplace` directory under your active Claude config directory after removing the native registration.

## Rehearsal status

The same-repository Linux rehearsal passed registry publication, manager installation, branch retrieval, native marketplace validation/registration, v1 install and invocation, same-tag v2 detection and update, and failed-update preservation. The final Mac check of the manager's interactive confirmation, permission prompt, `/plugin` view, and update notice remains in the plan; see the [implementation report](../implementation-report.md#t613--same-repository-developer-flow-2026-10-15).

## Mac acceptance run (T613)

Repeat this from a Mac Terminal with the existing `claude`, `oras`, and `git` tools and Quay login. No POC checkout is needed. Keep these commands in the same terminal so Claude uses the temporary profile throughout:

```bash
sw_vers -productVersion
claude --version
oras version
git --version

export CLAUDE_CONFIG_DIR="$(mktemp -d "${TMPDIR:-/tmp}/oci-marketplace-t613.XXXXXX")"
echo "$CLAUDE_CONFIG_DIR"
```

Use the copied example files and publish v1 with step 1 above. Save the digest from `oras manifest fetch`. Then bootstrap and launch the manager in the empty profile:

```bash
claude plugin marketplace add https://github.com/dmartinol/claude-oci-marketplace-poc.git --scope project
claude plugin install marketplace-manager@claude-oci-marketplace --scope project
claude plugin list --json
claude
```

In Claude, add the demo branch and check both marketplace views:

```text
/marketplace-manager add https://github.com/dmartinol/claude-oci-marketplace-poc.git#oci-demo-marketplace
/marketplace-manager list
```

Approve the download confirmation and Claude permission prompt. Verify `claude-oci-demo-marketplace` and the standard-only bootstrap marketplace are listed. Open `/plugin`, confirm the OCI marketplace and plugin are visible, and install `oci-demo-plugin` there. In `/config`, set `marketplace-manager.poll_interval_minutes` to `1` for this demo. Restart Claude, invoke `/oci-demo-plugin:demo` and confirm it returns `OCI demo plugin version 0.1.0`; `/marketplace-manager installed` should recognize that native installation.

To exercise the manager's install command too, exit Claude and run this in the same terminal:

```bash
claude plugin uninstall oci-demo-plugin@claude-oci-demo-marketplace --scope project
claude
```

In that Claude session run `/marketplace-manager install oci-demo-plugin@claude-oci-demo-marketplace`, approve the permission prompt, restart Claude, and confirm the v1 response again.

Keep Claude running and publish v2 to the same `OCI_REF` from the copied v2 plugin directory in a second terminal, using step 4 above. Wait up to about a minute for the active session's update notice. Review and approve the v2 update and its permission prompt. Restart Claude and confirm `/oci-demo-plugin:demo` returns `OCI demo plugin version 0.2.0`; `/marketplace-manager list` should show the new digest. Failed-update preservation is already covered by the Linux T610/T613 runs, so it need not be repeated here.

Report the tool versions, v1/v2 digests, marketplace visibility, both install paths, restart responses, and whether the update notice appeared. Do not include credentials. When finished, remove the demo plugin and marketplace using the [cleanup commands](#cleanup), then delete the temporary profile with `rm -r "$CLAUDE_CONFIG_DIR"` if it is no longer needed.
