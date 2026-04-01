---
name: edu-session-launcher
description: Launch and manage the local dev server for teaching sessions — handles port detection, health checks, and shutdown.
user-invocable: false
allowed-tools: Read, Write, Bash
---

# Edu Session Launcher

## Purpose
Server lifecycle manager for teaching sessions. Starts the Express server, resolves port conflicts, verifies the server is healthy, optionally opens a browser, monitors the session until completion or timeout, and shuts down cleanly. Called by the `edu-teacher` agent — not invoked directly by students.

## When to Use
- `edu-teacher` agent is about to begin a lesson chapter
- A teaching session needs to be restarted after a crash
- Session cleanup is required at the end of a chapter

## Workflow

### Step 1 — Read Configuration
Read `teaching_process/settings.json`. Extract:
- `port` (default `3456` if not set)
- `auto_open_browser` (default `true`)
- `session_timeout_minutes` (default `60`)
- `current_chapter_id` (the chapter being taught)

Record `project_root` as the absolute path to the project directory.

### Step 2 — Resolve Port Conflicts
Check if the configured port is in use:
```bash
lsof -i :{port} -t
```

If the port is occupied:
- Inspect the process: `ps -p {pid} -o comm=`
  - If the process name contains `node` or `edu-server`: assume it is a stale previous session. Kill it: `kill {pid}`. Wait 1 second, then proceed with the original port.
  - If the process is something else: do not kill it. Increment port by 1 and repeat the check. Try up to 3 alternative ports (`port+1`, `port+2`, `port+3`).
  - If all 3 alternatives are occupied: abort with error — see Error Handling.

Update `teaching_process/settings.json` with the actual port that will be used.

### Step 3 — Start the Server
Run the server process in the background:
```bash
cd {project_root}/server && node index.js &
```
Capture the PID immediately from `$!`.

Write the PID to `teaching_process/.server_pid` for crash recovery.

Wait 2 seconds for the process to initialize.

### Step 4 — Verify Server Health
Send a health check request:
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:{port}/api/session/status
```

- If HTTP 200: server is healthy, continue.
- If not 200 or connection refused: wait 2 more seconds, retry once.
  - If still failing: abort startup — see Error Handling.

### Step 5 — Update Settings
Write to `teaching_process/settings.json`:
- `server_running: true`
- `server_pid: {pid}`
- `server_start_time: {ISO timestamp}`

### Step 6 — Open Browser (Conditional)
If `auto_open_browser` is `true` in settings:

Detect OS:
```bash
uname -s
```
- `Darwin` (macOS): `open http://localhost:{port}/lesson/{chapter_id}`
- `Linux`: `xdg-open http://localhost:{port}/lesson/{chapter_id}`
- Other: skip silently, print the URL instead.

Print to console:
```
Teaching session live at http://localhost:{port}/lesson/{chapter_id}
```

### Step 7 — Monitoring Loop
Enter a polling loop. Track:
- `consecutive_health_failures` (integer, starts at 0)
- `start_time` (captured before loop begins)
- `elapsed_minutes` (updated each iteration)

Every iteration:

**a. Check for completion signal.**
Check if `teaching_process/.completed` file exists:
```bash
test -f {project_root}/teaching_process/.completed
```
If found: break the loop and proceed to Step 8.

**b. Health check (every 30 seconds).**
Only run the health check if 30 seconds have elapsed since the last one:
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:{port}/api/session/status
```
- If 200: reset `consecutive_health_failures` to 0.
- If not 200: increment `consecutive_health_failures`.
  - If `consecutive_health_failures >= 3`: attempt one server restart (return to Step 3, attempt count = 1). If restart fails, abort — see Error Handling.

**c. Timeout check.**
Calculate `elapsed_minutes = (current_time - start_time) / 60`.
If `elapsed_minutes >= session_timeout_minutes`:
- POST to `/api/session/complete` with body `{ "completion_status": "timeout" }`.
- Break the loop.

**d. Sleep 5 seconds before next iteration.**
```bash
sleep 5
```

### Step 8 — Shut Down Server
Send SIGTERM to the server process:
```bash
kill {pid}
```
Wait up to 5 seconds for graceful shutdown. If still running after 5 seconds:
```bash
kill -9 {pid}
```

### Step 9 — Update State and Clean Up
Write to `teaching_process/settings.json`:
- `server_running: false`
- `server_pid: null`
- `server_stop_time: {ISO timestamp}`

Remove the PID file:
```bash
rm -f {project_root}/teaching_process/.server_pid
```

Remove the completion signal file if it exists:
```bash
rm -f {project_root}/teaching_process/.completed
```

Print to console:
```
Teaching session ended. Server stopped cleanly.
```

## Output
- Server started and confirmed healthy before returning control to `edu-teacher`
- `teaching_process/settings.json` updated with live server state throughout lifecycle
- `teaching_process/.server_pid` written on start, removed on stop
- `teaching_process/.completed` signal file removed after handling
- Browser opened to the active lesson URL (if `auto_open_browser` is enabled)

## Error Handling
- **Port conflict persists after 3 alternatives**: Abort with message — "Could not find an available port. Please free up a port in the 3456–3459 range and try again." Do not modify settings.json further.
- **Server fails health check after retry**: Kill the spawned process, remove `.server_pid`, set `server_running: false` in settings, abort with message — "Server failed to start on port {port}. Check {project_root}/server/index.js for errors."
- **Server crashes during monitoring**: Attempt one automatic restart (re-run Steps 3–4). If the restart also fails health check: POST `/api/session/complete` with `completion_status: "crash"`, run shutdown cleanup (Steps 8–9), abort with message — "Server crashed and could not be restarted. Session has been ended."
- **`settings.json` unreadable**: Use all defaults (`port=3456`, `auto_open_browser=true`, `session_timeout_minutes=60`) and proceed. Print a warning that settings could not be read.
