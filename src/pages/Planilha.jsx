import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Rows, Columns, DownloadCloud, Save, ChevronLeft, ChevronRight, 
  ArrowLeft, ArrowRight, Plus, Trash2, ArrowUp, ArrowDown,
  Maximize, Minimize, CircleDollarSign, UploadCloud, BarChart3,
  Printer, Image as ImageIcon
} from 'lucide-react';

// --- UTILITÁRIOS LOCAIS DA PLANILHA ---
const getColumnLetter = (colIndex) => {
  let letter = '';
  while (colIndex >= 0) {
    letter = String.fromCharCode((colIndex % 26) + 65) + letter;
    colIndex = Math.floor(colIndex / 26) - 1;
  }
  return letter;
};

// Extrai as coordenadas { rIdx, colIdx } de uma referência tipo "A1"
const getCellCoords = (ref) => {
  const match = ref.match(/^([A-Z]+)(\d+)$/i);
  if (!match) return null;
  let colIdx = 0;
  const colLetters = match[1].toUpperCase();
  for (let i = 0; i < colLetters.length; i++) {
      colIdx = colIdx * 26 + (colLetters.charCodeAt(i) - 64);
  }
  colIdx -= 1;
  const rIdx = parseInt(match[2], 10) - 1;
  return { rIdx, colIdx };
};

const cleanNumber = (val) => {
  if (typeof val === 'number') return val;
  if (!val) return null;
  let s = String(val).replace(/[^\d.,-]/g, '').trim();
  if (s.includes(',')) { s = s.replace(/\./g, ''); s = s.replace(',', '.'); }
  const num = Number(s);
  return isNaN(num) ? null : num;
};

const formatGridValue = (val, format, symbol = 'R$') => {
  if (val === null || val === undefined || val === '') return '';
  if (val === '#ERRO!' || val === '#REF!') return val;
  const num = cleanNumber(val);
  if (num === null) return String(val);

  switch(format) {
      case 'currency': 
         const sym = symbol ? symbol.trim() : 'R$';
         return `${sym} ${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num)}`;
      case 'number': return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(num);
      case 'percent': return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(num) + '%';
      case 'date': 
         if (num > 10000 && num < 100000) return new Date(Math.round((num - 25569) * 86400 * 1000)).toLocaleDateString('pt-BR');
         return String(val);
      default: return String(val);
  }
};

const getTargetSymbol = (colKey, colFormats, colSymbols) => {
  if (!colKey) return 'R$';
  return colFormats[colKey] === 'currency' ? (colSymbols[colKey] || 'R$') : 'R$';
};

const convertCurrency = (value, fromSym, toSym, rates) => {
  if (!fromSym || !toSym || fromSym === toSym) return value;
  const rateFrom = rates[fromSym] || 1;
  const rateTo = rates[toSym] || 1;
  return (value * rateFrom) / rateTo;
};

// --- DESLOCAMENTO INTELIGENTE DE FÓRMULAS (SMART SHIFT) ---
const updateFormulasOnShift = (data, colMappingFn, rowMappingFn = (r) => r) => {
  return data.map((row) => {
    const newRow = { ...row };
    Object.keys(newRow).forEach(colKey => {
      const val = newRow[colKey];
      if (typeof val === 'string' && val.startsWith('=')) {
        newRow[colKey] = val.replace(/([A-Z]+)(\d+)/gi, (match, colStr, rowStr) => {
          let colIdx = 0;
          const colLetters = colStr.toUpperCase();
          for (let i = 0; i < colLetters.length; i++) {
              colIdx = colIdx * 26 + (colLetters.charCodeAt(i) - 64);
          }
          colIdx -= 1;
          const rIdxRef = parseInt(rowStr, 10) - 1;
          
          const newColIdx = colMappingFn(colIdx);
          const newRowIdx = rowMappingFn(rIdxRef);
          
          if (newColIdx === -1 || newRowIdx === -1) return `#REF!`;
          if (newColIdx === colIdx && newRowIdx === rIdxRef) return match;
          
          let letter = '';
          let tempIdx = newColIdx;
          while (tempIdx >= 0) {
              letter = String.fromCharCode((tempIdx % 26) + 65) + letter;
              tempIdx = Math.floor(tempIdx / 26) - 1;
          }
          return `${letter}${newRowIdx + 1}`;
        });
      }
    });
    return newRow;
  });
};

const FORMULAS_LIST = [
  { name: 'SOMA', desc: 'Soma valores' },
  { name: 'SOMASE', desc: 'Soma com condição' },
  { name: 'MÉDIA', desc: 'Calcula a média' },
  { name: 'MÍNIMO', desc: 'Menor valor' },
  { name: 'MÁXIMO', desc: 'Maior valor' },
  { name: 'CONT.SE', desc: 'Conta com condição' },
  { name: 'ABS', desc: 'Valor absoluto (sem sinal)' },
  { name: 'ARRED', desc: 'Arredonda um número' },
  { name: 'INT', desc: 'Parte inteira do número' },
  { name: 'MOD', desc: 'Resto da divisão' }
];

