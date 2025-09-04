import logging

logger = logging.getLogger(__name__)

try:
    from pydantic import BaseSettings
except ImportError:
    from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application configuration, loaded from environment or defaults."""

    version: str = "0.2.3"

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
    # Initial user message to seed conversations (as a user-role first message)
    initial_message: str = ""

    class Config:
        # Read environment file and ignore any extra environment variables
        env_file = ".env"
        extra = "ignore"


settings = Settings()

# Default location for user-supplied config when --config is omitted
DEFAULT_USER_CONFIG_FILE = "mcp-server.yaml"

# Raw contents of explorer-config.yaml (or DEFAULT_USER_CONFIG_FILE) if loaded via CLI
user_config: dict | None = None

# REPL Configuration
DEFAULT_REPL_PROMPT = "mcp-explorer> "
DEFAULT_REPL_ART = "MCP Explorer"


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

    # Override initial user message if provided
    if "initial_message" in cfg:
        settings.initial_message = cfg["initial_message"]
        logger.info(
            "Default initial_message overridden to: %r", settings.initial_message
        )

    # Override LLM model if provided
    if "model" in cfg:
        settings.default_model = cfg["model"]
        logger.info("Default LLM model overridden to: %r", settings.default_model)

    # Load MCP server entries: list of dicts with explicit fields
    if "mcp" in cfg:
        servers: list[dict[str, str | list[dict[str, str]]]] = []
        for entry in cfg.get("mcp") or []:
            if not isinstance(entry, dict):
                logger.error("Invalid MCP entry (expected dict), skipping: %r", entry)
                continue
            name = entry.get("name")
            if not isinstance(name, str) or not name.strip():
                logger.error(
                    "Missing or invalid 'name' in server entry: %r; skipping", entry
                )
                continue
            cmd_or_url = entry.get("url") or entry.get("cmd")
            if not isinstance(cmd_or_url, str) or not cmd_or_url.strip():
                logger.error(
                    "No 'url' or 'cmd' specified for server '%s'; skipping", name
                )
                continue
            stype = entry.get(
                "type",
                "sse" if cmd_or_url.startswith(("http://", "https://")) else "stdio",
            )
            tool_list = entry.get("tools", [])
            if not isinstance(tool_list, list):
                logger.error(
                    "Invalid tools list for server '%s': expected list, got %r; using empty list",
                    name,
                    tool_list,
                )
                tool_list = []
            # Extract placeholder API key names (list of strings) from config
            raw_keys = entry.get("api_keys") or []
            if isinstance(raw_keys, list):
                key_names = [k for k in raw_keys if isinstance(k, str) and k.strip()]
            else:
                logger.error(
                    "Invalid api_keys for server '%s': expected list, got %r; ignoring",
                    name,
                    raw_keys,
                )
                key_names = []
            servers.append(
                {
                    "name": name,
                    "url": cmd_or_url,
                    "server_type": stype,
                    "tools": tool_list,
                    "api_keys": key_names,
                }
            )
        settings.mcp_servers = servers
        logger.info("Preconfigured MCP servers: %r", settings.mcp_servers)
