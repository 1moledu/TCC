'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
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


const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

const ink = '#12182B';
const accent = 'rgb(254, 190, 0)';
const paperBg = '#FAFAF9';
const NEO4J_COLORS = ['#ffc8c8', '#c8d4ff', '#c8ffdb', '#ffedc8', '#e8c8ff', '#ffd4b8', '#d4f0ff'];

const suggestedQueries = [
  'Traga apenas 5 atividades de ensino',
  'Quais PETs realizaram atividades de extensão?',
  'Existem atividades feitas pelo PETECO que não são de ensino?',
];

const categorias = ['Ensino', 'Pesquisa', 'Extensão'];

type Filters = { categorias: string[]; ano: string; universidade: string; };
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

// Mapeia o Grafo Real da API para o formato que a ForceGraph entende (nodes e links)
function mapearGrafoReal(grafo: GrafoData) {
  const nodes = grafo.nodes.map((n) => ({
    id: n.id,
    label: n.caption,
    group: n.labels[0] || 'Nó',
    color: corPorLabel(n.labels[0] || 'Nó'),
    properties: n.properties,
    labels: n.labels
  }));
  
  const links = grafo.relationships.map((r) => ({
    source: r.from,
    target: r.to,
    label: r.type,
    curvature: 0, // Será calculado abaixo
    pairId: '',
    pairIndex: 0
  }));

  // Lógica para detectar múltiplos relacionamentos entre os mesmos nós
  const pairCounts: Record<string, number> = {};
  links.forEach(link => {
    // Cria um ID único para o par de nós (independente de quem aponta pra quem)
    const a = link.source < link.target ? link.source : link.target;
    const b = link.source < link.target ? link.target : link.source;
    const pairId = `${a}-${b}`;
    
    link.pairId = pairId;
    link.pairIndex = pairCounts[pairId] || 0;
    pairCounts[pairId] = (pairCounts[pairId] || 0) + 1;
  });

  // Se houver mais de um link no mesmo par, aplicamos uma curvatura alternada (0.2, -0.2, etc)
  links.forEach(link => {
     const total = pairCounts[link.pairId];
     if (total > 1) {
        let baseCurvature = 0.2 + (Math.floor(link.pairIndex / 2) * 0.1); 
        let sign = link.pairIndex % 2 === 0 ? 1 : -1;
        link.curvature = baseCurvature * sign;
     }
  });

  return { nodes, links };
}


// Fallback: Heurística para quando a consulta retornar apenas colunas sem grafo explícito
function mapearGrafoHeuristico(resultados: ResultRow[]) {
  const nodesMap = new Map();
  const links: { source: string; target: string; label: string }[] = [];

  resultados.forEach((row) => {
    const keys = Object.keys(row);
    if (keys.length === 0) return;
    
    const primaryKey = keys[0];
    const primaryVal = String(row[primaryKey] || 'N/A');
    const primaryId = `${primaryKey}:${primaryVal}`;
    
    if (!nodesMap.has(primaryId)) {
      nodesMap.set(primaryId, { 
        id: primaryId, label: primaryVal, group: primaryKey, color: corPorLabel(primaryKey),
        labels: [primaryKey], properties: { [primaryKey]: primaryVal }
      });
    }

    for (let i = 1; i < keys.length; i++) {
      const secKey = keys[i];
      const secVal = row[secKey];
      if (secVal === null || secVal === undefined || secVal === '') continue;
      
      const secValStr = typeof secVal === 'object' ? 'Objeto' : String(secVal);
      const secId = `${secKey}:${secValStr}`;
      
      if (!nodesMap.has(secId)) {
        nodesMap.set(secId, { 
          id: secId, label: secValStr, group: secKey, color: corPorLabel(secKey),
          labels: [secKey], properties: { [secKey]: secVal }
        });
      }
      links.push({ source: primaryId, target: secId, label: secKey });
    }
  });

  return { nodes: Array.from(nodesMap.values()), links };
}

