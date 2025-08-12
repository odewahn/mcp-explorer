from fastapi import APIRouter

from mcp_explorer.client.mcp_client import client
from mcp_explorer.models import MessageResponse
from mcp_explorer.config import settings

router = APIRouter()


@router.get("/messages", response_model=MessageResponse)
async def get_messages():
    """Get the conversation history"""
    # If no messages yet, seed the initial user prompt from config
    if not client.conversation_history and settings.initial_message:
        client.conversation_history.append({"role": "user", "content": settings.initial_message})
    return MessageResponse(messages=list(client.conversation_history))


@router.post("/reset-messages")
async def reset_messages():
    """Reset the conversation history"""
    client.conversation_history.clear()
    # Seed initial message on reset as well
    if settings.initial_message:
        client.conversation_history.append({"role": "user", "content": settings.initial_message})
    return {"status": "success", "message": "Conversation history has been reset"}