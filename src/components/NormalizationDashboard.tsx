import React, { useEffect, useState } from "react";
import * as d3 from "d3";

interface Bucket {
  key: string;
  doc_count: number;
}

interface FieldOption {
  key: string;
  label: string;
}

interface Irregularity {
  irregular: Bucket;
  similarity: number;
  isAlternative: boolean;
}

interface GroupedIrregularities {
  canonical: Bucket;
  irregulars: Irregularity[];
}

interface NormalizationState {
  fromValue: string;
  toValue: string;
  isNormalizing: boolean;
  error: string | null;
  success: boolean;
}

// Levenshtein distance para calcular a similaridade de nossos metadados
function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + cost
      );
    }
  }
  return matrix[b.length][a.length];
}

// Calculo da similaridade de termos usando a distancia de levenshtein
function similarity(a: string, b: string): number {
  const dist = levenshtein(a.toLowerCase(), b.toLowerCase());
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - dist / maxLen;
}

function getSearchUrl(field: string, value: string) {
  return `/pesquisa?${encodeURIComponent(field)}=${encodeURIComponent(value)}`;
}

const fieldMapping: Record<string, string> = {
  'Descritores': 'Descritores.Show',
  // ...
};

export default function NormalizationDashboard() {
  const [fields, setFields] = useState<FieldOption[]>([]);
  const [selectedField, setSelectedField] = useState<string>("");
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [grouped, setGrouped] = useState<GroupedIrregularities[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClientReady, setIsClientReady] = useState(false);
  const [threshold, setThreshold] = useState(0.85); // Treshold de similaridade predefinido
  const [normalizationState, setNormalizationState] = useState<NormalizationState | null>(null);
  const [pendingNormalization, setPendingNormalization] = useState<{from: string, to: string} | null>(null);
  const [selectedTargets, setSelectedTargets] = useState<{[key: string]: {dropdown?: string, custom?: string}}>({});
  const [sortBy, setSortBy] = useState<'group' | 'term' | 'count'>('term');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [pendingDateRange, setPendingDateRange] = useState<{start: string, end: string}>({start: '', end: ''});
  const [dateRange, setDateRange] = useState<{start: string, end: string}>({start: '', end: ''});
  const [showAllTerms, setShowAllTerms] = useState(false);
  const [sliderValue, setSliderValue] = useState(0.85); // UI
  const [searchTrigger, setSearchTrigger] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [lastThreshold, setLastThreshold] = useState(0.85);

  // Limitar o número de buckets processados
  const processBuckets = (buckets: Bucket[]) => {
    const limitedBuckets = buckets.slice(0, 3000);
    setBuckets(limitedBuckets);

    // Similaridade
    const nodes = limitedBuckets.map((b, i) => ({ ...b, idx: i }));
    const adj: number[][] = Array(nodes.length).fill(0).map(() => []);
    // Build adjacency matrix
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (similarity(nodes[i].key, nodes[j].key) >= threshold && nodes[i].key !== nodes[j].key) {
          adj[i].push(j);
          adj[j].push(i);
        }
      }
    }
    // Algoritmo de agrupamento 
    const visited = Array(nodes.length).fill(false);
    const groups: GroupedIrregularities[] = [];
    for (let i = 0; i < nodes.length; i++) {
      if (visited[i]) continue;
      // BFS 
      const queue = [i];
      const cluster = [];
      visited[i] = true;
      while (queue.length) {
        const curr = queue.shift()!;
        cluster.push(nodes[curr]);
        for (const neighbor of adj[curr]) {
          if (!visited[neighbor]) {
            visited[neighbor] = true;
            queue.push(neighbor);
          }
        }
      }
      if (cluster.length > 1) {
        // Sort cluster by doc_count
        cluster.sort((a, b) => b.doc_count - a.doc_count);
        const canonical = cluster[0];
        const irregulars: Irregularity[] = cluster.slice(1).map(ir => ({
          irregular: ir,
          similarity: similarity(canonical.key, ir.key),
          isAlternative: ir.doc_count === canonical.doc_count
        }));
        groups.push({ canonical, irregulars });
      }
    }
    setGrouped(groups);
    setLoading(false);
  };

  // Header da tabela
  const headerCellStyle = (active: boolean) => ({
    cursor: 'pointer',
    background: active ? '#e3f2fd' : '#e5f0ff',
    color: active ? '#1976d2' : '#222',
    fontWeight: 600,
    userSelect: 'none' as const,
    transition: 'background 0.15s',
    position: 'relative' as const,
  });

  const getSortArrow = (col: string) => {
    if (sortBy !== col) return '';
    return sortDirection === 'asc' ? '▲' : '▼';
  };

  useEffect(() => {
    setIsClientReady(true);
  }, []);

  useEffect(() => {
    if (!isClientReady) return;
    fetch("/api/normalization-fields")
      .then((res) => res.json())
      .then((json) => {
        setFields(json.fields);
        if (json.fields.length > 0) setSelectedField(json.fields[0].key);
      });
  }, [isClientReady]);

  useEffect(() => {
    if (!hasSearched) return;
    if (!selectedField || !isClientReady) return;
    setLoading(true);
    setError(null);
    setBuckets([]);
    setGrouped([]);

    const params = new URLSearchParams();
    params.append('term', selectedField);
    if (dateRange.start) params.append('MinAno', dateRange.start);
    if (dateRange.end) params.append('MaxAno', dateRange.end);
    if (!showAllTerms) params.append('threshold', threshold.toString());

    fetch(`/api/indices?${params.toString()}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((json) => {
        const buckets: Bucket[] = json.termAggregation?.buckets || [];
        if (buckets.length === 0) {
          setError("Nenhum termo encontrado para este campo.");
          setLoading(false);
          return;
        }
        processBuckets(buckets);
      })
      .catch((error) => {
        console.error('Error fetching data:', error);
        setError("Erro ao carregar dados de normalização. Por favor, tente novamente.");
        setLoading(false);
      });
  }, [selectedField, isClientReady, threshold, dateRange, showAllTerms, searchTrigger, hasSearched]);

  const handleNormalize = async (fromValue: string, toValue: string) => {
    setNormalizationState({
      fromValue,
      toValue,
      isNormalizing: true,
      error: null,
      success: false
    });

    try {
      const response = await fetch('/api/normalize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          field: selectedField,
          fromValue,
          toValue
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to normalize values');
      }

      setNormalizationState(prev => prev ? {
        ...prev,
        isNormalizing: false,
        success: true
      } : null);

      // Refresh dos termos apos normalização
      const refreshResponse = await fetch(`/api/indices?term=${encodeURIComponent(selectedField)}`);
      const refreshData = await refreshResponse.json();
      const buckets: Bucket[] = refreshData.termAggregation?.buckets || [];
          setBuckets(buckets);
      
      // Reagrupar os dados
          const used = new Set<string>();
          const groups: GroupedIrregularities[] = [];
          const N = Math.min(buckets.length, 200);
          for (let i = 0; i < N; i++) {
            if (used.has(buckets[i].key)) continue;
            const similars: {bucket: Bucket, similarity: number}[] = [];
            for (let j = 0; j < N; j++) {
              if (i === j) continue;
              if (used.has(buckets[j].key)) continue;
              const sim = similarity(buckets[i].key, buckets[j].key);
              if (sim >= threshold && buckets[i].key !== buckets[j].key) {
                similars.push({bucket: buckets[j], similarity: sim});
              }
            }
            if (similars.length > 0) {
              const all = [{bucket: buckets[i], similarity: 1}, ...similars];
              all.sort((a, b) => b.bucket.doc_count - a.bucket.doc_count);
              const canonical = all[0].bucket;
              const irregulars: Irregularity[] = all.slice(1).map(x => ({
                irregular: x.bucket,
                similarity: x.similarity,
                isAlternative: x.bucket.doc_count === canonical.doc_count
              }));
              all.forEach(x => used.add(x.bucket.key));
              groups.push({ canonical, irregulars });
            }
          }
          setGrouped(groups);
    } catch (err) {
      setNormalizationState(prev => prev ? {
        ...prev,
        isNormalizing: false,
        error: err instanceof Error ? err.message : 'An error occurred'
      } : null);
    }
  };

  // Flatten all terms into a single list with group number
  const flatTerms = React.useMemo(() => {
    let rows: { group: number; term: string; count: number }[] = [];
    let groupNum = 1;
    grouped.forEach((group) => {
      const allTerms = [group.canonical, ...group.irregulars.map(ir => ir.irregular)];
      allTerms.forEach(term => {
        rows.push({ group: groupNum, term: term.key, count: term.doc_count });
      });
      groupNum++;
    });
    // Se não estiver agrupado (sem clusters), apenas mostrar todos os buckets
    if (rows.length === 0 && buckets.length > 0) {
      buckets.forEach((b, i) => {
        rows.push({ group: 1, term: b.key, count: b.doc_count });
      });
    }
    // Sorting
    let sorted = [...rows];
    if (sortBy === 'group') {
      sorted.sort((a, b) => sortDirection === 'asc' ? a.group - b.group : b.group - a.group);
    } else if (sortBy === 'term') {
      sorted.sort((a, b) => sortDirection === 'asc' ? a.term.localeCompare(b.term) : b.term.localeCompare(a.term));
    } else if (sortBy === 'count') {
      sorted.sort((a, b) => sortDirection === 'asc' ? a.count - b.count : b.count - a.count);
    }
    return sorted;
  }, [grouped, buckets, sortBy, sortDirection]);

  // Quando o threshold muda de 0 (showAllTerms) para >=0.7, desativar showAllTerms
  useEffect(() => {
    if (!showAllTerms && threshold === 0) setThreshold(0.7);
    if (threshold >= 0.7 && showAllTerms) setShowAllTerms(false);
  }, [threshold]);

  const exportToExcel = () => {
    const headers = ['Grupo', 'Termo', 'Qtd', 'Termos do Grupo'];
    const rows = flatTerms.map(row => {
      const groupTerms = flatTerms.filter(t => t.group === row.group).map(t => t.term).join(', ');
      return [row.group, row.term, row.count, groupTerms];
    });
    let csv = headers.join(',') + '\n' + rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `termos_${selectedField}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  if (!isClientReady) {
    return null;
  }

  return (
    <div className="container-fluid px-4">
      <div className="row justify-content-center">
        <div className="col-12">
          <div className="card shadow-sm my-4" style={{border: 'none', boxShadow: '0 1px 6px rgba(0,0,0,0.04)'}}>
            <div className="card-body" style={{fontFamily: 'Inter, Arial, sans-serif', background: '#fff'}}>
              <h2 className="mb-2" style={{ fontSize: '2rem', fontWeight: 500, letterSpacing: '-0.5px' }}>Normalização de Dados</h2>
              <div className="mb-3" style={{color: '#555', fontSize: '1.08em'}}>
                <span> Esta ferramenta identifica <b>termos semelhantes</b> (potenciais duplicados ou variantes) nos metadados selecionados através de um algoritmo de <b>similaridade</b> personalizável. Pode visualizar quantas vezes cada termo aparece e sugerir a normalização para um termo preferido.</span>
              </div>
              <div className="row mb-2 align-items-end g-3">
                <div className="col-md-7 d-flex flex-column">
                  <label className="form-label mb-1">Metadados a analisar</label>
                  <select
                    className="form-select form-select-lg mb-2"
                    style={{ maxWidth: 700, width: '100%', color: '#555' }}
                    value={selectedField}
                    onChange={e => setSelectedField(e.target.value)}
                    disabled={loading}
                  >
                    {fields.map(f => (
                      <option key={f.key} value={f.key}>{f.label}</option>
                    ))}
                  </select>
                  <div className="d-flex align-items-center gap-2" style={{ marginTop: 24 }}>
                    <span style={{fontWeight: 700, color: '#555', marginRight: 8}}>Filtrar por período de tempo</span>
                    <span role="img" aria-label="calendar">📅</span>
                    <div style={{position: 'relative', display: 'inline-block'}}>
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        value={pendingDateRange.start}
                        onChange={e => setPendingDateRange(r => ({...r, start: e.target.value}))}
                        style={{minWidth: 200, width: '100%', fontSize: '1.6em', height: 58, paddingRight: pendingDateRange.start ? 24 : undefined, background: '#fff'}}
                      />
                      {pendingDateRange.start && (
                        <span
                          style={{position: 'absolute', right: 20, top: 2, cursor: 'pointer', color: '#888', fontSize: 48}}
                          title="Limpar"
                          onClick={() => setPendingDateRange(r => ({...r, start: ''}))}
                        >✕</span>
                      )}
                    </div>
                    <span style={{fontWeight: 500, color: '#888'}}>até</span>
                    <div style={{position: 'relative', display: 'inline-block'}}>
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        value={pendingDateRange.end}
                        onChange={e => setPendingDateRange(r => ({...r, end: e.target.value}))}
                        style={{minWidth: 200, width: '100%', fontSize: '1.6em', height: 58, paddingRight: pendingDateRange.end ? 24 : undefined, background: '#fff'}}
                      />
                      {pendingDateRange.end && (
                        <span
                          style={{position: 'absolute', right: 6, top: 2, cursor: 'pointer', color: '#888', fontSize: 18}}
                          title="Limpar"
                          onClick={() => setPendingDateRange(r => ({...r, end: ''}))}
                        >✕</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="col-md-5 d-flex flex-column align-items-end">
                  <div style={{display: 'flex', alignItems: 'center', width: '100%', gap: 24, marginBottom: 16}}>
                    <button
                      className={`btn btn-sm ${showAllTerms ? 'btn-primary' : 'btn-outline-primary'}`}
                      style={{fontWeight: 600, borderRadius: 6, minWidth: 60, height: 48, fontSize: '1.08em'}}
                      onClick={() => {
                        if (showAllTerms) {
                          setThreshold(lastThreshold);
                          setShowAllTerms(false);
                        } else {
                          setLastThreshold(threshold);
                          setThreshold(0);
                          setShowAllTerms(true);
                        }
                      }}
                      title={showAllTerms ? 'Voltar ao filtro de similaridade' : 'Mostrar todos os termos'}
                    >
                      {showAllTerms ? 'Usar similaridade' : 'Mostrar todos'}
                    </button>
                  <input
                    type="range"
                    min={0.7}
                    max={1}
                    step={0.01}
                      value={showAllTerms ? 0.7 : sliderValue}
                      onChange={e => setSliderValue(Number(e.target.value))}
                      onMouseUp={e => { if (!showAllTerms) setThreshold(sliderValue); }}
                      onTouchEnd={e => { if (!showAllTerms) setThreshold(sliderValue); }}
                    className="form-range"
                      disabled={loading || showAllTerms}
                      style={{flex: 1, height: 8, margin: 0}}
                    />
                    <span style={{fontWeight: 600, fontSize: '1.08em', whiteSpace: 'nowrap', marginLeft: 8, textAlign: 'center'}}>
                      Similaridade mínima {showAllTerms ? '(Todos)' : `(${Math.round(sliderValue * 100)}%)`}
                    </span>
                  </div>
                  <div className="d-flex align-items-center mt-2" style={{gap: 90, width: '100%', marginLeft: 'auto'}}>
                    <button
                      className="btn btn-primary"
                      style={{fontWeight: 600, borderRadius: 6, minWidth: 300, height: 56, fontSize: '1.15em'}}
                      onClick={() => {
                        setDateRange({...pendingDateRange});
                        setHasSearched(true);
                        setSearchTrigger(t => t + 1);
                      }}
                      disabled={loading}
                    >Pesquisar</button>
                    <button
                      className="btn btn-outline-success"
                      style={{fontWeight: 600, borderRadius: 6, minWidth: 300, height: 56, fontSize: '1.15em'}}
                      onClick={exportToExcel}
                      disabled={loading}
                    >Exportar para Excel</button>
                  </div>
                </div>
              </div>
              {normalizationState && (
                normalizationState.isNormalizing ? (
                  <div className="alert alert-info my-3">Normalizando valores...</div>
                ) : normalizationState.error ? (
                  <div className="alert alert-danger my-3">Erro: {normalizationState.error}</div>
                ) : normalizationState.success ? (
                  <div className="alert alert-success my-3">
                    Valores normalizados com sucesso!{' '}
                    <a href={getSearchUrl(selectedField, normalizationState.toValue)} target="_blank" rel="noopener noreferrer">
                      Ver casos normalizados
                    </a>
                  </div>
                ) : null
              )}
              <div className="mb-3" style={{fontSize: '1.15em'}}>
                <div className="fw-bold mb-2" style={{color: '#222', fontSize: '1.2em'}}>Lista de termos normalizáveis</div>
                <div className="mb-2" style={{color: '#666', fontSize: '1em'}}>
                </div>
                <div style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8}}>
                  <span style={{fontWeight: 500, color: '#888'}}>Ordenar por:</span>
                  <button
                    className="btn btn-light btn-sm"
                    style={{border: sortBy === 'term' ? '2px solid #1976d2' : '1px solid #ccc', color: sortBy === 'term' ? '#1976d2' : '#222', fontWeight: 600, borderRadius: 6, minWidth: 60}}
                    onClick={() => { setSortBy('term'); setSortDirection('asc'); }}
                  >Termo</button>
                  <button
                    className="btn btn-light btn-sm"
                    style={{border: sortBy === 'count' ? '2px solid #1976d2' : '1px solid #ccc', color: sortBy === 'count' ? '#1976d2' : '#222', fontWeight: 600, borderRadius: 6, minWidth: 60}}
                    onClick={() => { setSortBy('count'); setSortDirection('desc'); }}
                  >Qtd</button>
                  <button
                    className="btn btn-light btn-sm"
                    style={{border: sortBy === 'group' ? '2px solid #1976d2' : '1px solid #ccc', color: sortBy === 'group' ? '#1976d2' : '#222', fontWeight: 600, borderRadius: 6, minWidth: 60}}
                    onClick={() => { setSortBy('group'); setSortDirection('asc'); }}
                  >Grupo</button>
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    style={{marginLeft: 12, borderRadius: 6, fontWeight: 600}}
                    title="Resetar ordenação"
                    onClick={() => { setSortBy('term'); setSortDirection('asc'); }}
                  >⟲</button>
                </div>
                <div style={{ maxHeight: 700, overflowY: 'auto', fontSize: '1.08em', border: '1px solid #e5e7eb', borderRadius: 8, background: '#f8f9fa' }}>
                  <table className="table table-sm mb-0" style={{background: 'transparent', minWidth: 480}}>
                    <thead style={{position: 'sticky', top: 0, zIndex: 1}}>
                      <tr>
                        <th style={headerCellStyle(sortBy === 'group')}>G {getSortArrow('group')}</th>
                        <th style={headerCellStyle(sortBy === 'term')}>Termos {getSortArrow('term')}</th>
                        <th style={{...headerCellStyle(sortBy === 'count'), textAlign: 'center', verticalAlign: 'middle', width: 70}}>Qtd {getSortArrow('count')}</th>
                        <th style={{width: 40, background: '#e5f0ff'}}></th>
                        <th style={{minWidth: 320, background: '#e5f0ff'}}>Normalizar para</th>
                        <th></th>
                              </tr>
                            </thead>
                            <tbody>
                      {(() => {
                        if (sortBy !== 'group') {
          
                          return flatTerms.map((row, idx) => (
                            <tr key={row.term + row.group} style={{background: idx % 2 === 0 ? '#eaf3fb' : '#fff'}}>
                              <td style={{fontWeight: 500, color: '#1976d2', textAlign: 'center'}}>{row.group}</td>
                              <td style={{fontWeight: 500}}>
                                <a href={getSearchUrl(selectedField, row.term)} target="_blank" rel="noopener noreferrer" style={{color: '#2563eb', textDecoration: 'none'}}>{row.term}</a>
                                  </td>
                              <td style={{color: '#2563eb', fontWeight: 500, textAlign: 'center', verticalAlign: 'middle', width: 70}}>{row.count}</td>
                              <td style={{width: 40}}></td>
                              <td style={{minWidth: 320, maxWidth: 420, paddingLeft: 0, paddingRight: 0}}>
                                <div style={{
                                  display: 'flex',
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 8, 
                                  width: '100%',
                                  justifyContent: 'flex-start',
                                  marginLeft: 24, 
                                }}>
                                  <select
                                    className="form-select form-select-lg d-inline-block"
                                    style={{minWidth: 220, maxWidth: 320, width: 260, fontWeight: 500, fontSize: '1.08em'}}
                                    value={selectedTargets[row.term]?.dropdown ?? row.term}
                                    onChange={e => {
                                      setSelectedTargets(prev => ({ ...prev, [row.term]: { ...(prev[row.term] || {}), dropdown: e.target.value } }));
                                    }}
                                    disabled={(() => {
                                      const target = selectedTargets[row.term];
                                      return !!(target?.custom && target.custom.length > 0);
                                    })()}
                                  >
                                    {flatTerms.filter(t => t.group === row.group && t.term !== row.term).map((opt, k) => (
                                      <option key={k} value={opt.term}>{opt.term}</option>
                                    ))}
                                  </select>
                                  <input
                                    type="text"
                                    className="form-control form-control-lg"
                                    placeholder="Outro valor..."
                                    value={selectedTargets[row.term]?.custom || ''}
                                    onChange={e => {
                                      setSelectedTargets(prev => ({ ...prev, [row.term]: { ...(prev[row.term] || {}), custom: e.target.value } }));
                                    }}
                                    style={{maxWidth: 180, minWidth: 100, fontWeight: 500, fontSize: '1.08em'}}
                                  />
                                  <button
                                    className="btn btn-primary btn-lg"
                                    style={{fontSize: '1.18em', padding: '10px 32px', marginLeft: 12, minWidth: 140, fontWeight: 700}} // Tweak marginLeft, minWidth, fontSize, padding for button size/position
                                    onClick={() => {
                                      const target = selectedTargets[row.term] || {};
                                      const custom = target.custom;
                                      const dropdown = target.dropdown ?? row.term;
                                      setPendingNormalization({ from: row.term, to: (custom && custom.length > 0) ? custom : dropdown });
                                    }}
                                    disabled={normalizationState?.isNormalizing}
                                  >
                                    Normalizar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ));
                        }
                        // Grouped view with summary
                        let renderedGroups = new Set();
                        return flatTerms.map((row, idx) => {
                          const isFirstOfGroup = !renderedGroups.has(row.group);
                          renderedGroups.add(row.group);
                          const groupTerms = flatTerms.filter(t => t.group === row.group);
                          if (!isFirstOfGroup) {
                            // Render normal row, empty summary cell
                            return (
                              <tr key={row.term + row.group} style={{background: idx % 2 === 0 ? '#eaf3fb' : '#fff'}}>
                                <td style={{fontWeight: 500, color: '#1976d2', textAlign: 'center'}}>{row.group}</td>
                                <td style={{fontWeight: 500}}>
                                  <a href={getSearchUrl(selectedField, row.term)} target="_blank" rel="noopener noreferrer" style={{color: '#2563eb', textDecoration: 'none'}}>{row.term}</a>
                                </td>
                                <td style={{color: '#2563eb', fontWeight: 500, textAlign: 'center'}}>{row.count}</td>
                                <td>
                                  <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4}}>
                                    <select 
                                      className="form-select form-select-sm d-inline-block" 
                                      style={{minWidth: 140, maxWidth: 220, width: '100%'}}
                                      value={selectedTargets[row.term]?.dropdown ?? row.term}
                                      onChange={e => {
                                        setSelectedTargets(prev => ({ ...prev, [row.term]: { ...(prev[row.term] || {}), dropdown: e.target.value } }));
                                      }}
                                      disabled={(() => {
                                        const target = selectedTargets[row.term];
                                        return !!(target?.custom && target.custom.length > 0);
                                      })()}
                                    >
                                      {groupTerms.map((opt, k) => (
                                        <option key={k} value={opt.term}>{opt.term}</option>
                                      ))}
                                    </select>
                                    <input
                                      type="text"
                                      className="form-control form-control-sm mt-1"
                                      placeholder="Outro valor..."
                                      value={selectedTargets[row.term]?.custom || ''}
                                      onChange={e => {
                                        setSelectedTargets(prev => ({ ...prev, [row.term]: { ...(prev[row.term] || {}), custom: e.target.value } }));
                                      }}
                                      style={{maxWidth: 220}}
                                    />
                                  </div>
                                  </td>
                                <td></td>
                                </tr>
                            );
                          }
                          // First row of group: render summary card in last cell
                          // Compute summary
                          const total = groupTerms.reduce((sum, t) => sum + t.count, 0);
                          const max = Math.max(...groupTerms.map(t => t.count));
                          const min = Math.min(...groupTerms.map(t => t.count));
                          // Build search URL for all terms in group
                          const groupUrl = `/pesquisa?${groupTerms.filter(t => t.term !== row.term).map(t => `${encodeURIComponent(selectedField)}=${encodeURIComponent(t.term)}`).join('&')}`;
                          return (
                            <tr key={row.term + row.group} style={{background: idx % 2 === 0 ? '#eaf3fb' : '#fff'}}>
                              <td style={{fontWeight: 500, color: '#1976d2', textAlign: 'center'}}>{row.group}</td>
                              <td style={{fontWeight: 500}}>
                                <a href={getSearchUrl(selectedField, row.term)} target="_blank" rel="noopener noreferrer" style={{color: '#2563eb', textDecoration: 'none'}}>{row.term}</a>
                              </td>
                              <td style={{color: '#2563eb', fontWeight: 500, textAlign: 'center'}}>{row.count}</td>
                              <td>
                                <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4}}>
                                  <select 
                                    className="form-select form-select-sm d-inline-block" 
                                    style={{minWidth: 140, maxWidth: 220, width: '100%'}}
                                    value={selectedTargets[row.term]?.dropdown ?? row.term}
                                    onChange={e => {
                                      setSelectedTargets(prev => ({ ...prev, [row.term]: { ...(prev[row.term] || {}), dropdown: e.target.value } }));
                                    }}
                                    disabled={(() => {
                                      const target = selectedTargets[row.term];
                                      return !!(target?.custom && target.custom.length > 0);
                                    })()}
                                  >
                                    {groupTerms.map((opt, k) => (
                                      <option key={k} value={opt.term}>{opt.term}</option>
                                    ))}
                                  </select>
                                  <input
                                    type="text"
                                    className="form-control form-control-sm mt-1"
                                    placeholder="Outro valor..."
                                    value={selectedTargets[row.term]?.custom || ''}
                                    onChange={e => {
                                      setSelectedTargets(prev => ({ ...prev, [row.term]: { ...(prev[row.term] || {}), custom: e.target.value } }));
                                    }}
                                    style={{maxWidth: 220}}
                                  />
                                </div>
                              </td>
                              <td rowSpan={groupTerms.length} style={{verticalAlign: 'top', minWidth: 220, maxWidth: 270, background: '#f6fafd', borderLeft: '2px solid #e3eaf3', padding: 0}}>
                                <div style={{padding: '14px 12px 10px 12px', borderRadius: 12, border: '1.5px solid #e3eaf3', margin: 8, background: '#fafdff', boxShadow: '0 2px 8px rgba(30,64,175,0.04)'}}>
                                  <div style={{fontWeight: 700, color: '#1976d2', marginBottom: 8, fontSize: '1.08em', letterSpacing: '-0.5px'}}>Resumo do Grupo de Termos</div>
                                  <div style={{fontSize: '1em', color: '#444', marginBottom: 10, display: 'flex', gap: 12, flexWrap: 'wrap'}}>
                                    <span>Total de instâncias: <b>{total}</b></span>
                                    <span>|</span>
                                    <span>Maior valor: <b>{max}</b></span>
                                    <span>|</span>
                                    <span>Menor valor: <b>{min}</b></span>
                        </div>
                                  <div style={{marginBottom: 12}}>
                                    {groupTerms.map((t, i) => (
                                      <div key={t.term} style={{display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4}}>
                                        <span style={{fontSize: '1em', color: '#1976d2', minWidth: 22, textAlign: 'right', fontWeight: 600}}>{t.count}</span>
                                        <div style={{flex: 1, height: 10, background: '#e3eaf3', borderRadius: 5, position: 'relative'}}>
                                          <div style={{width: `${(t.count / max) * 100}%`, height: '100%', background: '#1976d2', borderRadius: 5}}></div>
                          </div>
                          </div>
                              ))}
                          </div>
                                  <a
                                    href={groupUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-outline-primary btn-sm w-100"
                                    style={{fontWeight: 700, borderRadius: 8, marginTop: 6, fontSize: '1.08em', padding: '8px 0'}}>
                            Ver todos os casos do grupo
                                  </a>
                        </div>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                  {loading && (
                    <div className="my-4 text-center">
                      <div className="spinner-border text-primary" role="status" style={{width: '3rem', height: '3rem'}}>
                        <span className="visually-hidden">A carregar...</span>
                      </div>
                      <div className="mt-2" style={{color: '#666'}}>A analisar termos e identificar irregularidades...</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Confirmação de Normalização */}
      {pendingNormalization && (
        (() => {
          // Encontrar a contagem para o termo selecionado
          const affectedCount = flatTerms.find(t => t.term === pendingNormalization.from)?.count || 0;
          return (
            <div className="modal show" tabIndex={-1} style={{
              display: 'block',
              background: 'rgba(0,0,0,0.15)',
              zIndex: 1050
            }}>
              <div className="modal-dialog modal-dialog-centered" style={{maxWidth: 380}}>
                <div className="modal-content" style={{
                  borderRadius: 14,
                  border: 'none',
                  boxShadow: '0 4px 32px rgba(0,0,0,0.10)'
                }}>
                  <div className="modal-header" style={{border: 'none', paddingBottom: 0}}>
                  </div>
                  <div className="modal-body" style={{textAlign: 'center', padding: '2rem 1.5rem 1.5rem 1.5rem'}}>
                    <div style={{fontSize: '1.1em', marginBottom: 18, color: '#444'}}>
                      Tem a certeza que deseja normalizar:
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.25em',
                      fontWeight: 500,
                      marginBottom: 18
                    }}>
                      <span style={{
                        background: '#f3f4f6',
                        borderRadius: 6,
                        padding: '6px 14px',
                        color: '#d97706'
                      }}>{pendingNormalization.from}</span>
                      <span style={{
                        margin: '0 16px',
                        fontSize: '1.5em',
                        color: '#2563eb'
                      }}>→</span>
                      <span style={{
                        background: '#f3f4f6',
                        borderRadius: 6,
                        padding: '6px 14px',
                        color: '#059669'
                      }}>{pendingNormalization.to}</span>
                    </div>
                    <div style={{color: '#888', fontSize: '0.98em', marginBottom: 8}}>
                      Esta ação irá atualizar <b>{affectedCount}</b> acordão{affectedCount === 1 ? '' : 's'}.
                    </div>
                  </div>
                  <div className="modal-footer" style={{border: 'none', justifyContent: 'center', gap: 12, paddingBottom: 1.5 + 'rem'}}>
                    <button className="btn btn-light" style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 6,
                      padding: '6px 22px',
                      fontWeight: 500
                    }} onClick={() => setPendingNormalization(null)}>
                      Cancelar
                    </button>
                    <button className="btn btn-success" style={{
                      borderRadius: 6,
                      padding: '6px 22px',
                      fontWeight: 500
                    }} onClick={() => {
                      handleNormalize(pendingNormalization.from, pendingNormalization.to);
                      setPendingNormalization(null);
                    }}>
                      Confirmar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()
      )}
    </div>
  );
} 


