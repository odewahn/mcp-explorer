import logging
import time

from fastapi import APIRouter, HTTPException, BackgroundTasks

from mcp_explorer.client.mcp_client import client
from mcp_explorer.models import (
    Query,
    MessageResponse,
    ToolsResponse,
    ToolCallRequest,
    ToolCallResponse,
    ToolServer,
    ToolServersResponse,
)
from mcp_explorer.server import create_test_stdio_server

logger = logging.getLogger("mcp_explorer.api.routes")
router = APIRouter()


@router.post("/query", response_model=str)
async def process_query(query: Query, background_tasks: BackgroundTasks):
    """Process a query and return the response"""
    try:
        logger.info("Processing query with model: %s", query.model)
        logger.debug("System prompt: %s...", query.system_prompt[:100])
        logger.debug("Query text: %s...", query.text[:100])

        max_tool_calls = query.max_tool_calls
        logger.info("Max tool calls: %d", max_tool_calls)

        response = await client.process_query(
            query.system_prompt, query.text, query.model, max_tool_calls
        )
        logger.info("Query processed successfully, response length: %d", len(response))
        return response
    except Exception as e:
        logger.exception("Error processing query")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/messages", response_model=MessageResponse)
async def get_messages():
    """Get the conversation history"""
    return MessageResponse(messages=list(client.conversation_history))


@router.get("/tools", response_model=ToolsResponse)
async def get_tools():
    """Get the list of available MCP tools"""
    logger.info("Handling /tools request: refreshing tools from client")
    try:
        tools = await client.refresh_tools()
        logger.info("/tools response: %d tools available", len(tools))
        return ToolsResponse(tools=tools)
    except Exception:
        logger.exception("Exception while retrieving tools")
        raise HTTPException(status_code=500, detail="Failed to retrieve tools")


@router.post("/call-tool", response_model=ToolCallResponse)
async def call_tool(request: ToolCallRequest):
    """Call a specific tool with the provided arguments"""
    try:
        server_name = next((t["server"] for t in client.available_tools if t["name"] == request.tool_name), None)
        if not server_name or server_name not in client.tool_servers:
            raise HTTPException(status_code=404, detail=f"Tool {request.tool_name} not found")

        connection = client.tool_servers[server_name]["connection"]
        if not connection:
            raise HTTPException(status_code=503, detail="Server connection not initialized")

        logger.info("Calling tool: %s with args: %s", request.tool_name, request.tool_args)
        result = await connection.call_tool(request.tool_name, request.tool_args)

        content_text = ""
        if isinstance(result.content, str):
            content_text = result.content
        else:
            for item in result.content or []:
                content_text += getattr(item, "text", item) + "\n"
        logger.info("Tool result: %s", content_text)
        return ToolCallResponse(result=content_text)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error calling tool %s", request.tool_name)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/add-tool-server")
async def add_tool_server(server: ToolServer):
    """Add a new tool server"""
    try:
        server_name = server.name or f"server-{int(time.time())}"
        if server_name in client.tool_servers:
            server_name = f"{server_name}-{int(time.time())}"

        logger.info("Adding new server: %s at %s", server_name, server.url)
        success = await client.connect_to_server(server_url=server.url, server_type=server.server_type, server_name=server_name)
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
    return ToolServersResponse(servers=[{"name": n, "url": info["url"]} for n, info in client.tool_servers.items()])


@router.delete("/tool-server/{server_name}")
async def remove_tool_server(server_name: str):
    """Remove a tool server"""
    if server_name not in client.tool_servers or server_name == "default":
        raise HTTPException(status_code=404, detail="Server not found or cannot remove default server")
    server_info = client.tool_servers.pop(server_name)
    client.refresh_available_tools()
    try:
        await server_info.get("connection").disconnect()
    except Exception:
        logger.warning("Error cleaning up server %s", server_name)
    return {"status": "success", "message": f"Removed server {server_name}"}


@router.post("/reset-messages")
async def reset_messages():
    """Reset the conversation history"""
    client.conversation_history.clear()
    return {"status": "success", "message": "Conversation history has been reset"}


@router.get("/create-test-stdio-server")
async def create_test_server():
    """Create a test STDIO server for testing"""
    filepath = create_test_stdio_server()
    logger.info("Created test STDIO server at: %s", filepath)
    return {"status": "success", "command": f"python {filepath}"}