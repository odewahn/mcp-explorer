from abc import ABC, abstractmethod
from typing import List, Dict, Any


class MCPServerConnection(ABC):
    """Abstract base class for MCP server connections"""

    @abstractmethod
    async def connect(self, server_url: str) -> bool:
        """Connect to an MCP server"""
        pass

    @abstractmethod
    async def disconnect(self) -> None:
        """Disconnect from the MCP server"""
        pass

    @abstractmethod
    async def list_tools(self) -> List[Dict[str, Any]]:
        """List available tools from the server"""
        pass

    @abstractmethod
    async def call_tool(self, tool_name: str, tool_args: Dict[str, Any]) -> Any:
        """Call a tool with the given arguments"""
        pass

    @property
    @abstractmethod
    def is_connected(self) -> bool:
        """Check if the connection is active"""
        pass
