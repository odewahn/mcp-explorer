"""
Query Processor Module

A clean, modular implementation for handling LLM interactions with MCP servers.
Can be dropped into existing codebases with minimal integration effort.
"""

from dataclasses import dataclass
from typing import List, Dict, Any, Optional, Protocol
import logging

# Configure logging
logger = logging.getLogger(__name__)


@dataclass
class ToolCallResult:
    """Represents the result of a tool call."""

    tool_name: str
    success: bool
    content: str
    error: Optional[str] = None


class ToolServerProtocol(Protocol):
    """Protocol for tool server connections - adapt this to your existing interface."""

    async def call_tool(self, tool_name: str, tool_args: Dict[str, Any]) -> Any:
        """Call a tool and return the result."""
        ...


class ConversationManager:
    """Handles conversation history management with proper tool call structure."""

    def __init__(self, initial_history: Optional[List[Dict[str, Any]]] = None):
        """Initialize with optional existing conversation history."""
        self.history: List[Dict[str, Any]] = initial_history or []

    def add_user_message(self, content: str) -> None:
        """Add a user message to conversation history."""
        self.history.append({"role": "user", "content": content})

    def add_assistant_message(self, content: str) -> None:
        """Add an assistant message to conversation history."""
        self.history.append({"role": "assistant", "content": content})

    def add_tool_call_message(
        self, tool_name: str, tool_args: Dict[str, Any], tool_id: str
    ) -> None:
        """Add a tool call message to conversation history."""
        self.history.append(
            {
                "role": "assistant",
                "content": [
                    {
                        "type": "tool_use",
                        "id": tool_id,
                        "name": tool_name,
                        "input": tool_args,
                    }
                ],
            }
        )

    def add_tool_result_message(
        self, tool_id: str, result_content: str, is_error: bool = False
    ) -> None:
        """Add a tool result message to conversation history."""
        self.history.append(
            {
                "role": "user",
                "content": [
                    {
                        "type": "tool_result",
                        "tool_use_id": tool_id,
                        "content": result_content,
                        "is_error": is_error,
                    }
                ],
            }
        )

    def get_messages(self) -> List[Dict[str, Any]]:
        """Get a copy of the conversation history."""
        return self.history.copy()

    def get_history(self) -> List[Dict[str, Any]]:
        """Get the raw conversation history (for external access)."""
        return self.history


class ToolManager:
    """Handles tool-related operations."""

    def __init__(self, available_tools: List[Dict], tool_servers: Dict[str, Dict]):
        """
        Initialize with tools and servers.

        Args:
            available_tools: List of tool definitions with 'server' field
            tool_servers: Dict mapping server names to server info (must have 'connection' key)
        """
        self.available_tools = available_tools
        self.tool_servers = tool_servers

    def clean_tools_for_api(self) -> List[Dict[str, Any]]:
        """Remove server field from tools for Anthropic API."""
        return [
            {
                "name": tool["name"],
                "description": tool["description"],
                "input_schema": tool["input_schema"],
            }
            for tool in self.available_tools
        ]

    def find_server_for_tool(self, tool_name: str) -> Optional[str]:
        """Find which server hosts the given tool."""
        for tool in self.available_tools:
            if tool["name"] == tool_name:
                return tool.get("server")
        return None

    async def execute_tool_call(
        self, tool_name: str, tool_args: Dict
    ) -> ToolCallResult:
        """Execute a tool call and return the result."""
        server_name = self.find_server_for_tool(tool_name)

        if not server_name or server_name not in self.tool_servers:
            return ToolCallResult(
                tool_name=tool_name,
                success=False,
                content="",
                error=f"Tool {tool_name} not found in any connected server",
            )

        try:
            connection = self.tool_servers[server_name]["connection"]
            result = await connection.call_tool(tool_name, tool_args)

            # Handle different result formats - adapt this to your result structure
            content = getattr(result, "content", str(result))

            return ToolCallResult(tool_name=tool_name, success=True, content=content)
        except Exception as e:
            logger.error(f"Error executing tool {tool_name}: {str(e)}")
            return ToolCallResult(
                tool_name=tool_name, success=False, content="", error=str(e)
            )


