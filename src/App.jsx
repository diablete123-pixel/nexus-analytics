import React, { useState, useRef, useEffect } from 'react';
import { 
  UploadCloud, Database, Bot, FilterX, MousePointerClick, AlertTriangle, 
  Layers, ChevronRight, Plus, Trash2, BarChart, ShoppingBag, Trophy, Calendar,
  FolderOpen, Clock, HardDrive, Home, TableProperties, Play
} from 'lucide-react';

// ============================================================================
// ATENÇÃO: DESCOMENTE AS 4 LINHAS ABAIXO NO SEU VS CODE LOCAL
// ============================================================================
 import AnalistaIA from './pages/AnalistaIA';
 import CustomLab from './pages/CustomLab';
 import Planilha from './pages/Planilha';
 import Apresenta from './pages/Apresenta';

// ============================================================================
// APAGUE ESTES 4 MOCKS NO SEU VS CODE (Eles estão aqui apenas para corrigir o 
// erro de compilação do preview nesta plataforma, mantendo o seu código separado)
// ============================================================================



// --- BASE DE DADOS LOCAL (INDEXED-DB PARA WORKSPACES) ---
const DB_NAME = 'NexusProDB';
const STORE_NAME = 'workspaces';

const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const dbHelper = {
  saveWorkspace: async (workspace) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(workspace);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  getAllWorkspaces: async () => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },
  deleteWorkspace: async (id) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
};

// --- COMPONENTE DE MODAL GLOBAL (CUSTOM DIALOG) ---
const CustomDialogOverlay = ({ isOpen, type, title, message, value, onChange, onSubmit, onCancel }) => {
  if (!isOpen) return null;

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); onSubmit(); }
    if (e.key === 'Escape' && type !== 'alert') { e.preventDefault(); onCancel(); }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 backdrop-blur-sm transition-all">
      <div className="bg-slate-900/95 border border-indigo-500/30 shadow-[0_0_50px_rgba(99,102,241,0.15)] rounded-[2rem] p-8 w-full max-w-md animate-fade-in-up" style={{ animationDuration: '0.3s' }}>
        <h3 className="text-2xl font-black italic text-white mb-2">{title}</h3>
        <p className="text-slate-300 mb-6 leading-relaxed">{message}</p>
        {type === 'prompt' && (
          <input autoFocus type="text" value={value} onChange={onChange} onKeyDown={handleKeyDown} className="w-full bg-black/50 border border-indigo-500/50 rounded-xl px-4 py-3 text-white mb-6 outline-none focus:border-indigo-400 transition-all font-mono" />
        )}
        <div className="flex justify-end gap-3 mt-4">
          {type !== 'alert' && <button onClick={onCancel} className="px-6 py-2.5 rounded-xl font-bold text-sm text-slate-400 hover:text-white hover:bg-white/10 transition-all">Cancelar</button>}
          <button onClick={onSubmit} className="px-6 py-2.5 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all">{type === 'alert' ? 'Entendido' : 'Confirmar'}</button>
        </div>
      </div>
    </div>
  );
};

// --- UTILITÁRIOS GLOBAIS ---
const cleanNumber = (val) => {
  if (typeof val === 'number') return val;
  if (!val) return null;
  let s = String(val).replace(/[R$\s%]/g, '').trim();
  if (s.includes(',')) { s = s.replace(/\./g, ''); s = s.replace(',', '.'); }
  const num = Number(s);
  return isNaN(num) ? null : num;
};

const isDate = (val) => {
  if (!val || typeof val !== 'string') return false;
  if (val.split('/').length === 3 || val.split('-').length === 3) {
    const parts = val.includes('/') ? val.split('/') : val.split('-');
    if (parts.length === 3 && parts.every(p => !isNaN(Number(p)))) return true;
  }
  return false;
};

const formatNumber = (num, compact = true) => {
  if (num === null || num === undefined) return '-';
  return new Intl.NumberFormat('pt-PT', { notation: compact ? "compact" : "standard", maximumFractionDigits: 1, style: 'currency', currency: 'EUR' }).format(num);
};

