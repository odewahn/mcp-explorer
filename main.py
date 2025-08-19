import argparse
import os
from mcp_explorer.config import (
    load_user_config,
    DEFAULT_USER_CONFIG_FILE,
    settings,
    configure_logging,
    DEFAULT_REPL_PROMPT,
    DEFAULT_REPL_ART,
)


def run():
    # Entrypoint for both HTTP server (default) and interactive REPL
    parser = argparse.ArgumentParser(prog="mcp-explorer")
    parser.add_argument(
        "--config",
        "-c",
        help=(
            f"Path to config file for prompt and MCP server setup"
            f" (default: {DEFAULT_USER_CONFIG_FILE})"
        ),
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable verbose logging (default off)",
    )
    parser.add_argument(
        "--port", "-p",
        type=int,
        help=f"Port for HTTP server (default: {settings.port})",
    )
    parser.add_argument(
        "mode",
        nargs="?",
        choices=["repl", "serve"],
        default="serve",
        help="Mode to run: 'repl' for interactive client, 'serve' for HTTP server (default)",
    )
    args = parser.parse_args()

    # Set logging level: verbose→DEBUG otherwise show errors only
    settings.log_level = "DEBUG" if args.verbose else "ERROR"
    configure_logging()

    # Load user config if provided or default file exists
    if args.config:
        load_user_config(args.config)
    elif os.path.exists(DEFAULT_USER_CONFIG_FILE):
        load_user_config(DEFAULT_USER_CONFIG_FILE)

    # Apply optional port override
    if args.port:
        settings.port = args.port

    # Decide mode: 'repl' for interactive client, 'serve' for HTTP server (default)
    if args.mode == "repl":
        # Interactive REPL chat client
        import asyncio
        import sys as _sys
        from prompt_toolkit import PromptSession
        from prompt_toolkit.formatted_text import ANSI
        from prompt_toolkit.patch_stdout import patch_stdout
        from rich import print
        from art import text2art
        from rich.console import Console

        console = Console()

        try:
            from mcp_explorer.client.mcp_client import client
        except ImportError as exc:
            print(
                f"[ERROR] Could not import mcp_client: {exc}. \
Please ensure 'anthropic' and other dependencies are installed.",
                file=_sys.stderr,
            )
            _sys.exit(1)

        async def repl_loop():
            # Auto-connect to any configured MCP servers
            failed = []
            for entry in settings.mcp_servers or []:
                name = entry.get("name")
                url = entry.get("url")
                stype = entry.get("server_type", "stdio")
                try:
                    ok = await client.connect_to_server(
                        server_url=url,
                        server_type=stype,
                        server_name=name,
                    )
                    if not ok:
                        failed.append((name, "connect_to_server returned False"))
                except Exception as exc:
                    failed.append((name, str(exc)))
            if failed:
                for name, err in failed:
                    print(
                        f"[ERROR] MCP server '{name}' failed to connect: {err}",
                        file=_sys.stderr,
                    )
                _sys.exit(1)

            Art = text2art(f"{DEFAULT_REPL_ART}")
            print(f"[green]\n{Art}\n")

            # Seed and display initial message if provided
            if not client.conversation_history and settings.initial_message:
                client.conversation_history.append(
                    {"role": "user", "content": settings.initial_message}
                )
                print(settings.initial_message)

            session = PromptSession(ANSI(f"\n\033[1;32m{DEFAULT_REPL_PROMPT}\033[0m"))

            while True:
                with patch_stdout():
                    try:
                        text = await session.prompt_async()
                    except (EOFError, KeyboardInterrupt):
                        break
                if not text or text.strip().lower() in ("exit", "quit"):
                    break
                with console.status(f"[bold green]thinking...") as status:
                    resp = await client.process_query(
                        system_prompt=settings.default_system_prompt,
                        query=text,
                        model=settings.default_model,
                        max_tool_calls=settings.max_tool_calls,
                    )
                console.print(f"\n{resp}")
            print("Goodbye from REPL!")

        asyncio.run(repl_loop())
    else:
        # Start HTTP API and UI server
        from mcp_explorer.api.app import main

        main()


if __name__ == "__main__":
    run()
