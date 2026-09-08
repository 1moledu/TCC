'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  Box, Typography, TextField, InputAdornment, IconButton, Chip, Stack, Paper, Divider,
  Container, Button, Collapse, Autocomplete, ToggleButton, ToggleButtonGroup,
  CircularProgress, Alert, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Tabs, Tab, Grid
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CodeIcon from '@mui/icons-material/Code';
import ViewListIcon from '@mui/icons-material/ViewList';
import HubIcon from '@mui/icons-material/Hub';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import TerminalIcon from '@mui/icons-material/Terminal';
import FilterAltIcon from '@mui/icons-material/FilterAlt';

const InteractiveNvlWrapper = dynamic(
  () => import('@neo4j-nvl/react').then((mod) => mod.InteractiveNvlWrapper),
  { ssr: false }
);

const ink = '#12182B';
const accent = 'rgb(254, 190, 0)';
const paperBg = '#FAFAF9';
const NEO4J_COLORS = ['#ffc8c8', '#c8d4ff', '#c8ffdb', '#ffedc8', '#e8c8ff', '#ffd4b8', '#d4f0ff'];

const suggestedQueries = [
  'Quais atividades de pesquisa foram realizadas pelos grupos de engenharia de computação em 2026?',
  'Quais PETs realizaram atividades de extensão?',
  'Quais são as atividades PET de ensino feitas em Curitiba?',
];

const regioes = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'];
const areas = ['Engenharia de Computação', 'Ciência da Computação', 'Administração', 'Direito', 'Medicina'];
const categorias = ['Ensino', 'Pesquisa', 'Extensão'];

type Filters = { regioes: string[]; areas: string[]; categorias: string[]; ano: string; };
type ResultRow = Record<string, unknown>;
type GraphNode = { id: string; labels: string[]; caption: string; properties: Record<string, unknown> };
type GraphRel = { id: string; from: string; to: string; type: string };
type GrafoData = { nodes: GraphNode[]; relationships: GraphRel[] };

function formatarCelula(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '-';
  if (typeof valor === 'object') return JSON.stringify(valor);
  return String(valor);
}

function corPorLabel(label: string) {
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = label.charCodeAt(i) + ((hash << 5) - hash);
  return NEO4J_COLORS[Math.abs(hash) % NEO4J_COLORS.length];
}

// Grafo real, vindo do backend (nós/relacionamentos de verdade do Neo4j)
function paraNvl(grafo: GrafoData) {
  const nodes = grafo.nodes.map((n) => ({
    id: n.id,
    caption: n.caption,
    color: corPorLabel(n.labels[0] || 'Nó'),
    size: 6,
  }));
  const rels = grafo.relationships.map((r) => ({
    id: r.id,
    from: r.from,
    to: r.to,
    captions: [{ value: r.type }],
  }));
  return { nodes, rels };
}

// Fallback: quando a consulta só devolveu propriedades soltas (sem nós/relacionamentos),
// reconstrói uma aproximação a partir das colunas.
function heuristicoParaNvl(resultados: ResultRow[]) {
  const nodesMap = new Map<string, { id: string; caption: string; color: string }>();
  const rels: { id: string; from: string; to: string; captions: { value: string }[] }[] = [];

  resultados.forEach((row) => {
    const keys = Object.keys(row);
    if (keys.length === 0) return;
    const primaryKey = keys[0];
    const primaryVal = String(row[primaryKey] || 'N/A');
    const primaryId = `${primaryKey}:${primaryVal}`;
    if (!nodesMap.has(primaryId)) {
      nodesMap.set(primaryId, { id: primaryId, caption: primaryVal, color: corPorLabel(primaryKey) });
    }
    for (let i = 1; i < keys.length; i++) {
      const secKey = keys[i];
      const secVal = row[secKey];
      if (secVal === null || secVal === undefined || secVal === '') continue;
      const secValStr = typeof secVal === 'object' ? 'Objeto' : String(secVal);
      const secId = `${secKey}:${secValStr}`;
      if (!nodesMap.has(secId)) {
        nodesMap.set(secId, { id: secId, caption: secValStr, color: corPorLabel(secKey) });
      }
      rels.push({ id: `${primaryId}->${secId}`, from: primaryId, to: secId, captions: [{ value: secKey }] });
    }
  });

  return { nodes: Array.from(nodesMap.values()), rels };
}

