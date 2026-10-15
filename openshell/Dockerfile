# POC base is retired upstream; see README.
FROM ghcr.io/nvidia/openshell-community/sandboxes/base:latest
ARG CODEX_VERSION=0.162.1
ARG CLAUDE_VERSION=2.1.299
ARG SKILLCTL_VERSION=0.4.0
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
# Tagged upstream installer checks release-archive checksums and selects Linux architecture.
RUN curl -fsSL "https://raw.githubusercontent.com/redhat-et/skillimage/v${SKILLCTL_VERSION}/install.sh" -o /tmp/install-skillctl.sh \
    && VERSION="${SKILLCTL_VERSION}" INSTALL_DIR=/usr/local/bin sh /tmp/install-skillctl.sh \
    && skillctl --version | grep -F "${SKILLCTL_VERSION}" \
    && rm /tmp/install-skillctl.sh
ENV DISABLE_AUTOUPDATER=1
USER sandbox
WORKDIR /sandbox
