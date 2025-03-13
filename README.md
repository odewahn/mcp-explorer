uv run client.py http://localhost:8080/sse --api

Once running, you can::

# Send a message

```
curl -X POST http://localhost:8000/query -H "Content-Type: application/json" -d \
'{"text":"Find the top authors on oreilly who write about ai. List their names and the titles of their top books along with links."}'
```

# Get message history

```
curl http://localhost:8000/messages
```

# Call a tool:

```bash
curl -X POST http://0.0.0.0:8000/call-tool \
   -H "Content-Type: application/json" \
   -d '{
      "tool_name": "search_content",
      "tool_args": { "query": "python" }}'
```
