# mcp-explorer: Goals, Threat Model, and a Practical Way to Hide Vendor API Keys on a Shared Linux Host (with Docker option)

## Summary of goals

- **Let learners run `mcp-explorer` locally** (on the same Linux box) to do MCP-based validations (e.g., “create a file with contents X, then verify”).
- **Keep your long-lived LLM vendor API key secret** from those learners.
- **Avoid root requirements.** Everything should work as your normal Unix user.
- **Optionally package the daemon in Docker** for easier deployment—_without_ giving learners Docker control.

---

## Threat model & constraints

- Learners have shell accounts on the same host but **not** your Unix account.
- You can run a background process under **your** account (or a container you control).
- If someone is **root** or has **Docker daemon access**, they can read your key. (Treat Docker daemon access ≈ root.)
- The LLM must validate tasks via **local MCP servers** (filesystem checks, commands, etc.)—so we keep the validation on the learner’s machine while the key stays protected.

---

## Core design (host or Docker)

Run two **local processes**:

- **Daemon (your user or your container):** holds the vendor API key _in memory_, talks to the LLM API, emits **tool calls** when the model wants to validate something, and never reveals the key. It communicates over a **Unix domain socket**.
- **Learner’s CLI (`mcp-explorer`):** connects to the Unix socket, executes **local MCP** actions (file checks, command runs, etc.), then returns those tool results to the daemon so the LLM can continue.

**Security boundary:** your daemon runs under a **different Unix UID** than the learner. Learners can connect to the socket (if allowed) but cannot read your daemon’s memory or environment.

---

## Socket paths (important!)

`$XDG_RUNTIME_DIR` (e.g., `/run/user/<uid>`) is per-user and not shareable. Use a **host directory under `/tmp`** that **you** own and grant limited ACLs to specific learners:

```
/tmp/mcp-explorer/<owner-username>/mcp-explorer.sock
```

You’ll:

- `chmod 0710` the directory (others can’t list; can traverse with `x` if granted).
- `setfacl` on the directory (traverse) and the socket (rw).
- Also enforce an **allowlist** in the daemon via `SO_PEERCRED` to check the connecting user’s UID.

---

## Wire protocol (simple NDJSON)

- CLI → Daemon

  - `start`: `{ "type":"start", "system":"...", "tools":[ ... ] }`
  - `user`: `{ "type":"user", "session_id":"...", "content":"..." }`
  - `tool_outputs`: `{ "type":"tool_outputs", "session_id":"...", "calls":[ { "id":"t1","name":"mcp.call","output":<json> }, ... ] }`

- Daemon → CLI

  - On `start`: `{ "ok": true, "session_id": "..." }`
  - On steps: `{ "ok": true, "assistant": "text...", "tool_calls":[ { "id":"t1","name":"mcp.call","args":{...}}, ... ] }`

One JSON object per line (`\n` terminated).

---

## Code: Daemon (no root)

Holds the vendor key in memory, authorizes by peer UID (allowlist), and drives the model turn loop. The LLM call is stubbed—plug in your vendor SDK/HTTPS where marked.

