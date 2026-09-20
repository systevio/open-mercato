---
title: "Validation gates must verify every command and isolate ancestry-sensitive temp fixtures"
modules: ["platform","cli"]
areas: ["testing","debugging"]
topics: ["testing","command-pattern"]
---

# Validation gates must verify every command and isolate ancestry-sensitive temp fixtures

**Context**: A multi-command validation wrapper used only `set -o pipefail`, did not stop or capture a status after each command, and printed a success marker after the final command. Separately, CLI resolver fixtures created with `mkdtemp(path.join(os.tmpdir(), ...))` inherited a Cezar temp directory inside the monorepo, so parent-directory discovery found the real checkout and produced five misleading failures.

**Rule**: Run validation sequences with `set -euo pipefail` or check every command immediately and abort on its non-zero status. When output is piped through `tee`, capture the command's `PIPESTATUS[0]`; neither the wrapper's final exit code nor a printed PASS marker proves intermediate success. If a test discovers configuration by walking parent directories, rerun it with command-scoped `TMPDIR`, `TEMP`, and `TMP` pointing to a dedicated directory outside every checkout. Compare the same targeted test on the unchanged baseline before changing product code, and document an environment-only correction when both branches behave identically.

**Applies to**: full validation gates, CI-mirroring scripts, and tests whose temporary fixtures invoke repository, workspace, or configuration discovery.
