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
  Typography,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";

/**
 * Dialog to add/edit API key name/value pairs for a server.
 * value fields are obfuscated (password input).
 */
export default function ApiKeysDialog({
  open,
  serverName,
  initialKeys = {},
  onSave,
  onClose,
}) {
  const [rows, setRows] = useState([]);

  // Initialize rows whenever dialog opens: use existing keys or a blank row
  useEffect(() => {
    if (!open) return;
    const init = Object.entries(initialKeys).map(([k, v]) => ({ key: k, value: v }));
    if (init.length > 0) {
      setRows(init);
    } else {
      setRows([{ key: "", value: "" }]);
    }
  }, [open, initialKeys]);

  const handleAddRow = () => setRows((r) => [...r, { key: "", value: "" }]);
  const handleRemoveRow = (idx) =>
    setRows((r) => r.filter((_, i) => i !== idx));
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
      <DialogTitle>API Keys for {serverName}</DialogTitle>
      <DialogContent>
        <List dense>
          {rows.map((row, idx) => (
            <ListItem key={idx} secondaryAction={
              <IconButton edge="end" onClick={() => handleRemoveRow(idx)}>
                <DeleteIcon />
              </IconButton>
            }>
              <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
                <TextField
                  label="Key Name"
                  value={row.key}
                  onChange={(e) => handleChange(idx, 'key', e.target.value)}
                  fullWidth
                />
                <TextField
                  label="Value"
                  type="password"
                  value={row.value}
                  onChange={(e) => handleChange(idx, 'value', e.target.value)}
                  fullWidth
                />
              </Box>
            </ListItem>
          ))}
        </List>
        <Box sx={{ textAlign: 'center', mt: 1 }}>
          <Button startIcon={<AddIcon />} onClick={handleAddRow}>
            Add Key
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