```python
# mcp_daemon.py
import os, json, socket, struct, pwd, pathlib, uuid, sys

OWNER = pwd.getpwuid(os.getuid()).pw_name
SOCK_DIR = os.environ.get("MCP_SOCK_DIR", f"/tmp/mcp-explorer/{OWNER}")
SOCK = os.environ.get("MCP_SOCK", os.path.join(SOCK_DIR, "mcp-explorer.sock"))
API_KEY = os.environ.get("MCP_BACKEND_API_KEY")
ALLOWLIST_FILE = os.environ.get("ALLOWLIST_FILE", os.path.expanduser("~/.mcp-explorer/allowlist"))

def load_allowlist():
    try:
        return {u.strip() for u in open(ALLOWLIST_FILE) if u.strip() and not u.startswith("#")}
    except FileNotFoundError:
        return set()

def peer_username(conn):
    # Linux SO_PEERCRED -> (pid, uid, gid) as 3 ints
    creds = conn.getsockopt(socket.SOL_SOCKET, socket.SO_PEERCRED, struct.calcsize("3i"))
    pid, uid, gid = struct.unpack("3i", creds)
    return pwd.getpwuid(uid).pw_name

# ---- plug your LLM vendor here --------------------------------------------
# Return either: {"assistant": "text..."} OR {"tool_calls":[{id,name,args},...]}
class Session:
    def __init__(self, system, tools):
        self.id = str(uuid.uuid4())
        self.messages = [{"role":"system","content":system}]
        self.tools = tools

def llm_step(session, last_msg):
    # TODO: Call your vendor with (session.messages + [last_msg]) and session.tools using API_KEY
    # Demo: always request one MCP call
    return {
        "assistant": "Checking your file...",
        "tool_calls": [
            {"id": "t1", "name":"mcp.call",
             "args": {"server":"fs", "method":"exists", "args":{"path":"/home/$USER/README"}}}
        ]
    }
# ---------------------------------------------------------------------------

def ensure_socket_path():
    pdir = pathlib.Path(SOCK_DIR)
    pdir.mkdir(parents=True, exist_ok=True)
    return pdir

def main():
    if not API_KEY:
        print("Error: MCP_BACKEND_API_KEY is not set for the daemon.", file=sys.stderr)
        sys.exit(1)

    ensure_socket_path()
    spath = pathlib.Path(SOCK)
    try: spath.unlink()
    except FileNotFoundError: pass

    srv = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    srv.bind(str(spath))
    os.chmod(str(spath), 0o660)  # add ACLs per learner after creation
    srv.listen(64)

    print(f"[mcpd] listening on {spath}")
    allow = load_allowlist()
    if allow:
        print(f"[mcpd] allowed users: {', '.join(sorted(allow))}")

    sessions = {}
    while True:
        conn, _ = srv.accept()
        try:
            user = peer_username(conn)
            if allow and user not in allow:
                conn.sendall(b'{"ok":false,"error":"unauthorized"}\n')
                conn.close()
                continue

            # read one JSON line
            data = b""
            while not data.endswith(b"\n"):
                chunk = conn.recv(65536)
                if not chunk: break
                data += chunk
            if not data:
                conn.close(); continue

            req = json.loads(data.decode("utf-8"))
            typ = req.get("type")

            if typ == "start":
                s = Session(system=req.get("system","You validate tasks via MCP."), tools=req.get("tools",[]))
                sessions[s.id] = s
                conn.sendall((json.dumps({"ok":True,"session_id":s.id})+"\n").encode()); conn.close(); continue

            sid = req["session_id"]
            s = sessions[sid]

            if typ == "user":
                s.messages.append({"role":"user","content":req["content"]})
                out = llm_step(s, s.messages[-1])
                conn.sendall((json.dumps({"ok":True, **out})+"\n").encode())
            elif typ == "tool_outputs":
                for c in req["calls"]:
                    s.messages.append({"role":"tool","name":c["name"],"tool_call_id":c["id"],"content":c["output"]})
                out = llm_step(s, s.messages[-1])
                conn.sendall((json.dumps({"ok":True, **out})+"\n").encode())
            else:
                conn.sendall(b'{"ok":false,"error":"unknown_type"}\n')
        except Exception as e:
            try: conn.sendall((json.dumps({"ok":False,"error":str(e)})+"\n").encode())
            except Exception: pass
        finally:
            conn.close()

if __name__ == "__main__":
    main()
```

---

## Code: CLI bridge (runs as learner)

Executes local MCP calls and sends outputs back to the daemon. Replace `run_mcp_call` with your MCP client integration.

```python
# mcp_cli_bridge.py
import os, json, socket, sys

SOCK = os.environ.get("MCP_SOCK", f"/tmp/mcp-explorer/{os.environ.get('MCP_OWNER','owner')}/mcp-explorer.sock")

def call_daemon(msg):
    s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    s.connect(SOCK)
    s.sendall((json.dumps(msg)+"\n").encode())
    data=b""
    while not data.endswith(b"\n"):
        chunk=s.recv(65536)
        if not chunk: break
        data += chunk
    s.close()
    return json.loads(data.decode())

def run_mcp_call(server, method, args):
    # TODO: bridge to your MCP client(s)
    if server == "fs" and method == "exists":
        path = os.path.expandvars(args["path"])
        return {"path": path, "exists": os.path.exists(path)}
    return {"server":server, "method":method, "args":args, "note":"stub"}

def chat(system, tools, user_text):
    sid = call_daemon({"type":"start","system":system,"tools":tools})["session_id"]
    resp = call_daemon({"type":"user","session_id":sid,"content":user_text})
    while True:
        tool_calls = resp.get("tool_calls") or []
        if tool_calls:
            results=[]
            for tc in tool_calls:
                a = tc["args"]
                out = run_mcp_call(a["server"], a["method"], a["args"])
                results.append({"id":tc["id"],"name":tc["name"],"output":out})
            resp = call_daemon({"type":"tool_outputs","session_id":sid,"calls":results})
        else:
            print(resp.get("assistant","(no text)"))
            break

if __name__ == "__main__":
    user_text = sys.argv[1] if len(sys.argv)>1 else "Check my README"
    tools = [{
        "type":"function",
        "function":{
            "name":"mcp.call",
            "description":"Call an MCP server method",
            "parameters":{
                "type":"object",
                "properties":{
                    "server":{"type":"string"},
                    "method":{"type":"string"},
                    "args":{"type":"object"}
                },
                "required":["server","method","args"]
            }
        }
    }]
    chat("You validate tasks via local MCP servers.", tools, user_text)
```

