from mcp.server.fastmcp import FastMCP


# Initialize server
mcp = FastMCP("my-server")


# Add a tool
@mcp.tool()
async def hello_world(name: str) -> str:
    """Say hello to someone.

    Args:
        name: Person's name
    """
    import sys

    print(f"Received request with name: {name}", file=sys.stderr)
    return f"Hello, {name}!"


# Run the server
if __name__ == "__main__":
    try:
        mcp.run(transport="stdio")
    except KeyboardInterrupt:
        # Graceful shutdown on Ctrl+C
        pass