const cleanString = (str) => {
  if (typeof str !== 'string') return str;
  return str.split('\n').join('').split('\r').join('').trim();
};

const evaluateFormula = (expr, data, headers, visited = new Set()) => {
  if (typeof expr !== 'string' || !expr.startsWith('=')) return expr;
  if (visited.has(expr)) return "#REF!"; 

  const newVisited = new Set(visited);
  newVisited.add(expr);

  let parsedExpr = expr.substring(1).toUpperCase().replace(/\s/g, '').replace(/,/g, '.').replace(/!/g, '');

  parsedExpr = parsedExpr.replace(/([A-Z]+)(\d+)/g, (match, colLetters, rowNum) => {
    let colIdx = 0;
    for (let i = 0; i < colLetters.length; i++) {
        colIdx = colIdx * 26 + (colLetters.charCodeAt(i) - 64);
    }
    colIdx -= 1;
    const rIdx = parseInt(rowNum, 10) - 1;

    if (rIdx >= 0 && rIdx < data.length && colIdx >= 0 && colIdx < headers.length) {
        const header = headers[colIdx];
        let val = data[rIdx][header];
        if (typeof val === 'string' && val.startsWith('=')) {
           val = evaluateFormula(val, data, headers, newVisited); 
        }
        const numVal = cleanNumber(val);
        return numVal !== null && !isNaN(numVal) ? numVal : 0;
    }
    return 0; 
  });

  try {
    if (/^[0-9+\-*/().]+$/.test(parsedExpr)) {
       const result = new Function('return ' + parsedExpr)();
       return isNaN(result) ? "#ERRO!" : result;
    }
    return "#ERRO!";
  } catch (e) {
    return "#ERRO!";
  }
};

