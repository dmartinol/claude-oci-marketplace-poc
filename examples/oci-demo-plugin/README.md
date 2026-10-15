# OCI demo plugin

Copy the `v1` and `v2` example files into local directories, preserving their paths; no clone of this repository is required. Use the file links in the [demo guide](../../docs/demo/README.md#1-copy-the-plugin-and-publish-v1).

Each version is a complete Claude plugin root with `.claude-plugin/plugin.json` and `skills/demo/SKILL.md`. Invoke it as `/oci-demo-plugin:demo`:

| Version | Response |
| --- | --- |
| v1 (`0.1.0`) | `OCI demo plugin version 0.1.0` |
| v2 (`0.2.0`) | `OCI demo plugin version 0.2.0` |

## Validate and publish

ORAS publishes the directory directly. Run the command from the version directory and pass `.` so a pull places `.claude-plugin/plugin.json` at the output root. Set `OCI_REPOSITORY` to your actual Quay repository (use the supplied configuration for the project rehearsal). The demo uses the same `oci-demo-plugin-draft` tag for both versions. Run the following from the parent of your copied `v1` and `v2` directories.

```sh
claude plugin validate --strict ./v1
claude plugin validate --strict ./v2

export OCI_REF="${OCI_REPOSITORY}:oci-demo-plugin-draft"

(
  cd v1
  oras push "$OCI_REF" \
    --artifact-type application/vnd.dmartino.claude.plugin.v1 \
    --annotation org.opencontainers.image.title=oci-demo-plugin \
    --annotation org.opencontainers.image.version=0.1.0 \
    .
)
oras manifest fetch "$OCI_REF" --format json
```

After validating v1 in Claude, publish v2 to the same `OCI_REF` with version annotation `0.2.0`:

```sh
(
  cd v2
  oras push "$OCI_REF" \
    --artifact-type application/vnd.dmartino.claude.plugin.v1 \
    --annotation org.opencontainers.image.title=oci-demo-plugin \
    --annotation org.opencontainers.image.version=0.2.0 \
    .
)
oras manifest fetch "$OCI_REF" --format json
```

ORAS creates the `application/vnd.oci.image.layer.v1.tar+gzip` layer and extracts it on pull. No intermediate tarball or package script is needed. Put the exact `OCI_REF` in the GitHub marketplace plugin entry's `source` field. The project keeps its bootstrap marketplace on `main` and its OCI demo marketplace on the `oci-demo-marketplace` branch of the same repository.

## Declare the plugin in your GitHub marketplace

For the project rehearsal, use the already published `.claude-plugin/marketplace.json` on the `oci-demo-marketplace` branch. To publish a different plugin reference, edit that file on a branch you can publish using GitHub's web editor or your existing Git tools:

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

Use the raw tagged Quay reference without `oci://`. The manager retrieves the marketplace branch, extracts the OCI plugin, and registers a generated native-compatible marketplace. Follow the [developer walkthrough](../../docs/demo/README.md) to add it by its Git URL without cloning this repository.
