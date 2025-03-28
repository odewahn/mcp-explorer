import { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Paper, 
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Alert,
  Chip,
  Tooltip
} from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import TerminalIcon from '@mui/icons-material/Terminal';
import AceEditor from 'react-ace';
import { JsonForms } from '@jsonforms/react';
import { materialRenderers, materialCells } from '@jsonforms/material-renderers';

// Import ace modes
import 'ace-builds/src-noconflict/mode-json';
import 'ace-builds/src-noconflict/theme-github';
import 'ace-builds/src-noconflict/theme-monokai';

function ToolTester() {
  const [selectedTool, setSelectedTool] = useState('');
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({});
  const [schema, setSchema] = useState({});
  const [result, setResult] = useState('');
  const [error, setError] = useState(null);
  const [executing, setExecuting] = useState(false);
  const [servers, setServers] = useState([]);

  // Fetch tools and servers on component mount and check for preselected tool
  useEffect(() => {
    Promise.all([fetchTools(), fetchServers()]).then(() => {
      // Check if a tool was selected from the tool list
      const preselectedTool = sessionStorage.getItem('selectedTool');
      if (preselectedTool) {
        setSelectedTool(preselectedTool);
        // Clear the storage after using it
        sessionStorage.removeItem('selectedTool');
      }
    });
  }, []);

  const fetchServers = async () => {
    try {
      const response = await fetch('http://0.0.0.0:8000/tool-servers');
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      setServers(data.servers);
      return data.servers;
    } catch (error) {
      console.error('Error fetching servers:', error);
      return [];
    }
  };

  const fetchTools = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://0.0.0.0:8000/tools');
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      setTools(data.tools);
      setLoading(false);
      return data.tools;
    } catch (error) {
      console.error('Error fetching tools:', error);
      setError(error.message);
      setLoading(false);
      return [];
    }
  };

  const handleToolChange = (event) => {
    const toolName = event.target.value;
    setSelectedTool(toolName);
    setFormData({});
    setResult('');
    setError(null);
    
    // Find the selected tool and set its schema
    const tool = tools.find(t => t.name === toolName);
    if (tool) {
      setSchema(tool.input_schema);
    }
  };

  // Effect to update form when selectedTool changes
  useEffect(() => {
    if (selectedTool) {
      const tool = tools.find(t => t.name === selectedTool);
      if (tool) {
        setSchema(tool.input_schema);
        setFormData({});
        setResult('');
        setError(null);
      }
    }
  }, [selectedTool, tools]);

  const handleFormChange = ({ data }) => {
    setFormData(data);
  };

  const executeToolCall = async () => {
    if (!selectedTool) {
      setError('Please select a tool first');
      return;
    }

    try {
      setExecuting(true);
      setError(null);
      
      const response = await fetch('http://0.0.0.0:8000/call-tool', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tool_name: selectedTool,
          tool_args: formData
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to execute tool');
      }

      const data = await response.json();
      setResult(data.result);
    } catch (error) {
      console.error('Error executing tool:', error);
      setError(error.message);
    } finally {
      setExecuting(false);
    }
  };

  if (loading && tools.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Helper function to determine server type
  const getServerType = (serverName) => {
    const server = servers.find(s => s.name === serverName);
    if (!server) return 'SSE'; // Default
    
    // Check if the URL looks like a command (no http/https)
    if (server.url && !server.url.startsWith('http')) {
      return 'STDIO';
    }
    return 'SSE';
  };

  return (
    <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 500, color: '#333' }}>
        Tool Tester
      </Typography>
      <Typography variant="body1" paragraph sx={{ color: '#666' }}>
        Test tools directly by selecting a tool and filling out the form.
      </Typography>

      <Paper 
        elevation={0} 
        sx={{ 
          p: 3, 
          mb: 3, 
          border: '1px solid #e0e0e0',
          borderRadius: '4px',
          backgroundColor: '#ffffff',
          flexGrow: 1,
          overflow: 'auto'
        }}
      >
        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel id="tool-select-label">Select Tool</InputLabel>
          <Select
            labelId="tool-select-label"
            id="tool-select"
            value={selectedTool}
            label="Select Tool"
            onChange={handleToolChange}
          >
            {tools.map((tool) => (
              <MenuItem key={tool.name} value={tool.name}>
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
                  <span>{tool.name}</span>
                  <Tooltip title={getServerType(tool.server)}>
                    <Chip 
                      size="small" 
                      label={tool.server} 
                      icon={getServerType(tool.server) === 'STDIO' ? <TerminalIcon fontSize="small" /> : <StorageIcon fontSize="small" />}
                      sx={{ ml: 1 }}
                    />
                  </Tooltip>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {selectedTool && (
          <>
            <Typography variant="h6" gutterBottom>
              Input Parameters
            </Typography>
            <Box sx={{ mb: 3 }}>
              <JsonForms
                schema={schema}
                data={formData}
                renderers={materialRenderers}
                cells={materialCells}
                onChange={handleFormChange}
              />
            </Box>
            <Button
              variant="contained"
              color="primary"
              onClick={executeToolCall}
              disabled={executing}
              sx={{ 
                mb: 2,
                padding: '8px 16px',
                textTransform: 'none',
                fontWeight: 500
              }}
            >
              {executing ? <CircularProgress size={24} /> : 'Execute Tool'}
            </Button>
          </>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
            {error}
          </Alert>
        )}

        {result && (
          <>
            <Divider sx={{ my: 3 }} />
            <Typography variant="h6" gutterBottom>
              Result
            </Typography>
            <AceEditor
              mode="json"
              theme="github"
              name="result-editor"
              value={result}
              readOnly={true}
              width="100%"
              height="300px"
              fontSize={14}
              showPrintMargin={false}
              showGutter={true}
              highlightActiveLine={true}
              setOptions={{
                useWorker: false,
                showLineNumbers: true,
                tabSize: 2,
                wrap: true,
              }}
              style={{
                maxHeight: '40vh',
                overflow: 'auto'
              }}
            />
          </>
        )}
      </Paper>
    </Box>
  );
}

export default ToolTester;
