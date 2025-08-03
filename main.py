import argparse
import os
from mcp_explorer.api.app import main
from mcp_explorer.config import load_user_config, DEFAULT_USER_CONFIG_FILE

if __name__ == "__main__":
    parser = argparse.ArgumentParser(prog="mcp-explorer")
    parser.add_argument(
        "--config", "-c",
        help=f"Path to config file for prompt and MCP server setup (default: {DEFAULT_USER_CONFIG_FILE})"
    )
    args = parser.parse_args()

    if args.config:
        load_user_config(args.config)
    elif os.path.exists(DEFAULT_USER_CONFIG_FILE):
        # Auto-load default hidden config file if present
        load_user_config(DEFAULT_USER_CONFIG_FILE)

    main()
