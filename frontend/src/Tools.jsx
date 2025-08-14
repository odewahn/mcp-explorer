import React, { useState, useEffect } from "react";
import {
  Box,
  Grid,
  Typography,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
} from "@mui/material";

import ServerTree from "./ServerTree";
import ToolDetail from "./ToolDetail";
import { useServers } from "./contexts/ServersContext";
import { useToolOverrides } from "./contexts/ToolOverrideContext";
import { useApiKeys } from "./contexts/ApiKeysContext";
import { API_BASE_URL } from "./apiConfig";
import ApiKeysDialog from "./ApiKeysDialog";

export default function Tools() {
  const { servers, tools, loading, refresh } = useServers();
  const { renameServer } = useToolOverrides();
  const { apiKeys, setApiKeys, renameServerApiKeys } = useApiKeys();

  // Selection & expansion state
  const [selectedServer, setSelectedServer] = useState(null);
  const [selectedTool, setSelectedTool] = useState(null);

  // Add-server dialog state
  const [openAdd, setOpenAdd] = useState(false);
  const [newServer, setNewServer] = useState({
    name: "",
    url: "http://localhost:8192/sse",
    server_type: "sse",
  });
  const [adding, setAdding] = useState(false);

  // API-keys dialog state
  const [openApiKeys, setOpenApiKeys] = useState(false);
  const [apiKeysServer, setApiKeysServer] = useState(null);

  // Auto-select first server/tool on load
  useEffect(() => {
    if (!selectedServer && servers.length > 0) {
      const first = servers[0].name;
      setSelectedServer(first);
      const list = tools.filter((t) => t.server === first);
      if (list.length) setSelectedTool(list[0].name);
    }
  }, [servers, tools]);

  // Group tools by server for tree and detail lookup
  const toolsByServer = tools.reduce((acc, t) => {
    (acc[t.server] = acc[t.server] || []).push(t);
    return acc;
  }, {});

  // Add a new server via API
  const handleAddServer = async () => {
    if (!newServer.url.trim()) return;
    setAdding(true);
    try {
      const resp = await fetch(`${API_BASE_URL}/add-tool-server`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newServer),
      });
      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.detail || "Failed to add server");
      }
      await refresh();
      setOpenAdd(false);
      setNewServer({ name: "", url: "", server_type: "sse" });
    } catch (e) {
      alert(`Error adding server: ${e.message}`);
    } finally {
      setAdding(false);
    }
  };

  // Remove a server via API
  const handleRemoveServer = async (srv) => {
    try {
      const resp = await fetch(`${API_BASE_URL}/tool-server/${srv}`, { method: "DELETE" });
      if (!resp.ok) throw new Error((await resp.json()).detail || "Failed to remove server");
      await refresh();
      if (srv === selectedServer) setSelectedServer(null), setSelectedTool(null);
    } catch (e) {
      alert(`Error removing server: ${e.message}`);
    }
  };

  const [openRename, setOpenRename] = useState(false);
  const [renameOldServer, setRenameOldServer] = useState(null);
  const [renameNewName, setRenameNewName] = useState("");

  const handleOpenRename = (srv) => {
    setRenameOldServer(srv);
    setRenameNewName(srv);
    setOpenRename(true);
  };
  const handleOpenApiKeys = (srv) => {
    setApiKeysServer(srv);
    setOpenApiKeys(true);
  };

  // Restart a server by deleting and re-adding it
  const handleRestartServer = async (srv) => {
    try {
      // Remove the server
      await fetch(`${API_BASE_URL}/tool-server/${encodeURIComponent(srv)}`, { method: "DELETE" });
      // Re-add with same config
      const srvInfo = servers.find((s) => s.name === srv);
      if (!srvInfo) throw new Error("Server info not found");
      const payload = {
        name: srv,
        url: srvInfo.url,
        server_type: srvInfo.url.startsWith("http") ? "sse" : "stdio",
      };
      const resp = await fetch(`${API_BASE_URL}/add-tool-server`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.detail || "Failed to restart server");
      }
      await refresh();
    } catch (e) {
      alert(`Error restarting server: ${e.message}`);
    }
  };
  const handleCloseRename = () => {
    setOpenRename(false);
    setRenameOldServer(null);
    setRenameNewName("");
  };
  const handleConfirmRename = async () => {
    if (!renameNewName.trim()) return;
    try {
      const resp = await fetch(
        `${API_BASE_URL}/tool-server/${renameOldServer}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ new_name: renameNewName }),
        }
      );
      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.detail || "Failed to rename server");
      }
      await refresh();
      // Update overrides and API-keys contexts to match the renamed server
      renameServer(renameOldServer, renameNewName);
      renameServerApiKeys(renameOldServer, renameNewName);
      if (selectedServer === renameOldServer) {
        setSelectedServer(renameNewName);
      }
      handleCloseRename();
    } catch (e) {
      alert(`Error renaming server: ${e.message}`);
    }
  };

  // API-keys dialog handlers
  const handleCloseApiKeys = () => {
    setOpenApiKeys(false);
    setApiKeysServer(null);
  };
  const handleConfirmApiKeys = async (srv, keysMap) => {
    try {
    const srvInfo = servers.find((s) => s.name === srv);
    if (!srvInfo) return;
    const payload = {
      name: srv,
      url: srvInfo.url,
      server_type: srvInfo.url.startsWith("http") ? "sse" : "stdio",
      api_keys: keysMap,
    };
    // Delete existing server so we can re-add it with new API keys
    await fetch(`${API_BASE_URL}/tool-server/${encodeURIComponent(srv)}`, {
      method: "DELETE",
    });
    const resp = await fetch(`${API_BASE_URL}/add-tool-server`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const data = await resp.json();
      throw new Error(data.detail || "Failed to restart server with API keys");
    }
    setApiKeys(srv, keysMap);
    await refresh();
    handleCloseApiKeys();
    } catch (e) {
      alert(`Error setting API keys: ${e.message}`);
    }
  };

  return (
    <Grid container spacing={2} sx={{ width: '95vw', mx: 'auto', height: '100%' }}>
      {/* 1/3 left column */}
      <Grid item xs={12} md={4}>
        <ServerTree
          servers={servers}
          toolsByServer={toolsByServer}
          loading={loading}
          selectedTool={selectedTool}
          onSelectTool={(srv, t) => {
            setSelectedServer(srv);
            setSelectedTool(t);
          }}
          onAddServer={() => setOpenAdd(true)}
          onRemoveServer={handleRemoveServer}
          onRenameServer={handleOpenRename}
          onEditApiKeys={handleOpenApiKeys}
          onRestartServer={handleRestartServer}
        />
        <Dialog open={openAdd} onClose={() => setOpenAdd(false)}>
          <DialogTitle>Add Tool Server</DialogTitle>
          <DialogContent>
            <DialogContentText>Enter MCP tool-server details:</DialogContentText>
            <FormControl fullWidth margin="dense">
              <InputLabel id="server-type-label">Server Type</InputLabel>
              <Select
                labelId="server-type-label"
                value={newServer.server_type}
                onChange={(e) =>
                  setNewServer((p) => ({
                    ...p,
                    server_type: e.target.value,
                    url:
                      e.target.value === 'stdio'
                        ? 'python -u stdio-server.py'
                        : p.url,
                  }))
                }
                label="Server Type"
              >
                <MenuItem value="sse">SSE</MenuItem>
                <MenuItem value="stdio">STDIO</MenuItem>
              </Select>
              <FormHelperText>
                {newServer.server_type === 'stdio'
                  ? 'Command for STDIO server'
                  : 'URL for SSE endpoint'}
              </FormHelperText>
            </FormControl>
            <TextField
              autoFocus
              margin="dense"
              label={
                newServer.server_type === 'stdio' ? 'Command' : 'URL'
              }
              fullWidth
              variant="outlined"
              multiline
              minRows={3}
              value={newServer.url}
              onChange={(e) =>
                setNewServer((p) => ({ ...p, url: e.target.value }))
              }
            />
            <TextField
              margin="dense"
              label="Server Name (optional)"
              fullWidth
              variant="outlined"
              value={newServer.name}
              onChange={(e) => setNewServer((p) => ({ ...p, name: e.target.value }))}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenAdd(false)}>Cancel</Button>
            <Button onClick={handleAddServer} disabled={adding} variant="contained">
              {adding ? 'Adding…' : 'Add'}
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog open={openRename} onClose={handleCloseRename}>
          <DialogTitle>Rename Server</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Enter a new name for server "{renameOldServer}"
            </DialogContentText>
            <TextField
              autoFocus
              margin="dense"
              label="New Server Name"
              fullWidth
              variant="outlined"
              value={renameNewName}
              onChange={(e) => setRenameNewName(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseRename}>Cancel</Button>
            <Button onClick={handleConfirmRename} variant="contained">
              Rename
            </Button>
          </DialogActions>
        </Dialog>
        {/* API Keys dialog */}
        <ApiKeysDialog
          open={openApiKeys}
          serverName={apiKeysServer}
          initialKeys={apiKeys?.[apiKeysServer] ?? {}}
          onSave={handleConfirmApiKeys}
          onClose={handleCloseApiKeys}
        />
      </Grid>

      {/* 2/3 right column */}
      <Grid item xs={12} md={8} sx={{ overflowY: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <CircularProgress />
          </Box>
        ) : selectedTool && selectedServer ? (
          <ToolDetail
            server={selectedServer}
            toolName={selectedTool}
            toolsByServer={toolsByServer}
          />
        ) : (
          <Typography>Select a tool on the left to view details and test.</Typography>
        )}
      </Grid>
    </Grid>
  );
}