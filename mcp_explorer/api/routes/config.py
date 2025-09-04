from fastapi import APIRouter, HTTPException
import logging
from mcp_explorer.config import settings
import mcp_explorer.config as cfg
from mcp_explorer.models import (
    ConfigResponse,
    InitialMessageRequest,
    ModelRequest,
)

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
        initial_message=settings.initial_message,
        model=settings.default_model,
        mcp=settings.mcp_servers,
    )
    logger.debug("/config returning: %r", response)
    return response


@router.patch("/config/initial-message", response_model=ConfigResponse)
async def update_initial_message(req: InitialMessageRequest):
    """Update the initial user message in-memory and return updated config."""
    settings.initial_message = req.initial_message
    response = ConfigResponse(
        prompt=settings.default_system_prompt,
        initial_message=settings.initial_message,
        model=settings.default_model,
        mcp=settings.mcp_servers,
    )
    return response


@router.patch("/config/model", response_model=ConfigResponse)
async def update_model(req: ModelRequest):
    """Update the LLM model in-memory and return updated config."""
    settings.default_model = req.model
    return ConfigResponse(
        prompt=settings.default_system_prompt,
        initial_message=settings.initial_message,
        model=settings.default_model,
        mcp=settings.mcp_servers,
    )
