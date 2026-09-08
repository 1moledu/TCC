'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import NextLink from 'next/link';
import {
  Box,
  TextField,
  Typography,
  Button,
  InputAdornment,
  IconButton,
  CircularProgress,
  Link as MuiLink,
  Alert,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

const ink = '#12182B';
const paper = '#F6F4EF';
const accent = 'rgb(254, 190, 0)';
const accentHover = '#E5AB00';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Preencha e-mail e senha para continuar.');
      return;
    }

    setLoading(true);
    try {
      // TODO: substituir pela chamada real de autenticação
      await new Promise((resolve) => setTimeout(resolve, 900));
      router.push('/Home');
    } catch {
      setError('Não foi possível entrar. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, minHeight: '100vh' }}>
      {/* Painel de marca */}
      <Box
        sx={{
          bgcolor: ink,
          color: paper,
          flex: { xs: '0 0 auto', md: '0 0 42%' },
          display: 'flex',
          flexDirection: 'column',
          justifyContent: { xs: 'center', md: 'space-between' },
          px: { xs: 3, md: 8 },
          py: { xs: 4, md: 8 },
        }}
      >
        <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: { xs: 22, md: 26 } }}>
          Console
        </Typography>

        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
          <Box sx={{ width: 40, height: 4, bgcolor: accent, borderRadius: 2, mb: 3 }} />
          <Typography
            sx={{
              fontFamily: 'var(--font-display)',
              fontSize: { md: 40, lg: 46 },
              lineHeight: 1.15,
              maxWidth: 420,
              mb: 3,
            }}
          >
            Tudo o que sua equipe precisa, em um só lugar.
          </Typography>
          <Typography sx={{ color: 'rgba(246,244,239,0.65)', maxWidth: 360, fontSize: 15 }}>
            Acesse seus projetos, dados e ferramentas com uma conta segura e centralizada.
          </Typography>
        </Box>

        <Typography sx={{ display: { xs: 'none', md: 'block' }, color: 'rgba(246,244,239,0.45)', fontSize: 13 }}>
          © {new Date().getFullYear()} Sua Empresa
        </Typography>
      </Box>

      {/* Painel de formulário */}
      <Box
        sx={{
          flex: 1,
          bgcolor: paper,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 3,
          py: { xs: 6, md: 4 },
        }}
      >
        <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%', maxWidth: 360 }}>
          <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: 28, mb: 1, color: ink }}>
            Entrar
          </Typography>
          <Typography sx={{ color: '#6B7280', fontSize: 14, mb: 4 }}>
            Informe suas credenciais para acessar sua conta.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <TextField
            label="E-mail"
            type="email"
            fullWidth
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            sx={{ mb: 2.5 }}
          />

          <TextField
            label="Senha"
            type={showPassword ? 'text' : 'password'}
            fullWidth
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            sx={{ mb: 1 }}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword((prev) => !prev)}
                      edge="end"
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
            <MuiLink component={NextLink} href="/RecuperarSenha" underline="hover" sx={{ fontSize: 13, color: ink, fontWeight: 600 }}>
              Esqueceu a senha?
            </MuiLink>
          </Box>

          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={loading}
            sx={{
              bgcolor: accent,
              color: ink,
              py: 1.3,
              textTransform: 'none',
              fontSize: 15,
              fontWeight: 600,
              boxShadow: 'none',
              '&:hover': { bgcolor: accentHover, boxShadow: 'none' },
            }}
          >
            {loading ? <CircularProgress size={22} sx={{ color: ink }} /> : 'Entrar'}
          </Button>

          <Typography sx={{ mt: 4, fontSize: 14, color: '#6B7280', textAlign: 'center' }}>
            Não tem uma conta?{' '}
            <MuiLink component={NextLink} href="/Cadastro" underline="hover" sx={{ color: ink, fontWeight: 600 }}>
              Criar conta
            </MuiLink>
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}