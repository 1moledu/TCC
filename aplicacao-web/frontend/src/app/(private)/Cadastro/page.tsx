'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  MenuItem,
  Container,
  Divider,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Snackbar,
  Alert,
  CircularProgress,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';

const ink = '#12182B';
const accent = 'rgb(254, 190, 0)';
const paperBg = '#FAFAF9';

const estados = [
  'Acre',
  'Alagoas',
  'Amapá',
  'Amazonas',
  'Bahia',
  'Ceará',
  'Distrito Federal',
  'Espírito Santo',
  'Goiás',
  'Maranhão',
  'Mato Grosso',
  'Mato Grosso do Sul',
  'Minas Gerais',
  'Pará',
  'Paraíba',
  'Paraná',
  'Pernambuco',
  'Piauí',
  'Rio de Janeiro',
  'Rio Grande do Norte',
  'Rio Grande do Sul',
  'Rondônia',
  'Roraima',
  'Santa Catarina',
  'São Paulo',
  'Sergipe',
  'Tocantins',
];

const areasOntologia = [
  { label: 'Ciência da Computação', value: 'ComputerScience' },
  { label: 'Engenharia', value: 'Engineering' },
  { label: 'Matemática', value: 'Mathematics' },
  { label: 'Física', value: 'Physics' },
  { label: 'Química', value: 'Chemistry' },
  { label: 'Biologia', value: 'Biology' },
  { label: 'Medicina', value: 'Medicine' },
  { label: 'Educação', value: 'Education' },
  { label: 'Economia', value: 'Economics' },
  { label: 'Arquitetura', value: 'Architecture' },
  { label: 'Direito', value: 'Law' },
  { label: 'Agricultura', value: 'Agriculture' },
  { label: 'Ciências Ambientais', value: 'EnvironmentalScience' },
  { label: 'Psicologia', value: 'Psychology' },
  { label: 'Linguística', value: 'Linguistics' },
  { label: 'Artes', value: 'Arts' },
  { label: 'Sociologia', value: 'Sociology' },
];