---

## Host-only quick start (no Docker)

As the **owner** (you):

```bash
export MCP_BACKEND_API_KEY='sk-live-...'
export MCP_SOCK_DIR="/tmp/mcp-explorer/$USER"
mkdir -p "$MCP_SOCK_DIR"
chmod 0710 "$MCP_SOCK_DIR"

mkdir -p ~/.mcp-explorer
printf "alice\nbob\n" > ~/.mcp-explorer/allowlist

# Run the daemon (in tmux/screen)
python3 mcp_daemon.py

# Once the socket file exists, grant per-user access:
setfacl -m u:alice:--x "$MCP_SOCK_DIR"
setfacl -m u:alice:rw  "$MCP_SOCK_DIR/mcp-explorer.sock"
setfacl -m u:bob:--x   "$MCP_SOCK_DIR"
setfacl -m u:bob:rw    "$MCP_SOCK_DIR/mcp-explorer.sock"
```

As the **learner**:

```bash
export MCP_SOCK="/tmp/mcp-explorer/<OWNER>/mcp-explorer.sock"  # replace <OWNER>
python3 mcp_cli_bridge.py "Validate step 1"
```

> Optional: run the daemon under `systemd --user`. (Omitted here for brevity; you can add unit files if your host supports it.)

---

## Docker deployment (daemon in a container you control)

**Why Docker?** Easier packaging and isolation, provided learners do **not** control the Docker daemon.

**Layout:**

```
.
├─ mcp_daemon.py
├─ docker/
│  └─ entrypoint-mcpd.sh
├─ Dockerfile.daemon
├─ docker-compose.yml
└─ secrets/
   └─ mcp_api_key.txt   # 0600, not in VCS
```

### `Dockerfile.daemon`

```dockerfile
# Dockerfile.daemon
FROM python:3.12-slim

WORKDIR /app
RUN pip install --no-cache-dir requests

COPY mcp_daemon.py /app/mcp_daemon.py
COPY docker/entrypoint-mcpd.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
ENV ALLOWLIST_FILE=/allow/allowlist \
    MCP_SOCK_DIR=/sock \
    MCP_SOCK=/sock/mcp-explorer.sock

ENTRYPOINT ["/entrypoint.sh"]
```

### `docker/entrypoint-mcpd.sh`

```sh
#!/bin/sh
set -e

if [ -f /run/secrets/mcp_api_key ]; then
  export MCP_BACKEND_API_KEY="$(cat /run/secrets/mcp_api_key)"
fi

: "${MCP_BACKEND_API_KEY:?MCP_BACKEND_API_KEY (or /run/secrets/mcp_api_key) required}"
: "${MCP_SOCK_DIR:=/sock}"

mkdir -p "$MCP_SOCK_DIR"
/usr/bin/env python -u /app/mcp_daemon.py
```

### `docker-compose.yml`

```yaml
version: "3.9"

services:
  mcpd:
    build:
      context: .
      dockerfile: Dockerfile.daemon

    # Map container user to your host UID/GID so the socket file is owned by you
    user: "${HOST_UID}:${HOST_GID}"

    environment:
      MCP_SOCK_DIR: /sock
      MCP_SOCK: /sock/mcp-explorer.sock
      ALLOWLIST_FILE: /allow/allowlist

    volumes:
      - type: bind
        source: ${MCP_SOCK_HOST_DIR}
        target: /sock
      - type: bind
        source: ${ALLOWLIST_HOST_FILE}
        target: /allow/allowlist
        read_only: true

    secrets:
      - mcp_api_key

    restart: unless-stopped

secrets:
  mcp_api_key:
    file: ./secrets/mcp_api_key.txt
```

