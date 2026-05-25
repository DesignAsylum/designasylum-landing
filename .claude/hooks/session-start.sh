#!/bin/bash
set -euo pipefail

# Only run in remote (web) sessions
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Configure git auth using GITHUB_TOKEN env var
if [ -n "${GITHUB_TOKEN:-}" ]; then
  git config --global credential.helper \
    '!f() { echo "username=x-access-token"; echo "password='"${GITHUB_TOKEN}"'"; }; f'
  git config --global user.email "accounts@designasylum.in"
  git config --global user.name "Design Asylum"
  # Update remote URL to use token directly
  git -C "${CLAUDE_PROJECT_DIR:-.}" remote set-url origin \
    "https://x-access-token:${GITHUB_TOKEN}@github.com/DesignAsylum/designasylum-landing.git" 2>/dev/null || true
  echo "✅ Git auth configured via GITHUB_TOKEN"
else
  echo "⚠️  GITHUB_TOKEN not set — git push will require manual auth"
fi
