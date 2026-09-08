'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image'; // 1. Importando o componente Image
import logo from '@/logo.png'; // 2. Importando a sua imagem da pasta src
import { useAuth } from '@/contexts/AuthContext';
import { AppBar, Toolbar, Box, Typography, Button, styled } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';

const ink = '#12182B';
const accent = 'rgb(254, 190, 0)';

const navItems = [
  { label: 'Home', href: '/Home' }, 
  { label: 'Buscar', href: '/Buscar' },
  { label: 'Cadastro', href: '/Cadastro' },
];

const NavLink = styled(Link, {
  shouldForwardProp: (prop) => prop !== 'active',
})<{ active?: boolean }>(({ active }) => ({
  textDecoration: 'none',
  color: active ? ink : '#6B7280',
  fontWeight: active ? 600 : 500,
  fontSize: '0.9rem',
  padding: '8px 4px',
  marginRight: 28,
  position: 'relative',
  transition: 'color 0.15s ease',
  '&:hover': { color: ink },
  '&::after': {
    content: '""',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0, 
    height: 3,
    borderRadius: '2px 2px 0 0',
    backgroundColor: active ? accent : 'transparent',
  },
}));

export default function Header() {
  const auth = useAuth();
  const pathname = usePathname();

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{ bgcolor: '#FFFFFF', color: ink, borderBottom: '1px solid rgba(18, 24, 43, 0.08)' }}
    >
      <Toolbar sx={{ height: 64, px: { xs: 2, md: 4 } }}>
        
        {/* 3. Nova estrutura do Logo com a Imagem */}
        <Box 
          component={Link} 
          href="/Home" 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            mr: 6, // Mantém a margem à direita que existia antes
            textDecoration: 'none' 
          }}
        >
          <Image 
            src={logo} 
            alt="Logo do Console" 
            style={{ 
              height: '32px', // Você pode aumentar ou diminuir esse valor para ajustar o tamanho na barra
              width: 'auto'   // Mantém a proporção da imagem
            }} 
          />
        </Box>

        <Box sx={{ display: 'flex', flexGrow: 1, alignItems: 'center' }}>
          {navItems.map((item) => (
            <NavLink key={item.href} href={item.href} active={pathname === item.href}>
              {item.label}
            </NavLink>
          ))}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="caption" sx={{ color: '#6B7280', display: { xs: 'none', md: 'block' }, fontWeight: 500 }}>
            {auth.user?.name ?? auth.user?.email}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            endIcon={<LogoutIcon sx={{ fontSize: 18 }} />}
            onClick={() => auth.signoutRedirect()}
            sx={{
              color: ink,
              borderColor: 'rgba(18, 24, 43, 0.2)',
              textTransform: 'none',
              fontWeight: 600,
              '&:hover': { borderColor: ink, bgcolor: 'rgba(18, 24, 43, 0.04)' },
            }}
          >
            Sair
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
}