// --- MOTOR DE ANÁLISE MULTI-FILES ---
const analyzeDataEngine = (rawInputs, activeFilters) => {
  if (!rawInputs || rawInputs.length === 0) return null;

  const processedFiles = rawInputs.map(raw => {
    let rawData = raw.data || [];
    let rawHeaders = raw.headers || [];
    const cleanHeaders = rawHeaders.map(cleanString);
    const formats = raw.colFormats || {};
    
    const colStats = {};
    cleanHeaders.forEach(h => { colStats[h] = { type: 'string', uniqueValues: new Set(), nullCount: 0 }; });

    let cleanedData = rawData.map((row) => {
      const cleanRow = { ...row, _original_row: { ...row } };
      cleanHeaders.forEach((h, hIdx) => {
        let rawVal = row[rawHeaders[hIdx]] !== undefined ? row[rawHeaders[hIdx]] : row[Object.keys(row).find(k => cleanString(k) === h)];
        if (typeof rawVal === 'string' && rawVal.startsWith('=')) rawVal = evaluateFormula(rawVal, rawData, rawHeaders);
        
        let val = cleanString(rawVal);
        cleanRow[h] = val;
        cleanRow._original_row[h] = rawVal;
        
        if (val === null || val === undefined || val === '') { colStats[h].nullCount++; return; }
        
        const forcedFormat = formats[h];
        const numVal = cleanNumber(val);

        if (forcedFormat === 'currency' || forcedFormat === 'number' || forcedFormat === 'percent') {
            colStats[h].type = 'number'; cleanRow[h] = numVal !== null ? numVal : 0; cleanRow._original_row[h] = cleanRow[h];
        } else if (forcedFormat === 'date') { colStats[h].type = 'date';
        } else {
            if (numVal !== null && /[0-9]/.test(String(val))) { colStats[h].type = 'number'; cleanRow[h] = numVal; cleanRow._original_row[h] = numVal; } 
            else if (isDate(val)) { colStats[h].type = 'date'; } 
            else { colStats[h].type = 'string'; colStats[h].uniqueValues.add(val); }
        }
      });
      return cleanRow;
    });

    const isValueCol = (h) => /valor|venda|preço|faturamento|total|custo|R\$|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez|202/gi.test(h);
    const isEntityCol = (h) => /vendedor|nome|equipe|consultor|player|usuário|cliente/gi.test(h);
    const isProductCol = (h) => /produto|item|serviço|sku|categoria/gi.test(h);

    const numericHeaders = cleanHeaders.filter(h => colStats[h].type === 'number' || isValueCol(h));
    const dimensionHeaders = cleanHeaders.filter(h => !numericHeaders.includes(h));
    const entityHeader = cleanHeaders.find(isEntityCol) || dimensionHeaders[0] || 'Entidade';
    const productHeader = cleanHeaders.find(isProductCol) || (dimensionHeaders[1] !== entityHeader ? dimensionHeaders[1] : dimensionHeaders[2]) || 'Item';

    let normalized = [];
    const isWideFormat = numericHeaders.length > 2 && numericHeaders.some(h => /jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez/gi.test(h));
    
    cleanedData.forEach(row => {
      if (isWideFormat) {
        numericHeaders.forEach(mCol => { normalized.push({ _entity: cleanString(row[entityHeader]) || 'N/A', _item: cleanString(row[productHeader]) || 'N/A', _period: mCol, _value: cleanNumber(row[mCol]), _original_row: row }); });
      } else {
        normalized.push({ _entity: cleanString(row[entityHeader]) || 'N/A', _item: cleanString(row[productHeader]) || 'N/A', _period: cleanString(row[cleanHeaders.find(h => colStats[h].type === 'date')] || cleanHeaders[0]), _value: cleanNumber(row[numericHeaders[0]]), _original_row: row });
      }
    });

    normalized = normalized.filter(r => {
      const e = String(r._entity).toLowerCase().trim();
      const i = String(r._item).toLowerCase().trim();
      if (/^(total|totais|total geral|resumo)$/i.test(e)) return false;
      if (/^(total|totais|total geral|resumo)$/i.test(i)) return false;
      if ((e === 'n/a' || e === '') && (i === 'n/a' || i === '')) return false;
      return true;
    });

    return { name: raw.name, cleanHeaders, numericHeaders, dimensionHeaders, entityHeader, productHeader, data: normalized };
  });

  const mainFile = processedFiles[0];
  let currentData = mainFile?.data || [];
  
  (activeFilters || []).forEach(f => {
    currentData = currentData.filter(row => String(row[f.col]) === String(f.val));
  });

  const aggregate = (data, groupKey) => {
    const res = {};
    data.forEach(r => { res[r[groupKey]] = (res[r[groupKey]] || 0) + (r._value || 0); });
    return Object.entries(res).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
  };

  const leaders = aggregate(currentData, '_entity');
  const items = aggregate(currentData, '_item');
  const periods = aggregate(currentData, '_period');
  const totalScope = currentData.reduce((s, r) => s + (r._value || 0), 0);

  let anomaly = null;
  if (leaders.length >= 2) {
    const avg = totalScope / leaders.length;
    if (leaders[0].value > avg * 2.5) {
      anomaly = { type: 'dominance', name: leaders[0].name, ratio: (leaders[0].value / avg).toFixed(1) };
    }
  }

  let insightText = "";
  let insightOptions = [];
  let architectReport = null;

  if ((activeFilters || []).length === 0) {
    architectReport = { diagnostico: processedFiles.length > 1 ? `Mesclados ${processedFiles.length} ficheiros. Relacionamento (PROCV) Ativo.` : `Analisadas ${mainFile?.data?.length || 0} linhas. Lixo e totais removidos.`, kpis: `${mainFile?.entityHeader || 'Entidade'}, ${mainFile?.productHeader || 'Item'}`, estrutura: 'Estrutura Relacional Otimizada.' };
    if (leaders.length > 0) {
      const diff = leaders[1] ? (((leaders[0].value - leaders[1].value) / (leaders[1].value || 1)) * 100).toFixed(0) : 0;
      insightText = `A análise revela que "${leaders[0].name}" é a força motriz, garantindo ${diff}% a mais que a base de apoio. Use os gráficos para Drill-down ou aceda ao "Custom Lab".`;
      insightOptions = [{ label: `Focar análise em "${leaders[0].name}"`, action: { type: 'push', col: '_entity', val: leaders[0].name }, icon: MousePointerClick }];
    } else insightText = "Nenhuma métrica de valor expressiva detetada. Use o Laboratório para explorar.";
  } else {
    const lastFilter = activeFilters[activeFilters.length - 1];
    insightText = `Drill-down Nível ${activeFilters.length}. Visão isolada para [${lastFilter.val}]. O item com melhor desempenho neste contexto é "${items[0]?.name || 'N/A'}".`;
    insightOptions = [{ label: `Mergulhar focando em "${items[0]?.name || 'N/A'}"`, action: { type: 'push', col: '_item', val: items[0]?.name || 'N/A' }, icon: Layers }, { label: `Remover Filtros`, action: { type: 'clear' }, icon: FilterX }];
  }

  const widgets = [];
  widgets.push({ id: 'insight', type: 'insight', title: 'Consultor Executivo IA', text: insightText, options: insightOptions, anomaly, report: architectReport, span: 'col-span-12' });

  if (currentData.length > 0) {
    widgets.push({ id: 'k1', type: 'kpi', title: `Líder: ${mainFile?.entityHeader}`, val: leaders[0]?.name, sub: formatNumber(leaders[0]?.value), icon: Trophy, color: 'amber', span: 'col-span-4' });
    widgets.push({ id: 'k2', type: 'kpi', title: `Líder: ${mainFile?.productHeader}`, val: items[0]?.name, sub: formatNumber(items[0]?.value), icon: ShoppingBag, color: 'cyan', span: 'col-span-4' });
    widgets.push({ id: 'k3', type: 'kpi', title: 'Maior Pico Identificado', val: periods[0]?.name, sub: formatNumber(periods[0]?.value), icon: Calendar, color: 'fuchsia', span: 'col-span-4' });
    widgets.push({ id: 'b1', type: 'battle', title: `Ranking: ${mainFile?.entityHeader}`, data: leaders, keyCol: '_entity', span: 'col-span-7' });
    widgets.push({ id: 'd1', type: 'distribution', title: `Mix: ${mainFile?.productHeader}`, data: items, keyCol: '_item', span: 'col-span-5' });
    widgets.push({ id: 't1', type: 'trend', title: 'Evolução Temporal', data: periods, keyCol: '_period', span: 'col-span-12' });
  }

  let availableMetrics = [];
  processedFiles.forEach(ds => { (ds.numericHeaders || []).forEach(h => { availableMetrics.push(processedFiles.length > 1 ? `[${ds.name}] ${h}` : h); }); });

  return { widgets, availableMetrics, availableDimensions: mainFile?.dimensionHeaders || [], processedFiles, activeFilters };
};

