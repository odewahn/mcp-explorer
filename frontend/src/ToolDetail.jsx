import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import AceEditor from 'react-ace';
import { JsonForms } from '@jsonforms/react';
import { materialRenderers, materialCells } from '@jsonforms/material-renderers';

// Ace editor modes/themes
import 'ace-builds/src-noconflict/mode-json';
import 'ace-builds/src-noconflict/mode-text';
import 'ace-builds/src-noconflict/theme-github';
import 'ace-builds/src-noconflict/theme-monokai';

import { useToolOverrides } from './contexts/ToolOverrideContext';

/**
 * ToolDetail: show description, override editor, JSON form and result.
 */
export default function ToolDetail({ server, toolName, toolsByServer }) {
  const { overrides, setOverride, markOverridesClean } = useToolOverrides();
  const tool = (toolsByServer[server] || []).find((t) => t.name === toolName) || {};

  const [formData, setFormData] = useState({});
  const [result, setResult] = useState('');
  const [error, setError] = useState(null);
  const [executing, setExecuting] = useState(false);

  // Reset form/result when switching tools
  useEffect(() => {
    setFormData({});
    setResult('');
    setError(null);
  }, [server, toolName]);

  const handleExecute = async () => {
    setExecuting(true);
    setError(null);
    try {
      const resp = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://0.0.0.0:8000'}/call-tool`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool_name: toolName, tool_args: formData }),
      });
      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.detail || 'Failed to execute tool');
      }
      const data = await resp.json();
      setResult(data.result);
    } catch (e) {
      setError(e.message);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <Box sx={{ flex: 1, height: 200, overflow: 'auto', border: 1, p: 1, borderRadius: 1 }}>
          <AceEditor
            mode="text"
            theme="github"
            name="orig-desc"
            value={tool.description || ''}
            readOnly
            width="100%"
            height="100%"
            setOptions={{ useWorker: false, wrap: true }}
          />
        </Box>
        <Box sx={{ flex: 1, height: 200 }}>
          <AceEditor
            mode="text"
            theme="github"
            name="override-desc"
            value={overrides[server]?.[toolName] || ''}
            onChange={(v) => setOverride(server, toolName, v)}
            width="100%"
            height="100%"
            setOptions={{ useWorker: false, wrap: true }}
          />
        </Box>
      </Box>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Input Parameters
        </Typography>
        <JsonForms
          schema={tool.input_schema}
          data={formData}
          renderers={materialRenderers}
          cells={materialCells}
          onChange={({ data }) => setFormData(data)}
        />
      </Box>
      <Box sx={{ mb: 2 }}>
        <Button
          variant="contained"
          onClick={handleExecute}
          disabled={executing}
          sx={{ textTransform: 'none' }}
        >
          {executing ? 'Executing...' : 'Execute Tool'}
        </Button>
      </Box>
      {error && (
        <Dialog open onClose={() => setError(null)}>
          <DialogTitle>Error</DialogTitle>
          <DialogContent>
            <DialogContentText>{error}</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setError(null)}>Close</Button>
          </DialogActions>
        </Dialog>
      )}
      {result && (
        <Box>
          <Typography variant="h6" gutterBottom>
            Result
          </Typography>
          <AceEditor
            mode="json"
            theme="github"
            name="result-view"
            value={result}
            readOnly
            width="100%"
            height="480px"
            setOptions={{ useWorker: false, wrap: true }}
          />
        </Box>
      )}
    </Box>
  );
}