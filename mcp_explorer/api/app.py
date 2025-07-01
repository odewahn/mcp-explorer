import logging
## no direct type hints in this module
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn


import os
import webbrowser

# Centralized configuration and logging
from mcp_explorer.config import settings, configure_logging

configure_logging()
logger = logging.getLogger("mcp_explorer")

# Import our custom modules
from mcp_explorer.models import (
    Query,
    MessageResponse,
    Tool,
    ToolsResponse,
    ToolServer,
    ToolServersResponse,
    ToolCallRequest,
    ToolCallResponse,
)
# Tool-server transports
from mcp_explorer.server import SSEServerConnection
from mcp_explorer.client.mcp_client import client

# Root directory (project root) for serving top-level static assets
root_dir = os.path.abspath(
    os.path.join(os.path.dirname(__file__), os.pardir, os.pardir)
)

# (client is instantiated in mcp_explorer.client.mcp_client)
# client = MCPClient()  # removed; using shared singleton above


# Create FastAPI app
app = FastAPI(title="MCP Client API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount(
    "/static",
    StaticFiles(directory=os.path.join(root_dir, "static"), html=True),
    name="static",
)

@app.on_event("shutdown")
async def shutdown_event():
    await client.cleanup()


@app.post("/query", response_model=str)
async def process_query(query: Query, background_tasks: BackgroundTasks):
    """Process a query and return the response"""
    try:
        # Use the system prompt from the request
        logger.info("Processing query with model: %s", query.model)
        logger.debug("System prompt: %s...", query.system_prompt[:100])
        logger.debug("Query text: %s...", query.text[:100])

        # Get max_tool_calls from the query
        max_tool_calls = query.max_tool_calls
        logger.info("Max tool calls: %d", max_tool_calls)

        response = await client.process_query(
            query.system_prompt, query.text, query.model, max_tool_calls
        )
        logger.info("Query processed successfully, response length: %d", len(response))
        return response
    except Exception as e:
        import traceback

        error_trace = traceback.format_exc()
        logger.error("ERROR processing query: %s", str(e))
        logger.error("Traceback: %s", error_trace)
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
    logger.info("Handling /tools request: refreshing tools from client")
    try:
        tools = await client.refresh_tools()
        logger.info("/tools response: %d tools available", len(tools))
        return ToolsResponse(tools=tools)
    except Exception as e:
        logger.exception("Exception while retrieving tools")
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

        logger.info("Calling tool: %s with args: %s", request.tool_name, request.tool_args)

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
        logger.info(content_text)
        return ToolCallResponse(result=content_text)
    except Exception as e:
        error_msg = f"Failed to call tool {request.tool_name}: {str(e)}"
        logger.error("Error: %s", error_msg)
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

        logger.info(
            f"Adding new {server.server_type} server: {server_name} at {server.url}"
        )

        # Connect to the new server
        success = await client.connect_to_server(
            server_url=server.url,
            server_type=server.server_type,
            server_name=server_name,
        )
        if not success:
            error_msg = f"Failed to connect to server at {server.url}"
            logger.error(error_msg)
            raise HTTPException(status_code=500, detail=error_msg)

        logger.info(f"Successfully added server {server_name}")
        return {
            "status": "success",
            "message": f"Connected to server {server_name} at {server.url}",
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback

        error_msg = f"Failed to add tool server: {str(e)}"
        logger.error(error_msg)
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=error_msg)


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
            logger.warning(
                "Error while cleaning up server %s: %s", server_name, str(e)
            )
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


@app.get("/create-test-stdio-server")
async def create_test_server():
    """Create a test STDIO server for testing"""
    try:
        from mcp_explorer.server import create_test_stdio_server

        filepath = create_test_stdio_server()
        logger.info(f"Created test STDIO server at: {filepath}")

        # Return the command to run the server
        command = f"python {filepath}"
        return {
            "status": "success",
            "message": f"Test STDIO server created at {filepath}",
            "command": command,
        }
    except Exception as e:
        logger.error(f"Error creating test server: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to create test server: {str(e)}"
        )


def main():
    # Check if os.environ.get("ENV") is set to "dev"
    if os.environ.get("ENV") == "dev":
        url = "http://localhost:5173"
    else:
        url = "http://localhost:8000/static"
    webbrowser.open(url)
    # Run the FastAPI app directly (this will create its own event loop)
    uvicorn.run(app, host="0.0.0.0", port=8000)


if __name__ == "__main__":
    main()
