import logging
import time

from fastapi import APIRouter, HTTPException

from mcp_explorer.client.mcp_client import client
from mcp_explorer.models import ToolServer, ToolServersResponse, RenameServerRequest
from mcp_explorer.server import create_test_stdio_server

logger = logging.getLogger("mcp_explorer.api.routes.servers")
router = APIRouter()


@router.post("/add-tool-server")
async def add_tool_server(server: ToolServer):
    """Add a new tool server"""
    try:
        server_name = server.name or f"server-{int(time.time())}"
        if server_name in client.tool_servers:
            server_name = f"{server_name}-{int(time.time())}"

        logger.info("Adding new server: %s at %s", server_name, server.url)
        # Convert list of {key,val} dicts into env var mapping
        env_map = {item["key"]: item["val"] for item in server.environment_variables or []}
        success = await client.connect_to_server(
            server_url=server.url,
            server_type=server.server_type,
            server_name=server_name,
            api_keys=server.api_keys,
            environment_variables=env_map,
        )
        if not success:
            raise HTTPException(status_code=500, detail="Failed to connect to server")
        return {"status": "success", "message": f"Connected to server {server_name}"}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error adding tool server")
        raise HTTPException(status_code=500, detail="Failed to add tool server")


@router.get("/tool-servers", response_model=ToolServersResponse)
async def get_tool_servers():
    """Get the list of connected tool servers"""
    return ToolServersResponse(
        servers=[
            {"name": n, "url": info["url"]} for n, info in client.tool_servers.items()
        ]
    )


@router.delete("/tool-server/{server_name}")
async def remove_tool_server(server_name: str):
    """Remove a tool server"""
    if server_name not in client.tool_servers or server_name == "default-B":
        raise HTTPException(
            status_code=404, detail="Server not found or cannot remove default server"
        )
    server_info = client.tool_servers.pop(server_name)
    client.refresh_available_tools()
    try:
        await server_info.get("connection").disconnect()
    except Exception:
        logger.warning("Error cleaning up server %s", server_name)
    return {"status": "success", "message": f"Removed server {server_name}"}


@router.patch("/tool-server/{old_name}")
async def rename_tool_server(old_name: str, req: RenameServerRequest):
    """Rename an existing tool server."""

    if old_name not in client.tool_servers:
        raise HTTPException(status_code=404, detail="Server not found")
    new_name = req.new_name.strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="New name must not be empty")
    if new_name in client.tool_servers:
        raise HTTPException(status_code=400, detail="A server with the new name already exists")
    # Pop server entry, update its tools' server field, then reinsert under new key
    server_info = client.tool_servers.pop(old_name)
    for tool in server_info.get("tools", []):
        tool["server"] = new_name
    client.tool_servers[new_name] = server_info
    # Refresh combined tool list so frontend sees tools under the new name
    client.refresh_available_tools()
    return {"status": "success", "message": f"Renamed server {old_name} to {new_name}"}




@router.get("/create-test-stdio-server")
async def create_test_server():
    """Create a test STDIO server for testing"""
    filepath = create_test_stdio_server()
    logger.info("Created test STDIO server at: %s", filepath)
    return {"status": "success", "command": f"python {filepath}"}
