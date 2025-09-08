import asyncio
import json
import logging
from typing import Dict, Any, List, Optional
from mcp.types import CallToolResult
import os


from .base import MCPServerConnection

logger = logging.getLogger("stdio_server")


class STDIOServerConnection(MCPServerConnection):
    def __init__(self):
        self._process = None
        self._connected = False
        self._request_id = 0
        self.tools = []

    # Helper function to create environment variables for subprocess

    def create_env(self, additional_vars=None):
        env = os.environ.copy()
        if additional_vars:
            env.update(additional_vars)
        return env

    """
    def create_env(self, additional_vars=None):

        # Essential system variables that are usually safe to pass
        safe_system_vars = [
            "PATH",
            "HOME",
            "USER",
            "SHELL",
            "TERM",
            "LANG",
            "LC_ALL",
            "TZ",
            "PWD",
            "TMPDIR",
            "TEMP",
            "TMP",
        ]

        env = {}

        # Add safe system variables
        for var in safe_system_vars:
            if var in os.environ:
                env[var] = os.environ[var]

        # Add your specific variables
        if additional_vars:
            env.update(additional_vars)

        return env
    """

    async def connect(
        self,
        server_url: str,
        api_keys: Dict[str, Any] | None = None,
        environment_variables: Dict[str, str] | None = None,
    ) -> bool:
        try:
            # Launch the command via shell to support complex invocations (e.g. docker run with escapes)
            logger.info(f"Starting STDIO server with shell command: {server_url}")
            # Combine API keys and environment variables into subprocess env
            additional_vars: dict[str, str] = {}
            if api_keys:
                additional_vars.update({k: str(v) for k, v in api_keys.items()})
            if environment_variables:
                additional_vars.update(environment_variables)
            self._process = await asyncio.create_subprocess_shell(
                server_url,
                limit=1024 * 128,  # 128 KiB buffer
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=self.create_env(additional_vars),
            )

            asyncio.create_task(self._log_stderr())

            # Step 1: Initialize
            result = await self._send_request(
                {
                    "jsonrpc": "2.0",
                    "method": "initialize",
                    "params": {
                        "protocolVersion": "2024-11-05",  # Updated version
                        "clientInfo": {
                            "name": "refactored-stdio-client",
                            "version": "1.0.0",
                        },
                        "capabilities": {"tools": {}},
                    },
                    "id": self._next_id(),
                }
            )

            if not result:
                logger.error("Initialization failed.")
                await self.disconnect()
                return False

            # Step 2: Initialized notification
            await self._send_notification("notifications/initialized", {})

            # Step 3: List tools (unwrap the JSON-RPC envelope)
            tools_result = await self._send_request(
                {
                    "jsonrpc": "2.0",
                    "method": "tools/list",
                    "params": {},
                    "id": self._next_id(),
                }
            )
            body = (
                tools_result.get("result") if isinstance(tools_result, dict) else None
            )
            if isinstance(body, dict) and "tools" in body:
                self.tools = body["tools"]
            elif isinstance(body, list):
                self.tools = body
            else:
                logger.warning("Unexpected tools/list result format: %s", body)
                self.tools = []

            logger.info(f"Found {len(self.tools)} tools.")
            self._connected = True
            return True

        except Exception as e:
            logger.error(f"Failed to connect: {e}")
            await self.disconnect()
            return False

    async def _send_request(
        self, payload: Dict[str, Any], timeout: float = 10.0
    ) -> Optional[Dict[str, Any]]:
        if (
            not self._process
            or not self._process.stdin
            or self._process.stdin.is_closing()
        ):
            logger.error("Process not available for request.")
            return None

        try:
            message = json.dumps(payload) + "\n"
            logger.info(f"Sending request: {message.strip()}")
            self._process.stdin.write(message.encode())
            await self._process.stdin.drain()

            # Only wait for response if ID is present
            if "id" not in payload:
                return None

            line = await asyncio.wait_for(self._process.stdout.readline(), timeout)
            response_str = line.decode().strip()
            logger.info(f"Received response: {response_str}")
            return json.loads(response_str)

        except asyncio.TimeoutError:
            logger.error(
                f"Timeout waiting for response to method '{payload.get('method')}'"
            )
        except Exception as e:
            logger.error(f"Request error: {e}")

        return None

    async def _send_notification(self, method: str, params: Dict[str, Any]) -> None:
        payload = {"jsonrpc": "2.0", "method": method, "params": params}
        await self._send_request(payload)

    async def list_tools(self) -> List[Dict[str, Any]]:
        """List available tools from the server."""
        if not self._connected:
            raise Exception("Not connected to server.")

        response = await self._send_request(
            {
                "jsonrpc": "2.0",
                "method": "tools/list",
                "params": {},
                "id": self._next_id(),
            }
        )

        result = response.get("result") if response else None

        raw_tools = []
        if isinstance(result, dict) and "tools" in result:
            raw_tools = result["tools"]
        elif isinstance(result, list):
            raw_tools = result
        else:
            logger.warning("Unexpected format from tools/list result: %s", result)

        # Convert camelCase to snake_case for consistency
        self.tools = [
            {
                "name": tool.get("name"),
                "description": tool.get("description"),
                "input_schema": tool.get("inputSchema", {}),
            }
            for tool in raw_tools
        ]

        return self.tools

    async def call_tool(
        self, tool_name: str, tool_args: Dict[str, Any]
    ) -> CallToolResult:
        """Call a tool with the given arguments and return a CallToolResult"""
        if not self._connected:
            raise Exception("Not connected to server.")

        response = await self._send_request(
            {
                "jsonrpc": "2.0",
                "method": "tools/call",
                "params": {"name": tool_name, "arguments": tool_args},
                "id": self._next_id(),
            }
        )

        if not response or "result" not in response:
            raise Exception(f"No valid result from tool '{tool_name}'")

        return CallToolResult(**response["result"])

    async def disconnect(self) -> None:
        logger.info("Disconnecting...")

        if self._process:
            if self._process.stdin and not self._process.stdin.is_closing():
                try:
                    # send the JSON-RPC terminate message to allow graceful shutdown
                    await self._send_notification("terminate", {})
                except Exception:
                    pass
                self._process.stdin.close()

            try:
                await asyncio.wait_for(self._process.wait(), timeout=3)
            except asyncio.TimeoutError:
                logger.warning("Force-killing process...")
                self._process.kill()
                await self._process.wait()

        self._process = None
        self._connected = False
        logger.info("Disconnected.")

    async def _log_stderr(self):
        if not self._process or not self._process.stderr:
            return

        while not self._process.stderr.at_eof():
            line = await self._process.stderr.readline()
            if line:
                logger.warning(f"STDERR: {line.decode().rstrip()}")

    def _next_id(self) -> int:
        self._request_id += 1
        return self._request_id

    @property
    def is_connected(self) -> bool:
        return self._connected and self._process and self._process.returncode is None