### Bring it up

```bash
# 1) Prepare env
export HOST_UID=$(id -u)
export HOST_GID=$(id -g)
export MCP_SOCK_HOST_DIR=/tmp/mcp-explorer/$USER
export ALLOWLIST_HOST_FILE=$HOME/.mcp-explorer/allowlist

mkdir -p "$MCP_SOCK_HOST_DIR"
chmod 0710 "$MCP_SOCK_HOST_DIR"

mkdir -p "$(dirname "$ALLOWLIST_HOST_FILE")"
printf "alice\nbob\n" > "$ALLOWLIST_HOST_FILE"

# Directory traverse for learners (socket ACLs come after create)
setfacl -m u:alice:--x "$MCP_SOCK_HOST_DIR"
setfacl -m u:bob:--x   "$MCP_SOCK_HOST_DIR"

# 2) Secret file (compose secret)
mkdir -p secrets && chmod 0700 secrets
printf 'sk-live-REDACTED\n' > secrets/mcp_api_key.txt
chmod 0600 secrets/mcp_api_key.txt

# 3) Build & run
docker compose up -d --build

# 4) After the container creates the socket:
setfacl -m u:alice:rw "$MCP_SOCK_HOST_DIR/mcp-explorer.sock"
setfacl -m u:bob:rw   "$MCP_SOCK_HOST_DIR/mcp-explorer.sock"
```

**Learner usage:**

```bash
export MCP_SOCK="/tmp/mcp-explorer/<OWNER>/mcp-explorer.sock"
mcp-explorer ...  # or python3 mcp_cli_bridge.py "Validate step 1"
```

> If you prefer **rootless Docker** (or Podman) under your user, that further reduces blast radius and avoids root-owned artifacts.

---

## Hardening checklist (host or Docker)

- **No TCP ports**—only a Unix socket file.
- **Run as non-root.** (In Docker, map to your host UID/GID with `user:`.)
- **Never bake secrets into images.** Provide at runtime via env or Docker secrets.
- **ACL + allowlist:** enforce both filesystem ACLs _and_ the in-daemon peer-UID allowlist.
- **No sensitive logging.** Scrub headers/payloads; never log the key.
- **Rate limiting (optional):** add per-UID quotas in the daemon.

---

## When this won’t protect you

- A user with **root** on the host (or control of the Docker daemon) can extract the key.
- If forced to run the daemon under the **same UID** as the learner, they can `ptrace`/dump the process. Use per-user keys or a remote broker instead.

---

## Troubleshooting

- `unauthorized`: user not in allowlist or lacks socket/dir ACLs.
- `Permission denied` on socket: ensure directory `x` and socket `rw` ACLs for the learner (`getfacl` helps).
- No response: confirm both sides agree on `MCP_SOCK` path.
- Model never calls tools: ensure your vendor call actually passes the `tools` schema and enables tool/function-calling.

---

## License

(Your repo’s license here.)

---
## Implementation plan (detailed)

Below is a detailed breakdown of the discrete changes required to turn this design into a fully working feature in your codebase.

### A. Add the secure daemon entrypoint

- Create `mcp_daemon.py` (or `mcp_explorer/secure_daemon.py`) based on the “Code: Daemon” stub above.
- Read the vendor key (`MCP_BACKEND_API_KEY`), socket paths (`MCP_SOCK_DIR`, `MCP_SOCK`), and allowlist (`ALLOWLIST_FILE`) from environment or Settings.
- Enforce ACLs on the directory/socket and check connecting UIDs via `SO_PEERCRED` against the allowlist.
- Drive the LLM turn‑loop, streaming NDJSON messages over the Unix domain socket.

### B. Add the learner CLI bridge

- Create `mcp_cli_bridge.py` (or `mcp_explorer/secure_cli.py`) per the “Code: CLI bridge” stub.
- Implement the NDJSON wire protocol (`start` → `user` → `tool_outputs` messages and parse back `ok`, `assistant`, `tool_calls`).
- Replace the stubbed `run_mcp_call()` with calls into your existing `mcp_explorer.client.client` (ToolServerProtocol) so real MCP servers execute.

