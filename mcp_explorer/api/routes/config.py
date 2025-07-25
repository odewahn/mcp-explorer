from fastapi import APIRouter, HTTPException
import logging
from mcp_explorer.config import settings
import mcp_explorer.config as cfg

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/config")
async def get_config():
    """
    Return the processed explorer-config: prompt and MCP server specs.
    """
    if cfg.user_config is None:
        logger.warning("/config requested but no config loaded")
        raise HTTPException(status_code=404, detail="No config loaded")
    payload = {"prompt": settings.default_system_prompt, "mcp": settings.mcp_servers}
    logger.debug("/config returning: %r", payload)
    return payload
