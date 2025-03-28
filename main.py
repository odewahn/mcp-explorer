import asyncio
import json
import os
import anyio
from typing import Optional, List, Dict, Any
from contextlib import AsyncExitStack
from collections import deque

from anthropic import Anthropic
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

import os
import webbrowser

# Import our custom modules
from models import (
    Query,
    MessageResponse,
    Tool,
    ToolsResponse,
    ToolServer,
    ToolServersResponse,
    ToolCallRequest,
    ToolCallResponse,
)
from server import SSEServerConnection

# Find the directory where binary is running
script_path = os.path.dirname(os.path.realpath(__file__))


class MCPClient:
    def __init__(self):
        # Initialize session and client objects
        self.sessions = {}  # Dictionary to store multiple sessions
        self.exit_stack = AsyncExitStack()
        self.anthropic = Anthropic()
        # Store conversation history
        self.conversation_history = deque(
            maxlen=100
        )  # Limit history to last 100 messages
        # Cache for available tools
        self.available_tools = []
        # Store tool servers
        self.tool_servers = {}  # Dictionary to store server URLs and their sessions

    async def connect_to_server(
        self, server_url: str, server_type: str = "sse", server_name: str = "default"
    ):
        """Connect to an MCP server with the specified transport type"""
        if server_type.lower() == "sse":
            return await self.connect_to_sse_server(server_url, server_name)
        elif server_type.lower() == "stdio":
            return await self.connect_to_stdio_server(server_url, server_name)
        else:
            print(f"Unsupported server type: {server_type}")
            return False

    async def connect_to_sse_server(
        self, server_url: str, server_name: str = "default"
    ):
        """Connect to an MCP server running with SSE transport"""
        try:
            # Create and connect the SSE server connection
            connection = SSEServerConnection()
            success = await connection.connect(server_url)

            if not success:
                return False

            # List available tools to verify connection
            tools = await connection.list_tools()

            # Store the connection and tools
            self.tool_servers[server_name] = {
                "url": server_url,
                "connection": connection,
                "session": connection.session,  # For backward compatibility
                "tools": [
                    {
                        "name": tool["name"],
                        "description": tool["description"],
                        "input_schema": tool["input_schema"],
                        "server": server_name,
                    }
                    for tool in tools
                ],
            }

            # Update the available tools list
            self.refresh_available_tools()

            print(
                f"\nConnected to server {server_name} with tools:",
                [tool["name"] for tool in tools],
            )
            return True
        except Exception as e:
            print(f"Error connecting to server {server_name}: {str(e)}")
            return False

    def refresh_available_tools(self):
        """Refresh the combined list of available tools from all servers"""
        self.available_tools = []
        for server_name, server_info in self.tool_servers.items():
            self.available_tools.extend(server_info["tools"])

    async def cleanup(self):
        """Properly clean up all sessions and streams"""
        for server_name, server_info in self.tool_servers.items():
            if "connection" in server_info:
                await server_info["connection"].disconnect()
        self.tool_servers = {}

    async def process_query(
        self, system_prompt: str, query: str, model: str = "claude-3-5-sonnet-20241022"
    ) -> str:
        """Process a query using Claude and available tools"""
        # Add user message to history
        self.conversation_history.append({"role": "user", "content": query})

        messages = [{"role": "user", "content": query}]

        # Refresh the tools list to ensure we have the latest
        await self.refresh_tools()

        try:
            print(f"Making API call to Anthropic with model: {model}")
            print(f"Number of available tools: {len(self.available_tools)}")
            if self.available_tools:
                print(f"Tool names: {[tool['name'] for tool in self.available_tools]}")

            # Clean tools for Anthropic API by removing server field
            clean_tools = []
            for tool in self.available_tools:
                # Create a copy of the tool without the server field
                clean_tool = {
                    "name": tool["name"],
                    "description": tool["description"],
                    "input_schema": tool["input_schema"],
                }
                clean_tools.append(clean_tool)

            print(f"Cleaned {len(clean_tools)} tools for Anthropic API")

            # Initial Claude API call
            response = self.anthropic.messages.create(
                model=model,
                system=system_prompt,
                max_tokens=1000,
                messages=messages,
                tools=clean_tools,
            )
            print("Successfully received response from Anthropic API")
        except Exception as e:
            print(f"ERROR in Anthropic API call: {str(e)}")
            import traceback

            print(f"Traceback: {traceback.format_exc()}")
            raise

        # Process response and handle tool calls
        tool_results = []
        final_text = []

        for content in response.content:
            if content.type == "text":
                final_text.append(content.text)
                # Add assistant message to history
                self.conversation_history.append(
                    {"role": "assistant", "content": content.text}
                )
            elif content.type == "tool_use":
                tool_name = content.name
                tool_args = content.input

                # Find which server has this tool
                server_name = None
                for tool in self.available_tools:
                    if tool["name"] == tool_name:
                        server_name = tool["server"]
                        break

                if not server_name or server_name not in self.tool_servers:
                    error_msg = f"Tool {tool_name} not found in any connected server"
                    final_text.append(f"[Error: {error_msg}]")
                    self.conversation_history.append(
                        {"role": "system", "content": f"Error: {error_msg}"}
                    )
                    continue

                # Get the connection for this server
                connection = self.tool_servers[server_name]["connection"]

                # Execute tool call
                try:
                    result = await connection.call_tool(tool_name, tool_args)
                    tool_results.append({"call": tool_name, "result": result})
                    tool_call_text = f"[Calling tool {tool_name} with args {tool_args}]"
                    final_text.append(tool_call_text)

                    # Add tool call to history
                    self.conversation_history.append(
                        {"role": "assistant", "content": tool_call_text}
                    )
                    self.conversation_history.append(
                        {"role": "system", "content": f"Tool result: {result.content}"}
                    )

                    # Continue conversation with tool results
                    if hasattr(content, "text") and content.text:
                        messages.append({"role": "assistant", "content": content.text})

                    messages.append({"role": "user", "content": result.content})

                    # Get next response from Claude
                    response = self.anthropic.messages.create(
                        model=model,
                        system=system_prompt,
                        max_tokens=1000,
                        messages=messages,
                    )

                    final_text.append(response.content[0].text)
                    # Add final assistant response to history
                    self.conversation_history.append(
                        {"role": "assistant", "content": response.content[0].text}
                    )
                except Exception as e:
                    error_msg = f"Error calling tool {tool_name}: {str(e)}"
                    final_text.append(f"[Error: {error_msg}]")
                    self.conversation_history.append(
                        {"role": "system", "content": f"Error: {error_msg}"}
                    )

        return "\n".join(final_text)

    async def connect_to_stdio_server(
        self, server_url: str, server_name: str = "default"
    ):
        """Connect to an MCP server running with STDIO transport"""
        try:
            # Create and connect the STDIO server connection
            from server import STDIOServerConnection

            connection = STDIOServerConnection()
            success = await connection.connect(server_url)

            if not success:
                return False

            # List available tools to verify connection
            tools = await connection.list_tools()

            # Store the connection and tools
            self.tool_servers[server_name] = {
                "url": server_url,
                "connection": connection,
                "session": connection,  # For backward compatibility
                "tools": [
                    {
                        "name": tool["name"],
                        "description": tool["description"],
                        "input_schema": tool["input_schema"],
                        "server": server_name,
                    }
                    for tool in tools
                ],
            }

            # Update the available tools list
            self.refresh_available_tools()

            print(
                f"\nConnected to STDIO server {server_name} with tools:",
                [tool["name"] for tool in tools],
            )
            return True
        except Exception as e:
            print(f"Error connecting to STDIO server {server_name}: {str(e)}")
            return False

    async def refresh_tools(self):
        """Refresh the list of available tools from all servers"""
        updated_tools = []
        servers_to_remove = []

        # Make a copy of the keys to avoid modification during iteration
        server_names = list(self.tool_servers.keys())

        for server_name in server_names:
            if server_name not in self.tool_servers:
                # Server was removed during iteration
                continue

            server_info = self.tool_servers[server_name]
            if "connection" in server_info:
                try:
                    print(f"Refreshing tools for server: {server_name}")
                    connection = server_info["connection"]
                    tools = await connection.list_tools()

                    server_info["tools"] = [
                        {
                            "name": tool["name"],
                            "description": tool["description"],
                            "input_schema": tool["input_schema"],
                            "server": server_name,  # Keep server info for our internal tracking
                        }
                        for tool in tools
                    ]
                    print(
                        f"Found {len(server_info['tools'])} tools in server {server_name}"
                    )
                    updated_tools.extend(server_info["tools"])
                except anyio.ClosedResourceError:
                    print(
                        f"Server {server_name} connection is closed. Marking for removal."
                    )
                    servers_to_remove.append(server_name)
                except Exception as e:
                    import traceback

                    print(f"ERROR refreshing tools for server {server_name}: {str(e)}")
                    print(f"Traceback: {traceback.format_exc()}")
                    # If we get a connection error, mark the server for removal
                    if "connection" in str(e).lower() or "closed" in str(e).lower():
                        servers_to_remove.append(server_name)

        # Remove any servers that had closed connections
        for server_name in servers_to_remove:
            if server_name in self.tool_servers and server_name != "default":
                print(f"Removing server with closed connection: {server_name}")
                try:
                    # Just remove it from our dictionary, don't try to clean up the session
                    del self.tool_servers[server_name]
                except Exception as e:
                    print(f"Error removing server {server_name}: {str(e)}")

        self.available_tools = updated_tools
        print(f"Total tools available across all servers: {len(self.available_tools)}")
        return self.available_tools


