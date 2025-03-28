from .base import MCPServerConnection
from .sse import SSEServerConnection
from .stdio import STDIOServerConnection

__all__ = ["MCPServerConnection", "SSEServerConnection", "STDIOServerConnection"]

# Add a function to create a test STDIO server file
def create_test_stdio_server(filename="test_stdio_server.py"):
    """
    Create a simple test STDIO server file that can be used for testing
    the STDIO connection implementation.
    
    Args:
        filename: The name of the file to create
        
    Returns:
        The path to the created file
    """
    import os
    
    server_code = '''
import json
import sys
import time

def main():
    """Simple STDIO MCP server for testing"""
    print("Server starting...", file=sys.stderr)
    
    while True:
        try:
            # Read a line from stdin
            line = sys.stdin.readline()
            if not line:
                print("Received EOF, exiting", file=sys.stderr)
                break
                
            # Parse the JSON message
            message = json.loads(line)
            print(f"Received message: {message}", file=sys.stderr)
            
            # Process the message based on its type
            if message.get("type") == "initialize":
                response = {"type": "initialize_response", "status": "ok"}
                print(json.dumps(response))
                sys.stdout.flush()
                
            elif message.get("type") == "list_tools":
                # Return a list of dummy tools
                tools = [
                    {
                        "name": "echo",
                        "description": "Echo back the input",
                        "input_schema": {
                            "type": "object",
                            "properties": {
                                "text": {"type": "string", "description": "Text to echo"}
                            },
                            "required": ["text"]
                        }
                    },
                    {
                        "name": "add",
                        "description": "Add two numbers",
                        "input_schema": {
                            "type": "object",
                            "properties": {
                                "a": {"type": "number", "description": "First number"},
                                "b": {"type": "number", "description": "Second number"}
                            },
                            "required": ["a", "b"]
                        }
                    }
                ]
                response = {"type": "list_tools_response", "tools": tools}
                print(json.dumps(response))
                sys.stdout.flush()
                
            elif message.get("type") == "call_tool":
                tool_name = message.get("tool_name")
                tool_args = message.get("tool_args", {})
                
                result = ""
                if tool_name == "echo":
                    result = tool_args.get("text", "")
                elif tool_name == "add":
                    a = tool_args.get("a", 0)
                    b = tool_args.get("b", 0)
                    result = str(a + b)
                else:
                    result = f"Unknown tool: {tool_name}"
                
                response = {"type": "call_tool_response", "result": result}
                print(json.dumps(response))
                sys.stdout.flush()
                
            elif message.get("type") == "terminate":
                print("Received terminate message, exiting", file=sys.stderr)
                break
                
            else:
                print(f"Unknown message type: {message.get('type')}", file=sys.stderr)
                
        except json.JSONDecodeError as e:
            print(f"Error decoding JSON: {e}", file=sys.stderr)
        except Exception as e:
            print(f"Error processing message: {e}", file=sys.stderr)
            import traceback
            print(traceback.format_exc(), file=sys.stderr)

if __name__ == "__main__":
    main()
'''
    
    with open(filename, 'w') as f:
        f.write(server_code)
    
    return os.path.abspath(filename)
