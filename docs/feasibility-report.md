# Feasibility Report

This report records evidence gathered during the P0 feasibility spike defined in [plan.md](plan.md). Credential values, tokens, usernames, and registry namespaces are intentionally excluded.

## Environment

**Task:** T001 — Inventory the demo environment  
**Result:** Pass  
**Observed:** 2026-10-13 (Europe/Rome)

### Platform and tools

| Component | Executable or source | Observed version |
| --- | --- | --- |
| macOS | `sw_vers` | macOS 26.7.1, build 25G241 |
| Architecture | `uname -m` | arm64 |
| Darwin kernel | `uname -r` | 25.6.0 |
| Claude Code | `/Users/dmartino/.local/bin/claude` | 2.1.296 |
| `skillctl` | `/opt/homebrew/bin/skillctl` | 0.4.0 |
| Git | `/usr/bin/git` | 2.50.1 (Apple Git-155) |
| Docker CLI | resolved from `PATH` | 29.0.2, build 8108357bcb |
| Podman CLI | resolved from `PATH` | 6.0.0 |

Commands exercised:

```text
$ sw_vers
ProductName:            macOS
ProductVersion:         26.7.1
BuildVersion:           25G241

$ uname -m
arm64

$ uname -r
25.6.0

$ command -v claude
/Users/dmartino/.local/bin/claude

$ claude --version
2.1.296 (Claude Code)

$ command -v skillctl
/opt/homebrew/bin/skillctl

$ skillctl --version
skillctl version 0.4.0

$ command -v git
/usr/bin/git

$ git --version
git version 2.50.1 (Apple Git-155)
```

The requirements originally named `skillctl version`, but the installed CLI reports that as an unknown command. Its help output documents `-v, --version`, and both supported flags report version 0.4.0. Subsequent tasks must use `skillctl --version`.

### Registry configuration

Local registry configuration is available for the required Quay host:

| Credential store | Quay entry | Credential material | File mode |
| --- | --- | --- | --- |
| `~/.docker/config.json` | Present | Present | `0600` |
| `~/.config/containers/auth.json` | Present | Present | `0600` |

The verification parsed only configuration structure and boolean presence. It did not print, decode, copy, or persist credential values, usernames, registry namespaces, or tokens. No matching `QUAY`, `REGISTRY`, `OCI`, or `SKILL` environment-variable names were present.

T001 confirms that local registry configuration is available. It does not prove that a remote authentication or artifact operation succeeds; T005 owns that live verification using the supplied registry coordinates.

### T001 acceptance

- [x] macOS and executable locations are recorded.
- [x] `claude --version` and the supported `skillctl --version` output are recorded.
- [x] Supplied registry configuration is confirmed available without exposing credentials.

### Conclusion

T001 passes. The demo machine satisfies the initial macOS and tool-presence prerequisites, and protected Quay credential entries are locally available. T002 is ready to begin. No product requirement or decision change is required from this task.

