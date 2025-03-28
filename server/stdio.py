import asyncio
import json
from typing import List, Dict, Any, Optional, Tuple
import sys
from .base import MCPServerConnection


class STDIOServerConnection(MCPServerConnection):
    """Implementation of MCP server connection using STDIO transport"""

    def __init__(self):
        self.process = None
        self.tools = []
        self._connected = False
        self._command = None

    async def connect(self, server_url: str) -> bool:
        """
        Connect to an MCP server running with STDIO transport
        
        The server_url should be a command to execute, e.g., "python server.py"
        """
        try:
            # Parse the command from the server_url
            self._command = server_url
            
            # Start the subprocess
            self.process = await asyncio.create_subprocess_shell(
                self._command,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            # Initialize the connection
            init_message = {"type": "initialize"}
            await self._send_message(init_message)
            
            # Wait for response
            response = await self._receive_message()
            if not response or response.get("type") != "initialize_response":
                print(f"Failed to initialize STDIO connection: {response}")
                await self.disconnect()
                return False
            
            # List tools to verify connection
            tools = await self.list_tools()
            if not tools:
                print("No tools available from STDIO server")
                await self.disconnect()
                return False
                
            self._connected = True
            return True
        except Exception as e:
            print(f"Error connecting to STDIO server: {str(e)}")
            await self.disconnect()
            self._connected = False
            return False

    async def disconnect(self) -> None:
        """Disconnect from the MCP server"""
        try:
            if self.process:
                # Send terminate message if possible
                try:
                    if self._connected:
                        await self._send_message({"type": "terminate"})
                except:
                    pass
                
                # Terminate the process
                self.process.terminate()
                try:
                    await asyncio.wait_for(self.process.wait(), timeout=2.0)
                except asyncio.TimeoutError:
                    self.process.kill()
                
                self.process = None
            
            self._connected = False
        except Exception as e:
            print(f"Error disconnecting from STDIO server: {str(e)}")

    async def list_tools(self) -> List[Dict[str, Any]]:
        """List available tools from the server"""
        if not self.is_connected:
            raise Exception("Not connected to server")

        try:
            await self._send_message({"type": "list_tools"})
            response = await self._receive_message()
            
            if not response or response.get("type") != "list_tools_response":
                raise Exception(f"Invalid response from STDIO server: {response}")
            
            self.tools = [
                {
                    "name": tool["name"],
                    "description": tool["description"],
                    "input_schema": tool["input_schema"],
                }
                for tool in response.get("tools", [])
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
            await self._send_message({
                "type": "call_tool",
                "tool_name": tool_name,
                "tool_args": tool_args
            })
            
            response = await self._receive_message()
            if not response or response.get("type") != "call_tool_response":
                raise Exception(f"Invalid response from STDIO server: {response}")
            
            # Create a response object similar to what the SSE implementation returns
            class ToolResponse:
                def __init__(self, content):
                    self.content = content
            
            return ToolResponse(response.get("result", ""))
        except Exception as e:
            print(f"Error calling tool {tool_name}: {str(e)}")
            raise

    async def _send_message(self, message: Dict[str, Any]) -> None:
        """Send a message to the STDIO server"""
        if not self.process or self.process.stdin.is_closing():
            raise Exception("Process not running or stdin is closed")
        
        message_json = json.dumps(message)
        message_bytes = (message_json + "\n").encode("utf-8")
        self.process.stdin.write(message_bytes)
        await self.process.stdin.drain()

    async def _receive_message(self, timeout: float = 10.0) -> Optional[Dict[str, Any]]:
        """Receive a message from the STDIO server with timeout"""
        if not self.process or self.process.stdout.at_eof():
            raise Exception("Process not running or stdout is closed")
        
        try:
            # Read one line with timeout
            line_bytes = await asyncio.wait_for(self.process.stdout.readline(), timeout)
            if not line_bytes:
                return None
                
            line = line_bytes.decode("utf-8").strip()
            return json.loads(line)
        except asyncio.TimeoutError:
            raise Exception(f"Timeout waiting for response from STDIO server after {timeout} seconds")
        except json.JSONDecodeError as e:
            raise Exception(f"Invalid JSON response from STDIO server: {e}")

    @property
    def is_connected(self) -> bool:
        """Check if the connection is active"""
        return (
            self._connected and 
            self.process is not None and 
            self.process.returncode is None
        )
