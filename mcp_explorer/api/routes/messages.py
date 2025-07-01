from fastapi import APIRouter

from mcp_explorer.client.mcp_client import client
from mcp_explorer.models import MessageResponse

router = APIRouter()


@router.get("/messages", response_model=MessageResponse)
async def get_messages():
    """Get the conversation history"""
    return MessageResponse(messages=list(client.conversation_history))


@router.post("/reset-messages")
async def reset_messages():
    """Reset the conversation history"""
    client.conversation_history.clear()
    return {"status": "success", "message": "Conversation history has been reset"}