const evaluateFormula = (expr, data, headers, colFormats, colSymbols, rates, targetColKey, visited = new Set()) => {
  if (typeof expr !== 'string' || !expr.startsWith('=')) return expr;
  if (visited.has(expr)) return "#REF!"; 

  const newVisited = new Set(visited);
  newVisited.add(expr);

  let exprToParse = expr.substring(1);
  const targetSym = getTargetSymbol(targetColKey, colFormats, colSymbols);

  const rateSymbols = Object.keys(rates).sort((a,b) => b.length - a.length); 
  if (rateSymbols.length > 0) {
      const escapedSymbols = rateSymbols.map(s => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')).join('|');
      const currencyRegex = new RegExp(`(${escapedSymbols})\\s*(\\d+(?:[.,]\\d+)?)`, 'gi');
      
      exprToParse = exprToParse.replace(currencyRegex, (match, sym, numStr) => {
          const num = parseFloat(numStr.replace(',', '.'));
          const exactSym = rateSymbols.find(s => s.toLowerCase() === sym.toLowerCase()) || sym;
          return convertCurrency(num, exactSym, targetSym, rates).toString();
      });
  }

  let parsedExpr = exprToParse.toUpperCase().replace(/\s/g, '').replace(/,/g, '.').replace(/!/g, '');

  const openParens = (parsedExpr.match(/\(/g) || []).length;
  const closeParens = (parsedExpr.match(/\)/g) || []).length;
  if (openParens > closeParens) {
    parsedExpr += ')'.repeat(openParens - closeParens);
  }

  const getCellValue = (rIdx, colIdx) => {
    if (rIdx >= 0 && rIdx < data.length && colIdx >= 0 && colIdx < headers.length) {
        const refColKey = headers[colIdx];
        let val = data[rIdx][refColKey];
        if (typeof val === 'string' && val.startsWith('=')) {
           val = evaluateFormula(val, data, headers, colFormats, colSymbols, rates, refColKey, newVisited); 
        }
        const numVal = cleanNumber(val);
        if (numVal === null || isNaN(numVal)) return null;

        const refSym = getTargetSymbol(refColKey, colFormats, colSymbols);
        return convertCurrency(numVal, refSym, targetSym, rates);
    }
    return null; 
  };

  parsedExpr = parsedExpr.replace(/(SOMA|MÉDIA|MEDIA|MÍNIMO|MINIMO|MÁXIMO|MAXIMO)\(([A-Z0-9:;]*)\)/g, (match, funcName, rangeStr) => {
      if (!rangeStr) return "0";
      const parts = rangeStr.split(/[:;]/);
      let values = [];

      if (parts.length >= 2) { 
          const start = getCellCoords(parts[0]);
          const end = getCellCoords(parts[parts.length - 1]);
          if (start && end) {
              const minR = Math.min(start.rIdx, end.rIdx);
              const maxR = Math.max(start.rIdx, end.rIdx);
              const minC = Math.min(start.colIdx, end.colIdx);
              const maxC = Math.max(start.colIdx, end.colIdx);

              for (let r = minR; r <= maxR; r++) {
                  for (let c = minC; c <= maxC; c++) {
                      const val = getCellValue(r, c);
                      if (val !== null) values.push(val);
                  }
              }
          }
      } else if (parts.length === 1) { 
           const start = getCellCoords(parts[0]);
           if (start) {
               const val = getCellValue(start.rIdx, start.colIdx);
               if (val !== null) values.push(val);
           }
      }

      if (values.length === 0) return "0";

      const upperFunc = funcName;
      if (upperFunc === 'SOMA') return values.reduce((a, b) => a + b, 0).toString();
      if (upperFunc === 'MÉDIA' || upperFunc === 'MEDIA') return (values.reduce((a, b) => a + b, 0) / values.length).toString();
      if (upperFunc === 'MÍNIMO' || upperFunc === 'MINIMO') return Math.min(...values).toString();
      if (upperFunc === 'MÁXIMO' || upperFunc === 'MAXIMO') return Math.max(...values).toString();
      
      return "0";
  });

  parsedExpr = parsedExpr.replace(/(SOMASE|CONT\.SE|CONTSE)\(([A-Z0-9:]+)[;]([^)]+)\)/g, (match, funcName, rangeStr, condStr) => {
      const parts = rangeStr.split(':');
      let values = [];

      if (parts.length >= 1) {
          const start = getCellCoords(parts[0]);
          const end = getCellCoords(parts[parts.length - 1]);
          if (start && end) {
              const minR = Math.min(start.rIdx, end.rIdx);
              const maxR = Math.max(start.rIdx, end.rIdx);
              const minC = Math.min(start.colIdx, end.colIdx);
              const maxC = Math.max(start.colIdx, end.colIdx);

              for (let r = minR; r <= maxR; r++) {
                  for (let c = minC; c <= maxC; c++) {
                      const val = getCellValue(r, c);
                      if (val !== null) values.push(val);
                  }
              }
          }
      }

      let cleanCond = condStr.replace(/['"]/g, '').trim(); 
      let op = '==';
      let condVal = 0;

      const opMatch = cleanCond.match(/^(>=|<=|<>|>|<|=)?(.*)$/);
      if (opMatch) {
          if (opMatch[1]) {
              op = opMatch[1];
              if (op === '=') op = '==';
              if (op === '<>') op = '!=';
          }
          
          let rawVal = opMatch[2].trim();
          const isPercent = rawVal.endsWith('%');
          if (isPercent) rawVal = rawVal.slice(0, -1);

          const cellRefMatch = getCellCoords(rawVal);
          if (cellRefMatch) {
              condVal = getCellValue(cellRefMatch.rIdx, cellRefMatch.colIdx) || 0;
          } else {
              condVal = parseFloat(rawVal) || 0;
          }
          if (isPercent) condVal = condVal / 100;
      }

      let result = 0;
      values.forEach(v => {
          let isMatch = false;
          if (op === '==') isMatch = (v === condVal);
          else if (op === '!=') isMatch = (v !== condVal);
          else if (op === '>') isMatch = (v > condVal);
          else if (op === '<') isMatch = (v < condVal);
          else if (op === '>=') isMatch = (v >= condVal);
          else if (op === '<=') isMatch = (v <= condVal);

          if (isMatch) {
              if (funcName.startsWith('SOMA')) result += v;
              else result += 1;
          }
      });

      return result.toString();
  });

  parsedExpr = parsedExpr.replace(/([A-Z]+)(\d+)/g, (match) => {
    const coords = getCellCoords(match);
    if (coords) {
       const val = getCellValue(coords.rIdx, coords.colIdx);
       return val !== null ? val : 0;
    }
    return 0; 
  });

  parsedExpr = parsedExpr.replace(/([0-9.]+)\%/g, '($1/100)');

  try {
    let evalExpr = parsedExpr.replace(/;/g, ',');
    
    if (/^[0-9+\-*/().,eE\sABDEIMNORST]+$/i.test(evalExpr)) {
       const ARRED = (v, p=0) => Number(Math.round(v + 'e' + p) + 'e-' + p);
       const ABS = Math.abs;
       const INT = Math.floor;
       const MOD = (a, b) => { const r = a % b; return r < 0 ? r + b : r; };
       
       const result = new Function('ARRED', 'ABS', 'INT', 'MOD', 'return ' + evalExpr)(ARRED, ABS, INT, MOD);
       return isNaN(result) ? "#ERRO!" : result;
    }
    return "#ERRO!";
  } catch (e) {
    return "#ERRO!";
  }
};

// --- COMPONENTE PRINCIPAL DA PLANILHA ---
const Planilha = ({ 
  rawInputs = [], 
  activeFileIndex = 0, 
  setActiveFileIndex = () => {},
  gridData = [], 
  setGridData = () => {},
  gridHeaders = [], 
  setGridHeaders = () => {},
  gridColFormats = {}, 
  setGridColFormats = () => {},
  gridCurrencySymbols = {}, 
  setGridCurrencySymbols = () => {},
  hasUnsavedGridChanges = false, 
  setHasUnsavedGridChanges = () => {},
  saveGridChanges = () => {}, 
  showDialog = async () => true
}) => {
  // ESTADOS INTERNOS (UI da Planilha)
  const [gridPage, setGridPage] = useState(0);
  const [editingCell, setEditingCell] = useState(null); 
  const [editValue, setEditValue] = useState("");
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectionEnd, setSelectionEnd] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // ESTADOS PARA SELEÇÃO EM MODO FÓRMULA
  const [isSelectingFormula, setIsSelectingFormula] = useState(false);
  const [formulaStartCell, setFormulaStartCell] = useState(null);
  const [preSelectionEditValue, setPreSelectionEditValue] = useState("");

  const isSelectingFormulaRef = useRef(false);
  const formulaStartCellRef = useRef(null);
  const preSelectionEditValueRef = useRef("");
  const editInputRef = useRef(null);
  const importFileRef = useRef(null);
  const printContentRef = useRef(null); // Referência para a área exata a ser impressa

  // ESTADOS DE IMPRESSÃO / PDF
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printOrientation, setPrintOrientation] = useState('landscape');
  const [userLogo, setUserLogo] = useState(() => {
    try { return localStorage.getItem('nexus_user_logo') || null; } catch { return null; }
  });

  useEffect(() => {
    if (userLogo) localStorage.setItem('nexus_user_logo', userLogo);
    else localStorage.removeItem('nexus_user_logo');
  }, [userLogo]);

  // ESTADO DO CÂMBIO E KPIS (LOCAL STORAGE)
  const [isExchangeModalOpen, setIsExchangeModalOpen] = useState(false);
  
  const [exchangeRates, setExchangeRates] = useState(() => {
    try {
      const saved = localStorage.getItem(`nexus_rates_${activeFileIndex}`);
      return saved ? JSON.parse(saved) : { 'R$': 1, '$': 5.23, '€': 5.60 };
    } catch { return { 'R$': 1, '$': 5.23, '€': 5.60 }; }
  });

  const [kpiColumns, setKpiColumns] = useState(() => {
    try {
      const saved = localStorage.getItem(`nexus_kpis_${activeFileIndex}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  }); 

  const [showKpiBar, setShowKpiBar] = useState(() => {
    try {
      const saved = localStorage.getItem('nexus_show_kpi_bar');
      return saved !== null ? JSON.parse(saved) : true;
    } catch { return true; }
  });
  
  const gridContainerRef = useRef(null);
  const scrollIntervalRef = useRef(null);
  const rowsPerPage = 100;

  useEffect(() => {
    isSelectingFormulaRef.current = isSelectingFormula;
    formulaStartCellRef.current = formulaStartCell;
    preSelectionEditValueRef.current = preSelectionEditValue;
  }, [isSelectingFormula, formulaStartCell, preSelectionEditValue]);

  // Efeito executado quando muda de arquivo/folha
  useEffect(() => {
    setGridPage(0);
    setSelectionStart(null);
    setSelectionEnd(null);
    setEditingCell(null);
    setIsSelectingFormula(false);
    
    // Recupera KPIs e Câmbio salvos do localStorage para a folha atual
    try {
      const savedKpis = localStorage.getItem(`nexus_kpis_${activeFileIndex}`);
      if (savedKpis) setKpiColumns(JSON.parse(savedKpis));
      else setKpiColumns([]);

      const savedRates = localStorage.getItem(`nexus_rates_${activeFileIndex}`);
      if (savedRates) setExchangeRates(JSON.parse(savedRates));
      else setExchangeRates({ 'R$': 1, '$': 5.23, '€': 5.60 });
    } catch (e) {
      setKpiColumns([]);
      setExchangeRates({ 'R$': 1, '$': 5.23, '€': 5.60 });
    }
  }, [activeFileIndex]);

  useEffect(() => {
    localStorage.setItem(`nexus_kpis_${activeFileIndex}`, JSON.stringify(kpiColumns));
  }, [kpiColumns, activeFileIndex]);

  useEffect(() => {
    localStorage.setItem(`nexus_rates_${activeFileIndex}`, JSON.stringify(exchangeRates));
  }, [exchangeRates, activeFileIndex]);

  useEffect(() => {
    localStorage.setItem('nexus_show_kpi_bar', JSON.stringify(showKpiBar));
  }, [showKpiBar]);

  useEffect(() => {
    if (isFullscreen || isExchangeModalOpen || isPrintModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => { document.body.style.overflow = 'auto'; };
  }, [isFullscreen, isExchangeModalOpen, isPrintModalOpen]);

  useEffect(() => {
    const handleMouseUp = () => { 
      setIsSelecting(false); 
      if (isSelectingFormulaRef.current) {
        setIsSelectingFormula(false);
        if (editInputRef.current) editInputRef.current.focus();
      }
      if (scrollIntervalRef.current) { 
        clearInterval(scrollIntervalRef.current); 
        scrollIntervalRef.current = null; 
      } 
    };
    
    const handleMouseMove = (e) => {
      if (!isSelecting && !isSelectingFormulaRef.current) return;
      if (!gridContainerRef.current) return;
      
      const rect = gridContainerRef.current.getBoundingClientRect();
      const scrollZone = 50; const scrollSpeed = 20;
      let dx = 0; let dy = 0;
      if (e.clientX < rect.left + scrollZone) dx = -scrollSpeed; 
      else if (e.clientX > rect.right - scrollZone) dx = scrollSpeed;
      if (e.clientY < rect.top + scrollZone) dy = -scrollSpeed; 
      else if (e.clientY > rect.bottom - scrollZone) dy = scrollSpeed;

      if (dx !== 0 || dy !== 0) {
        if (!scrollIntervalRef.current) {
          scrollIntervalRef.current = setInterval(() => {
            if (!gridContainerRef.current) return;
            gridContainerRef.current.scrollBy(dx, dy);
            const el = document.elementFromPoint(e.clientX, e.clientY);
            if (el) {
               const td = el.closest('td');
               if (td && td.dataset.row !== undefined && td.dataset.col !== undefined) {
                 const rIdx = parseInt(td.dataset.row, 10);
                 const cIdx = parseInt(td.dataset.col, 10);
                 
                 if (isSelectingFormulaRef.current && formulaStartCellRef.current) {
                    const minR = Math.min(formulaStartCellRef.current.r, rIdx);
                    const maxR = Math.max(formulaStartCellRef.current.r, rIdx);
                    const minC = Math.min(formulaStartCellRef.current.c, cIdx);
                    const maxC = Math.max(formulaStartCellRef.current.c, cIdx);
                    const startRef = `${getColumnLetter(minC)}${minR + 1}`;
                    const endRef = `${getColumnLetter(maxC)}${maxR + 1}`;
                    const rangeStr = (minR === maxR && minC === maxC) ? startRef : `${startRef}:${endRef}`;
                    setEditValue(preSelectionEditValueRef.current + rangeStr);
                 } else {
                    setSelectionEnd({ row: rIdx, col: cIdx });
                 }
               }
            }
          }, 30);
        }
      } else {
        if (scrollIntervalRef.current) { clearInterval(scrollIntervalRef.current); scrollIntervalRef.current = null; }
      }
    };

    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    return () => { 
      window.removeEventListener('mouseup', handleMouseUp); 
      window.removeEventListener('mousemove', handleMouseMove); 
      if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current); 
    };
  }, [isSelecting]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
        return;
      }
      if (['input', 'textarea', 'select'].includes(document.activeElement?.tagName.toLowerCase())) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && selectionStart && selectionEnd && !editingCell) {
          e.preventDefault();
          const minR = Math.min(selectionStart.row, selectionEnd.row); 
          const maxR = Math.max(selectionStart.row, selectionEnd.row);
          const minC = Math.min(selectionStart.col, selectionEnd.col); 
          const maxC = Math.max(selectionStart.col, selectionEnd.col);
          
          let copyText = '';
          for (let r = minR; r <= maxR; r++) {
              let rowValues = [];
              for (let c = minC; c <= maxC; c++) {
                  const colKey = gridHeaders[c];
                  let val = gridData[r] ? gridData[r][colKey] : "";
                  rowValues.push(val !== null && val !== undefined ? String(val) : "");
              }
              copyText += rowValues.join('\t') + '\n';
          }
          copyText = copyText.replace(/\n$/, ''); 
          
          const textarea = document.createElement('textarea');
          textarea.value = copyText;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectionStart && selectionEnd && !editingCell) {
          e.preventDefault();
          const minR = Math.min(selectionStart.row, selectionEnd.row); const maxR = Math.max(selectionStart.row, selectionEnd.row);
          const minC = Math.min(selectionStart.col, selectionEnd.col); const maxC = Math.max(selectionStart.col, selectionEnd.col);
          const newData = [...gridData]; let changed = false;
          for (let r = minR; r <= maxR; r++) {
              if (newData[r]) {
                  const newRow = { ...newData[r] };
                  for (let c = minC; c <= maxC; c++) { 
                    const colKey = gridHeaders[c]; 
                    if (colKey && newRow[colKey] !== "") { newRow[colKey] = ""; changed = true; } 
                  }
                  newData[r] = newRow;
              }
          }
          if (changed) { setGridData(newData); setHasUnsavedGridChanges(true); }
      }
    };

    const handlePaste = (e) => {
        if (['input', 'textarea', 'select'].includes(document.activeElement?.tagName.toLowerCase())) return;
        if (!selectionStart || !selectionEnd || editingCell) return;
        
        const clipboardData = e.clipboardData || window.clipboardData;
        const pastedText = clipboardData.getData('text');
        if (!pastedText) return;
        
        e.preventDefault();
        
        const rows = pastedText.split(/\r?\n/).map(row => row.split('\t'));
        const minR = Math.min(selectionStart.row, selectionEnd.row);
        const minC = Math.min(selectionStart.col, selectionEnd.col);
        
        const newData = [...gridData];
        let changed = false;
        
        for(let i = 0; i < rows.length; i++) {
            const targetR = minR + i;
            
            while(targetR >= newData.length) {
                const newRow = {};
                gridHeaders.forEach(h => newRow[h] = "");
                newData.push(newRow);
            }
            
            const rowData = rows[i];
            if (i === rows.length - 1 && rowData.length === 1 && rowData[0] === '') continue;

            const newRowData = { ...newData[targetR] };
            for(let j = 0; j < rowData.length; j++) {
                const targetC = minC + j;
                if (targetC < gridHeaders.length) {
                    const colKey = gridHeaders[targetC];
                    newRowData[colKey] = rowData[j];
                    changed = true;
                }
            }
            newData[targetR] = newRowData;
        }
        
        if (changed) { 
            setGridData(newData); 
            setHasUnsavedGridChanges(true); 
            setSelectionEnd({ 
                row: minR + rows.length - 1, 
                col: Math.min(gridHeaders.length - 1, minC + rows[0].length - 1) 
            });
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('paste', handlePaste);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('paste', handlePaste);
    };
  }, [selectionStart, selectionEnd, gridData, gridHeaders, editingCell, setGridData, setHasUnsavedGridChanges, isFullscreen]);

  // --- FUNÇÕES DE MANIPULAÇÃO DA TABELA ---
  const handleGridCellChange = (rowIndex, colKey, newValue) => {
    const actualRowIndex = (gridPage * rowsPerPage) + rowIndex;
    const newData = [...gridData]; 
    newData[actualRowIndex] = { ...newData[actualRowIndex], [colKey]: newValue };
    setGridData(newData); 
    setHasUnsavedGridChanges(true);
  };

  const applyFormulaToColumn = (colKey, baseRowIdx, baseFormula) => {
    if (!baseFormula.startsWith('=')) return;
    const absoluteBaseRowIdx = (gridPage * rowsPerPage) + baseRowIdx;
    const newData = [...gridData];
    for (let rIdx = 0; rIdx < newData.length; rIdx++) {
        if (rIdx === absoluteBaseRowIdx) {
          newData[rIdx] = { ...newData[rIdx], [colKey]: baseFormula };
        } else {
           const offset = rIdx - absoluteBaseRowIdx;
           const shiftedFormula = baseFormula.replace(/!([A-Z]+\d+)!|([A-Z]+)(\d+)/gi, (match, absoluteRef, colStr, rowStr) => {
              if (absoluteRef) return `!${absoluteRef}!`;
              const newRow = parseInt(rowStr, 10) + offset;
              return `${colStr}${Math.max(1, newRow)}`;
           });
           newData[rIdx] = { ...newData[rIdx], [colKey]: shiftedFormula };
        }
    }
    setGridData(newData); 
    setHasUnsavedGridChanges(true);
  };

  const addGridRow = () => { 
    const newRow = {}; 
    gridHeaders.forEach(h => newRow[h] = ""); 
    let newData = [newRow, ...gridData]; 
    newData = updateFormulasOnShift(newData, c => c, r => r + 1);
    setGridData(newData); 
    setHasUnsavedGridChanges(true); 
    setGridPage(0); 
  };
  
  const insertGridRow = (index) => { 
    const newRow = {}; 
    gridHeaders.forEach(h => newRow[h] = ""); 
    let newData = [...gridData]; 
    newData.splice(index, 0, newRow); 
    newData = updateFormulasOnShift(newData, c => c, r => r >= index ? r + 1 : r);
    setGridData(newData); 
    setHasUnsavedGridChanges(true); 
  };
  
  const moveGridRow = (index, direction) => {
    if (index === 0 && direction === -1) return; 
    if (index === gridData.length - 1 && direction === 1) return;
    let newData = [...gridData]; 
    const targetIndex = index + direction; 
    const temp = newData[index]; 
    newData[index] = newData[targetIndex]; 
    newData[targetIndex] = temp;
    
    newData = updateFormulasOnShift(newData, c => c, r => {
      if (r === index) return targetIndex;
      if (r === targetIndex) return index;
      return r;
    });
    setGridData(newData); 
    setHasUnsavedGridChanges(true);
  };
  
  const removeGridRow = async (absoluteIndex) => { 
    const confirmed = await showDialog('confirm', 'Eliminar Linha', "Deseja eliminar esta linha?"); 
    if (confirmed) { 
      let newData = gridData.filter((_, idx) => idx !== absoluteIndex); 
      newData = updateFormulasOnShift(newData, c => c, r => {
         if (r === absoluteIndex) return -1;
         return r > absoluteIndex ? r - 1 : r;
      });
      setGridData(newData); 
      setHasUnsavedGridChanges(true); 
    } 
  };

  const addGridColumn = async () => {
    const colName = await showDialog('prompt', 'Nova Coluna', "Nome da nova coluna:");
    if (!colName || colName.trim() === '') return;
    if (gridHeaders.includes(colName)) { await showDialog('alert', 'Aviso', "Já existe uma coluna com este nome."); return; }
    
    setGridHeaders([...gridHeaders, colName]); 
    setGridData(gridData.map(row => ({ ...row, [colName]: "" }))); 
    setHasUnsavedGridChanges(true);
  };
  
  const insertGridCol = async (index) => {
    const colName = await showDialog('prompt', 'Inserir Coluna', "Nome da nova coluna:");
    if (!colName || colName.trim() === '') return;
    if (gridHeaders.includes(colName)) { await showDialog('alert', 'Aviso', "Já existe uma coluna com este nome."); return; }
    
    const newHeaders = [...gridHeaders]; 
    newHeaders.splice(index, 0, colName); 
    setGridHeaders(newHeaders);
    
    let newData = gridData.map(row => ({ ...row, [colName]: "" })); 
    newData = updateFormulasOnShift(newData, c => c >= index ? c + 1 : c, r => r);
    setGridData(newData); 
    setHasUnsavedGridChanges(true);
  };
  
  const moveGridCol = (index, direction) => {
    if (index === 0 && direction === -1) return; 
    if (index === gridHeaders.length - 1 && direction === 1) return;
    
    const newHeaders = [...gridHeaders]; 
    const targetIndex = index + direction; 
    const temp = newHeaders[index]; 
    newHeaders[index] = newHeaders[targetIndex]; 
    newHeaders[targetIndex] = temp;
    setGridHeaders(newHeaders); 
    
    let newData = updateFormulasOnShift(gridData, c => {
        if (c === index) return targetIndex;
        if (c === targetIndex) return index;
        return c;
    }, r => r);
    setGridData(newData); 
    setHasUnsavedGridChanges(true);
  };
  
  const removeGridColumn = async (colKey) => {
    const confirmed = await showDialog('confirm', 'Eliminar Coluna', `Deseja eliminar a coluna "${colKey}" permanentemente?`);
    if (confirmed) { 
      const removedIndex = gridHeaders.indexOf(colKey);
      if (kpiColumns.includes(colKey)) setKpiColumns(kpiColumns.filter(c => c !== colKey));
      
      setGridHeaders(gridHeaders.filter(h => h !== colKey)); 
      
      let newData = gridData.map(row => { const newRow = { ...row }; delete newRow[colKey]; return newRow; }); 
      newData = updateFormulasOnShift(newData, c => {
          if (c === removedIndex) return -1;
          return c > removedIndex ? c - 1 : c;
      }, r => r);
      setGridData(newData); 
      setHasUnsavedGridChanges(true); 
    }
  };

  const exportGridToExcel = async () => {
    if (!window.XLSX) { await showDialog('alert', 'Aviso', "A biblioteca de Excel ainda está carregando."); return; }
    const ws = window.XLSX.utils.json_to_sheet(gridData, { header: gridHeaders }); 
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Dados_Exportados"); 
    window.XLSX.writeFile(wb, `Exportacao_Nexus_${Date.now()}.xlsx`);
  };

  const handleImportUpdatedData = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!window.XLSX) {
      await showDialog('alert', 'Aviso', "A biblioteca de Excel não foi carregada. Tente novamente em instantes.");
      return;
    }

    const confirmed = await showDialog('confirm', 'Atualizar Dados', "Isso vai substituir as colunas originais pelos dados deste arquivo, mantendo suas colunas novas (e calculando as fórmulas). Deseja continuar?");
    if (!confirmed) {
      e.target.value = null;
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target.result;
      const wb = window.XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      
      const data = window.XLSX.utils.sheet_to_json(ws, { header: 1 });
      
      if (data.length <= 1) {
          await showDialog('alert', 'Aviso', "O arquivo parece estar vazio.");
          return;
      }

      const novosHeadersArray = data[0]; 
      const novosDadosArray = [];

      for (let i = 1; i < data.length; i++) {
          const rowArr = data[i];
          if (rowArr.length === 0 || rowArr.every(v => v === undefined || v === null || v === "")) continue;
          
          const obj = {};
          novosHeadersArray.forEach((header, index) => {
              obj[header] = rowArr[index] !== undefined ? String(rowArr[index]) : "";
          });
          novosDadosArray.push(obj);
      }

      const colunasManuais = gridHeaders.filter(colAtual => !novosHeadersArray.includes(colAtual));
      
      const newDataGrid = novosDadosArray.map((novaLinha, rIdx) => {
          const linhaAtualizada = { ...novaLinha }; 
          
          colunasManuais.forEach(colManual => {
              if (gridData[rIdx] && gridData[rIdx][colManual] !== undefined) {
                  linhaAtualizada[colManual] = gridData[rIdx][colManual];
              } else if (gridData.length > 0 && typeof gridData[0][colManual] === 'string' && gridData[0][colManual].startsWith('=')) {
                  const baseFormula = gridData[0][colManual];
                  const offset = rIdx; 
                  const shiftedFormula = baseFormula.replace(/!([A-Z]+\d+)!|([A-Z]+)(\d+)/gi, (match, absoluteRef, colStr, rowStr) => {
                      if (absoluteRef) return `!${absoluteRef}!`;
                      const newRow = parseInt(rowStr, 10) + offset;
                      return `${colStr}${Math.max(1, newRow)}`;
                  });
                  linhaAtualizada[colManual] = shiftedFormula;
              } else {
                  linhaAtualizada[colManual] = "";
              }
          });
          return linhaAtualizada;
      });

      const headersFinais = [];
      gridHeaders.forEach(h => {
          if (novosHeadersArray.includes(h) || colunasManuais.includes(h)) headersFinais.push(h);
      });
      novosHeadersArray.forEach(h => {
          if (!headersFinais.includes(h)) headersFinais.push(h);
      });

      setGridHeaders(headersFinais);
      setGridData(newDataGrid);
      setHasUnsavedGridChanges(true);
      e.target.value = null; 
      
      await showDialog('success', 'Atualizado!', 'Os dados originais foram atualizados e as suas colunas/fórmulas foram preservadas!');
    };
    reader.readAsBinaryString(file);
  };

  const getKpiSum = (colKey) => {
    let sum = 0;
    for (let rIdx = 0; rIdx < gridData.length; rIdx++) {
      let val = gridData[rIdx][colKey];
      if (typeof val === 'string' && val.startsWith('=')) {
         val = evaluateFormula(val, gridData, gridHeaders, gridColFormats, gridCurrencySymbols, exchangeRates, colKey);
      }
      const numVal = cleanNumber(val);
      if (numVal !== null && !isNaN(numVal)) {
         sum += numVal;
      }
    }
    return sum;
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        setUserLogo(evt.target.result);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = null;
  };

  const highlightedCells = useMemo(() => {
    const cells = new Map();
    if (!editingCell || !String(editValue).startsWith('=')) return cells;

    const colors = [
      'bg-blue-500/30 ring-blue-500',
      'bg-rose-500/30 ring-rose-500',
      'bg-emerald-500/30 ring-emerald-500',
      'bg-amber-500/30 ring-amber-500',
      'bg-purple-500/30 ring-purple-500',
      'bg-cyan-500/30 ring-cyan-500'
    ];
    let colorIdx = 0;
    
    const combinedRegex = /([A-Z]+\d+:[A-Z]+\d+)|([A-Z]+\d+)/gi;
    const matches = [...String(editValue).matchAll(combinedRegex)];
    
    matches.forEach(m => {
      const color = colors[colorIdx % colors.length];
      colorIdx++;
      
      if (m[1]) {
          const [startRef, endRef] = m[1].split(':');
          const start = getCellCoords(startRef);
          const end = getCellCoords(endRef);
          if(start && end) {
              const minR = Math.min(start.rIdx, end.rIdx);
              const maxR = Math.max(start.rIdx, end.rIdx);
              const minC = Math.min(start.colIdx, end.colIdx);
              const maxC = Math.max(start.colIdx, end.colIdx);
              for (let r = minR; r <= maxR; r++) {
                  for (let c = minC; c <= maxC; c++) {
                      if (!cells.has(`${r}-${c}`)) cells.set(`${r}-${c}`, color);
                  }
              }
          }
      } else if (m[2]) {
          const coords = getCellCoords(m[2]);
          if (coords && !cells.has(`${coords.rIdx}-${coords.colIdx}`)) {
              cells.set(`${coords.rIdx}-${coords.colIdx}`, color);
          }
      }
    });
    return cells;
  }, [editValue, editingCell]);

  const showSuggestions = String(editValue).startsWith('=');
  const suggestionMatch = String(editValue).match(/([A-ZÀ-Ú.]+)$/i);
  const keyword = suggestionMatch ? suggestionMatch[1].toUpperCase() : '';
  const filteredFormulas = keyword ? FORMULAS_LIST.filter(f => f.name.startsWith(keyword)) : [];

  // ---------------------------------------------------------------------------------------------------------
  // NOVO SISTEMA PROFISSIONAL DE IMPRESSÃO (IFRAME INJECTION)
  // Isso isola completamente a impressão do tema escuro do seu App e evita que menus/botões apareçam no PDF.
  // ---------------------------------------------------------------------------------------------------------

  const printStyles = `
    @page { size: __ORIENTATION__; margin: 15mm; }
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111827; background: #ffffff; margin: 0; padding: 0; }
    .report-container { width: 100%; box-sizing: border-box; }
    .report-header { border-bottom: 2px solid #1e293b; padding-bottom: 12px; margin-bottom: 24px; }
    .report-title { font-size: 28px; font-weight: 900; margin: 0; color: #0f172a; }
    .kpi-grid { display: flex; gap: 16px; margin-bottom: 32px; flex-wrap: wrap; }
    .kpi-card { border: 2px solid #e2e8f0; padding: 16px; border-radius: 12px; min-width: 180px; background-color: #f8fafc; }
    .kpi-label { font-size: 11px; color: #64748b; font-weight: 800; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px; }
    .kpi-val { font-size: 22px; font-weight: 900; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { border: 1px solid #cbd5e1; background-color: #f1f5f9; padding: 10px; text-align: left; font-weight: 800; text-transform: uppercase; font-size: 10px; color: #334155; }
    td { border: 1px solid #e2e8f0; padding: 10px; color: #1e293b; }
    tr { page-break-inside: avoid; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    .footer-content { display: flex; justify-content: space-between; align-items: center; border-top: 2px solid #cbd5e1; padding-top: 16px; margin-top: 16px; }
    .logo-nexus { display: flex; align-items: center; gap: 10px; }
    .logo-box { width: 32px; height: 32px; background: #0f172a; border-radius: 8px; color: white; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 12px; }
    .logo-text { font-weight: 900; font-size: 15px; text-transform: uppercase; letter-spacing: 2px; color: #0f172a; }
    .user-logo-img { max-height: 44px; max-width: 220px; object-fit: contain; }
  `;

  // Função nativa e limpa para enviar apenas o relatório para a impressora do navegador
  const handlePrintDocument = () => {
    if (!printContentRef.current) return;
    
    setIsPrintModalOpen(false); // Fecha o modal
    
    // Cria um iframe invisível
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    // Injeta o HTML limpo e o CSS no iframe
    const doc = iframe.contentWindow.document;
    const contentHTML = printContentRef.current.innerHTML;
    const cssToInject = printStyles.replace(/__ORIENTATION__/g, printOrientation);

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Relatorio_Nexus_Planilha</title>
          <style>${cssToInject}</style>
        </head>
        <body>
          ${contentHTML}
        </body>
      </html>
    `);
    doc.close();

    // Dá foco e manda imprimir (um leve timeout garante que a imagem em base64 carregue)
    iframe.contentWindow.focus();
    setTimeout(() => {
      iframe.contentWindow.print();
      // Remove o iframe da tela para não gastar memória
      document.body.removeChild(iframe);
    }, 250);
  };

  return (
    <React.Fragment>
      {/* MODO APLICATIVO PRINCIPAL */}
      <div className={`transition-all duration-300 w-full font-sans flex flex-col ${isFullscreen ? 'fixed inset-0 z-[9999] bg-slate-950 p-4 sm:p-8 h-screen' : 'animate-fade-in-up'}`}>
        
        <input type="file" ref={importFileRef} className="hidden" accept=".xlsx, .xls, .csv" onChange={handleImportUpdatedData} />

        {/* Cabeçalho de Ações da Planilha */}
        <div className="flex flex-wrap justify-between items-center bg-white/5 p-6 rounded-3xl border border-white/10 gap-6 shrink-0 mb-4">
          <div className="flex gap-4 items-center">
              {rawInputs.length > 1 && (
                <select value={activeFileIndex} onChange={e => setActiveFileIndex(Number(e.target.value))} className="bg-slate-900 border border-emerald-500/30 p-3 rounded-xl font-black text-emerald-400 text-sm outline-none">
                  {rawInputs.map((ds, idx) => <option key={idx} value={idx}>Folha: {ds.name}</option>)}
                </select>
              )}
              <div className="text-slate-400 text-xs font-bold uppercase tracking-widest">{gridData.length} Registros Totais</div>
          </div>

          <div className="flex flex-wrap gap-3">
              <button onClick={() => setIsExchangeModalOpen(true)} className="px-5 py-2.5 bg-amber-600/20 text-amber-400 hover:bg-amber-600 hover:text-white rounded-xl font-bold text-xs uppercase flex items-center gap-2 transition-colors">
                <CircleDollarSign size={16}/> Câmbio
              </button>
              <button onClick={() => setShowKpiBar(!showKpiBar)} className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase flex items-center gap-2 transition-colors ${showKpiBar ? 'bg-emerald-600/20 text-emerald-400' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                <BarChart3 size={16}/> KPIs
              </button>
              <button onClick={() => setIsFullscreen(!isFullscreen)} className="px-5 py-2.5 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-xl font-bold text-xs uppercase flex items-center gap-2 transition-colors">
                {isFullscreen ? <Minimize size={16}/> : <Maximize size={16}/>}
                {isFullscreen ? 'Sair Tela Cheia' : 'Tela Cheia'}
              </button>
              
              <div className="w-px h-8 bg-white/10 mx-1 hidden sm:block"></div>
              
              <button onClick={addGridRow} className="px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-white font-bold text-xs uppercase flex items-center gap-2 transition-colors"><Rows size={16}/> Linha</button>
              <button onClick={addGridColumn} className="px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-white font-bold text-xs uppercase flex items-center gap-2 transition-colors"><Columns size={16}/> Coluna</button>
              
              <button onClick={() => importFileRef.current.click()} className="px-5 py-2.5 bg-purple-600/20 text-purple-400 hover:bg-purple-600 hover:text-white rounded-xl font-bold text-xs uppercase flex items-center gap-2 transition-colors">
                <UploadCloud size={16}/> Atualizar Dados
              </button>

              <button onClick={exportGridToExcel} className="px-5 py-2.5 bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white rounded-xl font-bold text-xs uppercase flex items-center gap-2 transition-colors"><DownloadCloud size={16}/> Exportar</button>
              
              <button onClick={() => setIsPrintModalOpen(true)} className="px-5 py-2.5 bg-rose-600/20 text-rose-400 hover:bg-rose-600 hover:text-white rounded-xl font-bold text-xs uppercase flex items-center gap-2 transition-colors">
                <Printer size={16}/> Imprimir PDF
              </button>

              <button onClick={saveGridChanges} disabled={!hasUnsavedGridChanges} className={`px-6 py-2.5 rounded-xl font-black text-xs uppercase flex items-center gap-2 transition-all ${hasUnsavedGridChanges ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/40 hover:bg-emerald-500' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}><Save size={16}/> {hasUnsavedGridChanges ? 'Salvar Modificações' : 'Salvo'}</button>
          </div>
        </div>

        {/* BARRA DE KPIs */}
        {showKpiBar && (
          <div className="flex gap-4 items-center shrink-0 w-full overflow-x-auto custom-scrollbar bg-slate-900/50 p-4 rounded-3xl border border-white/5 animate-fade-in-up mb-4">
             <div className="flex items-center gap-2 mr-2 shrink-0">
                <div className="bg-emerald-500/20 p-2 rounded-xl">
                   <BarChart3 className="text-emerald-400" size={20} />
                </div>
                <div className="flex flex-col">
                   <span className="text-white font-black text-sm leading-tight">KPIs</span>
                   <span className="text-slate-500 text-[9px] font-bold uppercase tracking-wider">Totais</span>
                </div>
             </div>
             
             {kpiColumns.map(col => (
                <div key={col} className="bg-slate-950/80 border border-slate-800 px-5 py-3 rounded-2xl min-w-[160px] relative group flex flex-col justify-center shrink-0 shadow-lg shadow-black/20">
                   <button onClick={() => setKpiColumns(kpiColumns.filter(c => c !== col))} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-rose-400 hover:bg-rose-500/20 p-1.5 rounded-lg transition-all"><Trash2 size={12}/></button>
                   <div className="text-slate-500 text-[10px] font-black uppercase tracking-wider mb-1 truncate pr-6" title={col}>{col}</div>
                   <div className="text-emerald-400 text-lg font-black truncate">
                      {formatGridValue(getKpiSum(col), gridColFormats[col] || 'number', gridCurrencySymbols[col])}
                   </div>
                </div>
             ))}

             {gridHeaders.filter(h => !kpiColumns.includes(h)).length > 0 && (
                 <div className="flex items-center gap-2 bg-white/5 p-2 rounded-2xl border border-white/10 border-dashed shrink-0 h-[68px]">
                    <select id="kpi-select" className="bg-transparent text-slate-300 text-xs font-bold p-2 outline-none w-40 cursor-pointer">
                       <option value="" className="bg-slate-900">Somar coluna...</option>
                       {gridHeaders.filter(h => !kpiColumns.includes(h)).map(h => <option key={h} value={h} className="bg-slate-900">{h}</option>)}
                    </select>
                    <button onClick={() => {
                       const sel = document.getElementById('kpi-select');
                       if(sel.value) { setKpiColumns([...kpiColumns, sel.value]); sel.value = ''; }
                    }} className="bg-emerald-600/20 text-emerald-400 p-2 rounded-xl hover:bg-emerald-600 hover:text-white transition-colors" title="Adicionar KPI">
                       <Plus size={16}/>
                    </button>
                 </div>
             )}
             {gridHeaders.filter(h => !kpiColumns.includes(h)).length === 0 && (
                <div className="text-slate-600 text-xs italic px-4">Todas as colunas viraram KPIs.</div>
             )}
          </div>
        )}

        {/* Grid Principal */}
        <div className={`p-2 overflow-hidden bg-slate-950/80 border border-slate-800 rounded-[2.5rem] shadow-2xl backdrop-blur-3xl flex flex-col ${isFullscreen ? 'flex-1 min-h-0' : ''}`}>
          <div ref={gridContainerRef} className={`w-full overflow-x-auto overflow-y-auto custom-scrollbar rounded-2xl border border-white/5 relative select-none ${isFullscreen ? 'flex-1 h-full min-h-0' : 'max-h-[600px]'}`}>
            <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
              <thead className="sticky top-0 bg-slate-900 z-50 shadow-md">
                <tr>
                  <th className="p-3 border-b border-r border-white/10 text-slate-400 font-black w-24 text-center bg-slate-900 sticky left-0 z-50">#</th>
                  {gridHeaders.map((col, cIdx) => (
                    <th key={col} className="p-3 border-b border-r border-white/10 text-emerald-400 font-bold uppercase tracking-wider relative group/colactions min-w-[140px] align-top bg-slate-900">
                      <div className="text-[10px] text-slate-500 font-mono mb-1 w-full text-center bg-black/20 rounded py-0.5">{getColumnLetter(cIdx)}</div>
                      <div className="flex justify-between items-start mb-2">
                        <span className="truncate pr-8">{col}</span>
                        <div className="absolute right-1 top-2 opacity-0 group-hover/colactions:opacity-100 flex gap-1 z-50 bg-slate-800 p-1 rounded shadow-xl border border-white/10">
                            <button onClick={(e) => { e.stopPropagation(); moveGridCol(cIdx, -1); }} title="Mover Coluna à Esquerda" className="hover:bg-white/10 p-1 rounded text-white"><ArrowLeft size={12}/></button>
                            <button onClick={(e) => { e.stopPropagation(); moveGridCol(cIdx, 1); }} title="Mover Coluna à Direita" className="hover:bg-white/10 p-1 rounded text-white"><ArrowRight size={12}/></button>
                            <button onClick={(e) => { e.stopPropagation(); insertGridCol(cIdx); }} title="Inserir Coluna Nova" className="hover:bg-emerald-500/20 text-emerald-400 p-1 rounded"><Plus size={12}/></button>
                            <button onClick={(e) => { e.stopPropagation(); removeGridColumn(col); }} title="Eliminar Coluna" className="hover:bg-rose-500/20 text-rose-400 p-1 rounded"><Trash2 size={12}/></button>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 w-full mt-1">
                          <select value={gridColFormats[col] || 'auto'} onChange={(e) => { setGridColFormats({...gridColFormats, [col]: e.target.value}); setHasUnsavedGridChanges(true); }} className="flex-1 min-w-0 bg-slate-950 border border-white/10 text-slate-300 text-[9px] rounded p-1 outline-none focus:border-emerald-500">
                            <option value="auto">Auto</option><option value="currency">Moeda</option><option value="number">Número</option><option value="percent">Porcentagem (%)</option><option value="date">Data</option>
                          </select>
                          {gridColFormats[col] === 'currency' && (
                            <button onClick={async () => { 
                              const sym = await showDialog('prompt', 'Símbolo', "Símbolo (Ex: R$, US$):", gridCurrencySymbols[col] || "R$"); 
                              if (sym !== null && sym.trim() !== '') { setGridCurrencySymbols({...gridCurrencySymbols, [col]: sym}); setHasUnsavedGridChanges(true); } 
                            }} className="bg-emerald-900/50 text-emerald-300 hover:bg-emerald-50 hover:text-white text-[9px] px-1.5 py-1 rounded border border-emerald-500/50 transition-colors">
                              {gridCurrencySymbols[col] || 'R$'}
                            </button>
                          )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gridData.slice(gridPage * rowsPerPage, (gridPage + 1) * rowsPerPage).map((row, rIdx) => {
                  const absoluteIndex = rIdx + (gridPage * rowsPerPage);
                  return (
                  <tr key={absoluteIndex} className="hover:bg-white/5 transition-colors group/row">
                    <td className="p-2 border-b border-r border-white/5 text-center text-slate-500 font-mono bg-slate-900/50 sticky left-0 z-40 group-hover/row:bg-slate-800 transition-colors w-24 min-w-[96px]">
                      <div className="flex items-center justify-between w-full relative">
                          <span className="group-hover/row:hidden w-full text-center">{absoluteIndex + 1}</span>
                          <div className="hidden group-hover/row:flex gap-1 w-full justify-center">
                            <button onClick={() => moveGridRow(absoluteIndex, -1)} title="Mover Acima" className="hover:bg-white/20 p-1 rounded text-white"><ArrowUp size={12}/></button>
                            <button onClick={() => moveGridRow(absoluteIndex, 1)} title="Mover Abaixo" className="hover:bg-white/20 p-1 rounded text-white"><ArrowDown size={12}/></button>
                            <button onClick={() => insertGridRow(absoluteIndex)} title="Inserir Linha" className="hover:bg-emerald-500/20 text-emerald-400 p-1 rounded"><Plus size={12}/></button>
                            <button onClick={() => removeGridRow(absoluteIndex)} title="Eliminar Linha" className="hover:bg-rose-500/20 text-rose-400 p-1 rounded"><Trash2 size={12}/></button>
                          </div>
                      </div>
                    </td>
                    {gridHeaders.map((col, cIdx) => {
                      const isEditing = editingCell?.rowIndex === rIdx && editingCell?.colKey === col;
                      let isSelected = false;
                      if (selectionStart && selectionEnd && !isEditing) {
                          const minR = Math.min(selectionStart.row, selectionEnd.row); const maxR = Math.max(selectionStart.row, selectionEnd.row);
                          const minC = Math.min(selectionStart.col, selectionEnd.col); const maxC = Math.max(selectionStart.col, selectionEnd.col);
                          if (absoluteIndex >= minR && absoluteIndex <= maxR && cIdx >= minC && cIdx <= maxC) isSelected = true;
                      }
                      
                      const highlightClass = highlightedCells.get(`${absoluteIndex}-${cIdx}`);
                      
                      return (
                        <td 
                          key={col} data-row={absoluteIndex} data-col={cIdx}
                          onMouseDown={(e) => {
                              if (editingCell && !isEditing && String(editValue).startsWith('=')) { 
                                  e.preventDefault(); 
                                  setIsSelectingFormula(true);
                                  setFormulaStartCell({r: absoluteIndex, c: cIdx});
                                  setPreSelectionEditValue(editValue);
                                  setEditValue(editValue + `${getColumnLetter(cIdx)}${absoluteIndex + 1}`); 
                                  return; 
                              }
                              if (!isEditing && e.button === 0) { 
                                  setSelectionStart({ row: absoluteIndex, col: cIdx }); 
                                  setSelectionEnd({ row: absoluteIndex, col: cIdx }); 
                                  setIsSelecting(true); 
                                  setEditingCell(null); 
                              }
                          }}
                          onMouseEnter={() => { 
                              if (isSelectingFormula && !isEditing) {
                                  const minR = Math.min(formulaStartCell.r, absoluteIndex);
                                  const maxR = Math.max(formulaStartCell.r, absoluteIndex);
                                  const minC = Math.min(formulaStartCell.c, cIdx);
                                  const maxC = Math.max(formulaStartCell.c, cIdx);
                                  const startRef = `${getColumnLetter(minC)}${minR + 1}`;
                                  const endRef = `${getColumnLetter(maxC)}${maxR + 1}`;
                                  const rangeStr = (minR === maxR && minC === maxC) ? startRef : `${startRef}:${endRef}`;
                                  setEditValue(preSelectionEditValue + rangeStr);
                              } else if (isSelecting && !isEditing) {
                                  setSelectionEnd({ row: absoluteIndex, col: cIdx }); 
                              }
                          }}
                          onDoubleClick={() => { setEditingCell({ rowIndex: rIdx, colKey: col }); setEditValue(row[col] !== null && row[col] !== undefined ? String(row[col]) : ""); setSelectionStart(null); setSelectionEnd(null); }}
                          className={`p-0 border-b border-r border-white/5 min-w-[140px] relative cursor-cell group/cell ${isSelected && !highlightClass ? 'bg-indigo-900/40 ring-1 ring-inset ring-indigo-400' : ''} ${highlightClass && !isEditing ? `${highlightClass} ring-2 ring-inset z-20` : ''}`}
                        >
                            {isEditing ? (
                              <div className="relative w-full h-full min-h-[44px] flex items-center">
                                <input 
                                  ref={editInputRef}
                                  autoFocus 
                                  value={editValue} 
                                  onChange={(e) => setEditValue(e.target.value)} 
                                  onBlur={() => { handleGridCellChange(rIdx, col, editValue); setEditingCell(null); }} 
                                  onKeyDown={(e) => { if(e.key === 'Enter') e.target.blur(); }} 
                                  className="w-full h-full absolute inset-0 bg-indigo-900/40 text-white px-3 outline-none border-2 border-indigo-500 font-mono text-xs z-[60] shadow-[0_0_15px_rgba(99,102,241,0.3)]" 
                                />
                                
                                {showSuggestions && filteredFormulas.length > 0 && (
                                  <div className="absolute top-full left-0 mt-1 w-48 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl z-[100] flex flex-col overflow-hidden">
                                    {filteredFormulas.map(f => (
                                      <button 
                                        key={f.name}
                                        onMouseDown={(e) => {
                                            e.preventDefault(); 
                                            const newVal = editValue.slice(0, -keyword.length) + f.name + '(';
                                            setEditValue(newVal);
                                            if (editInputRef.current) editInputRef.current.focus();
                                        }}
                                        className="text-left px-3 py-2 hover:bg-emerald-600/20 hover:text-emerald-400 text-slate-200 text-xs transition-colors border-b border-white/5 last:border-0"
                                      >
                                        <div className="font-bold">{f.name}()</div>
                                        <div className="text-[9px] text-slate-400">{f.desc}</div>
                                      </button>
                                    ))}
                                  </div>
                                )}

                                {String(editValue).startsWith('=') && (
                                    <button onMouseDown={(e) => { e.preventDefault(); applyFormulaToColumn(col, rIdx, editValue); setEditingCell(null); }} className="absolute bottom-1 right-1 w-5 h-5 z-[70] bg-emerald-500 hover:bg-emerald-400 text-white rounded cursor-pointer shadow-md flex items-center justify-center transition-all hover:scale-110" title="Aplicar a toda coluna"><ArrowDown size={12} strokeWidth={3}/></button>
                                )}
                              </div>
                            ) : (
                              <div className={`px-3 py-2 w-full h-full min-h-[44px] text-slate-300 truncate flex items-center ${isSelected || highlightClass ? '' : 'group-hover/cell:bg-white/5'}`}>
                                {row[col] === null || row[col] === undefined || row[col] === "" ? <span className="text-slate-700 italic text-[10px]">Vazio</span> : String(row[col]).startsWith('=') ? <span className="text-emerald-300 font-bold" title={row[col]}>{formatGridValue(evaluateFormula(row[col], gridData, gridHeaders, gridColFormats, gridCurrencySymbols, exchangeRates, col), gridColFormats[col], gridCurrencySymbols[col])}</span> : formatGridValue(row[col], gridColFormats[col], gridCurrencySymbols[col])}
                              </div>
                            )}
                        </td>
                      );
                    })}
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
          
          {/* Paginação */}
          <div className="flex justify-between items-center p-4 bg-slate-900/50 border-t border-white/5 mt-2 rounded-xl shrink-0">
              <div className="text-xs font-bold text-slate-500 uppercase">Página {gridPage + 1} de {Math.max(1, Math.ceil(gridData.length / rowsPerPage))}</div>
              <div className="flex gap-2">
                <button disabled={gridPage === 0} onClick={() => setGridPage(p => p - 1)} className="px-4 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-30 rounded-lg text-white font-bold text-xs flex items-center gap-1"><ChevronLeft size={14}/> Anterior</button>
                <button disabled={(gridPage + 1) * rowsPerPage >= gridData.length} onClick={() => setGridPage(p => p + 1)} className="px-4 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-30 rounded-lg text-white font-bold text-xs flex items-center gap-1">Próxima <ChevronRight size={14}/></button>
              </div>
          </div>
        </div>
      </div>


      {/* --- MODAIS SOBREPOSTOS --- */}

      {/* MODAL DE PRÉ-VISUALIZAÇÃO / PDF (SISTEMA INDEPENDENTE DE PRINT) */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
           <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-7xl h-[95vh] shadow-2xl flex overflow-hidden">
              
              {/* SIDEBAR DE CONFIGURAÇÕES */}
              <div className="w-80 bg-slate-950 p-6 flex flex-col gap-6 border-r border-slate-800 shrink-0 relative z-20">
                 <div>
                    <h3 className="text-white font-black text-xl flex items-center gap-2 mb-1"><Printer className="text-rose-400"/> Imprimir / PDF</h3>
                    <p className="text-slate-400 text-xs">Configure o layout. A função Imprimir gera PDFs no seu computador e não afeta o tema do sistema.</p>
                 </div>

                 <div className="space-y-6 flex-1 overflow-y-auto custom-scrollbar pr-2">
                    {/* Orientação */}
                    <div className="space-y-2">
                       <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Orientação da Folha</label>
                       <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
                          <button onClick={() => setPrintOrientation('portrait')} className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${printOrientation === 'portrait' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>Retrato</button>
                          <button onClick={() => setPrintOrientation('landscape')} className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${printOrientation === 'landscape' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>Paisagem</button>
                       </div>
                    </div>

                    {/* Logo do Usuário */}
                    <div className="space-y-2">
                       <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sua Logo no Rodapé</label>
                       <div className="border border-dashed border-slate-700 bg-slate-900 rounded-xl p-4 flex flex-col items-center justify-center gap-3 text-center relative hover:bg-slate-800 transition-colors cursor-pointer" onClick={() => document.getElementById('logo-upload').click()}>
                          <input type="file" id="logo-upload" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                          {userLogo ? (
                             <>
                                <img src={userLogo} alt="Sua Logo" className="h-16 max-w-full object-contain" />
                                <button onClick={(e) => { e.stopPropagation(); setUserLogo(null); }} className="absolute top-2 right-2 text-rose-400 bg-rose-500/10 p-1.5 rounded-md hover:bg-rose-500 hover:text-white transition-colors"><Trash2 size={14}/></button>
                             </>
                          ) : (
                             <>
                                <ImageIcon className="text-slate-500" size={28}/>
                                <div className="text-xs text-slate-400 font-bold">Clique para procurar imagem</div>
                             </>
                          )}
                       </div>
                    </div>
                 </div>

                 {/* AÇÕES DE IMPRIMIR / PDF */}
                 <div className="pt-4 border-t border-slate-800 flex flex-col gap-3">
                    <button onClick={handlePrintDocument} className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black text-sm transition-colors shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2">
                       <Printer size={18}/> Imprimir / Gerar PDF
                    </button>
                    <button onClick={() => setIsPrintModalOpen(false)} className="w-full py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-bold text-sm transition-colors">
                       Voltar
                    </button>
                 </div>
              </div>

              {/* ÁREA DE PRÉ-VISUALIZAÇÃO EM TEMPO REAL */}
              <div className="flex-1 bg-slate-800 p-8 overflow-y-auto custom-scrollbar flex flex-col items-center relative z-10">
                 <div className="bg-slate-900/80 backdrop-blur text-slate-300 text-xs font-bold px-4 py-2 rounded-full border border-slate-700 mb-6 flex items-center gap-2 shadow-xl sticky top-0 z-50">
                    Pré-visualização do Relatório (Aproximada)
                 </div>
                 
                 {/* Papel Simulando A4 Branca Independente */}
                 <div className={`bg-white text-black shadow-2xl transition-all duration-300 origin-top flex-shrink-0 relative ${printOrientation === 'portrait' ? 'w-[210mm] min-h-[297mm]' : 'w-[297mm] min-h-[210mm]'}`} style={{ transform: 'scale(0.85)', marginBottom: '-10%' }}>
                    
                    {/* Injeta as folhas de estilo apenas dentro do preview para não bagunçar o tailwind externo */}
                    <style>{printStyles.replace(/__ORIENTATION__/g, printOrientation)}</style>
                    
                    {/* CONTEÚDO A SER IMPRESSO */}
                    <div ref={printContentRef} className="report-container">
                        {/* 1. KPIs NA PRIMEIRA PÁGINA */}
                        <div className="report-header">
                            <h1 className="report-title">Relatório de Dados</h1>
                        </div>

                        {kpiColumns.length > 0 && (
                            <div className="kpi-grid">
                                {kpiColumns.map(col => (
                                <div key={col} className="kpi-card">
                                    <div className="kpi-label" title={col}>{col}</div>
                                    <div className="kpi-val">
                                        {formatGridValue(getKpiSum(col), gridColFormats[col] || 'number', gridCurrencySymbols[col])}
                                    </div>
                                </div>
                                ))}
                            </div>
                        )}

                        {/* 2. TABELA DE DADOS AUTOAJUSTÁVEL */}
                        <table>
                            <thead>
                                <tr>
                                {gridHeaders.map(col => <th key={col}>{col}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {gridData.map((row, rIdx) => (
                                    <tr key={rIdx}>
                                    {gridHeaders.map(col => {
                                        let val = row[col];
                                        if (typeof val === 'string' && val.startsWith('=')) {
                                            val = evaluateFormula(val, gridData, gridHeaders, gridColFormats, gridCurrencySymbols, exchangeRates, col);
                                        }
                                        return (
                                            <td key={col}>
                                                {formatGridValue(val, gridColFormats[col], gridCurrencySymbols[col])}
                                            </td>
                                        )
                                    })}
                                    </tr>
                                ))}
                            </tbody>
                            {/* O Rodapé (tfoot) se repete no final da tabela em cada página impressa */}
                            <tfoot>
                                <tr>
                                    <td colSpan={gridHeaders.length} style={{ border: 'none', padding: '0' }}>
                                        <div className="footer-content">
                                            {/* Logo do Programa NX */}
                                            <div className="logo-nexus">
                                                <div className="logo-box">NX</div>
                                                <div className="logo-text">Nexus Pro</div>
                                            </div>
                                            
                                            {/* Logo do Usuário */}
                                            {userLogo && <img src={userLogo} alt="Sua Logo" className="user-logo-img" />}
                                        </div>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                 </div>
              </div>

           </div>
        </div>
      )}

      {/* MODAL DE CÂMBIO */}
      {isExchangeModalOpen && (
        <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-3xl w-full max-w-sm shadow-2xl flex flex-col gap-4">
            <div>
              <h3 className="text-white font-black text-lg flex items-center gap-2"><CircleDollarSign className="text-emerald-400"/> Câmbio de Moedas</h3>
              <p className="text-slate-400 text-xs mt-1">Defina a cotação de cada moeda em relação ao R$ (sua Moeda Base que vale 1,00).</p>
            </div>
            
            <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
              {Object.entries(exchangeRates).map(([sym, rate]) => (
                <div key={sym} className="flex gap-2 items-center bg-slate-950 p-2 rounded-xl border border-white/5">
                  <span className="text-emerald-400 font-bold w-12 text-center">{sym}</span>
                  <input 
                    type="number" 
                    step="0.01"
                    value={rate}
                    disabled={sym === 'R$'}
                    onChange={(e) => {
                       const val = parseFloat(e.target.value);
                       setExchangeRates({...exchangeRates, [sym]: isNaN(val) ? 0 : val});
                       setHasUnsavedGridChanges(true);
                    }}
                    className="flex-1 bg-slate-900 border border-slate-700 focus:border-emerald-500 text-white rounded-lg p-2 text-sm outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  {sym !== 'R$' && (
                    <button onClick={() => {
                      const newRates = {...exchangeRates};
                      delete newRates[sym];
                      setExchangeRates(newRates);
                      setHasUnsavedGridChanges(true);
                    }} className="text-rose-400 p-2 hover:bg-rose-500/20 rounded-lg transition-colors" title="Remover Moeda">
                      <Trash2 size={16}/>
                    </button>
                  )}
                </div>
              ))}
              
              <button onClick={async () => {
                const sym = await showDialog('prompt', 'Nova Moeda', 'Símbolo da nova moeda (ex: £, ¥):');
                if (sym && sym.trim() !== '' && !exchangeRates[sym.trim()]) {
                   setExchangeRates({...exchangeRates, [sym.trim()]: 1});
                   setHasUnsavedGridChanges(true);
                }
              }} className="w-full mt-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 p-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors">
                <Plus size={16}/> Adicionar Moeda
              </button>
            </div>
            
            <div className="mt-2 flex justify-end">
              <button onClick={() => setIsExchangeModalOpen(false)} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm transition-colors">
                Concluído
              </button>
            </div>
          </div>
        </div>
      )}

    </React.Fragment>
  );
};

export default Planilha;