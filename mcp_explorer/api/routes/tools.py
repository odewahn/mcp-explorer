import logging

from fastapi import APIRouter, HTTPException

from mcp_explorer.client.mcp_client import client
from mcp_explorer.models import ToolsResponse, ToolCallRequest, ToolCallResponse

logger = logging.getLogger("mcp_explorer.api.routes.tools")
router = APIRouter()


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