export default function BuscarPage() {
  const [searchMode, setSearchMode] = useState(0); 

  const [query, setQuery] = useState('');
  const [rawCypher, setRawCypher] = useState('');

  const [hasSearched, setHasSearched] = useState(false);
  const [showFilters, setShowFilters] = useState(false); 
  const [filters, setFilters] = useState<Filters>({ categorias: [], ano: '', universidade: '' });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<ResultRow[]>([]);
  const [cypherQuery, setCypherQuery] = useState('');
  const [showCypher, setShowCypher] = useState(false);
  const [copied, setCopied] = useState(false);

  const [viewMode, setViewMode] = useState<'table' | 'graph'>('table');
  const [grafoData, setGrafoData] = useState<GrafoData>({ nodes: [], relationships: [] });
  const [selectedNode, setSelectedNode] = useState<any | null>(null);

  const [containerWidth, setContainerWidth] = useState(600);
  const graphContainerRef = useRef<HTMLDivElement>(null);

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
    setSelectedNode(null);

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
    setSelectedNode(null);
  }

  function handleCopyCypher() {
    navigator.clipboard.writeText(cypherQuery);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  useEffect(() => {
    if (viewMode === 'graph' && graphContainerRef.current) {
      setContainerWidth(graphContainerRef.current.offsetWidth);
    }
  }, [viewMode, results, grafoData]);

  const activeFilterCount = filters.categorias.length + (filters.ano ? 1 : 0) + (filters.universidade ? 1 : 0);
  const tableHeaders = results.length > 0 ? Object.keys(results[0]) : [];

  const usandoGrafoReal = grafoData.nodes.length > 0;
  
  // Decide se usa os nós e relacionamentos da API ou a Heurística da tabela
  const graphDataToRender = useMemo(
    () => (usandoGrafoReal ? mapearGrafoReal(grafoData) : mapearGrafoHeuristico(results)),
    [grafoData, results, usandoGrafoReal]
  );

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

        {searchMode === 1 && (
          <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid rgba(18,24,43,0.12)', mb: 2, bgcolor: '#1e1e1e' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <TextField
                fullWidth 
                multiline 
                minRows={3} 
                placeholder="MATCH (n) RETURN n LIMIT 25" 
                value={rawCypher} 
                onChange={(e) => setRawCypher(e.target.value)} 
                variant="outlined" 
                disabled={isLoading}
                spellCheck={false} 
                sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { border: 'none' }, color: '#d4d4d4', fontFamily: 'monospace', fontSize: '1rem' } }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mt: 1, gap: 1 }}>
                
                {/* Novo botão de apagar a query */}
                {rawCypher.trim().length > 0 && (
                  <Button
                    onClick={() => setRawCypher('')}
                    disabled={isLoading}
                    sx={{ color: '#a0a0a0', textTransform: 'none', fontWeight: 600, '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.08)' } }}
                  >
                    Limpar Código
                  </Button>
                )}

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
                  <ToggleButton value="table" sx={{ textTransform: 'none', px: 2 }}><ViewListIcon sx={{ mr: 1, fontSize: 18 }} /> Tabela</ToggleButton>
                  <ToggleButton value="graph" sx={{ textTransform: 'none', px: 2 }}><HubIcon sx={{ mr: 1, fontSize: 18 }} /> Rede</ToggleButton>
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

            <Paper elevation={0} sx={{ border: '1px solid rgba(18,24,43,0.1)', borderRadius: 2, bgcolor: '#fff', minHeight: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }} ref={graphContainerRef}>
              
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
                <Typography sx={{ color: '#6B7280', p: 4 }}>A consulta foi executada, mas não retornou resultados.</Typography>
              )}

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

              {!isLoading && !error && results.length > 0 && viewMode === 'graph' && (
                <Box sx={{ width: '100%', height: 520, bgcolor: '#1e222d', position: 'relative' }}>
                  {!usandoGrafoReal && (
                    <Chip
                      label="Grafo aproximado (a consulta não retornou nós/relacionamentos completos)"
                      size="small"
                      sx={{ position: 'absolute', top: 12, left: 12, zIndex: 1, bgcolor: '#fff', fontWeight: 500 }}
                    />
                  )}
                  
                  <ForceGraph2D
                    width={containerWidth}
                    height={520}
                    graphData={graphDataToRender}
                    onNodeClick={(node) => setSelectedNode(node)}
                    onBackgroundClick={() => setSelectedNode(null)}
                    linkDirectionalArrowLength={5}
                    linkDirectionalArrowRelPos={1}
                    linkColor={() => '#808080'}
                    
                    // Adiciona a propriedade de curvatura!
                    linkCurvature="curvature" 
                    
                    linkCanvasObjectMode={() => 'after'}
                    linkCanvasObject={(link: any, ctx, globalScale) => {
                      const start = link.source; 
                      const end = link.target;
                      if (typeof start !== 'object' || typeof end !== 'object') return;
                      
                      // Calcula o ponto central (linha reta)
                      const midX = start.x + (end.x - start.x) / 2;
                      const midY = start.y + (end.y - start.y) / 2;
                      let textPos = { x: midX, y: midY };

                      // Ajuste matemático avançado: Se a linha for curvada, o texto deve acompanhar a barriga da curva!
                      if (link.curvature) {
                         const dx = end.x - start.x;
                         const dy = end.y - start.y;
                         const length = Math.sqrt(dx * dx + dy * dy);
                         const cpDist = link.curvature * length; // Distância do ponto de controle
                         const orthoAngle = Math.atan2(dy, dx) + Math.PI / 2; // Ângulo ortogonal
                         const cpX = midX + cpDist * Math.cos(orthoAngle);
                         const cpY = midY + cpDist * Math.sin(orthoAngle);
                         // O texto fica exatamente na metade do caminho entre a reta e o ponto de controle
                         textPos.x = midX + (cpX - midX) / 2;
                         textPos.y = midY + (cpY - midY) / 2;
                      }

                      let textAngle = Math.atan2(end.y - start.y, end.x - start.x);
                      if (textAngle > Math.PI / 2) textAngle = -(Math.PI - textAngle);
                      if (textAngle < -Math.PI / 2) textAngle = -(-Math.PI - textAngle);

                      const fontSize = Math.min(12, 10 / globalScale);
                      ctx.font = `${fontSize}px Sans-Serif`;
                      
                      ctx.save();
                      ctx.translate(textPos.x, textPos.y);
                      ctx.rotate(textAngle);
                      const textWidth = ctx.measureText(link.label).width;
                      ctx.fillStyle = '#1e222d'; 
                      ctx.fillRect(-textWidth / 2 - 2, -fontSize / 2 - 2, textWidth + 4, fontSize + 4);
                      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#a0a0a0';
                      ctx.fillText(link.label, 0, 0);
                      ctx.restore();
                    }}
                    nodeCanvasObject={(node: any, ctx, globalScale) => {
                      ctx.font = `${12 / globalScale}px Sans-Serif`;
                      ctx.beginPath();
                      ctx.arc(node.x, node.y, 22 / globalScale, 0, 2 * Math.PI, false);
                      ctx.fillStyle = node.color || '#fff'; ctx.fill();
                      
                      if (selectedNode && selectedNode.id === node.id) {
                         ctx.strokeStyle = accent;
                         ctx.lineWidth = 4 / globalScale;
                      } else {
                         ctx.strokeStyle = 'rgba(255,255,255,0.4)'; 
                         ctx.lineWidth = 2 / globalScale; 
                      }
                      
                      ctx.stroke();
                      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#12182B'; 
                      ctx.fillText(node.label.length > 12 ? node.label.substring(0, 10) + '...' : node.label, node.x, node.y);
                    }}
                  />

                  {/* Mantido o seu painel de Propriedades Lateral flutuante! */}
                  {selectedNode && (
                    <Paper sx={{ position: 'absolute', top: 12, right: 12, p: 2, maxWidth: 280, maxHeight: 400, overflow: 'auto', zIndex: 10 }}>
                      <Typography sx={{ fontWeight: 600, color: ink, mb: 0.5 }}>{selectedNode.label}</Typography>
                      <Typography sx={{ fontSize: 12, color: '#6B7280', mb: 1.5 }}>
                         {selectedNode.labels ? selectedNode.labels.join(', ') : selectedNode.group}
                      </Typography>
                      <Divider sx={{ mb: 1.5 }} />
                      {selectedNode.properties && Object.entries(selectedNode.properties).map(([chave, valor]) => (
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
        <Grid size={{ xs: 12, sm: 3 }}>
          <TextField label="Ano" placeholder="ex: 2026" value={filters.ano} onChange={(e) => setFilters((prev: any) => ({ ...prev, ano: e.target.value }))} size="small" fullWidth />
        </Grid>
      </Grid>
      <Grid size={{ xs: 12, sm: 5 }}>
          <TextField 
             label="Universidade" 
             placeholder="Ex: UTFPR" 
             value={filters.universidade} 
             onChange={(e) => setFilters((prev: any) => ({ ...prev, universidade: e.target.value }))} 
             size="small" 
             fullWidth 
          />
        </Grid>
    </Stack>
  );
}