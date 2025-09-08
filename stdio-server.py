from mcp.server.fastmcp import FastMCP
import os
import logging
import sys
import datetime

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
    print(f"X-API-KEY: {os.environ.get('X-API-KEY', 'not set')}", file=sys.stderr)
    return f"Hello, {name}!"


@mcp.tool()
async def today() -> str:
    """
    Return today's date in yyyyy-mm-dd format.
    """
    return str(datetime.date.today())


@mcp.tool()
async def month_in_words() -> str:
    """
    Return the current month in words.
    """
    return datetime.date.today().strftime("%B")


@mcp.tool()
async def print_env_var(name: str) -> str:
    """
    Print the value of an environment variable.
    """
    return os.environ.get(name, "not set")


# Run the server
if __name__ == "__main__":
    try:
        logger.info("Starting MCP server...")
        # logger.info(f"Using X-API-KEY: {os.environ['X-API-KEY']}")
        mcp.run(transport="stdio")
    except KeyboardInterrupt:
        # Graceful shutdown on Ctrl+C
        pass
