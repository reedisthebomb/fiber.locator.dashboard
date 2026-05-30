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