class ResponseProcessor:
    """Processes Claude API responses and handles tool calls."""

    def __init__(
        self, conversation_manager: ConversationManager, tool_manager: ToolManager
    ):
        self.conversation_manager = conversation_manager
        self.tool_manager = tool_manager

    async def process_response(
        self,
        response,
        anthropic_client,
        system_prompt: str,
        model: str,
        max_tokens: int = 4096,
    ) -> str:
        """
        Process the complete response from Claude, handling both text and tool calls.
        Returns only the final text response, with all tool calls properly stored as messages.
        """
        text_parts = []
        tool_calls_made = []

        # First pass: collect text content and identify tool calls
        for content_item in response.content:
            if content_item.type == "text":
                text_parts.append(content_item.text)
            elif content_item.type == "tool_use":
                tool_calls_made.append(content_item)

        # If there are text parts but also tool calls, add the text as an assistant message
        if text_parts:
            text_content = "\n".join(text_parts)
            self.conversation_manager.add_assistant_message(text_content)

        # If no tool calls, return the text content
        if not tool_calls_made:
            return "\n".join(text_parts) if text_parts else ""

        # Process each tool call separately
        for tool_call in tool_calls_made:
            await self._process_single_tool_call(tool_call)

        # After all tool calls are complete, get Claude's final response
        final_response = await self._get_final_response(
            anthropic_client, system_prompt, model, max_tokens
        )
        return final_response

    async def _process_single_tool_call(self, tool_call) -> None:
        """Process a single tool call and add it to conversation history."""
        tool_name = tool_call.name
        tool_args = tool_call.input
        tool_id = tool_call.id

        # Add the tool call to conversation history
        self.conversation_manager.add_tool_call_message(tool_name, tool_args, tool_id)

        # Execute the tool call
        tool_result = await self.tool_manager.execute_tool_call(tool_name, tool_args)

        # Add the tool result to conversation history
        if tool_result.success:
            self.conversation_manager.add_tool_result_message(
                tool_id, tool_result.content, is_error=False
            )
        else:
            error_content = tool_result.error or f"Tool {tool_name} failed"
            self.conversation_manager.add_tool_result_message(
                tool_id, error_content, is_error=True
            )

    async def _get_final_response(
        self, anthropic_client, system_prompt: str, model: str, max_tokens: int
    ) -> str:
        """Get Claude's final response after all tool calls are complete."""
        messages = self.conversation_manager.get_messages()

        try:
            response = anthropic_client.messages.create(
                model=model,
                system=system_prompt,
                max_tokens=max_tokens,
                messages=messages,
            )

            # Extract text content from the response
            final_text_parts = []
            for content_item in response.content:
                if content_item.type == "text":
                    final_text_parts.append(content_item.text)

            final_text = "\n".join(final_text_parts)

            # Add Claude's final response to conversation history
            if final_text:
                self.conversation_manager.add_assistant_message(final_text)

            return final_text

        except Exception as e:
            error_msg = f"Error in final API call: {str(e)}"
            logger.error(error_msg)
            self.conversation_manager.add_assistant_message(error_msg)
            return error_msg


class QueryProcessor:
    """
    Main class that orchestrates query processing.

    This is the primary interface - replace your existing process_query method
    with this class.
    """

    def __init__(
        self,
        anthropic_client,
        available_tools: List[Dict],
        tool_servers: Dict,
        existing_conversation: Optional[List[Dict]] = None,
    ):
        """
        Initialize the query processor.

        Args:
            anthropic_client: Your Anthropic client instance
            available_tools: List of available tools (with 'server' field)
            tool_servers: Dict of server name -> server info with 'connection'
            existing_conversation: Optional existing conversation history to continue
        """
        self.anthropic = anthropic_client
        self.conversation_manager = ConversationManager(existing_conversation)
        self.tool_manager = ToolManager(available_tools, tool_servers)
        self.response_processor = ResponseProcessor(
            self.conversation_manager, self.tool_manager
        )

    def get_conversation_history(self) -> List[Dict[str, Any]]:
        """Get the current conversation history."""
        return self.conversation_manager.get_history()

    def set_conversation_history(self, history: List[Dict[str, Any]]) -> None:
        """Set the conversation history (useful for continuing conversations)."""
        self.conversation_manager.history = history

    async def process_query(
        self,
        system_prompt: str,
        query: str,
        model: str = "claude-3-5-sonnet-20241022",
        max_tokens: int = 4096,
    ) -> str:
        """
        Process a query using Claude and available tools.

        Args:
            system_prompt: System prompt for Claude
            query: User query to process
            model: Claude model to use
            max_tokens: Maximum tokens for response

        Returns:
            Final text response from Claude (tool calls handled internally)
        """
        # Add user message to conversation
        self.conversation_manager.add_user_message(query)

        # Prepare tools for API call
        clean_tools = self.tool_manager.clean_tools_for_api()

        # Make initial API call
        try:
            response = await self._make_initial_api_call(
                system_prompt, model, clean_tools, max_tokens
            )
        except Exception as e:
            logger.error(f"ERROR in Anthropic API call: {str(e)}")
            raise

        # Process the complete response (including any tool calls)
        final_response = await self.response_processor.process_response(
            response, self.anthropic, system_prompt, model, max_tokens
        )

        return final_response

    async def _make_initial_api_call(
        self, system_prompt: str, model: str, clean_tools: List[Dict], max_tokens: int
    ):
        """Make the initial API call to Claude."""
        messages = self.conversation_manager.get_messages()

        logger.info(f"Making API call to Anthropic with model: {model}")
        logger.info(f"Number of available tools: {len(clean_tools)}")
        if clean_tools:
            logger.debug(f"Tool names: {[tool['name'] for tool in clean_tools]}")

        response = self.anthropic.messages.create(
            model=model,
            system=system_prompt,
            max_tokens=max_tokens,
            messages=messages,
            tools=clean_tools,
        )

        logger.info("Successfully received response from Anthropic API")
        return response


# Convenience function for simple integration
async def process_query_simple(
    anthropic_client,
    system_prompt: str,
    query: str,
    available_tools: List[Dict],
    tool_servers: Dict,
    model: str = "claude-3-5-sonnet-20241022",
    max_tokens: int = 4096,
    conversation_history: Optional[List[Dict]] = None,
) -> tuple[str, List[Dict]]:
    """
    Simple function interface for processing queries.

    Returns:
        (response_text, updated_conversation_history)
    """
    processor = QueryProcessor(
        anthropic_client, available_tools, tool_servers, conversation_history
    )
    response = await processor.process_query(system_prompt, query, model, max_tokens)
    return response, processor.get_conversation_history()
