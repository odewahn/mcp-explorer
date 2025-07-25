import argparse
import os
from mcp_explorer.api.app import main
from mcp_explorer.config import load_user_config

if __name__ == "__main__":
    parser = argparse.ArgumentParser(prog="mcp-explorer")
    parser.add_argument(
        "--config", "-c",
        help="Path to explorer-config.yaml for prompt and MCP server setup"
    )
    args = parser.parse_args()

    if args.config:
        load_user_config(args.config)
    elif os.path.exists("explorer-config.yaml"):
        # Auto-load default config file if present
        load_user_config("explorer-config.yaml")

    main()
