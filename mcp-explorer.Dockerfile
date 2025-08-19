#first stage - builder
FROM python:3.11-slim AS builder

# Build mcp-explorer package with PyInstaller
COPY . /mcp-explorer
WORKDIR /mcp-explorer
RUN apt-get update && apt-get install -y binutils
RUN pip install -r mcp-explorer-requirements.txt
RUN pyinstaller --noconfirm --clean mcp-explorer.spec

#second stage
FROM python:3.11-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/
COPY --from=builder /mcp-explorer/dist/mcp-explorer /usr/local/bin/mcp-explorer

# Copy only metadata and package code for pip install (avoid extra files)
COPY --from=builder /mcp-explorer/requirements-mcp-server-common.txt requirements-mcp-server-common.txt
RUN python -m pip install -r requirements-mcp-server-common.txt

RUN chmod +x /usr/local/bin/mcp-explorer

# Switch to a clean application directory for runtime
RUN mkdir /app
WORKDIR /app