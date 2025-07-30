from fastapi import APIRouter, HTTPException
import logging
from mcp_explorer.config import settings
import mcp_explorer.config as cfg
from mcp_explorer.models import ConfigResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/config", response_model=ConfigResponse)
async def get_config():
    """
    Return the processed explorer-config.yaml: prompt and MCP server configs.
    """
    if cfg.user_config is None:
        logger.warning("/config requested but no config loaded")
        raise HTTPException(status_code=404, detail="No config loaded")
    response = ConfigResponse(
        prompt=settings.default_system_prompt,
        mcp=settings.mcp_servers,
    )
    logger.debug("/config returning: %r", response)
    return response
