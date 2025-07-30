import logging

logger = logging.getLogger(__name__)

try:
    from pydantic import BaseSettings
except ImportError:
    from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application configuration, loaded from environment or defaults."""

    version: str = "0.1.0"

    # Anthropic model settings
    default_model: str = "claude-3-5-sonnet-20241022"
    default_system_prompt: str = (
        "You are Claude, an AI assistant. Be helpful, harmless, and honest."
    )
    max_tokens: int = 8192
    max_tool_calls: int = 5

    # Web interface settings
    dev_url: str = "http://localhost:5173"
    prod_url: str = "http://localhost:8000/static"
    port: int = 8000

    # Logging settings
    log_file: str = "mcp_explorer.log"
    log_level: str = "INFO"
    debug: bool = False

    # Preconfigured MCP servers to auto-connect (name -> command)
    mcp_servers: list[dict[str, str]] = []

    class Config:
        env_file = ".env"


settings = Settings()

# Raw contents of explorer-config.yaml if loaded via CLI
user_config: dict | None = None


def configure_logging() -> None:
    """
    Configure root logger based on settings.
    """
    level = getattr(logging, settings.log_level.upper(), logging.INFO)

    # Console handler with color for WARNING messages
    console_handler = logging.StreamHandler()
    console_handler.setLevel(level)

    class ColorFormatter(logging.Formatter):
        """Formatter that highlights WARNING level logs in red."""
        RED = "\033[31m"
        RESET = "\033[0m"

        def format(self, record):
            msg = super().format(record)
            if record.levelno == logging.WARNING:
                return f"{self.RED}{msg}{self.RESET}"
            return msg

    log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    console_handler.setFormatter(ColorFormatter(log_format))

    # File handler for persistent logs (no color)
    file_handler = logging.FileHandler(settings.log_file)
    file_handler.setLevel(level)
    file_handler.setFormatter(logging.Formatter(log_format))

    logging.basicConfig(level=level, handlers=[console_handler, file_handler])


def load_user_config(path: str) -> None:
    """
    Load a YAML config file to override system prompt and preconfigure MCP servers.
    """
    import yaml

    global user_config, settings
    with open(path, "r") as f:
        cfg = yaml.safe_load(f) or {}
    user_config = cfg
    logger.info("Loaded user config from %s: %r", path, cfg)

    # Override system prompt if provided
    if "prompt" in cfg:
        settings.default_system_prompt = cfg["prompt"]
        logger.info(
            "Default system prompt overridden to: %r", settings.default_system_prompt
        )

    # Load MCP server entries: list of name/url/type
    if "mcp" in cfg:
        servers: list[dict[str, str | list[dict[str, str]]]] = []
        for item in cfg["mcp"] or []:
            for name, entry in item.items():
                # Determine URL/command and transport type
                if isinstance(entry, dict):
                    cmd_or_url = entry.get("url") or entry.get("cmd", "")
                    stype = entry.get(
                        "type",
                        "sse" if cmd_or_url.startswith(("http://", "https://")) else "stdio",
                    )
                    tool_list = entry.get("tools") or []
                else:
                    cmd_or_url = entry
                    stype = (
                        "sse"
                        if isinstance(entry, str) and entry.startswith(("http://", "https://"))
                        else "stdio"
                    )
                    tool_list = []
                servers.append(
                    {
                        "name": name,
                        "url": cmd_or_url,
                        "server_type": stype,
                        "tools": tool_list,
                    }
                )
        settings.mcp_servers = servers
        logger.info("Preconfigured MCP servers: %r", settings.mcp_servers)

