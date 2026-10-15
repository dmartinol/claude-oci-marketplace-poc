#!/usr/bin/env python3
"""Small no-network checks for the Vertex ADC validation helper."""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path


HELPER = Path(__file__).with_name("vertex-config.py")
PROJECT = "sandbox-project-1234"


def run_case(project: str, adc: dict) -> subprocess.CompletedProcess[str]:
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / "application_default_credentials.json"
        path.write_text(json.dumps(adc), encoding="utf-8")
        return subprocess.run(
            [sys.executable, str(HELPER), project, "global", str(path)],
            capture_output=True,
            text=True,
            check=False,
        )


def main() -> int:
    adc = {
        "type": "authorized_user",
        "client_id": "fake-client-id",
        "client_secret": "do-not-print-client-secret",
        "refresh_token": "do-not-print-refresh-token",
    }
    result = run_case(PROJECT, adc)
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout) == {"project_id": PROJECT, "region": "global"}
    assert "do-not-print" not in result.stdout

    result = run_case(PROJECT, {"type": "service_account", "private_key": "do-not-print-key"})
    assert result.returncode == 1
    assert "not copied" in result.stderr
    assert "do-not-print-key" not in result.stderr

    result = run_case("INVALID_PROJECT_ID", adc)
    assert result.returncode == 1
    assert "Invalid Google Cloud project ID" in result.stderr

    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory) / "vertex config"
        result = subprocess.run(
            [sys.executable, str(HELPER), "install", str(root)],
            input=json.dumps({"project_id": PROJECT, "region": "global"}),
            capture_output=True,
            text=True,
            check=False,
        )
        assert result.returncode == 0, result.stderr
        env = (root / "env.sh").read_text(encoding="utf-8")
        wrapper = (root / "bin" / "claude").read_text(encoding="utf-8")
        assert f"ANTHROPIC_VERTEX_PROJECT_ID={PROJECT}" in env
        assert "CLAUDE_CODE_USE_VERTEX=1" in env
        assert "GOOGLE_APPLICATION_CREDENTIALS=" in env
        assert "ANTHROPIC_API_KEY" in env and "unset" in env
        assert 'exec /usr/local/bin/claude "$@"' in wrapper
        assert "do-not-print" not in env + wrapper
        assert (root.stat().st_mode & 0o777) == 0o700
        assert (root / "env.sh").stat().st_mode & 0o777 == 0o600
        assert (root / "bin" / "claude").stat().st_mode & 0o777 == 0o700

    print("PASS: ADC validation emits no credentials; unsupported inputs fail; installed Vertex settings and wrapper are correctly quoted and permissioned.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
