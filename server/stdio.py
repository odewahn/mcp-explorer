import asyncio
import json
import logging
import traceback
from typing import List, Dict, Any, Optional, Tuple
import sys
from .base import MCPServerConnection

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("stdio_server")


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
            logger.info(f"Attempting to start STDIO server with command: {self._command}")
            
            # Start the subprocess
            self.process = await asyncio.create_subprocess_shell(
                self._command,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            logger.info(f"Process started with PID: {self.process.pid}")
            
            # Start a task to log stderr output
            asyncio.create_task(self._log_stderr())
            
            # Initialize the connection
            init_message = {"type": "initialize"}
            logger.info(f"Sending initialize message: {init_message}")
            await self._send_message(init_message)
            
            # Wait for response
            logger.info("Waiting for initialize response...")
            response = await self._receive_message()
            logger.info(f"Received initialize response: {response}")
            
            if not response or response.get("type") != "initialize_response":
                logger.error(f"Failed to initialize STDIO connection: {response}")
                await self.disconnect()
                return False
            
            # List tools to verify connection
            logger.info("Requesting tool list...")
            tools = await self.list_tools()
            if not tools:
                logger.error("No tools available from STDIO server")
                await self.disconnect()
                return False
                
            logger.info(f"Successfully connected to STDIO server with {len(tools)} tools")
            self._connected = True
            return True
        except Exception as e:
            logger.error(f"Error connecting to STDIO server: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            await self.disconnect()
            self._connected = False
            return False
            
    async def _log_stderr(self):
        """Log stderr output from the subprocess"""
        if not self.process or self.process.stderr.at_eof():
            return
            
        while not self.process.stderr.at_eof():
            try:
                line = await self.process.stderr.readline()
                if line:
                    stderr_line = line.decode('utf-8').rstrip()
                    logger.error(f"STDIO server stderr: {stderr_line}")
            except Exception as e:
                logger.error(f"Error reading stderr: {e}")
                break

    async def disconnect(self) -> None:
        """Disconnect from the MCP server"""
        try:
            if self.process:
                logger.info("Disconnecting from STDIO server...")
                # Send terminate message if possible
                try:
                    if self._connected:
                        logger.info("Sending terminate message")
                        await self._send_message({"type": "terminate"})
                except Exception as e:
                    logger.warning(f"Failed to send terminate message: {e}")
                
                # Terminate the process
                logger.info("Terminating process")
                self.process.terminate()
                try:
                    logger.info("Waiting for process to exit")
                    await asyncio.wait_for(self.process.wait(), timeout=2.0)
                    logger.info(f"Process exited with code: {self.process.returncode}")
                except asyncio.TimeoutError:
                    logger.warning("Process did not terminate gracefully, killing it")
                    self.process.kill()
                
                self.process = None
            
            self._connected = False
            logger.info("Disconnected from STDIO server")
        except Exception as e:
            logger.error(f"Error disconnecting from STDIO server: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")

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
        logger.info(f"Sending message to STDIO server: {message_json}")
        self.process.stdin.write(message_bytes)
        await self.process.stdin.drain()
        logger.info("Message sent and drained")

    async def _receive_message(self, timeout: float = 10.0) -> Optional[Dict[str, Any]]:
        """Receive a message from the STDIO server with timeout"""
        if not self.process or self.process.stdout.at_eof():
            raise Exception("Process not running or stdout is closed")
        
        logger.info(f"Waiting for response with timeout {timeout} seconds...")
        try:
            # Read one line with timeout
            start_time = asyncio.get_event_loop().time()
            line_bytes = await asyncio.wait_for(self.process.stdout.readline(), timeout)
            elapsed = asyncio.get_event_loop().time() - start_time
            logger.info(f"Received response after {elapsed:.2f} seconds")
            
            if not line_bytes:
                logger.error("Received empty response (EOF)")
                return None
                
            line = line_bytes.decode("utf-8").strip()
            logger.info(f"Raw response: {line}")
            
            try:
                parsed = json.loads(line)
                logger.info(f"Parsed JSON response: {parsed}")
                return parsed
            except json.JSONDecodeError as e:
                logger.error(f"JSON parse error: {e}")
                logger.error(f"Raw content that failed to parse: {line}")
                raise Exception(f"Invalid JSON response from STDIO server: {e}")
        except asyncio.TimeoutError:
            logger.error(f"Timeout after {timeout} seconds waiting for response")
            # Try to check if process is still running
            if self.process.returncode is not None:
                logger.error(f"Process has exited with code: {self.process.returncode}")
            raise Exception(f"Timeout waiting for response from STDIO server after {timeout} seconds")
        except Exception as e:
            logger.error(f"Error receiving message: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise

    @property
    def is_connected(self) -> bool:
        """Check if the connection is active"""
        return (
            self._connected and 
            self.process is not None and 
            self.process.returncode is None
        )