# Create FastAPI app
app = FastAPI(title="MCP Client API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

app.mount(
    "/static",
    StaticFiles(directory=os.path.join(script_path, "static"), html=True),
    name="static",
)

client = MCPClient()


@app.on_event("shutdown")
async def shutdown_event():
    await client.cleanup()


@app.post("/query", response_model=str)
async def process_query(query: Query, background_tasks: BackgroundTasks):
    """Process a query and return the response"""
    try:
        # Use the system prompt from the request
        print(f"Processing query with model: {query.model}")
        print(
            f"System prompt: {query.system_prompt[:100]}..."
        )  # Log first 100 chars of system prompt
        print(f"Query text: {query.text[:100]}...")  # Log first 100 chars of query

        response = await client.process_query(
            query.system_prompt, query.text, query.model
        )
        print(f"Query processed successfully, response length: {len(response)}")
        return response
    except Exception as e:
        import traceback

        error_trace = traceback.format_exc()
        print(f"ERROR processing query: {str(e)}")
        print(f"Traceback: {error_trace}")
        raise HTTPException(
            status_code=500, detail=f"{str(e)}\n\nTraceback: {error_trace}"
        )


@app.get("/messages", response_model=MessageResponse)
async def get_messages():
    """Get the conversation history"""
    return MessageResponse(messages=list(client.conversation_history))


@app.get("/tools", response_model=ToolsResponse)
async def get_tools():
    """Get the list of available MCP tools"""
    try:
        tools = await client.refresh_tools()
        return ToolsResponse(tools=tools)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve tools: {str(e)}"
        )


