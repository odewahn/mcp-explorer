import { useState, useEffect } from 'react';
import { 
  Typography, 
  Paper, 
  Box, 
  List, 
  ListItem, 
  ListItemText, 
  ListItemIcon,
  ListItemButton,
  Collapse,
  Divider,
  CircularProgress,
  TextField,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  IconButton,
  Alert,
  Snackbar,
  Tabs,
  Tab
} from '@mui/material';
import BuildIcon from '@mui/icons-material/Build';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CodeIcon from '@mui/icons-material/Code';
import StorageIcon from '@mui/icons-material/Storage';
import ToolTester from './ToolTester';

function Tools() {
  const [tools, setTools] = useState([]);
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [newServer, setNewServer] = useState({ name: '', url: '' });
  const [expandedTool, setExpandedTool] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [tabValue, setTabValue] = useState(0);

  // Fetch both tools and servers on component mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch tools
      const toolsResponse = await fetch('http://0.0.0.0:8000/tools');
      if (!toolsResponse.ok) {
        throw new Error(`HTTP error! Status: ${toolsResponse.status}`);
      }
      const toolsData = await toolsResponse.json();
      
      // Fetch servers
      const serversResponse = await fetch('http://0.0.0.0:8000/tool-servers');
      if (!serversResponse.ok) {
        throw new Error(`HTTP error! Status: ${serversResponse.status}`);
      }
      const serversData = await serversResponse.json();
      
      setTools(toolsData.tools);
      setServers(serversData.servers);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError(error.message);
      setLoading(false);
    }
  };

  const handleAddServer = async () => {
    if (!newServer.url) {
      setSnackbar({
        open: true,
        message: 'Server URL is required',
        severity: 'error'
      });
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('http://0.0.0.0:8000/add-tool-server', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newServer),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to add server');
      }

      setSnackbar({
        open: true,
        message: `Server ${newServer.name} added successfully`,
        severity: 'success'
      });
      setOpenDialog(false);
      setNewServer({ name: '', url: '' });
      
      // Show a message about auto-generated name if none was provided
      if (!newServer.name) {
        setSnackbar({
          open: true,
          message: 'Server added with auto-generated name',
          severity: 'info'
        });
      }
      
      // Refresh data
      await fetchData();
    } catch (error) {
      console.error('Error adding server:', error);
      setSnackbar({
        open: true,
        message: error.message,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveServer = async (serverName) => {
    try {
      setLoading(true);
      const response = await fetch(`http://0.0.0.0:8000/tool-server/${serverName}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Failed to remove server ${serverName}`);
      }

      setSnackbar({
        open: true,
        message: `Server ${serverName} removed successfully`,
        severity: 'success'
      });
      
      // Refresh data
      await fetchData();
    } catch (error) {
      console.error('Error removing server:', error);
      setSnackbar({
        open: true,
        message: error.message,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // Group tools by server
  const toolsByServer = tools.reduce((acc, tool) => {
    const server = tool.server || 'default';
    if (!acc[server]) {
      acc[server] = [];
    }
    acc[server].push(tool);
    return acc;
  }, {});

  if (loading && tools.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && tools.length === 0) {
    return (
      <Paper sx={{ p: 3, mt: 2, backgroundColor: '#ffebee' }}>
        <Typography variant="h6" color="error">Error loading tools</Typography>
        <Typography>{error}</Typography>
      </Paper>
    );
  }

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  return (
    <Box>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="tool tabs">
          <Tab label="Tool Servers" />
          <Tab label="Test Tools" />
        </Tabs>
      </Box>

      {tabValue === 0 ? (
        <Box>
          <Typography variant="h4" gutterBottom>
            Tool Servers
          </Typography>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="body1">
          Manage the tool servers that Claude can connect to.
        </Typography>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />} 
          onClick={() => setOpenDialog(true)}
          disabled={loading}
        >
          Add Server
        </Button>
      </Box>
      
      {/* Servers List */}
      <Paper elevation={2} sx={{ mb: 4 }}>
        <List>
          {servers.length === 0 ? (
            <ListItem>
              <ListItemText primary="No servers connected" />
            </ListItem>
          ) : (
            servers.map((server, index) => (
              <Box key={server.name}>
                <ListItem
                  secondaryAction={
                    server.name !== 'default' && (
                      <IconButton 
                        edge="end" 
                        aria-label="delete" 
                        onClick={() => handleRemoveServer(server.name)}
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
                  <ListItemText 
                    primary={server.name} 
                    secondary={server.url}
                    primaryTypographyProps={{ fontWeight: 'bold' }}
                  />
                </ListItem>
                {index < servers.length - 1 && <Divider />}
              </Box>
            ))
          )}
        </List>
      </Paper>

      <Typography variant="h4" gutterBottom>
        Available Tools
      </Typography>
      <Typography variant="body1" paragraph>
        These are the tools that Claude can use when responding to your queries.
      </Typography>
      
      {/* Tools List Grouped by Server */}
      {Object.entries(toolsByServer).map(([serverName, serverTools]) => (
        <Accordion key={serverName} sx={{ mb: 2 }} defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ fontWeight: 'bold' }}>
              {serverName} <Chip size="small" label={`${serverTools.length} tools`} sx={{ ml: 1 }} />
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <List sx={{ width: '100%', bgcolor: 'background.paper' }}>
              {serverTools.map((tool, index) => (
                <Box key={tool.name}>
                  <ListItemButton onClick={() => setExpandedTool(expandedTool === tool.name ? null : tool.name)}>
                    <ListItemIcon>
                      <BuildIcon />
                    </ListItemIcon>
                    <ListItemText 
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Typography sx={{ fontWeight: 'bold' }}>{tool.name}</Typography>
                          <Button 
                            size="small" 
                            variant="outlined" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setTabValue(1);
                              // Store the tool name in sessionStorage to be used by ToolTester
                              sessionStorage.setItem('selectedTool', tool.name);
                            }}
                          >
                            Test
                          </Button>
                        </Box>
                      }
                      secondary={tool.description}
                    />
                    <ExpandMoreIcon 
                      sx={{ 
                        transform: expandedTool === tool.name ? 'rotate(180deg)' : 'rotate(0)',
                        transition: '0.3s'
                      }} 
                    />
                  </ListItemButton>
                  <Collapse in={expandedTool === tool.name} timeout="auto" unmountOnExit>
                    <Box sx={{ pl: 4, pr: 2, pb: 2 }}>
                      <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                        <Typography variant="subtitle2" gutterBottom>
                          <CodeIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 1 }} />
                          Input Schema:
                        </Typography>
                        <pre style={{ 
                          overflowX: 'auto', 
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          fontSize: '0.875rem'
                        }}>
                          {JSON.stringify(tool.input_schema, null, 2)}
                        </pre>
                      </Paper>
                    </Box>
                  </Collapse>
                  {index < serverTools.length - 1 && <Divider />}
                </Box>
              ))}
            </List>
          </AccordionDetails>
        </Accordion>
      ))}

      {/* Add Server Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
        <DialogTitle>Add Tool Server</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Enter the URL of the MCP tool server you want to connect to.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            id="url"
            label="Server URL"
            type="url"
            fullWidth
            variant="outlined"
            value={newServer.url}
            onChange={(e) => setNewServer({ ...newServer, url: e.target.value })}
            placeholder="http://localhost:8080/sse"
            helperText="The URL should point to the SSE endpoint of the MCP server"
          />
          <TextField
            margin="dense"
            id="name"
            label="Server Name (Optional)"
            type="text"
            fullWidth
            variant="outlined"
            value={newServer.name}
            onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
            sx={{ mt: 2 }}
            helperText="Leave blank to auto-generate a name"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleAddServer} 
            variant="contained"
            disabled={loading || !newServer.url}
          >
            {loading ? <CircularProgress size={24} /> : 'Add Server'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={6000} 
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
        </Box>
      ) : (
        <ToolTester />
      )}
    </Box>
  );
}

export default Tools;
