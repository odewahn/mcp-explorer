import React, { useState } from "react";
import {
  Box,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  IconButton,
  Divider,
  Typography,
  Paper,
  Menu,
  MenuItem,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import StorageIcon from "@mui/icons-material/Storage";
import BuildIcon from "@mui/icons-material/Build";
import MoreVertIcon from "@mui/icons-material/MoreVert";

/**
 * ServerTree renders the "Add Server" button and a nested list of servers/tools.
 */
export default function ServerTree({
  servers,
  toolsByServer,
  loading,
  selectedTool,
  onSelectTool,
  onAddServer,
  onRemoveServer,
  onRenameServer,
  onEditApiKeys,
  onRestartServer,
}) {
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [menuServer, setMenuServer] = useState(null);

  const handleMenuOpen = (event, serverName) => {
    setMenuAnchorEl(event.currentTarget);
    setMenuServer(serverName);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setMenuServer(null);
  };
  return (
    <>
      <Box
        sx={{
          mb: 2,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onAddServer}
          disabled={loading}
          sx={{ textTransform: "none" }}
        >
          Add Server
        </Button>
      </Box>
      <Paper elevation={2} sx={{ mb: 3 }}>
        <List dense>
          {servers.length === 0 ? (
            <ListItem>
              <ListItemText primary="No servers connected" />
            </ListItem>
          ) : (
            servers.map((srv) => (
              <React.Fragment key={srv.name}>
                <ListItem
                  button
                  sx={{ backgroundColor: "grey.100" }}
                  secondaryAction={
                    srv.name !== "default" && (
                      <>
                        <IconButton
                          edge="end"
                          onClick={(e) => handleMenuOpen(e, srv.name)}
                          disabled={loading}
                        >
                          <MoreVertIcon />
                        </IconButton>
                        <Menu
                          anchorEl={menuAnchorEl}
                          open={Boolean(
                            menuAnchorEl && menuServer === srv.name
                          )}
                          onClose={handleMenuClose}
                        >
                          <MenuItem
                            onClick={() => {
                              onRenameServer(srv.name);
                              handleMenuClose();
                            }}
                          >
                            Rename
                          </MenuItem>
                          <MenuItem
                            onClick={() => {
                              onEditApiKeys(srv.name);
                              handleMenuClose();
                            }}
                          >
                            Add API Keys
                          </MenuItem>
                          <MenuItem
                            onClick={() => {
                              onRestartServer(srv.name);
                              handleMenuClose();
                            }}
                          >
                            Restart
                          </MenuItem>
                          <Divider />
                          <MenuItem
                            onClick={() => {
                              onRemoveServer(srv.name);
                              handleMenuClose();
                            }}
                            disabled={loading}
                          >
                            Delete
                          </MenuItem>
                        </Menu>
                      </>
                    )
                  }
                >
                  <ListItemIcon>
                    <StorageIcon />
                  </ListItemIcon>
                  <ListItemText primary={srv.name} secondary={srv.url} />
                </ListItem>
                <Divider />
                <List component="div" disablePadding dense>
                  {(toolsByServer[srv.name] || []).map((tool) => (
                    <ListItemButton
                      key={tool.name}
                      sx={{ pl: 4 }}
                      selected={selectedTool === tool.name}
                      onClick={() => onSelectTool(srv.name, tool.name)}
                    >
                      <ListItemIcon>
                        <BuildIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary={tool.name} />
                    </ListItemButton>
                  ))}
                </List>
                <Divider />
              </React.Fragment>
            ))
          )}
        </List>
      </Paper>
    </>
  );
}
