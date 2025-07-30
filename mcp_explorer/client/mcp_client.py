import logging
from typing import List, Dict, Any
from collections import deque
from contextlib import AsyncExitStack

from anthropic import Anthropic

from mcp_explorer.core.query_processor import process_query_simple
from mcp_explorer.server import SSEServerConnection

logger = logging.getLogger("mcp_explorer.client")


class MCPClient:
    def __init__(self):
        # Initialize Anthropic client and conversation/tool tracking
        self.sessions: Dict[str, Any] = {}
        self.exit_stack = AsyncExitStack()
        self.anthropic = Anthropic()
        self.conversation_history = deque(maxlen=100)
        self.available_tools: List[Dict[str, Any]] = []
        self.tool_servers: Dict[str, Any] = {}

    async def connect_to_server(
        self, server_url: str, server_type: str = "sse", server_name: str = "default-C"
    ) -> bool:
        """Connect to an MCP server over SSE or STDIO transport."""
        if server_type.lower() == "sse":
            return await self.connect_to_sse_server(server_url, server_name)
        elif server_type.lower() == "stdio":
            return await self.connect_to_stdio_server(server_url, server_name)
        else:
            logger.error("Unsupported server type: %s", server_type)
            return False

    async def connect_to_sse_server(
        self, server_url: str, server_name: str = "default-D"
    ) -> bool:
        """Connect to an MCP server running with SSE transport."""
        try:
            connection = SSEServerConnection()
            if not await connection.connect(server_url):
                return False
            tools = await connection.list_tools()
            self.tool_servers[server_name] = {
                "url": server_url,
                "connection": connection,
                "session": connection.session,
                "tools": [
                    {
                        "name": t["name"],
                        "description": t["description"],
                        "input_schema": t["input_schema"],
                        "server": server_name,
                    }
                    for t in tools
                ],
            }
            self.refresh_available_tools()
            logger.info(
                "Connected to SSE server %s with tools: %s",
                server_name,
                [t["name"] for t in tools],
            )
            return True
        except Exception as e:
            logger.error("Error connecting to SSE server %s: %s", server_name, e)
            return False

    def refresh_available_tools(self) -> None:
        """Combine the list of tools from all connected servers."""
        self.available_tools = []
        for server_info in self.tool_servers.values():
            self.available_tools.extend(server_info.get("tools", []))

    async def refresh_tools(self) -> List[Dict[str, Any]]:
        """Refresh and return the combined list of available tools from all servers."""
        # Update internal tool list
        self.refresh_available_tools()
        return self.available_tools

    async def cleanup(self) -> None:
        """Disconnect all servers and clear tracking."""
        for server_info in self.tool_servers.values():
            conn = server_info.get("connection")
            if conn:
                await conn.disconnect()
        self.tool_servers.clear()

    async def process_query(
        self,
        system_prompt: str,
        query: str,
        model: str,
        max_tool_calls: int,
        tool_overrides: list = None,
    ) -> str:
        """Process a query via Claude and invoke tools as needed."""
        response, self.conversation_history = await process_query_simple(
            anthropic_client=self.anthropic,
            system_prompt=system_prompt,
            query=query,
            available_tools=self.available_tools,
            tool_servers=self.tool_servers,
            model=model,
            conversation_history=list(self.conversation_history),
            max_tool_calls=max_tool_calls,
            tool_overrides=tool_overrides or [],
        )
        return response

    async def connect_to_stdio_server(
        self, server_url: str, server_name: str = "default-E"
    ) -> bool:
        """Connect to an MCP server running with STDIO transport."""
        try:
            from mcp_explorer.server import STDIOServerConnection

            logger.info("Creating STDIO connection to: %s", server_url)
            connection = STDIOServerConnection()
            if not await connection.connect(server_url):
                logger.error("Failed to connect to STDIO server")
                return False
            tools = await connection.list_tools()
            self.tool_servers[server_name] = {
                "url": server_url,
                "connection": connection,
                "session": connection,
                "tools": [
                    {
                        "name": t["name"],
                        "description": t["description"],
                        "input_schema": t["input_schema"],
                        "server": server_name,
                    }
                    for t in tools
                ],
            }
            self.refresh_available_tools()
            logger.info(
                "Connected to STDIO server %s with tools: %s",
                server_name,
                [t["name"] for t in tools],
            )
            return True
        except Exception as e:
            logger.error("Error connecting to STDIO server %s: %s", server_name, e)
            return False


# Singleton client for use by API routes
client = MCPClient()
