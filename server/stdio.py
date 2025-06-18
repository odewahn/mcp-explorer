import asyncio
import logging
import subprocess
import json
from typing import List, Dict, Any, Optional, Tuple
from mcp.types import Tool, CallToolResult, InitializeResult, ListToolsResult
from .base import MCPServerConnection

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("stdio_server")


class STDIOServerConnection(MCPServerConnection):
    """Implementation of MCP server connection using direct process management"""

    def __init__(self):
        self.tools = []
        self._connected = False
        self._command = None
        self._args = []
        self._env = None
        self._process = None
        self._request_id = 0
        self._pending_requests = {}

    async def connect(self, server_url: str) -> bool:
        """
        Connect to an MCP server running with STDIO transport

        The server_url should be a command to execute, e.g., "python server.py"
        """
        try:
            # Parse the command from the server_url
            cmd_parts = server_url.split()
            self._command = cmd_parts[0]
            self._args = cmd_parts[1:] if len(cmd_parts) > 1 else []

            logger.info(
                f"Attempting to start STDIO server with command: {self._command} {' '.join(self._args)}"
            )

            # Start the subprocess
            self._process = await asyncio.create_subprocess_exec(
                self._command,
                *self._args,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=self._env,
            )

            # Start logging stderr in the background
            asyncio.create_task(self._log_stderr())

            # Start processing responses in the background
            asyncio.create_task(self._process_responses())

            # Send initialize request
            initialize_result = await self._send_request(
                "initialize",
                {
                    "protocolVersion": "0.1.0",
                    "clientInfo": {"name": "mcp-client", "version": "1.0.0"},
                    "capabilities": {"tools": {}},
                },
            )

            if not initialize_result:
                logger.error("Failed to initialize connection")
                await self.disconnect()
                return False

            # Send initialized notification
            await self._send_notification("initialized", {})

            # List tools to verify connection
            logger.info("Requesting tool list...")
            tools_result = await self._send_request("tools/list", {})

            if not tools_result or "tools" not in tools_result:
                logger.error("Failed to list tools")
                await self.disconnect()
                return False

            self.tools = tools_result["tools"]
            logger.info(
                f"Successfully connected to STDIO server with {len(self.tools)} tools"
            )

            self._connected = True
            return True
        except Exception as e:
            logger.error(f"Error connecting to STDIO server: {str(e)}")
            await self.disconnect()
            self._connected = False
            return False

    async def _log_stderr(self):
        """Log stderr output from the subprocess"""
        if not self._process or self._process.stderr.at_eof():
            return

        while self._process and not self._process.stderr.at_eof():
            try:
                line = await self._process.stderr.readline()
                if line:
                    stderr_line = line.decode("utf-8").rstrip()
                    logger.error(f"STDIO server stderr: {stderr_line}")
            except Exception as e:
                logger.error(f"Error reading stderr: {e}")
                break

    async def _process_responses(self):
        """Process responses from the server"""
        if not self._process or self._process.stdout.at_eof():
            return

        while self._process and not self._process.stdout.at_eof():
            try:
                line = await self._process.stdout.readline()
                if not line:
                    logger.warning("Server closed stdout")
                    break

                response_str = line.decode("utf-8").strip()
                logger.debug(f"Raw response: {response_str}")

                try:
                    response = json.loads(response_str)

                    # Handle request responses
                    if "id" in response:
                        request_id = response["id"]
                        if request_id in self._pending_requests:
                            # Get the future from pending requests
                            future = self._pending_requests.pop(request_id)

                            if "error" in response:
                                error = response["error"]
                                future.set_exception(
                                    Exception(f"RPC error: {error.get('message')}")
                                )
                            else:
                                future.set_result(response.get("result"))
                        else:
                            logger.warning(
                                f"Received response for unknown request ID: {request_id}"
                            )

                    # Handle notifications
                    elif "method" in response and "id" not in response:
                        logger.info(f"Received notification: {response['method']}")

                    else:
                        logger.warning(f"Received unknown message type: {response}")

                except json.JSONDecodeError as e:
                    logger.error(f"Error parsing response JSON: {e}")

            except Exception as e:
                logger.error(f"Error processing response: {e}")
                # Don't break here to keep the loop running

    async def _send_request(
        self, method: str, params: Dict[str, Any], timeout: float = 10.0
    ) -> Any:
        """Send a request to the server and wait for response"""
        if not self._process or self._process.stdin.is_closing():
            raise Exception("Process not running or stdin is closed")

        # Create a request ID
        self._request_id += 1
        request_id = str(self._request_id)

        # Create a future to wait for the response
        future = asyncio.Future()
        self._pending_requests[request_id] = future

        # Build the request
        request = {
            "jsonrpc": "2.0",
            "id": request_id,
            "method": method,
            "params": params,
        }

        # Send the request
        request_json = json.dumps(request)
        request_bytes = (request_json + "\n").encode("utf-8")
        logger.debug(f"Sending request: {request_json}")
        self._process.stdin.write(request_bytes)
        await self._process.stdin.drain()

        # Wait for the response with timeout
        try:
            result = await asyncio.wait_for(future, timeout)
            return result
        except asyncio.TimeoutError:
            # Remove the pending request on timeout
            if request_id in self._pending_requests:
                self._pending_requests.pop(request_id)
            logger.error(f"Timeout waiting for response to {method}")
            raise Exception(f"Timeout waiting for response to {method}")

    async def _send_notification(self, method: str, params: Dict[str, Any]) -> None:
        """Send a notification to the server (no response expected)"""
        if not self._process or self._process.stdin.is_closing():
            raise Exception("Process not running or stdin is closed")

        # Build the notification
        notification = {"jsonrpc": "2.0", "method": method, "params": params}

        # Send the notification
        notification_json = json.dumps(notification)
        notification_bytes = (notification_json + "\n").encode("utf-8")
        logger.debug(f"Sending notification: {notification_json}")
        self._process.stdin.write(notification_bytes)
        await self._process.stdin.drain()

    async def disconnect(self) -> None:
        """Disconnect from the MCP server"""
        try:
            logger.info("Disconnecting from STDIO server...")

            # Try to send shutdown notification if the connection is still open
            if (
                self._connected
                and self._process
                and not self._process.stdin.is_closing()
            ):
                try:
                    await self._send_notification("shutdown", {})
                except Exception as e:
                    logger.warning(f"Error sending shutdown notification: {e}")

            # Cancel all pending requests
            for request_id, future in self._pending_requests.items():
                if not future.done():
                    future.set_exception(Exception("Connection closed"))
            self._pending_requests.clear()

            # Terminate the process
            if self._process:
                try:
                    self._process.terminate()
                    try:
                        await asyncio.wait_for(self._process.wait(), timeout=2.0)
                    except asyncio.TimeoutError:
                        logger.warning(
                            "Process did not terminate gracefully, killing it"
                        )
                        self._process.kill()
                except Exception as e:
                    logger.error(f"Error terminating process: {e}")
                finally:
                    self._process = None

            self._connected = False
            logger.info("Disconnected from STDIO server")
        except Exception as e:
            logger.error(f"Error disconnecting from STDIO server: {e}")

    async def list_tools(self) -> List[Dict[str, Any]]:
        """List available tools from the server"""
        if not self.is_connected:
            raise Exception("Not connected to server")

        try:
            result = await self._send_request("tools/list", {})

            if not result or "tools" not in result:
                raise Exception("Invalid response from tools/list")

            self.tools = result["tools"]

            # Convert to the expected format
            return [
                {
                    "name": tool["name"],
                    "description": tool["description"],
                    "input_schema": tool["inputSchema"],
                }
                for tool in self.tools
            ]
        except Exception as e:
            logger.error(f"Error listing tools: {e}")
            raise

    async def call_tool(self, tool_name: str, tool_args: Dict[str, Any]) -> Any:
        """Call a tool with the given arguments"""
        if not self.is_connected:
            raise Exception("Not connected to server")

        try:
            result = await self._send_request(
                "tools/call", {"name": tool_name, "arguments": tool_args}
            )

            if not result:
                raise Exception("No result from tool call")

            # Create a response object to match your expected interface
            class ToolResponse:
                def __init__(self, data):
                    self.content = data.get("content", [])
                    self.is_error = data.get("isError", False)

                def __str__(self):
                    return str(self.content)

            return ToolResponse(result)
        except Exception as e:
            logger.error(f"Error calling tool {tool_name}: {e}")
            raise

    @property
    def is_connected(self) -> bool:
        """Check if the connection is active"""
        return (
            self._connected
            and self._process is not None
            and self._process.returncode is None
        )