@app.post("/call-tool", response_model=ToolCallResponse)
async def call_tool(request: ToolCallRequest):
    """Call a specific tool with the provided arguments"""
    try:
        # Find which server has this tool
        server_name = None
        for tool in client.available_tools:
            if tool["name"] == request.tool_name:
                server_name = tool["server"]
                break

        if not server_name or server_name not in client.tool_servers:
            raise HTTPException(
                status_code=404,
                detail=f"Tool {request.tool_name} not found in any connected server",
            )

        connection = client.tool_servers[server_name]["connection"]
        if not connection:
            raise HTTPException(
                status_code=503,
                detail=f"Connection for server {server_name} not initialized",
            )

        print(f"Calling tool: {request.tool_name} with args: {request.tool_args}")

        # Call the tool using the connection
        result = await connection.call_tool(request.tool_name, request.tool_args)

        # Extract the content properly based on its type
        content_text = ""
        if isinstance(result.content, str):
            content_text = result.content
        elif isinstance(result.content, list):
            # If it's a list of content objects, extract text from each one
            for item in result.content:
                if hasattr(item, "text"):
                    content_text += item.text + "\n"
                elif isinstance(item, dict) and "text" in item:
                    content_text += item["text"] + "\n"
                elif isinstance(item, str):
                    content_text += item + "\n"
        print(content_text)
        return ToolCallResponse(result=content_text)
    except Exception as e:
        error_msg = f"Failed to call tool {request.tool_name}: {str(e)}"
        print(f"Error: {error_msg}")
        raise HTTPException(status_code=500, detail=error_msg)


