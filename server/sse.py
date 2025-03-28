from typing import List, Dict, Any
from mcp import ClientSession
from mcp.client.sse import sse_client
from .base import MCPServerConnection


class SSEServerConnection(MCPServerConnection):
    """Implementation of MCP server connection using SSE transport"""

    def __init__(self):
        self.session = None
        self.streams_context = None
        self.session_context = None
        self.tools = []
        self._connected = False

    async def connect(self, server_url: str) -> bool:
        """Connect to an MCP server running with SSE transport"""
        try:
            # Store the context managers so they stay alive
            self.streams_context = sse_client(url=server_url)
            streams = await self.streams_context.__aenter__()

            self.session_context = ClientSession(*streams)
            self.session = await self.session_context.__aenter__()

            # Initialize
            await self.session.initialize()

            # List available tools to verify connection
            response = await self.session.list_tools()
            self.tools = [
                {
                    "name": tool.name,
                    "description": tool.description,
                    "input_schema": tool.inputSchema,
                }
                for tool in response.tools
            ]

            self._connected = True
            return True
        except Exception as e:
            print(f"Error connecting to SSE server: {str(e)}")
            self._connected = False
            return False

    async def disconnect(self) -> None:
        """Disconnect from the MCP server"""
        try:
            if self.session_context:
                await self.session_context.__aexit__(None, None, None)
            if self.streams_context:
                await self.streams_context.__aexit__(None, None, None)
            self._connected = False
        except Exception as e:
            print(f"Error disconnecting from SSE server: {str(e)}")

    async def list_tools(self) -> List[Dict[str, Any]]:
        """List available tools from the server"""
        if not self.is_connected:
            raise Exception("Not connected to server")

        try:
            response = await self.session.list_tools()
            self.tools = [
                {
                    "name": tool.name,
                    "description": tool.description,
                    "input_schema": tool.inputSchema,
                }
                for tool in response.tools
            ]
            return self.tools
        except Exception as e:
            print(f"Error listing tools: {str(e)}")
            raise

    async def call_tool(self, tool_name: str, tool_args: Dict[str, Any]) -> Any:
        """Call a tool with the given arguments"""
        if not self.is_connected:
            raise Exception("Not connected to server")

        try:
            return await self.session.call_tool(tool_name, tool_args)
        except Exception as e:
            print(f"Error calling tool {tool_name}: {str(e)}")
            raise

    @property
    def is_connected(self) -> bool:
        """Check if the connection is active"""
        return self._connected and self.session is not None
