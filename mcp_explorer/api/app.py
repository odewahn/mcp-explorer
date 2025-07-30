import logging
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import webbrowser

# Centralized configuration and logging
from mcp_explorer.config import settings, configure_logging

configure_logging()
logger = logging.getLogger("mcp_explorer")


# Tool-server transports
# from mcp_explorer.server import SSEServerConnection
from mcp_explorer.client.mcp_client import client

# Root directory (project root) for serving top-level static assets
root_dir = os.path.abspath(
    os.path.join(os.path.dirname(__file__), os.pardir, os.pardir)
)

# (client is instantiated in mcp_explorer.client.mcp_client)
# client = MCPClient()  # removed; using shared singleton above


# Create FastAPI app and include API router
app = FastAPI(title="MCP Client API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount(
    "/static",
    StaticFiles(directory=os.path.join(root_dir, "static"), html=True),
    name="static",
)
from mcp_explorer.api.routes import router as api_router

app.include_router(api_router)


@app.on_event("shutdown")
async def shutdown_event():
    await client.cleanup()


@app.on_event("startup")
async def startup_event():
    """Auto-connect to any preconfigured MCP servers from explorer-config.yaml"""
    failed = []
    if settings.mcp_servers:
        logger.info("Auto-connecting to %d configured MCP servers", len(settings.mcp_servers))
        for entry in settings.mcp_servers:
            name = entry.get("name")
            url = entry.get("url")
            stype = entry.get("server_type", "stdio")
            logger.info("Connecting to MCP server %s -> %s (%s)", name, url, stype)
            try:
                ok = await client.connect_to_server(
                    server_url=url,
                    server_type=stype,
                    server_name=name,
                )
                if ok:
                    logger.info("Connected to MCP server %s", name)
                else:
                    logger.error("Failed to connect to MCP server %s", name)
                    failed.append((name, "connect_to_server returned False"))
            except Exception as exc:
                logger.exception("Error during auto-connect to MCP server %s", name)
                failed.append((name, str(exc)))

    if failed:
        for name, err in failed:
            logger.error("MCP server '%s' failed to start: %s", name, err)
        os._exit(1)

    # Validate that config-defined server names and tool overrides match actual servers/tools
    for entry in settings.mcp_servers:
        cfg_name = entry["name"]
        if cfg_name not in client.tool_servers:
            logger.error(
                "Configured server name '%s' not found among connected servers: %s",
                cfg_name,
                list(client.tool_servers.keys()),
            )
            os._exit(1)
        # Validate tool overrides from config (if any)
        for override in entry.get("tools", []):
            tool_name = override.get("name")
            actual = [t["name"] for t in client.tool_servers[cfg_name]["tools"]]
            if tool_name not in actual:
                logger.error(
                    "Configured override for unknown tool '%s' on server '%s'",
                    tool_name,
                    cfg_name,
                )
                os._exit(1)

    # Open browser after MCP servers are connected and startup complete
    if os.environ.get("ENV") == "dev":
        target = settings.dev_url
    else:
        target = settings.prod_url
    logger.info("Opening browser to %s", target)
    webbrowser.open_new(target)


def main():
    # Check dev vs prod URL for logging
    if os.environ.get("ENV") == "dev":
        url = settings.dev_url
    else:
        url = settings.prod_url
    logger.info(f"Starting MCP Explorer API at {url}")
    logger.info(f"Version: {settings.version}")
    logger.info(f"Logging to: {settings.log_file} at level {settings.log_level}")
    logger.debug(
        "Debug mode is enabled" if settings.debug else "Debug mode is disabled"
    )
    # Start the main function to run the app
    uvicorn.run(
        app, host="0.0.0.0", port=settings.port, log_level=settings.log_level.lower()
    )


if __name__ == "__main__":
    main()
