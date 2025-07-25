from fastapi import APIRouter

from mcp_explorer.api.routes.query import router as query_router
from mcp_explorer.api.routes.messages import router as messages_router
from mcp_explorer.api.routes.tools import router as tools_router
from mcp_explorer.api.routes.servers import router as servers_router
from mcp_explorer.api.routes.config import router as config_router

router = APIRouter()
router.include_router(query_router)
router.include_router(messages_router)
router.include_router(tools_router)
router.include_router(servers_router)
router.include_router(config_router)
