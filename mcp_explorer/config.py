import logging
try:
    from pydantic import BaseSettings
except ImportError:
    from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application configuration, loaded from environment or defaults."""

    # Anthropic model settings
    default_model: str = "claude-3-5-sonnet-20241022"
    default_system_prompt: str = (
        "You are Claude, an AI assistant. Be helpful, harmless, and honest."
    )
    max_tokens: int = 8192
    max_tool_calls: int = 5

    # Logging settings
    log_file: str = "mcp_explorer.log"
    log_level: str = "INFO"
    debug: bool = False

    class Config:
        env_file = ".env"


settings = Settings()


def configure_logging() -> None:
    """
    Configure root logger based on settings.
    """
    level = getattr(logging, settings.log_level.upper(), logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[logging.StreamHandler(), logging.FileHandler(settings.log_file)],
    )