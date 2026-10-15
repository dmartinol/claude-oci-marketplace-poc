# OCI demo plugin

Copy the `v1` and `v2` example files into local directories, preserving their paths; no clone of this repository is required. Use the file links in the [demo guide](../../docs/demo/README.md#1-create-or-copy-a-plugin-and-publish-v1).

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

ORAS creates the `application/vnd.oci.image.layer.v1.tar+gzip` layer and extracts it on pull. No intermediate tarball or package script is needed. Put the exact `OCI_REF` in your GitHub marketplace plugin entry’s `source` field. Add that Git URL through marketplace-manager; it will extract the plugin and register a native-compatible local marketplace visible in `/plugin` and the manager. This materialization flow remains pending implementation; see the [plan](../../docs/plan.md).
