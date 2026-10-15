# OCI demo plugin

This example is a complete Claude plugin bundle. Each version contains its own `.claude-plugin/plugin.json` and `skills/demo/SKILL.md`; the OCI payload is the whole version directory, not a standalone skillctl artifact.

Invoke the installed component as `/oci-demo-plugin:demo`. Version 0.1.0 responds `OCI demo plugin version 0.1.0`; version 0.2.0 responds `OCI demo plugin version 0.2.0`.

## Validate and package

Run from the repository root:

```sh
claude plugin validate --strict ./examples/oci-demo-plugin/v1
claude plugin validate --strict ./examples/oci-demo-plugin/v2
scripts/package-oci-plugin.sh examples/oci-demo-plugin/v1 /tmp/oci-demo-plugin-v1.tar.gz
scripts/package-oci-plugin.sh examples/oci-demo-plugin/v2 /tmp/oci-demo-plugin-v2.tar.gz
```

The packaging script creates a reproducible gzip tar archive whose root contains `.claude-plugin/plugin.json`. It does not publish anything.

## Publish after the T607 registry check

Read the repository value from the locally supplied demo registry configuration. Do not add a registry host, namespace, or repository here. T607 must first confirm the artifact and layer media types against that registry. Then publish each archive to the same project-owned tag, `oci-demo-plugin-draft`, using the selected media types and these annotations:

- `org.opencontainers.image.title=oci-demo-plugin`
- `org.opencontainers.image.version=0.1.0` for v1 or `0.2.0` for v2

The v2 push intentionally moves the same tag after the v1 acceptance run. Record both resolved manifest digests in the implementation report. Do not reuse any historical skill artifact tag.
