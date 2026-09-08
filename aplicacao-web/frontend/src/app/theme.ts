'use client';
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: { main: '#febe00' },
    background: { default: '#F6F4EF', paper: '#FFFFFF' },
  },
  typography: {
    fontFamily: 'var(--font-body), system-ui, sans-serif',
    h1: { fontFamily: 'var(--font-display), serif' },
    h2: { fontFamily: 'var(--font-display), serif' },
    h3: { fontFamily: 'var(--font-display), serif' },
    h4: { fontFamily: 'var(--font-display), serif' },
  },
  shape: { borderRadius: 4 },
});

export default theme;