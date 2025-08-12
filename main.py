import argparse
import os
from mcp_explorer.config import load_user_config, DEFAULT_USER_CONFIG_FILE, settings, configure_logging

def run():
    parser = argparse.ArgumentParser(prog="mcp-explorer")
    parser.add_argument(
        "--config", "-c",
        help=f"Path to config file for prompt and MCP server setup (default: {DEFAULT_USER_CONFIG_FILE})"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable verbose logging (default off)"
    )
    args = parser.parse_args()

    # Set logging level: verbose→DEBUG, otherwise show errors+critical only
    settings.log_level = "DEBUG" if args.verbose else "ERROR"
    configure_logging()

    # Load user config if provided
    if args.config:
        load_user_config(args.config)
    elif os.path.exists(DEFAULT_USER_CONFIG_FILE):
        load_user_config(DEFAULT_USER_CONFIG_FILE)

    # Import app after logging/config is set
    from mcp_explorer.api.app import main

    main()

if __name__ == "__main__":
    run()
