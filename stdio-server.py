from mcp.server.fastmcp import FastMCP
import os
import logging
import sys

logger = logging.getLogger(__name__)

# Configure logging to stderr
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    stream=sys.stderr,
)


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

    if os.environ.get("X-API-KEY", "xxx") == "xxx":
        raise ValueError("X-API-KEY environment variable must be set to a valid value.")

    print(f"Received request with name: {name}", file=sys.stderr)
    return f"Hello, {name}!"


# Run the server
if __name__ == "__main__":
    try:
        logger.info("Starting MCP server...")
        logger.info(f"Using X-API-KEY: {os.environ['X-API-KEY']}")
        mcp.run(transport="stdio")
    except KeyboardInterrupt:
        # Graceful shutdown on Ctrl+C
        pass
