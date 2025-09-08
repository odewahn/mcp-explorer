import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  TextField,
  Box,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";

/**
 * Dialog to view/edit environment variable name/value pairs for a server.
 * Values are shown in a multiline text field.
 */
export default function EnvVarsDialog({
  open,
  serverName,
  initialVars = {},
  onSave,
  onClose,
}) {
  const [rows, setRows] = useState([]);

  // Initialize rows whenever dialog opens: use existing vars or a blank row
  useEffect(() => {
    if (!open) return;
    const init = Object.entries(initialVars).map(([k, v]) => ({ key: k, value: v }));
    setRows(init.length > 0 ? init : [{ key: "", value: "" }]);
  }, [open, initialVars]);

  const handleAddRow = () => setRows((r) => [...r, { key: "", value: "" }]);
  const handleRemoveRow = (idx) => setRows((r) => r.filter((_, i) => i !== idx));
  const handleChange = (idx, field, val) =>
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, [field]: val } : row)));

  const handleSave = () => {
    const map = {};
    rows.forEach(({ key, value }) => {
      if (key.trim()) map[key.trim()] = value;
    });
    onSave(serverName, map);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Environment Variables for {serverName}</DialogTitle>
      <DialogContent sx={{ maxHeight: '60vh', overflowY: 'auto' }} dividers>
        <List dense disablePadding>
          {rows.map((row, idx) => (
            <ListItem
              key={idx}
              secondaryAction={
                <IconButton edge="end" onClick={() => handleRemoveRow(idx)}>
                  <DeleteIcon />
                </IconButton>
              }
            >
              <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
                <TextField
                  label="Variable Name"
                  value={row.key}
                  onChange={(e) => handleChange(idx, 'key', e.target.value)}
                  fullWidth
                />
                <TextField
                  label="Value"
                  value={row.value}
                  onChange={(e) => handleChange(idx, 'value', e.target.value)}
                  fullWidth
                  multiline
                  minRows={3}
                />
              </Box>
            </ListItem>
          ))}
        </List>
        <Box sx={{ textAlign: 'center', mt: 1 }}>
          <Button startIcon={<AddIcon />} onClick={handleAddRow}>
            Add Variable
          </Button>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}