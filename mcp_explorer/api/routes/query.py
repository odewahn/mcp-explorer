import logging

from fastapi import APIRouter, HTTPException, BackgroundTasks

from mcp_explorer.client.mcp_client import client
from mcp_explorer.models import Query

logger = logging.getLogger("mcp_explorer.api.routes.query")
router = APIRouter()


@router.post("/query", response_model=str)
async def process_query(query: Query, background_tasks: BackgroundTasks):
    """Process a query and return the response"""
    try:
        logger.info("Processing query with model: %s", query.model)
        logger.debug("System prompt: %s...", query.system_prompt[:100])
        logger.debug("Query text: %s...", query.text[:100])

        max_tool_calls = query.max_tool_calls
        logger.info("Max tool calls: %d", max_tool_calls)

        response = await client.process_query(
            query.system_prompt, query.text, query.model, max_tool_calls
        )
        logger.info("Query processed successfully, response length: %d", len(response))
        return response
    except Exception as e:
        logger.exception("Error processing query")
        raise HTTPException(status_code=500, detail=str(e))