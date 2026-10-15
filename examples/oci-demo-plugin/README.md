# OCI demo plugin

Each version is a complete Claude plugin root with `.claude-plugin/plugin.json` and `skills/demo/SKILL.md`. Invoke it as `/oci-demo-plugin:demo`:

| Version | Response |
| --- | --- |
| v1 (`0.1.0`) | `OCI demo plugin version 0.1.0` |
| v2 (`0.2.0`) | `OCI demo plugin version 0.2.0` |

## Validate and publish

ORAS publishes the directory directly. Run the command from the version directory and pass `.` so a pull places `.claude-plugin/plugin.json` at the output root. Set `OCI_REF` to the repository from the supplied demo registry configuration and the project-owned tag `oci-demo-plugin-draft`.

```sh
claude plugin validate --strict ./examples/oci-demo-plugin/v1
claude plugin validate --strict ./examples/oci-demo-plugin/v2

export OCI_REF="${OCI_REPOSITORY}:oci-demo-plugin-draft"

(
  cd examples/oci-demo-plugin/v1
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
  cd examples/oci-demo-plugin/v2
  oras push "$OCI_REF" \
    --artifact-type application/vnd.dmartino.claude.plugin.v1 \
    --annotation org.opencontainers.image.title=oci-demo-plugin \
    --annotation org.opencontainers.image.version=0.2.0 \
    .
)
oras manifest fetch "$OCI_REF" --format json
```

ORAS creates the `application/vnd.oci.image.layer.v1.tar+gzip` layer and extracts it on pull. No intermediate tarball or package script is needed. The repository and credentials come from the demo setup; do not substitute a historical skill artifact tag. If you publish to a different repository, update the source in a demo marketplace you control to the same repository and tag.