@app.post("/add-tool-server")
async def add_tool_server(server: ToolServer):
    """Add a new tool server"""
    try:
        # Generate a server name if not provided
        server_name = server.name
        if not server_name:
            # Use a timestamp-based name as default
            import time

            server_name = f"server-{int(time.time())}"

        # Check if server with this name already exists
        if server_name in client.tool_servers:
            # If name exists, generate a unique one
            server_name = f"{server_name}-{int(time.time())}"

        # Connect to the new server
        success = await client.connect_to_server(
            server_url=server.url,
            server_type=server.server_type,
            server_name=server_name,
        )
        if not success:
            raise HTTPException(
                status_code=500, detail=f"Failed to connect to server at {server.url}"
            )

        return {
            "status": "success",
            "message": f"Connected to server {server_name} at {server.url}",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to add tool server: {str(e)}"
        )


@app.get("/tool-servers", response_model=ToolServersResponse)
async def get_tool_servers():
    """Get the list of connected tool servers"""
    try:
        servers = [
            {"name": name, "url": info["url"]}
            for name, info in client.tool_servers.items()
        ]
        return ToolServersResponse(servers=servers)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve tool servers: {str(e)}"
        )


@app.delete("/tool-server/{server_name}")
async def remove_tool_server(server_name: str):
    """Remove a tool server"""
    try:
        if server_name not in client.tool_servers:
            raise HTTPException(
                status_code=404, detail=f"Server with name '{server_name}' not found"
            )

        # Don't allow removing the default server
        if server_name == "default":
            raise HTTPException(
                status_code=400, detail="Cannot remove the default server"
            )

        # First, mark the server as being removed to prevent other operations from using it
        server_info = client.tool_servers[server_name].copy()

        # Remove the server from the dictionary before cleaning up to prevent concurrent access
        del client.tool_servers[server_name]

        # Update available tools list immediately to prevent using tools from this server
        client.refresh_available_tools()

        # Now clean up the connection in a try/except block
        try:
            if "connection" in server_info:
                await server_info["connection"].disconnect()
        except Exception as e:
            print(f"Warning: Error while cleaning up server {server_name}: {str(e)}")
            # Continue with removal even if cleanup fails

        return {"status": "success", "message": f"Removed server {server_name}"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to remove tool server: {str(e)}"
        )


@app.post("/reset-messages")
async def reset_messages():
    """Reset the conversation history"""
    try:
        client.conversation_history.clear()
        return {"status": "success", "message": "Conversation history has been reset"}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to reset messages: {str(e)}"
        )


def main():

    # chec if o.s.environ.get("ENV") is set to "dev"
    if os.environ.get("ENV") == "dev":
        url = "http://localhost:5173"
    else:
        url = "http://localhost:8000/static"
    webbrowser.open(url)
    # Run the FastAPI app directly (this will create its own event loop)
    uvicorn.run(app, host="0.0.0.0", port=8000)


if __name__ == "__main__":
    main()
