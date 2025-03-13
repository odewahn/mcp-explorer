import { useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Button, Box, Container } from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import BuildIcon from '@mui/icons-material/Build';
import App from './App';
import Tools from './Tools';

function AppWrapper() {
  const [activePage, setActivePage] = useState('chat');

  return (
    <BrowserRouter>
      <Box sx={{ flexGrow: 1 }}>
        <AppBar position="static">
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              Claude Client
            </Typography>
            <Button 
              color="inherit" 
              component={Link} 
              to="/"
              startIcon={<ChatIcon />}
              sx={{ 
                mr: 2,
                backgroundColor: activePage === 'chat' ? 'rgba(255, 255, 255, 0.15)' : 'transparent'
              }}
              onClick={() => setActivePage('chat')}
            >
              Chat
            </Button>
            <Button 
              color="inherit" 
              component={Link} 
              to="/tools"
              startIcon={<BuildIcon />}
              sx={{ 
                backgroundColor: activePage === 'tools' ? 'rgba(255, 255, 255, 0.15)' : 'transparent'
              }}
              onClick={() => setActivePage('tools')}
            >
              Tools
            </Button>
          </Toolbar>
        </AppBar>
        <Container sx={{ mt: 2, pb: 2 }}>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/tools" element={<Tools />} />
          </Routes>
        </Container>
      </Box>
    </BrowserRouter>
  );
}

export default AppWrapper;
