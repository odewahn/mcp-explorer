from fastapi import APIRouter, HTTPException
from anthropic import Anthropic

from mcp_explorer.models import ModelsResponse

router = APIRouter()

_anthropic_client = Anthropic()


@router.get("/models", response_model=ModelsResponse)
def list_models():
    """List available Claude/Anthropic models from the API."""
    try:
        # Use the official models.list() page to get ModelInfo entries (with metadata)
        page = _anthropic_client.models.list()
        # Serialize each ModelInfo to a dict
        models = [m.model_dump() for m in page.data]
        return ModelsResponse(models=models)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))