### C. Wire it into your main CLI (`main.py`)

- Add new subcommands or flags (e.g. `daemon`, `secure-cli`) to dispatch to these entrypoints.
- Ensure `daemon` mode boots the secure‑API‑key daemon, and `secure-cli` mode runs the bridge instead of the normal REPL/serve.

### D. Update configuration & Settings

- Either read required env vars directly in the new scripts, or add fields to your `Settings` in `mcp_explorer/config.py` (e.g. `mcp_backend_api_key`, `secure_sock_dir`, `allowlist_file`).

### E. Hook the bridge into your MCP client API

- In the bridge’s `run_mcp_call(...)`, dispatch tool calls to your existing MCPClient (`process_query` or `ToolServerProtocol.call_tool`).
- Match your MCP client’s JSON input/output schema so the daemon receives real results.

### F. Documentation & operator guides

- Port the Host‑only quick start (lines 257–285) and Docker deployment (lines 291–383) to your README or a dedicated docs/secure_api_key.md.
- Add the hardening checklist (lines 427–434) to SECURITY.md or your ops runbook.

### G. Docker packaging & secrets

- Include `Dockerfile.daemon`, `docker/entrypoint-mcpd.sh`, and `docker-compose.yml` from the spec.
- Create `secrets/mcp_api_key.txt` (mode 0600) and add it to `.gitignore`.
- Bind‑mount the host socket dir and allowlist file; inject the key via Docker secrets or environment.

### H. Tests & CI

- Add unit tests for ACL/allowlist enforcement (mock `SO_PEERCRED`), NDJSON framing, and error paths.
- Add integration tests that spin up the daemon in a temporary socket, run the bridge, and verify at least one tool‑call round‑trip.

### I. Packaging & manifest updates

- Update `pyproject.toml`/`MANIFEST.in` to include the new scripts, Docker folder, and docs.
- Update any lint/pre‑commit configs if needed for the new files.

---

## How to run (quick start)

Below is a minimal summary of the commands to start the secure‑API‑key daemon and invoke the CLI bridge in host‑only or Docker mode.  See the full instructions above for details.

### Host‑only mode

```bash
# 1) Prepare environment and allowlist
export MCP_BACKEND_API_KEY='sk-live-...'
export MCP_SOCK_DIR=/tmp/mcp-explorer/${USER}
mkdir -p "$MCP_SOCK_DIR" && chmod 0710 "$MCP_SOCK_DIR"
mkdir -p ~/.mcp-explorer
printf "alice\nbob\n" > ~/.mcp-explorer/allowlist

# 2) Launch the daemon in the background
python3 mcp_daemon.py &

# 3) Grant learner ACLs on the socket
setfacl -m u:alice:--x "$MCP_SOCK_DIR"
setfacl -m u:alice:rw  "$MCP_SOCK_DIR/mcp-explorer.sock"
setfacl -m u:bob:--x   "$MCP_SOCK_DIR"
setfacl -m u:bob:rw    "$MCP_SOCK_DIR/mcp-explorer.sock"

# 4) As learner, run the CLI bridge
export MCP_SOCK="$MCP_SOCK_DIR/mcp-explorer.sock"
python3 mcp_cli_bridge.py "Validate step 1"
```

### Docker mode

```bash
# 1) Set host variables
export HOST_UID=$(id -u)
export HOST_GID=$(id -g)
export MCP_SOCK_HOST_DIR=/tmp/mcp-explorer/${USER}
export ALLOWLIST_HOST_FILE=~/.mcp-explorer/allowlist

# 2) Prepare host dirs and allowlist
mkdir -p "$MCP_SOCK_HOST_DIR" && chmod 0710 "$MCP_SOCK_HOST_DIR"
mkdir -p "$(dirname "$ALLOWLIST_HOST_FILE")"
printf "alice\nbob\n" > "$ALLOWLIST_HOST_FILE"

# 3) Build and run the container
docker compose up -d --build

# 4) Grant learner RW on the socket
setfacl -m u:alice:rw "$MCP_SOCK_HOST_DIR/mcp-explorer.sock"
setfacl -m u:bob:rw   "$MCP_SOCK_HOST_DIR/mcp-explorer.sock"

# 5) As learner, run the bridge or mcp-explorer
export MCP_SOCK="$MCP_SOCK_HOST_DIR/mcp-explorer.sock"
mcp-explorer "Validate step 1"
```

