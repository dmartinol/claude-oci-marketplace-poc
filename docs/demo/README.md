# Demo: publish and update a Claude plugin with OCI

This is the target POC walkthrough. Local direct-directory ORAS publication/extraction and Claude validation have passed. Remote directory retrieval and the generated marketplace's complete native install/update flow remain to be demonstrated in T607. Commands describing manager materialization below are expected behavior, not a claim that it is implemented.

Use installed Claude Code, ORAS, and Git on macOS, your existing Quay credentials, and a GitHub repository where you can publish the marketplace JSON. You do not need to clone the POC repository or run its scripts. GitHub's web editor is sufficient for publishing the marketplace configuration.

## 1. Create or copy a plugin and publish v1

Use your own complete Claude plugin, or copy the four example files into local `v1` and `v2` plugin directories from these links:

- [v1 plugin manifest](https://github.com/dmartinol/claude-oci-marketplace-poc/blob/main/examples/oci-demo-plugin/v1/.claude-plugin/plugin.json)
- [v1 skill](https://github.com/dmartinol/claude-oci-marketplace-poc/blob/main/examples/oci-demo-plugin/v1/skills/demo/SKILL.md)
- [v2 plugin manifest](https://github.com/dmartinol/claude-oci-marketplace-poc/blob/main/examples/oci-demo-plugin/v2/.claude-plugin/plugin.json)
- [v2 skill](https://github.com/dmartinol/claude-oci-marketplace-poc/blob/main/examples/oci-demo-plugin/v2/skills/demo/SKILL.md)

Preserve `.claude-plugin/plugin.json` and `skills/demo/SKILL.md` under each version's root. The [example instructions](../../examples/oci-demo-plugin/README.md) contain the short ORAS commands.

Set `OCI_REPOSITORY` to your actual Quay repository (for the project rehearsal, use only the supplied demo configuration), then run from the copied v1 plugin root:

```bash
export OCI_REPOSITORY="<your-configured-quay-repository>"
export OCI_REF="${OCI_REPOSITORY}:oci-demo-plugin-draft"
claude plugin validate --strict .
oras push "$OCI_REF" \
  --artifact-type application/vnd.dmartino.claude.plugin.v1 \
  --annotation org.opencontainers.image.title=oci-demo-plugin \
  --annotation org.opencontainers.image.version=0.1.0 .
oras manifest fetch "$OCI_REF" --format json
```

ORAS packages the directory itself; no tarball or packaging script is needed. Record the digest. For your own plugin, use its actual name and version in the annotations.

## 2. Publish the marketplace on GitHub

Create `.claude-plugin/marketplace.json` in a separate GitHub repository, using the web editor or your existing Git tools:

```json
{
  "name": "oci-demo-marketplace",
  "owner": { "name": "Your name" },
  "plugins": [
    {
      "name": "oci-demo-plugin",
      "description": "OCI plugin demo",
      "source": "<the exact value of OCI_REF>"
    }
  ]
}
```

Replace the source placeholder with the published raw tagged reference, without `oci://`. The published configuration is input for the manager. Claude validates the generated local-path marketplace after extraction.

## 3. Install the manager and add the marketplace

Install using your existing Claude CLI, from any directory:

```bash
claude plugin marketplace add https://github.com/dmartinol/claude-oci-marketplace-poc.git --scope user
claude plugin install marketplace-manager@claude-oci-marketplace --scope user
claude
```

In Claude, run:

```text
/marketplace-manager add <your-marketplace-git-url>
/marketplace-manager list
```

Approve the manager confirmation and Claude permission request. The manager retrieves the Git content, pulls and extracts the OCI bundle with ORAS, validates it, and registers a generated local marketplace named `oci-demo-marketplace`. It retains the original OCI source for update checks. You do not manually clone, extract, edit the generated files, or register a second marketplace.

Open `/plugin` and confirm the marketplace and `oci-demo-plugin` are available. Install through `/plugin`, or use:

```text
/marketplace-manager install oci-demo-plugin@oci-demo-marketplace
/marketplace-manager installed
```

Restart Claude and invoke `/oci-demo-plugin:demo`. v1 responds `OCI demo plugin version 0.1.0`. The manager must recognize installation through either interface.

## 4. Publish v2 and approve the update

From the copied v2 plugin root, in a terminal retaining the same `OCI_REF`:

```bash
claude plugin validate --strict .
oras push "$OCI_REF" \
  --artifact-type application/vnd.dmartino.claude.plugin.v1 \
  --annotation org.opencontainers.image.title=oci-demo-plugin \
  --annotation org.opencontainers.image.version=0.2.0 .
oras manifest fetch "$OCI_REF" --format json
```

The tag stays the same; its digest and version change. Start a new Claude session to receive the update notice, or review updates manually:

```text
/marketplace-manager updates
```

Approve the selected update and Claude's permission prompt. Restart Claude and invoke `/oci-demo-plugin:demo` again; expect `OCI demo plugin version 0.2.0`. Listing and update checks do not download plugin layers; adding an OCI marketplace and applying approved updates do.

## Rehearsal evidence

For project acceptance, use a fresh Claude profile, record tool versions and the two digests, verify both interfaces, and exercise one failed update that leaves the old plugin usable. Keep credentials and profile files private. Record the result in the existing reports; do not treat this target walkthrough as passing evidence.

After the demo, remove the demo marketplace with Claude's native marketplace removal command. The manager's generated-file cleanup instructions will be finalized after the supported path is verified; do not delete undocumented Claude cache/settings files.
