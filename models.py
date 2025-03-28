from typing import List, Dict, Any
from pydantic import BaseModel


class Query(BaseModel):
    text: str
    model: str = "claude-3-5-sonnet-20241022"
    system_prompt: str = (
        "You are Claude, an AI assistant. Be helpful, harmless, and honest."
    )


class MessageResponse(BaseModel):
    messages: List[Dict[str, Any]]


class Tool(BaseModel):
    name: str
    description: str
    input_schema: Dict[str, Any]


class ToolsResponse(BaseModel):
    tools: List[Tool]


class ToolServer(BaseModel):
    url: str
    name: str = ""  # Optional name, will be auto-generated if not provided
    server_type: str = "sse"  # Default to SSE, can be "sse" or "stdio"
    server_type: str = "sse"  # Default to SSE, can be "sse" or "stdio"


class ToolServersResponse(BaseModel):
    servers: List[Dict[str, str]]


class ToolCallRequest(BaseModel):
    tool_name: str
    tool_args: Dict[str, Any]


class ToolCallResponse(BaseModel):
    result: str
