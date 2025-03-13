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
  Alert
} from '@mui/material';
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

  // Fetch tools on component mount and check for preselected tool
  useEffect(() => {
    fetchTools().then(() => {
      // Check if a tool was selected from the tool list
      const preselectedTool = sessionStorage.getItem('selectedTool');
      if (preselectedTool) {
        setSelectedTool(preselectedTool);
        // Clear the storage after using it
        sessionStorage.removeItem('selectedTool');
      }
    });
  }, []);

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

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Tool Tester
      </Typography>
      <Typography variant="body1" paragraph>
        Test tools directly by selecting a tool and filling out the form.
      </Typography>

      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
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
                {tool.name}
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
              sx={{ mb: 2 }}
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
            />
          </>
        )}
      </Paper>
    </Box>
  );
}

export default ToolTester;
