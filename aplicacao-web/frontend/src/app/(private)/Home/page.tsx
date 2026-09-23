'use client';

import {
  Box,
  Typography,
  Stack,
  Grid,
  Button,
} from '@mui/material';
import SchoolIcon from '@mui/icons-material/School';
import ScienceIcon from '@mui/icons-material/Science';
import EmojiObjectsIcon from '@mui/icons-material/EmojiObjects';
import HubIcon from '@mui/icons-material/Hub';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import GraphBackground from '@/components/GraphBackground';

const ink = '#12182B';
const accent = 'rgb(254, 190, 0)';
const paper = '#FAFAF9';

const steps = [
  {
    icon: <TravelExploreIcon sx={{ fontSize: 28 }} />,
    title: 'Coleta',
    description: 'Agentes percorrem páginas web e redes sociais dos grupos PET em busca de atividades de ensino, pesquisa e extensão.',
  },
  {
    icon: <AccountTreeIcon sx={{ fontSize: 28 }} />,
    title: 'Estruturação',
    description: 'Os dados coletados são organizados segundo uma ontologia e armazenados em um banco de dados de grafos.',
  },
  {
    icon: <HubIcon sx={{ fontSize: 28 }} />,
    title: 'Consulta',
    description: 'A base torna-se consultável em linguagem natural, revelando padrões e comparações entre grupos.',
  },
];

export default function HomePage() {
  return (
    <Box sx={{ bgcolor: paper, minHeight: '100%' }}>
      {/* Hero */}
      <Box sx={{ position: 'relative', overflow: 'hidden', px: { xs: 3, md: 8 }, pt: { xs: 6, md: 9 }, pb: { xs: 5, md: 7 } }}>
        <GraphBackground />
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(to bottom, rgba(250,250,249,0) 55%, ${paper} 100%)`,
            pointerEvents: 'none',
          }}
        />

        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: { xs: 30, md: 42 }, color: ink, maxWidth: 640, lineHeight: 1.2, mb: 2 }}>
            Uma visão estruturada dos grupos PET do Brasil
          </Typography>
          <Typography sx={{ color: '#5B5B52', fontSize: 16, maxWidth: 560, mb: 4 }}>
            Consulte atividades de ensino, pesquisa e extensão a partir de uma base construída com ontologias e grafos de conhecimento.
          </Typography>

          <Box sx={{ maxWidth: 640 }}>
            <Typography sx={{ color: ink, fontWeight: 600, mb: 2 }}>
              Explore as atividades por categoria:
            </Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 4 }}>
              <Button
                variant="outlined"
                size="large"
                startIcon={<SchoolIcon />}
                sx={{
                  flex: 1,
                  color: ink,
                  borderColor: 'rgba(18,24,43,0.2)',
                  textTransform: 'none',
                  fontWeight: 600,
                  py: 1.5,
                  bgcolor: paper,
                  '&:hover': { borderColor: accent, bgcolor: 'rgba(254, 190, 0, 0.08)' },
                }}
              >
                Ensino
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<ScienceIcon />}
                sx={{
                  flex: 1,
                  color: ink,
                  borderColor: 'rgba(18,24,43,0.2)',
                  textTransform: 'none',
                  fontWeight: 600,
                  py: 1.5,
                  bgcolor: paper,
                  '&:hover': { borderColor: accent, bgcolor: 'rgba(254, 190, 0, 0.08)' },
                }}
              >
                Pesquisa
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<EmojiObjectsIcon />}
                sx={{
                  flex: 1,
                  color: ink,
                  borderColor: 'rgba(18,24,43,0.2)',
                  textTransform: 'none',
                  fontWeight: 600,
                  py: 1.5,
                  bgcolor: paper,
                  '&:hover': { borderColor: accent, bgcolor: 'rgba(254, 190, 0, 0.08)' },
                }}
              >
                Extensão
              </Button>
            </Stack>

            <Button
              variant="contained"
              size="large"
              onClick={() => console.log('Ir para tela de busca avançada')}
              sx={{
                bgcolor: ink,
                color: '#fff',
                textTransform: 'none',
                fontWeight: 600,
                px: 4,
                py: 1.5,
                '&:hover': { bgcolor: '#2a334a' },
              }}
            >
              Explorar toda a base de grafos
            </Button>
          </Box>
        </Box>
      </Box>

      {/* Como funciona */}
      <Box sx={{ bgcolor: ink, color: '#F6F4EF', px: { xs: 3, md: 8 }, py: { xs: 6, md: 8 } }}>
        <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: { xs: 24, md: 28 }, mb: 4 }}>
          Como a base é construída
        </Typography>
        <Grid container spacing={4}>
          {steps.map((step) => (
            <Grid size={{ xs: 12, md: 4 }} key={step.title}>
              <Box sx={{ color: accent, mb: 1.5 }}>{step.icon}</Box>
              <Typography sx={{ fontSize: 18, mb: 1 }}>{step.title}</Typography>
              <Typography sx={{ color: 'rgba(246,244,239,0.65)', fontSize: 14, lineHeight: 1.6 }}>
                {step.description}
              </Typography>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Box>
  );
}