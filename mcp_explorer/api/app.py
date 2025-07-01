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


def main():
    # Check if os.environ.get("ENV") is set to "dev"
    if os.environ.get("ENV") == "dev":
        url = settings.dev_url
    else:
        url = settings.prod_url
    webbrowser.open_new(url)
    # Run the FastAPI app directly (this will create its own event loop)
    uvicorn.run(app, host="0.0.0.0", port=8000)


if __name__ == "__main__":
    main()
