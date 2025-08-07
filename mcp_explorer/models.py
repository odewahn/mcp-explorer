from typing import List, Dict, Any
from pydantic import BaseModel


class ServerTool(BaseModel):
    """Configuration for a single tool defined in explorer-config.yaml"""
    name: str
    description: str


class ServerConfig(BaseModel):
    """Configuration for an MCP server as loaded from explorer-config.yaml"""
    name: str
    url: str
    server_type: str
    tools: List[ServerTool] = []


class ConfigResponse(BaseModel):
    """Response model for /config endpoint"""
    prompt: str
    mcp: List[ServerConfig]


class ToolOverride(BaseModel):
    """Override for a specific server/tool description."""
    server: str
    name: str
    description: str


class Query(BaseModel):
    """Request body for /query endpoint, with optional tool overrides."""
    text: str
    model: str = "claude-3-5-sonnet-20241022"
    system_prompt: str = (
        "You are Claude, an AI assistant. Be helpful, harmless, and honest."
    )
    max_tool_calls: int = 5
    # A list of server+tool description overrides
    tool_overrides: List[ToolOverride] = []


class MessageResponse(BaseModel):
    messages: List[Dict[str, Any]]


class Tool(BaseModel):
    name: str
    description: str
    input_schema: Dict[str, Any]
    # The server name that hosts this tool
    server: str


class ToolsResponse(BaseModel):
    tools: List[Tool]


class ToolServer(BaseModel):
    url: str
    name: str = ""
    server_type: str = "sse"


class ToolServersResponse(BaseModel):
    servers: List[Dict[str, str]]


class RenameServerRequest(BaseModel):
    """Request body for renaming a tool server."""
    new_name: str


class ToolCallRequest(BaseModel):
    tool_name: str
    tool_args: Dict[str, Any]


class ToolCallResponse(BaseModel):
    result: str
