# Fiber Locator Project Guidance

## Project Context

- This is the active Fiber Locator / OneCall dashboard project.
- The live cloud dashboard target is `http://5.78.214.184:8765/` unless Reed explicitly says otherwise.
- Preserve admin/employee boundaries: Reed is the admin control surface, and employee/mobile views should use server-backed shared state when saving or publishing filtered dashboard views.
- Keep UI controls close to the surfaces they affect and avoid bringing back removed map controls unless Reed asks.

## Verification

- Check syntax before deploy, usually with `python3 -m py_compile server.py tools/*.py`.
- For live work, verify the service with `systemctl is-active onecall-dashboard` on the host when available, plus HTTP/API smoke checks.
- Unauthenticated live checks may redirect to `/login` or return `401 Login required`; that can be normal.

## State And Handoff

- Before major changes, inspect `HANDOFF.md`, `OPERATIONS.md`, and `WORKFLOW_BREAKDOWN.md` if present.
- Do not commit secrets, cookies, downloaded auth headers, dashboard credentials, or raw private exports.
- When Reed asks to update GitHub too, deploy/live-verify first when appropriate, then commit and push only the intended project changes.


<!-- headroom:rtk-instructions -->
# RTK (Rust Token Killer) - Token-Optimized Commands

When running shell commands, **always prefix with `rtk`**. This reduces context
usage by 60-90% with zero behavior change. If rtk has no filter for a command,
it passes through unchanged — so it is always safe to use.

## Key Commands
```bash
# Git (59-80% savings)
rtk git status          rtk git diff            rtk git log

# Files & Search (60-75% savings)
rtk ls <path>           rtk read <file>         rtk grep <pattern>
rtk find <pattern>      rtk diff <file>

# Test (90-99% savings) — shows failures only
rtk pytest tests/       rtk cargo test          rtk test <cmd>

# Build & Lint (80-90% savings) — shows errors only
rtk tsc                 rtk lint                rtk cargo build
rtk prettier --check    rtk mypy                rtk ruff check

# Analysis (70-90% savings)
rtk err <cmd>           rtk log <file>          rtk json <file>
rtk summary <cmd>       rtk deps                rtk env

# GitHub (26-87% savings)
rtk gh pr view <n>      rtk gh run list         rtk gh issue list

# Infrastructure (85% savings)
rtk docker ps           rtk kubectl get         rtk docker logs <c>

# Package managers (70-90% savings)
rtk pip list            rtk pnpm install        rtk npm run <script>
```

## Rules
- In command chains, prefix each segment: `rtk git add . && rtk git commit -m "msg"`
- For debugging, use raw command without rtk prefix
- `rtk proxy <cmd>` runs command without filtering but tracks usage
<!-- /headroom:rtk-instructions -->
