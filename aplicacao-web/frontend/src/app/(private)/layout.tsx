import Header from '@/components/Header'; // Ajuste o caminho se necessário
import { Box } from '@mui/material';

export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* O Header só será renderizado nas rotas dentro de (private) */}
      <Header />
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        {children}
      </Box>
    </Box>
  );
}