export default function BuscarPage() {
  const [searchMode, setSearchMode] = useState(0); // 0 = NLP, 1 = Cypher, 2 = Filtros

  const [query, setQuery] = useState('');
  const [rawCypher, setRawCypher] = useState('');

  const [hasSearched, setHasSearched] = useState(false);
  const [showFilters, setShowFilters] = useState(false); // Usado apenas no modo 0
  const [filters, setFilters] = useState<Filters>({ regioes: [], areas: [], categorias: [], ano: '' });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<ResultRow[]>([]);
  const [cypherQuery, setCypherQuery] = useState('');
  const [showCypher, setShowCypher] = useState(false);
  const [copied, setCopied] = useState(false);

  const [viewMode, setViewMode] = useState<'table' | 'graph'>('table');
  const [grafoData, setGrafoData] = useState<GrafoData>({ nodes: [], relationships: [] });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  async function handleSearch() {
    setIsLoading(true);
    setError('');
    setHasSearched(true);
    setResults([]);
    setCypherQuery('');
    setShowCypher(false);
    setCopied(false);
    setGrafoData({ nodes: [], relationships: [] });
    setSelectedNodeId(null);

    try {
      let endpoint = '';
      let payload = {};

      if (searchMode === 0) {
        if (!query.trim()) { setIsLoading(false); setHasSearched(false); return; }
        endpoint = '/api/buscar';
        payload = { query, filters };
      } else if (searchMode === 1) {
        if (!rawCypher.trim()) { setIsLoading(false); setHasSearched(false); return; }
        endpoint = '/api/cypher';
        payload = { query: rawCypher };
      } else if (searchMode === 2) {
        endpoint = '/api/buscar-por-filtros';
        payload = filters;
      }

      const response = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Erro ao consultar o grafo.');

      setResults(data.resultados || []);
      setCypherQuery(data.cypher || '');
      setGrafoData(data.grafo || { nodes: [], relationships: [] });
    } catch (err) {
      console.error('Erro na busca:', err);
      setError(err instanceof Error ? err.message : 'Erro de conexão com a API.');
    } finally {
      setIsLoading(false);
    }
  }

  function handleClear() {
    setHasSearched(false);
    setResults([]);
    setCypherQuery('');
    setError('');
    setCopied(false);
    setGrafoData({ nodes: [], relationships: [] });
    setSelectedNodeId(null);
  }

  function handleCopyCypher() {
    navigator.clipboard.writeText(cypherQuery);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const activeFilterCount = filters.regioes.length + filters.areas.length + filters.categorias.length + (filters.ano ? 1 : 0);
  const tableHeaders = results.length > 0 ? Object.keys(results[0]) : [];

  const usandoGrafoReal = grafoData.nodes.length > 0;
  const nvlData = useMemo(
    () => (usandoGrafoReal ? paraNvl(grafoData) : heuristicoParaNvl(results)),
    [grafoData, results, usandoGrafoReal]
  );
  const nodeLookup = useMemo(() => new Map(grafoData.nodes.map((n) => [n.id, n])), [grafoData]);
  const selectedNode = selectedNodeId ? nodeLookup.get(selectedNodeId) : null;

  return (
    <Box sx={{ bgcolor: paperBg, minHeight: '100%', py: { xs: 4, md: 8 } }}>
      <Container maxWidth="md">

        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <Typography variant="h4" component="h1" sx={{ fontFamily: 'var(--font-display)', color: ink, mb: 1.5, fontWeight: 600 }}>
            Exploração Avançada
          </Typography>
          <Typography sx={{ color: '#5B5B52', fontSize: 16, maxWidth: 600, mx: 'auto' }}>
            Faça consultas em linguagem natural, estruturadas ou escreva queries Cypher nativas para explorar os dados.
          </Typography>
        </Box>

        {/* ABAS (TABS) */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs
            value={searchMode}
            onChange={(_, newValue) => setSearchMode(newValue)}
            centered
            sx={{ '& .MuiTabs-indicator': { backgroundColor: accent } }}
          >
            <Tab icon={<AutoAwesomeIcon fontSize="small" />} iconPosition="start" label="Linguagem Natural" sx={{ textTransform: 'none', fontWeight: 600, color: ink, '&.Mui-selected': { color: ink } }} />
            <Tab icon={<FilterAltIcon fontSize="small" />} iconPosition="start" label="Cypher Nativo" sx={{ textTransform: 'none', fontWeight: 600, color: ink, '&.Mui-selected': { color: ink } }} />
            <Tab icon={<TerminalIcon fontSize="small" />} iconPosition="start" label="Busca Guiada" sx={{ textTransform: 'none', fontWeight: 600, color: ink, '&.Mui-selected': { color: ink } }} />
          </Tabs>
        </Box>

        {/* MODO 0: LINGUAGEM NATURAL */}
        {searchMode === 0 && (
          <Box>
            <Paper elevation={0} sx={{ p: 0.5, borderRadius: 2, border: '1px solid rgba(18,24,43,0.12)', mb: 2 }}>
              <TextField
                fullWidth placeholder="Ex: Quais PETs realizaram atividades de ensino?" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} variant="outlined" disabled={isLoading}
                sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { border: 'none' }, fontSize: '1.05rem' } }}
                slotProps={{
                  input: {
                    startAdornment: <InputAdornment position="start"><AutoAwesomeIcon sx={{ color: accent, ml: 1 }} /></InputAdornment>,
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={handleSearch} disabled={isLoading} sx={{ bgcolor: ink, color: '#fff', borderRadius: 1.5, p: 1.5, mr: 0.5, '&:hover': { bgcolor: '#2a334a' } }}>
                          {isLoading ? <CircularProgress size={24} color="inherit" /> : <SearchIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Paper>

            <Collapse in={showFilters}>
               <FiltrosComponent filters={filters} setFilters={setFilters} />
            </Collapse>

            {!hasSearched && (
              <Box>
                <Typography variant="overline" sx={{ color: '#6B7280', fontWeight: 600, display: 'block', mb: 1.5, mt: 4, textAlign: 'center' }}>
                  Experimente perguntar
                </Typography>
                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
                  {suggestedQueries.map((q) => (
                    <Chip key={q} label={q} onClick={() => { setQuery(q); }} variant="outlined" sx={{ borderColor: 'rgba(18,24,43,0.15)', color: ink, bgcolor: '#fff', fontWeight: 500 }} />
                  ))}
                </Stack>
              </Box>
            )}
          </Box>
        )}

        {/* MODO 2: BUSCA GUIADA (FILTROS) */}
        {searchMode === 2 && (
          <Paper elevation={0} sx={{ p: 4, borderRadius: 2, border: '1px solid rgba(18,24,43,0.12)', bgcolor: '#fff' }}>
             <Typography sx={{ color: '#5B5B52', mb: 3 }}>
                Selecione os critérios abaixo. O sistema montará a consulta no grafo automaticamente para você.
             </Typography>

             <FiltrosComponent filters={filters} setFilters={setFilters} />

             <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
                <Button
                  variant="contained" onClick={handleSearch} disabled={isLoading}
                  startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : <SearchIcon />}
                  sx={{ bgcolor: ink, color: '#fff', fontWeight: 600, textTransform: 'none', px: 4, '&:hover': { bgcolor: '#2a334a' } }}
                >
                  Buscar no Grafo
                </Button>
              </Box>
          </Paper>
        )}

        {/* MODO 1: CYPHER NATIVO */}
        {searchMode === 1 && (
          <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid rgba(18,24,43,0.12)', mb: 2, bgcolor: '#1e1e1e' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <TextField
                fullWidth multiline minRows={3} placeholder="MATCH (n) RETURN n LIMIT 25" value={rawCypher} onChange={(e) => setRawCypher(e.target.value)} variant="outlined" disabled={isLoading}
                sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { border: 'none' }, color: '#d4d4d4', fontFamily: 'monospace', fontSize: '1rem' } }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                <Button
                  variant="contained" onClick={handleSearch} disabled={isLoading}
                  startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : <CodeIcon />}
                  sx={{ bgcolor: accent, color: ink, fontWeight: 600, textTransform: 'none', '&:hover': { bgcolor: '#e6ac00' } }}
                >
                  Executar Cypher
                </Button>
              </Box>
            </Box>
          </Paper>
        )}

        {/* ÁREA DE RESULTADOS */}
        {hasSearched && (
          <Box sx={{ mt: 6 }}>
             <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
              <Typography variant="h6" sx={{ color: ink, fontFamily: 'var(--font-display)' }}>
                {isLoading ? 'Executando...' : `${results.length} resultado${results.length === 1 ? '' : 's'} encontrado${results.length === 1 ? '' : 's'}`}
              </Typography>

              <Box sx={{ display: 'flex', gap: 2 }}>
                {cypherQuery && (
                  <Button size="small" startIcon={<CodeIcon />} onClick={() => setShowCypher(!showCypher)} sx={{ color: '#6B7280', textTransform: 'none' }}>
                    {showCypher ? 'Ocultar Cypher' : 'Ver Cypher'}
                  </Button>
                )}

                <ToggleButtonGroup value={viewMode} exclusive onChange={(_, val) => val && setViewMode(val)} size="small">
                  <ToggleButton value="table" sx={{ textTransform: 'none', px: 2 }}>
                    <ViewListIcon sx={{ mr: 1, fontSize: 18 }} /> Tabela
                  </ToggleButton>
                  <ToggleButton value="graph" sx={{ textTransform: 'none', px: 2 }}>
                    <HubIcon sx={{ mr: 1, fontSize: 18 }} /> Rede
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>
            </Box>

            <Collapse in={showCypher}>
              <Paper sx={{ position: 'relative', p: 2, pr: 6, bgcolor: '#1e1e1e', color: '#d4d4d4', mb: 2, borderRadius: 2, fontFamily: 'monospace', fontSize: '0.85rem' }}>
                {cypherQuery}
                <IconButton size="small" onClick={handleCopyCypher} sx={{ position: 'absolute', top: 8, right: 8, color: '#a0a0a0', '&:hover': { color: '#fff' } }}>
                  {copied ? <CheckIcon fontSize="small" color="success" /> : <ContentCopyIcon fontSize="small" />}
                </IconButton>
              </Paper>
            </Collapse>

            <Paper elevation={0} sx={{ border: '1px solid rgba(18,24,43,0.1)', borderRadius: 2, bgcolor: '#fff', minHeight: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>

              {isLoading && (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, p: 4 }}>
                  <CircularProgress sx={{ color: accent }} />
                  <Typography sx={{ color: '#6B7280' }}>Processando consulta no grafo...</Typography>
                </Box>
              )}

              {!isLoading && error && (
                <Alert severity="error" sx={{ width: '100%', m: 4 }}>{error}</Alert>
              )}

              {!isLoading && !error && results.length === 0 && (
                <Typography sx={{ color: '#6B7280', p: 4 }}>
                  A consulta foi executada, mas não retornou resultados.
                </Typography>
              )}

              {/* TABELA */}
              {!isLoading && !error && results.length > 0 && viewMode === 'table' && (
                <TableContainer sx={{ width: '100%', maxHeight: 500, p: 2 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        {tableHeaders.map((header) => (
                          <TableCell key={header} sx={{ fontWeight: 600, color: ink, bgcolor: paperBg, textTransform: 'capitalize' }}>
                            {header.replace(/_/g, ' ')}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {results.map((row, index) => (
                        <TableRow key={index} hover>
                          {tableHeaders.map((header) => (
                            <TableCell key={header}>{formatarCelula(row[header])}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {/* REDE */}
              {!isLoading && !error && results.length > 0 && viewMode === 'graph' && (
                <Box sx={{ width: '100%', height: 520, bgcolor: '#1e222d', position: 'relative' }}>
                  {!usandoGrafoReal && (
                    <Chip
                      label="Grafo aproximado (a consulta não retornou nós/relacionamentos)"
                      size="small"
                      sx={{ position: 'absolute', top: 12, left: 12, zIndex: 1, bgcolor: '#fff', fontWeight: 500 }}
                    />
                  )}
                  <InteractiveNvlWrapper
                    nodes={nvlData.nodes}
                    rels={nvlData.rels}
                    nvlOptions={{ layout: 'forceDirected', initialZoom: 0.9 }}
                    mouseEventCallbacks={{
                      onNodeClick: (node: any) => setSelectedNodeId(node.id),
                      onCanvasClick: () => setSelectedNodeId(null),
                    }}
                    style={{ width: '100%', height: '100%' }}
                  />
                  {selectedNode && (
                    <Paper sx={{ position: 'absolute', top: 12, right: 12, p: 2, maxWidth: 280, maxHeight: 400, overflow: 'auto' }}>
                      <Typography sx={{ fontWeight: 600, color: ink, mb: 0.5 }}>{selectedNode.caption}</Typography>
                      <Typography sx={{ fontSize: 12, color: '#6B7280', mb: 1.5 }}>{selectedNode.labels.join(', ')}</Typography>
                      <Divider sx={{ mb: 1.5 }} />
                      {Object.entries(selectedNode.properties).map(([chave, valor]) => (
                        <Typography key={chave} sx={{ fontSize: 13, mb: 0.5 }}>
                          <b>{chave}:</b> {formatarCelula(valor)}
                        </Typography>
                      ))}
                    </Paper>
                  )}
                </Box>
              )}

            </Paper>

            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Button variant="text" onClick={handleClear} sx={{ color: ink, textTransform: 'none', fontWeight: 600 }}>
                Limpar resultados
              </Button>
            </Box>
          </Box>
        )}
      </Container>
    </Box>
  );
}

// Subcomponente para renderizar os filtros sem repetir código
function FiltrosComponent({ filters, setFilters }: { filters: Filters, setFilters: any }) {
  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: ink, mb: 1 }}>Categoria da Atividade</Typography>
        <ToggleButtonGroup value={filters.categorias} onChange={(_, values) => setFilters((prev: any) => ({ ...prev, categorias: values }))} size="small" sx={{ '& .MuiToggleButton-root': { textTransform: 'none', color: ink, borderColor: 'rgba(18,24,43,0.15)', '&.Mui-selected': { bgcolor: 'rgba(254, 190, 0, 0.15)', borderColor: accent, color: ink } } }}>
          {categorias.map((c) => <ToggleButton key={c} value={c}>{c}</ToggleButton>)}
        </ToggleButtonGroup>
      </Box>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Autocomplete multiple options={regioes} value={filters.regioes} onChange={(_, values) => setFilters((prev: any) => ({ ...prev, regioes: values }))} size="small" renderInput={(params) => <TextField {...params} label="Região" placeholder="Todas" />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 5 }}>
          <Autocomplete multiple options={areas} value={filters.areas} onChange={(_, values) => setFilters((prev: any) => ({ ...prev, areas: values }))} size="small" renderInput={(params) => <TextField {...params} label="Área/Curso" placeholder="Todas" />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <TextField label="Ano" placeholder="ex: 2026" value={filters.ano} onChange={(e) => setFilters((prev: any) => ({ ...prev, ano: e.target.value }))} size="small" fullWidth />
        </Grid>
      </Grid>
    </Stack>
  );
}