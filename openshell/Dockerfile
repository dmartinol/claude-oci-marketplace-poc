# POC base is retired upstream; see README.
FROM ghcr.io/nvidia/openshell-community/sandboxes/base:latest
ARG CODEX_VERSION=0.162.1
ARG CLAUDE_VERSION=2.1.299
ARG ORAS_VERSION=1.3.4
USER root
RUN npm install -g @openai/codex@${CODEX_VERSION}
# Native installer supports an exact version; copy the binary, not its root-home symlink.
RUN curl -fsSL https://claude.ai/install.sh -o /tmp/install-claude.sh \
    && bash /tmp/install-claude.sh "${CLAUDE_VERSION}" \
    && rm -f /usr/local/bin/claude \
    && cp -L /root/.local/bin/claude /usr/local/bin/claude \
    && chmod 755 /usr/local/bin/claude \
    && claude --version | grep -F "${CLAUDE_VERSION}" \
    && claude plugin test --help >/dev/null \
    && rm /tmp/install-claude.sh
# Install the pinned ORAS release for the build architecture and verify its checksum.
RUN set -eu; \
    case "$(uname -m)" in \
      x86_64) oras_arch=amd64 ;; \
      aarch64|arm64) oras_arch=arm64 ;; \
      *) echo "Unsupported ORAS architecture" >&2; exit 1 ;; \
    esac; \
    oras_archive="oras_${ORAS_VERSION}_linux_${oras_arch}.tar.gz"; \
    oras_release="https://github.com/oras-project/oras/releases/download/v${ORAS_VERSION}"; \
    mkdir /tmp/oras-install; \
    cd /tmp/oras-install; \
    curl -fsSL "$oras_release/$oras_archive" -o "$oras_archive"; \
    curl -fsSL "$oras_release/oras_${ORAS_VERSION}_checksums.txt" -o checksums.txt; \
    awk -v archive="$oras_archive" '$2 == archive { print; found=1 } END { if (!found) exit 1 }' checksums.txt > archive.sha256; \
    sha256sum -c archive.sha256; \
    tar -xzf "$oras_archive" oras; \
    install -m 755 oras /usr/local/bin/oras; \
    oras version | grep -F "${ORAS_VERSION}"; \
    cd /; \
    rm -rf /tmp/oras-install
ENV DISABLE_AUTOUPDATER=1
USER sandbox
WORKDIR /sandbox