export default function CadastroPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    nome_grupo: '',
    tipo_grupo: '',
    universidade: '',
    estado: '',
    cidade: '',
    campos: '',
    titulo_atividade: '',
    tipo_atividade: '',
    area: '',
    data_inicio: '',
    data_fim: '',
    uri: '',
    descricao: '',
  });

  const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; type: 'success' | 'error' }>({
    open: false,
    message: '',
    type: 'success',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOpenConfirmDialog(true);
  };

  const handleConfirmSave = async () => {
    setIsSubmitting(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cadastrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok) {
        setSnackbar({ open: true, message: 'Atividade salva no Neo4j com sucesso!', type: 'success' });
        setOpenConfirmDialog(false);

        setFormData({
          nome_grupo: '',
          tipo_grupo: '',
          universidade: '',
          estado: '',
          cidade: '',
          campos: '',
          titulo_atividade: '',
          tipo_atividade: '',
          area: '',
          data_inicio: '',
          data_fim: '',
          uri: '',
          descricao: '',
        });

        setTimeout(() => {
          router.push('/Home');
        }, 2000);
      } else {
        setSnackbar({ open: true, message: `Erro: ${result.detail}`, type: 'error' });
        setOpenConfirmDialog(false);
      }
    } catch (error) {
      console.error('Erro na requisição:', error);
      setSnackbar({ open: true, message: 'Erro ao conectar com a API.', type: 'error' });
      setOpenConfirmDialog(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseSnackbar = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  return (
    <Box sx={{ bgcolor: paperBg, minHeight: '100%', py: { xs: 4, md: 6 } }}>
      <Container maxWidth="md">
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" sx={{ fontFamily: 'var(--font-display)', color: ink, fontWeight: 600, mb: 1 }}>
            Cadastro de Atividades
          </Typography>
          <Typography sx={{ color: '#5B5B52' }}>
            Preencha os dados abaixo para estruturar uma nova atividade na base de grafos do PET.
          </Typography>
        </Box>

        <Paper elevation={0} sx={{ p: { xs: 3, md: 5 }, borderRadius: 2, border: '1px solid rgba(18,24,43,0.12)' }}>
          <form onSubmit={handleFormSubmit}>

            <Typography variant="h6" sx={{ color: ink, fontWeight: 600, mb: 3 }}>Informações do Grupo</Typography>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Nome do Grupo" name="nome_grupo" value={formData.nome_grupo} onChange={handleChange} required /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField select fullWidth label="Tipo de Grupo" name="tipo_grupo" value={formData.tipo_grupo} onChange={handleChange} required>
                  <MenuItem value="Curso">Curso</MenuItem>
                  <MenuItem value="Institucional">Institucional</MenuItem>
                  <MenuItem value="Outro">Outro</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Universidade" name="universidade" value={formData.universidade} onChange={handleChange} required /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Campus (Campos)" name="campos" value={formData.campos} onChange={handleChange} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField select fullWidth label="Estado" name="estado" value={formData.estado} onChange={handleChange} required>
                  {estados.map((uf) => (
                    <MenuItem key={uf} value={uf}>{uf}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Cidade" name="cidade" value={formData.cidade} onChange={handleChange} required /></Grid>
            </Grid>

            <Divider sx={{ my: 5 }} />

            <Typography variant="h6" sx={{ color: ink, fontWeight: 600, mb: 3 }}>Detalhes da Atividade</Typography>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12 }}><TextField fullWidth label="Título da Atividade" name="titulo_atividade" value={formData.titulo_atividade} onChange={handleChange} required /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField select fullWidth label="Tipo de Atividade" name="tipo_atividade" value={formData.tipo_atividade} onChange={handleChange} required>
                  <MenuItem value="Ensino">Ensino</MenuItem>
                  <MenuItem value="Pesquisa">Pesquisa</MenuItem>
                  <MenuItem value="Extensão">Extensão</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField select fullWidth label="Área" name="area" value={formData.area} onChange={handleChange} required>
                  {areasOntologia.map((a) => (
                    <MenuItem key={a.value} value={a.value}>{a.label}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Data de Início" name="data_inicio" type="date" value={formData.data_inicio} onChange={handleChange} slotProps={{ inputLabel: { shrink: true } }} required /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Data de Fim" name="data_fim" type="date" value={formData.data_fim} onChange={handleChange} slotProps={{ inputLabel: { shrink: true } }} /></Grid>
              <Grid size={{ xs: 12 }}><TextField fullWidth label="URI (Link da Atividade)" name="uri" type="url" value={formData.uri} onChange={handleChange} placeholder="https://" /></Grid>
              <Grid size={{ xs: 12 }}><TextField fullWidth label="Descrição" name="descricao" multiline rows={4} value={formData.descricao} onChange={handleChange} /></Grid>
            </Grid>

            <Box sx={{ mt: 5, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                type="submit"
                variant="contained"
                size="large"
                startIcon={<SaveIcon />}
                sx={{ bgcolor: ink, color: '#fff', textTransform: 'none', fontWeight: 600, px: 4, '&:hover': { bgcolor: '#2a334a' } }}
              >
                Salvar
              </Button>
            </Box>
          </form>
        </Paper>
      </Container>

      <Dialog
        open={openConfirmDialog}
        onClose={() => !isSubmitting && setOpenConfirmDialog(false)}
        sx={{ '& .MuiDialog-paper': { borderRadius: 2, p: 1 } }}
      >
        <DialogTitle sx={{ color: ink, fontWeight: 600, pb: 1 }}>Confirmar Inclusão</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: '#5B5B52' }}>
            Tem certeza que deseja salvar esta atividade?
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setOpenConfirmDialog(false)}
            disabled={isSubmitting}
            sx={{ color: '#6B7280', fontWeight: 600, textTransform: 'none' }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmSave}
            disabled={isSubmitting}
            variant="contained"
            sx={{
              bgcolor: ink,
              color: '#fff',
              textTransform: 'none',
              fontWeight: 600,
              minWidth: 120,
              '&:hover': { bgcolor: '#2a334a' },
            }}
            autoFocus
          >
            {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Sim, Salvar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.type}
          variant="filled"
          sx={{
            width: '100%',
            bgcolor: snackbar.type === 'success' ? ink : undefined,
            color: '#fff',
            '& .MuiAlert-icon': {
              color: snackbar.type === 'success' ? accent : undefined,
            },
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}