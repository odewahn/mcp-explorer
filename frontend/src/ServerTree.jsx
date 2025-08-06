import React from "react";
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
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import StorageIcon from "@mui/icons-material/Storage";
import BuildIcon from "@mui/icons-material/Build";

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
}) {
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
                  sx={{ backgroundColor: 'grey.100' }}
                  secondaryAction={
                    srv.name !== "default" && (
                      <IconButton
                        edge="end"
                        onClick={() => onRemoveServer(srv.name)}
                        disabled={loading}
                      >
                        <DeleteIcon />
                      </IconButton>
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
