---
# MCP Explorer

An application to interact with the MCP protocol via an AI assistant (Claude) and external tools.

## Architecture Overview

```mermaid
flowchart TD
  subgraph API Layer
    API[api/app.py]
  end
  subgraph Routes
    Q[/query]
    M[/messages]
    T[/tools]
    Srv[/add-tool-server & more]
  end

  subgraph Client Layer
    C[mcp_explorer/client/mcp_client.py]
  end

  subgraph Core Layer
    QP[mcp_explorer/core/query_processor.py]
  end

  subgraph Transport Layer
    SSE[mcp_explorer/server/sse.py]
    STDIO[mcp_explorer/server/stdio.py]
  end

  API -->|routes| Routes
  Routes -->|calls| C -->|orchestrates| QP ---|uses| SSE & STDIO
```

## Project Layout

```text
mcp_explorer/
├─ api/
│  ├─ app.py
│  └─ routes/
│     ├─ query.py
│     ├─ messages.py
│     ├─ tools.py
│     └─ servers.py
├─ client/
│  └─ mcp_client.py
├─ core/
│  └─ query_processor.py
├─ server/
│  ├─ base.py
│  ├─ sse.py
│  └─ stdio.py
├─ config.py
├─ models.py
└─ static/
```

---

## Frontend

## Build for OSx

```
pyinstaller --noconfirm --clean mcp-explorer.spec
```

### To package, sign, and notarize

I used this this tool, whih does all the steps in a nice package:

https://github.com/txoof/codesign

Note that I renamed it `pycodesign` when I downloaded it, even though it's called `pycodesign.py` when you download it from the repo.

```
cd dist
pycodesign ../pycodesign.ini
```

NB: Before you can notarize, you need to have a developer account with Apple and have set up the notarization process. This is a bit of a pain, but it's not too bad. You can find the instructions [here](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution).

# Testing STDIO client

This repo include a simple STDIO server that you can use to test the client:

```
python -u stdio-server.py
```