// --- APLICAÇÃO PRINCIPAL (APP) ---
const App = () => {
  const [appState, setAppState] = useState('workspace');
  const [activeTab, setActiveTab] = useState('ia'); 
  const [activeWorkspace, setActiveWorkspace] = useState(null); 
  const [savedWorkspaces, setSavedWorkspaces] = useState([]);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  
  const [rawInputs, setRawInputs] = useState([]);
  const [filterStack, setFilterStack] = useState([]);
  const [result, setResult] = useState(null);
  const [customCharts, setCustomCharts] = useState([]);
  
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [gridData, setGridData] = useState([]);
  const [gridHeaders, setGridHeaders] = useState([]);
  const [gridColFormats, setGridColFormats] = useState({});
  const [gridCurrencySymbols, setGridCurrencySymbols] = useState({});
  const [hasUnsavedGridChanges, setHasUnsavedGridChanges] = useState(false);

  // NOVO: Estado para abrir a Apresentação ("PowerPoint")
  const [showPresentation, setShowPresentation] = useState(false);

  const [dialogState, setDialogState] = useState({ isOpen: false, type: 'alert', title: '', message: '', value: '' });
  const resolveDialogRef = useRef(null);

  const showDialog = (type, title, message, defaultValue = '') => {
    return new Promise((resolve) => {
      resolveDialogRef.current = resolve;
      setDialogState({ isOpen: true, type, title, message, value: defaultValue });
    });
  };

  const handleDialogSubmit = () => {
    if (resolveDialogRef.current) { resolveDialogRef.current(dialogState.type === 'prompt' ? dialogState.value : true); resolveDialogRef.current = null; }
    setDialogState(prev => ({ ...prev, isOpen: false }));
  };

  const handleDialogCancel = () => {
    if (resolveDialogRef.current) { resolveDialogRef.current(dialogState.type === 'prompt' ? null : false); resolveDialogRef.current = null; }
    setDialogState(prev => ({ ...prev, isOpen: false }));
  };

  const handleDialogChange = (e) => setDialogState(prev => ({ ...prev, value: e.target.value }));

  useEffect(() => {
    if (!window.XLSX) {
      const script = document.createElement('script');
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  useEffect(() => {
    dbHelper.getAllWorkspaces().then(data => setSavedWorkspaces(data.sort((a, b) => b.id - a.id))).catch(e => console.error("Erro ao carregar BD", e));
  }, []);

  useEffect(() => {
    if (rawInputs.length > 0) {
      setResult(analyzeDataEngine(rawInputs, filterStack));
      if (rawInputs[activeFileIndex]) {
         setGridData(JSON.parse(JSON.stringify(rawInputs[activeFileIndex].data || []))); 
         setGridHeaders([...(rawInputs[activeFileIndex].headers || [])]);
         setGridColFormats({ ...(rawInputs[activeFileIndex].colFormats || {}) });
         setGridCurrencySymbols({ ...(rawInputs[activeFileIndex].colSymbols || {}) });
         setHasUnsavedGridChanges(false);
      }
    }
  }, [rawInputs, filterStack, activeFileIndex]);

  const updateWorkspaceCharts = (updatedCharts) => {
    setCustomCharts(updatedCharts);
    if (activeWorkspace) {
       const updatedWs = { ...activeWorkspace, customCharts: updatedCharts };
       setActiveWorkspace(updatedWs);
       dbHelper.saveWorkspace(updatedWs).catch(console.error);
       setSavedWorkspaces(prev => prev.map(w => w.id === updatedWs.id ? updatedWs : w));
    }
  };

  const handleWorkspaceSelect = (ws) => {
    setAppState('analyzing'); setRawInputs(ws.files || []); setActiveWorkspace(ws); setCustomCharts(ws.customCharts || []); setActiveFileIndex(0);
    setTimeout(() => setAppState('dashboard'), 800);
  };

  const handleWorkspaceDelete = async (id, e) => {
    e.stopPropagation();
    const confirmed = await showDialog('confirm', 'Eliminar Projeto', "Tem a certeza que deseja eliminar este projeto permanentemente?");
    if (confirmed) { await dbHelper.deleteWorkspace(id); setSavedWorkspaces(prev => prev.filter(w => w.id !== id)); }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    if (!window.XLSX) { await showDialog('alert', 'Aviso', "O motor do Excel está a carregar, tente novamente num segundo."); return; }
    setAppState('analyzing');
    
    const readSingleFile = (file) => new Promise((resolve, reject) => {
       const reader = new FileReader();
       reader.onload = (evt) => {
          try {
             const data = new Uint8Array(evt.target.result);
             const workbook = window.XLSX.read(data, { type: 'array' });
             const json = window.XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
             resolve({ name: file.name, data: json, headers: json.length > 0 ? Object.keys(json[0]) : [] });
          } catch(err) { reject(err); }
       };
       reader.readAsArrayBuffer(file);
    });

    try {
       const datasets = await Promise.all(files.map(f => readSingleFile(f)));
       if (datasets.some(ds => (ds.data || []).length === 0)) throw new Error("Uma das folhas de cálculo está vazia.");
       
       const newWs = { id: Date.now(), name: newWorkspaceName || `Projeto Analítico - ${new Date().toLocaleDateString('pt-PT')}`, date: new Date().toISOString(), files: datasets.map(ds => ({ ...ds, colFormats: {}, colSymbols: {} })), customCharts: [] };
       await dbHelper.saveWorkspace(newWs);
       setSavedWorkspaces(prev => [newWs, ...prev]);
       setRawInputs(datasets); setActiveWorkspace(newWs); setCustomCharts([]); setActiveFileIndex(0);
       setTimeout(() => setAppState('dashboard'), 1000);
    } catch (err) { await showDialog('alert', 'Erro', "Erro ao ler ficheiros: " + err.message); setAppState('upload'); }
  };

  const handleAction = (a) => {
    if (a.type === 'push') setFilterStack([...filterStack, { col: a.col, val: a.val }]);
    if (a.type === 'pop') setFilterStack(filterStack.slice(0, -1));
    if (a.type === 'clear') setFilterStack([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveGridChanges = async () => {
    if (!activeWorkspace) return;
    const updatedInputs = [...rawInputs];
    updatedInputs[activeFileIndex] = { ...updatedInputs[activeFileIndex], data: gridData, headers: gridHeaders, colFormats: gridColFormats, colSymbols: gridCurrencySymbols };
    const updatedWs = { ...activeWorkspace, files: updatedInputs, date: new Date().toISOString() };
    setRawInputs(updatedInputs); setActiveWorkspace(updatedWs); await dbHelper.saveWorkspace(updatedWs);
    setSavedWorkspaces(prev => prev.map(w => w.id === updatedWs.id ? updatedWs : w));
    setHasUnsavedGridChanges(false); await showDialog('alert', 'Sucesso', "Alterações guardadas com sucesso! Os gráficos foram atualizados.");
  };

  if (appState === 'workspace') return (
    <div className="min-h-screen bg-[#020617] text-white p-12 relative overflow-hidden">
       <CustomDialogOverlay {...dialogState} onChange={handleDialogChange} onSubmit={handleDialogSubmit} onCancel={handleDialogCancel} />
       <style dangerouslySetInnerHTML={{__html: `@keyframes fade-in-up { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in-up { animation: fade-in-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }`}} />
       <div className="fixed top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_-20%,#1e1b4b,transparent)] pointer-events-none z-0" />
       <div className="relative z-10 max-w-7xl mx-auto">
          <header className="flex flex-row justify-between items-center mb-16 gap-6 animate-fade-in-up">
            <div><h1 className="text-5xl font-black tracking-tighter italic">NEXUS <span className="text-indigo-500">PRO.</span></h1><p className="text-slate-400 mt-2 font-bold uppercase tracking-widest text-xs">A sua Área de Trabalho</p></div>
            <button onClick={() => setAppState('upload')} className="px-8 py-4 bg-indigo-600 rounded-2xl font-black uppercase text-xs hover:bg-indigo-500 transition-all shadow-2xl shadow-indigo-600/40 flex items-center gap-3 text-white"><Plus size={18}/> Novo Projeto de Análise</button>
          </header>

          {savedWorkspaces.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 opacity-30 animate-fade-in-up"><FolderOpen size={100} className="mb-6 text-indigo-400"/><h2 className="text-3xl font-black italic uppercase">Nenhum projeto guardado.</h2><p className="text-xl">Crie o seu primeiro projeto de análise clicando acima.</p></div>
          ) : (
            <div className="grid grid-cols-4 gap-6 animate-fade-in-up">
               {savedWorkspaces.map((ws, i) => (
                 <div key={ws.id} onClick={() => handleWorkspaceSelect(ws)} className="bg-slate-900/60 backdrop-blur-xl border border-white/10 p-8 rounded-[2rem] cursor-pointer hover:border-indigo-500/50 hover:bg-slate-800/80 transition-all duration-300 group relative flex flex-col h-64" style={{ animationDelay: `${i * 50}ms` }}>
                    <button onClick={(e) => handleWorkspaceDelete(ws.id, e)} className="absolute top-6 right-6 p-2 bg-rose-500/10 text-rose-500 rounded-xl opacity-0 group-hover:opacity-100 hover:bg-rose-500 hover:text-white transition-all" title="Eliminar Projeto"><Trash2 size={16}/></button>
                    <div className="w-14 h-14 bg-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center mb-6 shrink-0 group-hover:scale-110 transition-transform"><Database size={24}/></div>
                    <h3 className="text-xl font-black text-white truncate w-[85%] mb-2">{ws.name}</h3>
                    <div className="mt-auto space-y-2">
                       <div className="flex items-center gap-2 text-xs font-bold text-slate-400"><HardDrive size={14}/> {(ws.files || []).length} Folha(s)</div>
                       <div className="flex items-center gap-2 text-xs font-bold text-slate-400"><BarChart size={14}/> {(ws.customCharts || []).length} Painéis</div>
                       <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><Clock size={14}/> Editado {new Date(ws.date).toLocaleDateString('pt-PT')}</div>
                    </div>
                 </div>
               ))}
            </div>
          )}
       </div>
    </div>
  );

  if (appState === 'upload') return (
    <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-6 relative">
      <CustomDialogOverlay {...dialogState} onChange={handleDialogChange} onSubmit={handleDialogSubmit} onCancel={handleDialogCancel} />
      <style dangerouslySetInnerHTML={{__html: `@keyframes fade-in-up { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in-up { animation: fade-in-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }`}} />
      <div className="absolute inset-0 bg-gradient-to-bl from-indigo-900/20 via-[#020617] to-cyan-900/20 pointer-events-none" />
      <div className="max-w-4xl w-full relative z-10 animate-fade-in-up">
        <button onClick={() => setAppState('workspace')} className="mb-8 text-slate-400 hover:text-white font-bold uppercase text-xs tracking-widest flex items-center gap-2"><ChevronRight className="rotate-180" size={16}/> Voltar à Área de Trabalho</button>
        <h1 className="text-6xl font-black tracking-tighter mb-4 italic">CRIAR <span className="text-indigo-500">PROJETO.</span></h1>
        <p className="text-slate-400 text-lg mb-12">Os seus dados ficarão guardados na base de dados interna de forma segura.</p>
        <div className="bg-slate-900/60 backdrop-blur-2xl border border-white/10 rounded-[3rem] p-10 shadow-2xl">
           <div className="mb-8">
              <label className="text-xs font-black text-indigo-400 uppercase tracking-widest block mb-3">Nome do Projeto</label>
              <input type="text" placeholder="Ex: Fecho Trimestral 2026" value={newWorkspaceName} onChange={(e) => setNewWorkspaceName(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-2xl p-5 text-xl font-bold text-white outline-none focus:border-indigo-500 transition-colors" />
           </div>
           <label className="w-full p-16 bg-black/30 border-dashed border-2 border-indigo-500/30 rounded-3xl cursor-pointer hover:bg-indigo-500/10 transition-all duration-300 flex flex-col items-center justify-center group mb-6">
              <input type="file" multiple onChange={handleFileUpload} className="hidden" accept=".xlsx,.csv" />
              <UploadCloud size={50} className="mb-4 text-indigo-400 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-black uppercase text-indigo-100">Carregar Folha(s) de Cálculo e Guardar</h3>
           </label>
        </div>
      </div>
    </div>
  );

  if (appState === 'analyzing') return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center"><h2 className="text-3xl font-black uppercase tracking-widest text-indigo-400 animate-pulse">A carregar a Base de Dados...</h2></div>;

  return (
    <div className="min-h-screen bg-[#020617] text-white p-12 relative overflow-x-hidden">
      <CustomDialogOverlay {...dialogState} onChange={handleDialogChange} onSubmit={handleDialogSubmit} onCancel={handleDialogCancel} />
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { height: 8px; width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }
        @keyframes fade-in-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in-up { animation: fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}} />
      <div className="fixed top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_-20%,#1e1b4b,transparent)] pointer-events-none z-0" />

      <header className="relative z-10 flex flex-row justify-between items-center gap-8 mb-12 border-b border-white/5 pb-8 animate-fade-in-up">
        <div>
          <h1 className="text-4xl font-black tracking-tighter italic">NEXUS <span className="text-indigo-500">PRO 2026</span></h1>
          <div className="flex gap-4 mt-6">
            <button onClick={() => setActiveTab('ia')} className={`px-6 py-2 rounded-xl text-[10px] font-black tracking-widest border transition-all flex items-center gap-2 ${activeTab==='ia' ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-white/5 border-white/10 text-slate-500 hover:text-white'}`}><Bot size={14}/> ANALISTA IA</button>
            <button onClick={() => setActiveTab('lab')} className={`px-6 py-2 rounded-xl text-[10px] font-black tracking-widest border transition-all flex items-center gap-2 ${activeTab==='lab' ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-white/5 border-white/10 text-slate-500 hover:text-white'}`}><BarChart size={14}/> CUSTOM LAB</button>
            <button onClick={() => setActiveTab('data')} className={`px-6 py-2 rounded-xl text-[10px] font-black tracking-widest border transition-all flex items-center gap-2 ${activeTab==='data' ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-white/5 border-white/10 text-slate-500 hover:text-white'}`}><TableProperties size={14}/> PLANILHA DE DADOS</button>
          </div>
          {activeTab !== 'data' && (
            <div className="flex flex-wrap gap-2 mt-4 items-center">
               <button onClick={() => setFilterStack([])} className={`px-4 py-1.5 rounded-full text-[10px] font-black border ${filterStack.length === 0 ? 'bg-indigo-500 border-indigo-400 text-white' : 'bg-white/5 border-white/10 text-slate-500'}`}>GLOBAL</button>
               {filterStack.map((f, i) => (<div key={i} className="flex items-center gap-2"><ChevronRight size={14} className="text-slate-700"/><span className="px-4 py-1.5 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 text-[10px] font-black uppercase">{f.val}</span></div>))}
            </div>
          )}
        </div>
        <div className="flex flex-row gap-4">
           {/* BOTÃO DE APRESENTAÇÃO APARECE SE HOUVER GRÁFICOS */}
           {customCharts.length > 0 && (
              <button onClick={() => setShowPresentation(true)} className="px-8 py-3 bg-fuchsia-600 border border-fuchsia-500 rounded-xl font-black text-xs hover:bg-fuchsia-500 text-white shadow-lg shadow-fuchsia-600/30 flex items-center justify-center gap-2 animate-fade-in-up"><Play fill="currentColor" size={16}/> APRESENTAR</button>
           )}
           <button onClick={() => { setAppState('workspace'); setRawInputs([]); setResult(null); setCustomCharts([]); setActiveWorkspace(null); }} className="px-8 py-3 bg-slate-800 border border-white/10 rounded-xl font-black text-xs hover:bg-slate-700 text-white flex items-center justify-center gap-2"><Home size={16}/> WORKSPACE</button>
           <button onClick={() => { setAppState('upload'); setNewWorkspaceName(''); }} className="px-8 py-3 bg-indigo-600 border border-indigo-500 rounded-xl font-black text-xs hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"><Plus size={16}/> NOVO PROJETO</button>
        </div>
      </header>

      <div className="relative z-10 max-w-[1700px] mx-auto">
        {activeTab === 'ia' && (
          <AnalistaIA result={result} handleAction={handleAction} />
        )}

        {activeTab === 'lab' && (
          <CustomLab 
            result={result} 
            customCharts={customCharts} 
            updateWorkspaceCharts={updateWorkspaceCharts} 
            showDialog={showDialog} 
          />
        )}

        {activeTab === 'data' && (
          <Planilha 
            rawInputs={rawInputs}
            activeFileIndex={activeFileIndex}
            setActiveFileIndex={setActiveFileIndex}
            gridData={gridData}
            setGridData={setGridData}
            gridHeaders={gridHeaders}
            setGridHeaders={setGridHeaders}
            gridColFormats={gridColFormats}
            setGridColFormats={setGridColFormats}
            gridCurrencySymbols={gridCurrencySymbols}
            setGridCurrencySymbols={setGridCurrencySymbols}
            hasUnsavedGridChanges={hasUnsavedGridChanges}
            setHasUnsavedGridChanges={setHasUnsavedGridChanges}
            saveGridChanges={saveGridChanges}
            showDialog={showDialog}
          />
        )}
      </div>

      {/* RENDERIZAÇÃO DA PÁGINA APRESENTAÇÃO */}
      {showPresentation && (
        <Apresenta 
          result={result} 
          customCharts={customCharts} 
          onClose={() => setShowPresentation(false)} 
        />
      )}
    </div>
  );
};

export default App;