import React, { useState, useMemo, useRef } from 'react';
import { Plus, Calculator, GitCompare, AlertTriangle, Layers, X, Search, ListFilter, PlusCircle, Maximize2, Minimize2, Trash2, Eye, Settings2, Edit2, Check, ChevronRight, Waypoints, Link2, Key, ChevronLeft, BarChart, Activity, Sigma, FunctionSquare, ArrowRight } from 'lucide-react';

const COLOR_MAP = {
  cyan: { text: 'text-cyan-400', bg: 'bg-cyan-500/20', border: 'border-cyan-500/20', hex: '#22d3ee' },
  violet: { text: 'text-violet-400', bg: 'bg-violet-500/20', border: 'border-violet-500/20', hex: '#a855f7' },
  fuchsia: { text: 'text-fuchsia-400', bg: 'bg-fuchsia-500/20', border: 'border-fuchsia-500/20', hex: '#d946ef' },
  emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/20', hex: '#34d399' },
  amber: { text: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/20', hex: '#fbbf24' },
  blue: { text: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/20', hex: '#60a5fa' },
  rose: { text: 'text-rose-400', bg: 'bg-rose-500/20', border: 'border-rose-500/20', hex: '#fb7185' },
  teal: { text: 'text-teal-400', bg: 'bg-teal-500/20', border: 'border-teal-500/20', hex: '#2dd4bf' },
  orange: { text: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500/20', hex: '#f97316' },
  indigo: { text: 'text-indigo-400', bg: 'bg-indigo-500/20', border: 'border-indigo-500/20', hex: '#818cf8' }
};

const THEME_COLORS = ['cyan', 'violet', 'fuchsia', 'emerald', 'amber', 'blue', 'rose', 'teal', 'orange', 'indigo'];
const AGG_LABELS = { sum: 'Soma', avg: 'Média', max: 'Máximo', min: 'Mínimo', count: 'Contagem' };

const COMP_METHODS = {
  growth: { name: '📈 Crescimento Relativo (A/B)', defaultFormat: 'percent' },
  ratio_div: { name: '➗ Divisão Direta (A ÷ B)', defaultFormat: 'number' },
  ticket_medio: { name: '🏷️ Ticket Médio (Extrai Fat e Qtd do Painel)', defaultFormat: 'currency' },
  gap: { name: '📏 Diferença Absoluta (Gap)', defaultFormat: 'currency' },
  share: { name: '🍕 Participação / Share (%)', defaultFormat: 'percent' },
  index_100: { name: '🎯 Índice Desempenho (Base 100)', defaultFormat: 'number' },
  sum: { name: '➕ Soma Consolidada', defaultFormat: 'currency' },
  avg: { name: '⚖️ Média Simples (A e B)', defaultFormat: 'currency' }, 
  win_b: { name: '🏆 Vantagem do Alvo (Win B)', defaultFormat: 'currency' },
  win_a: { name: '📉 Déficit / Perda (Win A)', defaultFormat: 'currency' },
  variance: { name: '✂️ Variância (Distância)', defaultFormat: 'number' },
  custom: { name: '🔤 Fórmula Textual Livre', defaultFormat: 'number' },
  step_formula: { name: '⚙️ Matriz de Fórmulas Dinâmicas', defaultFormat: 'number' }
};

const cleanNumber = (val) => {
  if (typeof val === 'number') return val;
  if (!val) return null;
  let s = String(val).replace(/[R$\s%]/g, '').trim();
  if (s === '') return null;
  const lastComma = s.lastIndexOf(','), lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) { s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, ''); }
  else if (lastComma > -1) { s = s.indexOf(',') !== lastComma ? s.replace(/,/g, '') : s.replace(',', '.'); }
  else if (lastDot > -1) { if (s.indexOf('.') !== lastDot) s = s.replace(/\./g, ''); else if (s.split('.')[1].length === 3) s = s.replace('.', ''); }
  const num = Number(s);
  return isNaN(num) ? null : num;
};

const formatNumber = (num, compact = true) => num === null || num === undefined ? '-' : new Intl.NumberFormat('pt-BR', { notation: compact ? "compact" : "standard", maximumFractionDigits: 1, style: 'currency', currency: 'BRL' }).format(num);

const formatCustomValue = (num, aggType, formatType = 'currency') => {
  if (num === null || num === undefined || isNaN(num)) return '-';
  if (formatType === 'percent') return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(num) + '%';
  if (formatType === 'number') return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(num);
  if (formatType === 'compact') return new Intl.NumberFormat('pt-BR', { notation: "compact", maximumFractionDigits: 1 }).format(num);
  if (formatType === 'date') return num > 1000000000000 ? new Date(num).toLocaleDateString('pt-BR') : num > 10000 && num < 100000 ? new Date(Math.round((num - 25569) * 86400 * 1000)).toLocaleDateString('pt-BR') : String(Math.round(num)); 
  if (formatType === 'integer' || aggType === 'count') return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(Math.round(num));
  return formatNumber(num);
};

const formatKeyString = (val, ignoreYear) => {
    let str = String(val || 'N/A').trim();
    if (ignoreYear) {
        const matchBr = str.match(/^(\d{2}[\/\-]\d{2})/);
        if (matchBr) return matchBr[1].replace('-', '/');
        const matchIso = str.match(/^\d{4}[\/\-](\d{2})[\/\-](\d{2})/);
        if (matchIso) return `${matchIso[2]}/${matchIso[1]}`;
    }
    return str;
};

const safeExtractVal = (valObj, method) => typeof valObj !== 'object' || valObj === null ? (valObj || 0) : method === 'ticket_medio' ? (valObj._smartQtd ? valObj._smartFat / valObj._smartQtd : 0) : (valObj._total || 0);

const getChartTitle = (c) => {
  if (!c) return 'Gráfico Vazio';
  if (c.customTitle) return c.customTitle;
  if (c.isComparison) return `Cruzamento: ${c.linkMode === 'exact' ? 'Lado a Lado' : 'Matriz'} (${c.panels?.map(p => c.panelTitles?.[p.alias] || p.alias).join(' vs ')})${c.compJoinKey ? ` agrupado por [${c.compJoinKey}]` : ''}`;
  const activeYCols = c.isFormula ? ['Fórmula'] : (Array.isArray(c.y) ? c.y : []);
  const baseTitle = `${AGG_LABELS[c.agg] || 'Soma'}: ${activeYCols.join(', ')} por ${c.x || '?'}`;
  return c.breakdown ? `${baseTitle} (Quebrado por ${c.breakdown})` : baseTitle;
};

const getPanelLegendName = (chartRef) => !chartRef ? 'Desconhecido' : chartRef.customTitle ? chartRef.customTitle : chartRef.isFormula ? 'Fórmula' : chartRef.y?.length > 0 ? chartRef.y.map(y => y.replace(/^\[.*?\]\s*/, '')).join(', ') : 'Valor';

const evaluateMultiPanelFormula = (expr, valuesMap) => {
  try {
      const safeMap = {};
      Object.keys(valuesMap).forEach(k => safeMap[k] = safeExtractVal(valuesMap[k]));
      const cleanExpr = expr.toUpperCase().replace(/\s/g, '');
      if (!/^[A-F0-9+\-*/().]+$/.test(cleanExpr)) return 0;
      const res = new Function(...Object.keys(safeMap), `return ${cleanExpr};`)(...Object.values(safeMap));
      return isNaN(res) || !isFinite(res) ? 0 : res;
  } catch(e) { return 0; }
};

const computeGlobalRes = (c, totals, activeYCols) => {
    if (!c.isComparison || activeYCols.length < 2) return 0;
    if (c.compMethod === 'ticket_medio') {
        let totalFat = 0, totalQtd = 0;
        activeYCols.forEach(a => { totalFat += totals?.[a]?._smartFat || 0; totalQtd += totals?.[a]?._smartQtd || 0; });
        return totalQtd > 0 ? totalFat / totalQtd : 0;
    }
    const rawA = totals ? safeExtractVal(totals[activeYCols[0]], c.compMethod) : 0, rawB = totals ? safeExtractVal(totals[activeYCols[activeYCols.length - 1]], c.compMethod) : 0;
    switch(c.compMethod) {
        case 'growth': return rawA ? ((rawB - rawA) / Math.abs(rawA)) * 100 : 0;
        case 'gap': return rawB - rawA;
        case 'ratio': case 'ratio_div': return rawA ? rawB / rawA : 0;
        case 'avg': return (rawA + rawB) / 2;
        case 'sum': return rawA + rawB;
        case 'win_a': return rawA > rawB ? rawA - rawB : 0;
        case 'win_b': return rawB > rawA ? rawB - rawA : 0;
        case 'variance': return Math.abs(rawA - rawB);
        case 'index_100': return rawA ? (rawB / rawA) * 100 : 0;
        case 'custom': return evaluateMultiPanelFormula(c.customExpression, totals || {});
        case 'step_formula': {
            let stepResults = [];
            (c.compSteps || []).forEach(step => {
                const getStepVal = (opPanel, type, col) => type === 'num' ? Number(opPanel) || 0 : type === 'step' ? stepResults[Number(opPanel)] || 0 : type === 'panel' ? (totals[opPanel] ? (typeof totals[opPanel] === 'number' ? totals[opPanel] : (col && col !== '_total' ? totals[opPanel][col] || 0 : totals[opPanel]._total || 0)) : 0) : 0;
                const v1 = getStepVal(step.op1, step.op1Type, step.op1Col), v2 = getStepVal(step.op2, step.op2Type, step.op2Col); let sRes = 0;
                if (step.operator === '+') sRes = v1 + v2; if (step.operator === '-') sRes = v1 - v2; if (step.operator === '*') sRes = v1 * v2; if (step.operator === '/') sRes = (v2 && v2 !== 0) ? (v1 / v2) : 0; stepResults.push(sRes);
            }); return stepResults[stepResults.length - 1] || 0;
        } default: return 0;
    }
};

const extractSmartQtd = (r, cfg, dsName) => {
    let q = 1;
    if(cfg?.isFormula && cfg.steps?.length > 0) {
        let col = null;
        cfg.steps.forEach(s => {
            if(s.type === 'advanced') {
                const match = s.expression.match(/\{(qtd|quant|vol|peç|pec)[^}]*\}/i);
                if (match) col = match[1];
            } else {
                if(/(qtd|quant|vol|peç|pec)/i.test(s.op1)) col = s.op1;
                if(/(qtd|quant|vol|peç|pec)/i.test(s.op2)) col = s.op2;
            }
        });
        if(!col && cfg.steps[0].type !== 'advanced') col = cfg.steps[0].op1;
        if(col) {
            let h = col, m = col.match(/^\[(.*?)\]\s*(.*)$/);
            if(m){ if(m[1] !== dsName) return 1; h = m[2]; }
            let v = cleanNumber(r._original_row?.[h]);
            if(v !== null && !isNaN(v)) q = v;
        }
    }
    return q;
};

const extractSmartFat = (r, cfg, dsName) => {
    if(cfg?.isFormula && cfg.steps?.length > 0) {
        let s = cfg.steps[0];
        if (s.type === 'advanced') return null;
        let getV = (op) => {
            let h = op, m = op.match(/^\[(.*?)\]\s*(.*)$/);
            if(m){ if(m[1] !== dsName) return 0; h = m[2]; }
            return cleanNumber(r._original_row?.[h]) || 0;
        };
        let v1 = getV(s.op1), v2 = getV(s.op2);
        if(s.operator === '+') return v1 + v2;
        if(s.operator === '-') return v1 - v2;
        if(s.operator === '*') return v1 * v2;
        if(s.operator === '/') return v2 ? v1 / v2 : 0;
    }
    return null;
};

const getResultPrefix = (res, method) => res > 0 && !['ratio', 'ratio_div', 'index_100', 'share', 'variance', 'ticket_medio'].includes(method) ? '+' : '';

const evaluateFormulaStep = (step, stepResults, globalTotals, getValFn) => {
    if (step.type === 'advanced') {
        let expr = step.expression;
        let safeMap = {}; let varIdx = 0;
        const matches = expr.match(/\{([^}]+)\}/g) || [];
        matches.forEach(m => {
            const k = m.slice(1, -1);
            let val = 0;
            if (k.startsWith('Passo ')) { val = stepResults[Number(k.replace('Passo ', '')) - 1] || 0; }
            else if (k.startsWith('Σ ')) { val = globalTotals[k.substring(2)] || 0; }
            else if (k.startsWith('KPI: ')) { val = globalTotals[k] || 0; } 
            else { val = getValFn(k, 'col'); }
            
            const varName = `v${varIdx++}`;
            safeMap[varName] = val;
            expr = expr.replace(m, varName);
        });
        try { 
            const res = new Function(...Object.keys(safeMap), `return ${expr};`)(...Object.values(safeMap)); 
            return isNaN(res) || !isFinite(res) ? 0 : res; 
        } catch(e) { return 0; }
    } else {
        const v1 = getValFn(step.op1, step.op1Type), v2 = getValFn(step.op2, step.op2Type);
        if (step.operator === '+') return v1 + v2;
        if (step.operator === '-') return v1 - v2;
        if (step.operator === '*') return v1 * v2;
        if (step.operator === '/') return (v2 && v2 !== 0) ? (v1 / v2) : 0;
    }
    return 0;
};

const MathExpressionViewer = ({ expression }) => {
    if (!expression) return null;
    
    let isFraction = false;
    let numerator = expression;
    let denominator = "";
    
    if (expression.includes(" / ")) {
        const parts = expression.split(" / ");
        if (parts.length === 2) {
            isFraction = true;
            numerator = parts[0];
            denominator = parts[1];
        }
    }

    const renderTextWithVars = (text) => {
        const tokens = text.split(/(\{.*?\})/g);
        return tokens.map((token, i) => {
            if (token.startsWith('{') && token.endsWith('}')) {
                const varName = token.slice(1, -1);
                let colorClass = "bg-cyan-500/20 text-cyan-300 border-cyan-500/30";
                if (varName.startsWith('Passo')) colorClass = "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30";
                if (varName.startsWith('Σ')) colorClass = "bg-amber-500/20 text-amber-300 border-amber-500/30";
                if (varName.startsWith('KPI:')) colorClass = "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
                
                return (
                    <span key={i} className={`inline-block px-1.5 py-0.5 mx-0.5 text-[10px] font-bold rounded border shadow-sm ${colorClass}`}>
                        {varName.replace('KPI: ', 'KPI ')}
                    </span>
                );
            }
            let cleanToken = token;
            if (isFraction && (cleanToken.trim() === '(' || cleanToken.trim() === ')')) {
                 if (text.startsWith('(') && text.endsWith(')')) return null;
            }
            return <span key={i} className="text-white font-mono text-lg">{cleanToken}</span>;
        });
    };

    if (isFraction) {
        return (
            <div className="flex flex-col items-center justify-center mx-4 my-1">
                <div className="border-b-2 border-fuchsia-500/50 pb-1 px-4 text-center min-w-[3rem]">
                    {renderTextWithVars(numerator)}
                </div>
                <div className="pt-1 px-4 text-center min-w-[3rem]">
                    {renderTextWithVars(denominator)}
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center mx-4 py-2">
            {renderTextWithVars(expression)}
        </div>
    );
};

const Card = React.forwardRef(({ children, className = "", delay = 0, onClick }, ref) => (
  <div ref={ref} onClick={onClick} className={`relative bg-slate-900/60 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl transition-all duration-500 hover:border-indigo-500/40 animate-fade-in-up ${className}`} style={{ animationFillMode: 'both', animationDelay: `${delay}ms` }}>{children}</div>
));

const computeLabData = (config, result, kpiValues = {}, showAll = false) => {
  if (!result || !result.processedFiles || result.processedFiles.length === 0 || !config) return { records: [], yCols: [], totals: {} };
  const globalTotals = { ...kpiValues }; 
  (result.availableMetrics || []).forEach(m => globalTotals[m] = 0);
  result.processedFiles.forEach(ds => { (ds.data || []).forEach(r => {
      let skip = false;
      if (result.activeFilters && result.activeFilters.length > 0) result.activeFilters.forEach(f => { if ((ds.cleanHeaders || []).includes(f.col) && String(r._original_row?.[f.col]) !== String(f.val)) skip = true; });
      if (skip) return;
      (ds.numericHeaders || []).forEach(rawH => {
          const mName = result.processedFiles.length > 1 ? `[${ds.name}] ${rawH}` : rawH;
          if ((result.availableMetrics || []).includes(mName)) { const val = cleanNumber(r._original_row?.[rawH]); if (val !== null) globalTotals[mName] += val; }
      });
  })});

  if (config.isComparison) {
      const activePanels = config.panels ? config.panels.filter(p => p.chartId) : (config.chartAConfig ? [{alias: 'A', chartId: config.chartAConfig.id}, {alias: 'B', chartId: config.chartBConfig.id}] : []);
      const pConfigs = config.panelConfigs || { A: config.chartAConfig, B: config.chartBConfig };
      if(activePanels.length === 0) return { records: [], yCols: [], totals: {} };
      const activeAliases = activePanels.map(p => p.alias);

      const getValObj = (r, cfg, dsName) => {
          if (!cfg) return { _total: 0, _rawSum: 0, _totalCount: 0 };
          let res = { _total: 0, _rawSum: 0, _totalCount: 1 };
          (result?.availableMetrics || []).forEach(m => {
              let targetFile = null, rawH = m, match = m.match(/^\[(.*?)\]\s*(.*)$/);
              if (match) { targetFile = match[1]; rawH = match[2]; }
              if (targetFile && targetFile !== dsName) res[m] = 0; else res[m] = cleanNumber(r._original_row?.[rawH]) || 0;
          });
          if (!cfg.isFormula) {
              let sum = 0; (cfg.y || []).forEach(yCol => sum += res[yCol] || 0);
              res._total = sum; res._rawSum = sum; res._rawValForDebug = sum;
          } else {
              if (cfg.formulaMode === 'aggregate') { res['Fórmula'] = 0; res._total = 0; } else {
                  let involvesCurrentFile = false, involvesSpecificFiles = false;
                  (cfg.steps || []).forEach(step => {
                     if (step.type === 'advanced') {
                         involvesCurrentFile = true; 
                     } else {
                         [ {op: step.op1, type: step.op1Type}, {op: step.op2, type: step.op2Type} ].forEach(operand => {
                             if (operand.type === 'col') {
                                 const match = operand.op.match(/^\[(.*?)\]\s*(.*)$/);
                                 if (match) { involvesSpecificFiles = true; if (match[1] === dsName) involvesCurrentFile = true; } else involvesCurrentFile = true;
                             }
                         });
                     }
                  });
                  if (!involvesSpecificFiles || involvesCurrentFile) {
                      let stepResults = [];
                      (cfg.steps || []).forEach(step => {
                          const getValFn = (op, type) => {
                              if (type === 'num') return Number(op) || 0;
                              if (type === 'step') return stepResults[Number(op)] || 0;
                              if (type === 'global_col' || type === 'kpi') return globalTotals[op] || 0;
                              if (type === 'col') return res[op] || 0; return 0;
                          };
                          stepResults.push(evaluateFormulaStep(step, stepResults, globalTotals, getValFn));
                      });
                      res['Fórmula'] = stepResults[stepResults.length - 1] || 0;
                  } else res['Fórmula'] = 0;
                  res._total = res['Fórmula']; res._rawSum = res['Fórmula']; res._rawValForDebug = res['Fórmula'];
              }
          }
          res._smartQtd = extractSmartQtd(r, cfg, dsName);
          let magicalFat = extractSmartFat(r, cfg, dsName);
          res._smartFat = magicalFat !== null ? magicalFat : res._total;
          return res;
      };

      const calculateResultMulti = (valsMap, parentValsMap) => {
          const ext = (v) => typeof v === 'object' && v !== null ? (v._total || 0) : (v || 0);
          const A = ext(valsMap['A']), B = ext(valsMap['B']);
          let res = 0;
          switch(config.compMethod) {
              case 'growth': res = A ? ((B - A) / Math.abs(A)) * 100 : 0; break;
              case 'gap': res = B - A; break;
              case 'ratio': case 'ratio_div': res = A ? B / A : 0; break;
              case 'ticket_medio': {
                  let tFat = 0, tQtd = 0;
                  activeAliases.forEach(a => { if (valsMap[a]) { tFat += valsMap[a]._smartFat || 0; tQtd += valsMap[a]._smartQtd || 0; }});
                  res = tQtd > 0 ? tFat / tQtd : 0; break;
              }
              case 'share': {
                  let targetPanel = activeAliases[activeAliases.length - 1], nodeVal = ext(valsMap[targetPanel]), parentVal = parentValsMap ? ext(parentValsMap[targetPanel]) : 0;
                  if (!parentVal && parentValsMap) { targetPanel = activeAliases[0]; nodeVal = ext(valsMap[targetPanel]); parentVal = ext(parentValsMap[targetPanel]); }
                  res = parentVal ? (nodeVal / parentVal) * 100 : 0; break;
              }
              case 'index_100': res = A ? (B / A) * 100 : 0; break;
              case 'sum': res = A + B; break;
              case 'avg': res = activeAliases.reduce((sum, a) => sum + ext(valsMap[a]), 0) / Math.max(activeAliases.length, 1); break;
              case 'win_b': res = B > A ? B - A : 0; break;
              case 'win_a': res = A > B ? A - B : 0; break;
              case 'variance': res = Math.abs(A - B); break;
              case 'custom': res = evaluateMultiPanelFormula(config.customExpression, valsMap); break;
              case 'step_formula': {
                  let stepResults = [];
                  (config.compSteps || []).forEach(step => {
                      const getStepVal = (opPanel, type, col) => {
                          if (type === 'num') return Number(opPanel) || 0;
                          if (type === 'step') return stepResults[Number(opPanel)] || 0;
                          if (type === 'panel') {
                              const pObj = valsMap[opPanel]; if (!pObj) return 0; if (typeof pObj === 'number') return pObj;
                              if (col && col !== '_total') return pObj[col] || 0; return pObj._total || 0;
                          } return 0;
                      };
                      const v1 = getStepVal(step.op1, step.op1Type, step.op1Col), v2 = getStepVal(step.op2, step.op2Type, step.op2Col);
                      let sRes = 0;
                      if (step.operator === '+') sRes = v1 + v2; if (step.operator === '-') sRes = v1 - v2;
                      if (step.operator === '*') sRes = v1 * v2; if (step.operator === '/') sRes = (v2 && v2 !== 0) ? (v1 / v2) : 0;
                      stepResults.push(sRes);
                  });
                  res = stepResults[stepResults.length - 1] || 0; break;
              }
          }
          return res;
      };

      if (config.linkMode === 'exact') {
          const map = {}, exactGrandTotal = {};
          activeAliases.forEach(alias => {
             const baseCfg = pConfigs[alias]; if (!baseCfg) return;
             const cfg = config.compJoinKey ? { ...baseCfg, x: config.compJoinKey, breakdown: null, ignoreYear: config.ignoreYear } : { ...baseCfg, ignoreYear: config.ignoreYear };
             const { records, totals: subTotals } = computeLabData(cfg, result, kpiValues, true) || { records: [], totals: {} };
             exactGrandTotal[alias] = subTotals || { _total: 0, _rawSum: 0, _totalCount: 0 };
             const extractValObj = (d, cConfig) => {
                 if (!cConfig || !d) return { _total: 0, _rawSum: 0, _totalCount: 0 };
                 let res = { _total: 0, _rawSum: d._rawSum !== undefined ? d._rawSum : 0, _totalCount: d._totalCount || 1 };
                 if (cConfig.isFormula) {
                     res['Fórmula'] = d['Fórmula'] || 0; res._total = d['Fórmula'] || 0; res._rawSum = d._rawSum !== undefined ? d._rawSum : (d['Fórmula'] || 0); res._rawValues = d._formulaVals || []; res._debug = d._debug || [];
                 } else if (cConfig.breakdown) {
                     res._total = d._total || 0; res._rawValues = [d._total || 0];
                 } else {
                     let sum = 0, allRaw = [];
                     (Array.isArray(cConfig.y) ? cConfig.y : []).forEach(yCol => { res[yCol] = d[yCol] || 0; sum += res[yCol]; if (d._rawValues && d._rawValues[yCol]) allRaw.push(...d._rawValues[yCol]); });
                     res._total = sum; res._rawValues = allRaw.length > 0 ? allRaw : [sum];
                 }
                 res._smartQtd = d._smartQtd !== undefined ? d._smartQtd : (d._totalCount || 1);
                 res._smartFat = d._smartFat !== undefined ? d._smartFat : res._total;
                 (result?.availableMetrics || []).forEach(m => { if (!res.hasOwnProperty(m)) res[m] = d[m] || 0; });
                 return res;
             };
             (records || []).forEach(d => {
                 if (d) { if (!map[d.name]) { map[d.name] = {}; activeAliases.forEach(a => map[d.name][a] = { _total: 0, _rawSum: 0, _totalCount: 0 }); }
                     map[d.name][alias] = extractValObj(d, cfg);
             }});
          });

          const sortedData = Object.entries(map).map(([name, vals]) => ({ name, res: calculateResultMulti(vals, exactGrandTotal), ...vals })).sort((a, b) => (b.res || 0) - (a.res || 0));
          return { records: showAll ? sortedData : sortedData.slice(0, 15), isHierarchy: false, yCols: activeAliases, totals: exactGrandTotal };
      } else {
          let groupKeys = []; if (config.compJoinKey) groupKeys.push(config.compJoinKey);
          activeAliases.forEach(alias => {
             const cfg = pConfigs[alias];
             if (cfg?.x && !groupKeys.includes(cfg.x)) groupKeys.push(cfg.x);
             if (cfg?.breakdown && !groupKeys.includes(cfg.breakdown)) groupKeys.push(cfg.breakdown);
          });
          const tree = {};
          const getColName = (ds, colX) => {
              if (!colX) return null; if ((ds.cleanHeaders || []).includes(colX)) return colX;
              const mainFile = result.processedFiles[0];
              if (mainFile) { if (colX === mainFile.productHeader) return ds.productHeader; if (colX === mainFile.entityHeader) return ds.entityHeader; }
              return null;
          };
          const doAggObj = (valsArrObj, aggType, cfg) => {
              if (!valsArrObj || !valsArrObj.length) return { _total: 0, _rawSum: 0, _totalCount: 0 };
              let res = { _total: 0, _rawSum: 0, _totalCount: 0, _debug: [] };
              (result?.availableMetrics || []).forEach(m => res[m] = valsArrObj.map(v => v[m] || 0).reduce((a,b) => a + b, 0));
              let sumTotal = 0, countTotal = 0, smartQtdTotal = 0, smartFatTotal = 0;
              valsArrObj.forEach(v => { sumTotal += (v._rawSum !== undefined ? v._rawSum : (v._total || 0)); countTotal += (v._totalCount || 0); smartQtdTotal += (v._smartQtd || 0); smartFatTotal += (v._smartFat || 0); });
              res._rawSum = sumTotal; res._totalCount = countTotal; res._smartQtd = smartQtdTotal; res._smartFat = smartFatTotal;
              res._rawValues = valsArrObj.map(v => v._rawValForDebug).filter(v => v !== undefined && v !== null);
              if (cfg && cfg.isFormula) {
                  if (cfg.formulaMode === 'aggregate') {
                      let stepResults = [];
                      (cfg.steps || []).forEach(step => {
                          const getValFn = (op, type) => type === 'num' ? Number(op) || 0 : type === 'step' ? stepResults[Number(op)] || 0 : type === 'global_col' || type === 'kpi' ? globalTotals[op] || 0 : res[op] || 0; 
                          stepResults.push(evaluateFormulaStep(step, stepResults, globalTotals, getValFn));
                      });
                      res['Fórmula'] = stepResults[stepResults.length - 1] || 0; res._total = res['Fórmula']; res._debug.push(`Modo: Total Agregado`);
                  } else {
                      let arr = valsArrObj.map(v => v['Fórmula'] || 0);
                      if (aggType === 'avg') res['Fórmula'] = arr.length > 0 ? arr.reduce((a,b)=>a+b,0)/arr.length : 0; else if (aggType === 'max') res['Fórmula'] = Math.max(...arr); else if (aggType === 'min') res['Fórmula'] = Math.min(...arr); else if (aggType === 'count') res['Fórmula'] = arr.length; else res['Fórmula'] = arr.reduce((a,b)=>a+b,0);
                      res._total = res['Fórmula']; res._debug.push(`Modo: Linha a Linha (${AGG_LABELS[aggType] || 'Soma'})`);
                  }
              } else {
                  if (aggType === 'avg') res._total = countTotal > 0 ? sumTotal / countTotal : 0; else if (aggType === 'max') res._total = Math.max(...valsArrObj.map(v => v._total || 0)); else if (aggType === 'min') res._total = Math.min(...valsArrObj.map(v => v._total || 0)); else if (aggType === 'count') res._total = countTotal; else res._total = sumTotal;
                  (cfg?.y || []).forEach(yCol => {
                      let arr = valsArrObj.map(v => v[yCol] || 0);
                      if (aggType === 'avg') res[yCol] = arr.length > 0 ? arr.reduce((a,b)=>a+b,0)/arr.length : 0; else if (aggType === 'max') res[yCol] = Math.max(...arr); else if (aggType === 'min') res[yCol] = Math.min(...arr); else if (aggType === 'count') res[yCol] = arr.length; else res[yCol] = arr.reduce((a,b)=>a+b,0);
                  });
              }
              return res;
          };

          const globalVals = {}; activeAliases.forEach(a => globalVals[a] = []);
          result.processedFiles.forEach(ds => {
              let actualKeys = groupKeys.map(k => getColName(ds, k));
              (ds.data || []).forEach(r => {
                  let skip = false;
                  if (result.activeFilters && result.activeFilters.length > 0) result.activeFilters.forEach(f => { if ((ds.cleanHeaders || []).includes(f.col) && String(r._original_row?.[f.col]) !== String(f.val)) skip = true; });
                  if (skip) return;
                  let rawVals = actualKeys.map(k => k ? formatKeyString(r._original_row?.[k], config.ignoreYear) : 'N/A');
                  let isSubtotal = false; for (let i = 1; i < rawVals.length; i++) { if (rawVals[i].toLowerCase() === rawVals[i - 1].toLowerCase() && rawVals[i] !== 'N/A') { isSubtotal = true; break; } }
                  if (isSubtotal) return;
                  let currentLevel = tree;
                  rawVals.forEach((val) => {
                      if (!currentLevel[val]) { currentLevel[val] = { _vals: {}, children: {} }; activeAliases.forEach(a => currentLevel[val]._vals[a] = []); }
                      activeAliases.forEach(alias => currentLevel[val]._vals[alias].push(getValObj(r, pConfigs[alias], ds.name)));
                      currentLevel = currentLevel[val].children;
                  });
                  activeAliases.forEach(alias => globalVals[alias].push(getValObj(r, pConfigs[alias], ds.name)));
              });
          });

          let grandTotalAgg = {}; activeAliases.forEach(alias => grandTotalAgg[alias] = doAggObj(globalVals[alias], pConfigs[alias]?.agg || 'sum', pConfigs[alias]));
          const aggNode = (node, parentAggVals) => { let aggVals = {}; activeAliases.forEach(alias => aggVals[alias] = doAggObj(node._vals[alias], pConfigs[alias]?.agg || 'sum', pConfigs[alias])); return { ...aggVals, res: calculateResultMulti(aggVals, parentAggVals) }; };
          const processTree = (obj, level, parentAggVals) => Object.entries(obj).map(([name, node]) => ({ name, ...aggNode(node, parentAggVals), children: node.children && Object.keys(node.children).length > 0 ? processTree(node.children, level + 1, aggNode(node, parentAggVals)) : [], level })).sort((a,b) => b.res - a.res);
          return { records: processTree(tree, 0, grandTotalAgg), isHierarchy: true, yCols: activeAliases, totals: grandTotalAgg };
      }
  }

  if (config.breakdown && !config.isFormula) {
      const grouped = {}, bKeys = new Set(), yMetric = Array.isArray(config.y) ? config.y[0] : null; 
      if (!yMetric) return { records: [], yCols: [], totals: {} };
      result.processedFiles.forEach(ds => {
          const rawH = (ds.numericHeaders || []).find(h => (result.processedFiles.length > 1 ? `[${ds.name}] ${h}` : h) === yMetric); if (!rawH) return; 
          let joinCol = config.x; 
          if (!(ds.cleanHeaders || []).includes(config.x)) {
              const matchX = (ds.cleanHeaders || []).find(h => h.toLowerCase() === (config.x || '').toLowerCase());
              if (matchX) joinCol = matchX; else joinCol = config.x === result.processedFiles[0]?.productHeader ? ds.productHeader : (config.x === result.processedFiles[0]?.entityHeader ? ds.entityHeader : null);
          }
          if (!joinCol && config.x) joinCol = config.x;
          let bJoinCol = config.breakdown; 
          if (!(ds.cleanHeaders || []).includes(config.breakdown)) {
              const matchB = (ds.cleanHeaders || []).find(h => h.toLowerCase() === (config.breakdown || '').toLowerCase());
              if (matchB) bJoinCol = matchB; else bJoinCol = config.breakdown === result.processedFiles[0]?.productHeader ? ds.productHeader : (config.breakdown === result.processedFiles[0]?.entityHeader ? ds.entityHeader : null);
          }
          if (!bJoinCol && config.breakdown) bJoinCol = config.breakdown;
          (ds.data || []).forEach(r => {
             let skip = false; if (result.activeFilters && result.activeFilters.length > 0) result.activeFilters.forEach(f => { if ((ds.cleanHeaders || []).includes(f.col) && String(r._original_row?.[f.col]) !== String(f.val)) skip = true; }); if (skip) return;
             const key = formatKeyString(r._original_row?.[joinCol], config.ignoreYear); if (config.xFilters && config.xFilters.length > 0 && !config.xFilters.includes(key)) return; 
             const bKey = bJoinCol ? formatKeyString(r._original_row?.[bJoinCol], config.ignoreYear) : 'Não Especificado'; if (bJoinCol && key.toLowerCase() === bKey.toLowerCase() && key !== 'N/A') return;
             const val = cleanNumber(r._original_row?.[rawH]);
             if (val !== null && val !== undefined) {
                 bKeys.add(bKey); if (!grouped[key]) grouped[key] = { name: key }; if (!grouped[key][bKey]) grouped[key][bKey] = { val: 0, _counts: 0, _rawValues: [], _smartQtd: 0 };
                 grouped[key][bKey].val += val; grouped[key][bKey]._counts += 1; grouped[key][bKey]._smartQtd += 1; grouped[key][bKey]._rawValues.push(val);
             }
          });
      });
      const activeYCols = Array.from(bKeys).sort(); 
      const sortedData = Object.values(grouped).map(g => {
          const finalObj = { name: g.name }; let rowTotal = 0, rowRawSum = 0, rowCount = 0;
          activeYCols.forEach(bKey => {
              const bData = g[bKey]; if (!bData || !bData._rawValues || bData._rawValues.length === 0) { finalObj[bKey] = 0; return; }
              let res = 0; if (config.agg === 'avg') res = bData.val / (bData._counts || 1); else if (config.agg === 'max') res = Math.max(...bData._rawValues); else if (config.agg === 'min') res = Math.min(...bData._rawValues); else if (config.agg === 'count') res = bData._counts; else res = bData.val;
              finalObj[bKey] = res; rowTotal += res; rowRawSum += bData.val; rowCount += bData._counts;
          });
          finalObj._total = rowTotal; finalObj._rawSum = rowRawSum; finalObj._totalCount = rowCount; finalObj._smartQtd = rowCount; finalObj._smartFat = rowTotal;
          return finalObj;
      }).sort((a, b) => (b._total || 0) - (a._total || 0));

      let totals = { _total: 0, _rawSum: 0, _totalCount: 0 }; activeYCols.forEach(y => totals[y] = 0);
      let globalRawSum = 0, globalCount = 0, globalVals = [];
      activeYCols.forEach(y => {
          let ySum = 0, yCount = 0, yVals = [];
          Object.values(grouped).forEach(g => { if (g[y]) { ySum += g[y].val || 0; yCount += g[y]._counts || 0; if (g[y]._rawValues) yVals.push(...g[y]._rawValues); }});
          if (config.agg === 'avg') totals[y] = yCount > 0 ? ySum / yCount : 0; else if (config.agg === 'max') totals[y] = yVals.length ? Math.max(...yVals) : 0; else if (config.agg === 'min') totals[y] = yVals.length ? Math.min(...yVals) : 0; else if (config.agg === 'count') totals[y] = yCount; else totals[y] = ySum;
          globalRawSum += ySum; globalCount += yCount; globalVals.push(...yVals);
      });
      totals._rawSum = globalRawSum; totals._totalCount = globalCount;
      if (config.agg === 'avg') totals._total = globalCount > 0 ? globalRawSum / globalCount : 0; else if (config.agg === 'max') totals._total = globalVals.length ? Math.max(...globalVals) : 0; else if (config.agg === 'min') totals._total = globalVals.length ? Math.min(...globalVals) : 0; else if (config.agg === 'count') totals._total = globalCount; else totals._total = globalRawSum;
      totals._smartQtd = globalCount; totals._smartFat = globalRawSum;
      
      let finalRecordsBreakdown = sortedData;
      if (!showAll && !(config.xFilters && config.xFilters.length > 0)) {
          const topNSet = new Set();
          activeYCols.forEach(y => {
               const sortedByY = [...sortedData].sort((a, b) => (b[y] || 0) - (a[y] || 0));
               sortedByY.slice(0, 15).forEach(d => topNSet.add(d.name));
          });
          sortedData.slice(0, 15).forEach(d => topNSet.add(d.name));
          finalRecordsBreakdown = sortedData.filter(d => topNSet.has(d.name)).sort((a, b) => (b._total || 0) - (a._total || 0));
      }
      return { records: finalRecordsBreakdown, yCols: activeYCols, totals };
  }

  const grouped = {};
  result.processedFiles.forEach(ds => {
      let joinCol = config.x; 
      if (!(ds.cleanHeaders || []).includes(config.x)) {
          const caseMatch = (ds.cleanHeaders || []).find(h => h.toLowerCase() === (config.x || '').toLowerCase());
          if (caseMatch) joinCol = caseMatch;
          else joinCol = config.x === result.processedFiles[0]?.productHeader ? ds.productHeader : (config.x === result.processedFiles[0]?.entityHeader ? ds.entityHeader : null);
      }
      if (!joinCol && config.x) joinCol = config.x; 
      (ds.data || []).forEach(r => {
         let skip = false; if (result.activeFilters && result.activeFilters.length > 0) result.activeFilters.forEach(f => { if ((ds.cleanHeaders || []).includes(f.col) && String(r._original_row?.[f.col]) !== String(f.val)) skip = true; }); if (skip) return;
         const key = formatKeyString(r._original_row?.[joinCol], config.ignoreYear); if (config.xFilters && config.xFilters.length > 0 && !config.xFilters.includes(key)) return; 
         if (!grouped[key]) { grouped[key] = { name: key, _counts: {}, _rawValues: {}, _rowHits: 0, _formulaVals: [], _smartQtdAcc: 0, _smartFatAcc: 0 }; (result.availableMetrics || []).forEach(m => { grouped[key][m] = 0; grouped[key]._counts[m] = 0; grouped[key]._rawValues[m] = []; }); }
         grouped[key]._rowHits += 1;
         grouped[key]._smartQtdAcc += extractSmartQtd(r, config, ds.name);
         let mFat = extractSmartFat(r, config, ds.name);
         if(mFat !== null) grouped[key]._smartFatAcc += mFat;

         if (config.isFormula) {
             let involvesCurrentFile = false, involvesSpecificFiles = false;
             (config.steps || []).forEach(step => {
                 if (step.type === 'advanced') { involvesCurrentFile = true; } 
                 else {
                     [ {op: step.op1, type: step.op1Type}, {op: step.op2, type: step.op2Type} ].forEach(operand => { if (operand.type === 'col') { const match = operand.op.match(/^\[(.*?)\]\s*(.*)$/); if (match) { involvesSpecificFiles = true; if (match[1] === ds.name) involvesCurrentFile = true; } else involvesCurrentFile = true; } });
                 }
             });
             if (!involvesSpecificFiles || involvesCurrentFile) {
                 if (config.formulaMode !== 'aggregate') {
                     let stepResults = [];
                     (config.steps || []).forEach(step => {
                         const getValFn = (op, type) => {
                             if (type === 'num') return Number(op) || 0; if (type === 'step') return stepResults[Number(op)] || 0; if (type === 'global_col' || type === 'kpi') return globalTotals[op] || 0;
                             if (type === 'col') { let targetFile = null, rawH = op, match = op.match(/^\[(.*?)\]\s*(.*)$/); if (match) { targetFile = match[1]; rawH = match[2]; } if (targetFile && targetFile !== ds.name) return 0; return cleanNumber(r._original_row?.[rawH]) || 0; } return 0;
                         };
                         stepResults.push(evaluateFormulaStep(step, stepResults, globalTotals, getValFn));
                     });
                     grouped[key]._formulaVals.push(stepResults[stepResults.length - 1] || 0);
                 }
             }
         }
         (ds.numericHeaders || []).forEach(rawH => {
             const mName = result.processedFiles.length > 1 ? `[${ds.name}] ${rawH}` : rawH;
             if ((result.availableMetrics || []).includes(mName)) { const val = cleanNumber(r._original_row?.[rawH]); if (val !== null) { grouped[key][mName] += val; grouped[key]._counts[mName] += 1; grouped[key]._rawValues[mName].push(val); } }
         });
      });
  });

  const activeYCols = (config.breakdown && !config.isFormula) ? [] : (config.isFormula ? ['Fórmula'] : (Array.isArray(config.y) ? config.y : []));

  const sortedData = Object.values(grouped).map(g => {
    const finalObj = { name: g.name }; let rowCount = 0, rowRawSum = 0;
    finalObj._rawValues = {}; finalObj._debug = [];
    activeYCols.forEach(y => {
        if (y === 'Fórmula') return;
        const vals = g._rawValues?.[y]; finalObj._rawValues[y] = vals || []; if (!vals || vals.length === 0) { finalObj[y] = 0; return; }
        if (config.agg === 'avg') finalObj[y] = g[y] / (g._counts[y] || 1); else if (config.agg === 'max') finalObj[y] = Math.max(...vals); else if (config.agg === 'min') finalObj[y] = Math.min(...vals); else if (config.agg === 'count') finalObj[y] = g._counts[y]; else finalObj[y] = g[y]; 
        rowCount += g._counts[y] || 0; rowRawSum += finalObj[y] || 0;
    });
    finalObj._totalCount = rowCount; finalObj._rawSum = rowRawSum; finalObj._total = rowRawSum; finalObj._smartQtd = g._smartQtdAcc || 1;

    if (config.isFormula) {
      let fRes = 0;
      if (config.formulaMode === 'aggregate') {
          let stepResults = [];
          (config.steps || []).forEach(step => {
              const getValFn = (op, type) => type === 'num' ? Number(op) || 0 : type === 'step' ? stepResults[Number(op)] || 0 : type === 'global_col' || type === 'kpi' ? globalTotals[op] || 0 : g[op] || 0; 
              stepResults.push(evaluateFormulaStep(step, stepResults, globalTotals, getValFn));
          });
          fRes = stepResults[stepResults.length - 1] || 0;
          finalObj['Fórmula'] = fRes; finalObj._total = fRes; finalObj._rawSum = fRes; finalObj._totalCount = 1; finalObj._formulaVals = [fRes];
          finalObj._debug.push(`Modo de Cálculo: Total Agregado`);
      } else {
          const fVals = g._formulaVals || [];
          if (config.agg === 'avg') fRes = fVals.length ? fVals.reduce((a,b)=>a+b,0)/fVals.length : 0; else if (config.agg === 'max') fRes = Math.max(...fVals); else if (config.agg === 'min') fRes = Math.min(...fVals); else if (config.agg === 'count') fRes = fVals.length; else fRes = fVals.reduce((a,b)=>a+b,0);
          finalObj['Fórmula'] = fRes; finalObj._total = fRes; finalObj._rawSum = fVals.reduce((a,b)=>a+b,0); finalObj._totalCount = fVals.length || 1; finalObj._formulaVals = fVals;
          finalObj._debug.push(`Modo de Cálculo: Linha a Linha (${AGG_LABELS[config.agg] || 'Soma'})`);
      }
    }
    finalObj._smartFat = (g._smartFatAcc !== undefined && g._smartFatAcc !== 0) ? g._smartFatAcc : finalObj._total;
    return finalObj;
  }).sort((a, b) => (b._total || 0) - (a._total || 0));
  
  let totals = { _total: 0, _rawSum: 0, _totalCount: 0 }; activeYCols.forEach(y => totals[y] = 0);
  if (config.isFormula) {
      if (config.formulaMode === 'aggregate') {
          let stepResults = [];
          (config.steps || []).forEach(step => {
              const getValFn = (op, type) => type === 'num' ? Number(op) || 0 : type === 'step' ? stepResults[Number(op)] || 0 : type === 'global_col' || type === 'kpi' ? globalTotals[op] || 0 : globalTotals[op] || 0; 
              stepResults.push(evaluateFormulaStep(step, stepResults, globalTotals, getValFn));
          });
          let fRes = stepResults[stepResults.length - 1] || 0;
          totals['Fórmula'] = fRes; totals._total = fRes; totals._rawSum = fRes; totals._totalCount = 1;
      } else {
          totals._rawSum = 0; totals._totalCount = 0; let globalFVals = [];
          Object.values(grouped).forEach(g => { if (g._formulaVals) globalFVals.push(...g._formulaVals); });
          let fRes = 0;
          if (config.agg === 'avg') fRes = globalFVals.length ? globalFVals.reduce((a,b)=>a+b,0)/globalFVals.length : 0; else if (config.agg === 'max') fRes = Math.max(...globalFVals); else if (config.agg === 'min') fRes = Math.min(...globalFVals); else if (config.agg === 'count') fRes = globalFVals.length; else fRes = globalFVals.reduce((a,b)=>a+b,0);
          totals['Fórmula'] = fRes; totals._total = fRes; totals._rawSum = globalFVals.reduce((a,b)=>a+b,0); totals._totalCount = globalFVals.length || 1;
      }
      let globalSmartQtd = 0, globalSmartFat = 0;
      Object.values(grouped).forEach(g => { globalSmartQtd += (g._smartQtdAcc || 0); globalSmartFat += (g._smartFatAcc || 0); });
      totals._smartQtd = globalSmartQtd; totals._smartFat = globalSmartFat !== 0 ? globalSmartFat : totals._total;
  } else {
      let globalRawSum = 0, globalCount = 0, globalVals = [], globalSmartQtd = 0, globalSmartFat = 0;
      activeYCols.forEach(y => {
          let ySum = 0, yCount = 0, yVals = [];
          Object.values(grouped).forEach(g => { ySum += g[y] || 0; yCount += g._counts?.[y] || 0; globalSmartQtd += (g._smartQtdAcc || 0); globalSmartFat += (g._smartFatAcc || 0); if (g._rawValues?.[y]) yVals.push(...g._rawValues[y]); });
          if (config.agg === 'avg') totals[y] = yCount > 0 ? ySum / yCount : 0; else if (config.agg === 'max') totals[y] = yVals.length ? Math.max(...yVals) : 0; else if (config.agg === 'min') totals[y] = yVals.length ? Math.min(...yVals) : 0; else if (config.agg === 'count') totals[y] = yCount; else totals[y] = ySum;
          globalRawSum += ySum; globalCount += yCount; globalVals.push(...yVals);
      });
      totals._rawSum = globalRawSum; totals._totalCount = globalCount;
      if (config.agg === 'avg') totals._total = globalCount > 0 ? globalRawSum / globalCount : 0; else if (config.agg === 'max') totals._total = globalVals.length ? Math.max(...globalVals) : 0; else if (config.agg === 'min') totals._total = globalVals.length ? Math.min(...globalVals) : 0; else if (config.agg === 'count') totals._total = globalCount; else totals._total = globalRawSum;
      totals._smartQtd = globalSmartQtd || globalCount; totals._smartFat = globalRawSum;
      
      let finalRecords = [];
      if (config.alignMode === 'rank' && activeYCols.length > 1 && !config.isFormula && !config.breakdown) {
          const independentArrays = {};
          activeYCols.forEach(y => {
              independentArrays[y] = sortedData
                  .filter(d => (d[y] || 0) !== 0)
                  .map(d => ({ name: d.name, val: d[y], rawValues: d._rawValues[y] || [] }))
                  .sort((a, b) => b.val - a.val);
          });
          const limit = showAll || (config.xFilters && config.xFilters.length > 0) ? Math.max(0, ...Object.values(independentArrays).map(a => a.length)) : 15;
          for (let i = 0; i < limit; i++) {
              const rowObj = { name: `Top ${i + 1}`, _isRanked: true, _rankLabels: {}, _rawValues: {} };
              let rowRawSum = 0;
              activeYCols.forEach(y => {
                  const item = independentArrays[y][i];
                  if (item) {
                      rowObj[y] = item.val;
                      rowObj._rankLabels[y] = item.name;
                      rowObj._rawValues[y] = item.rawValues;
                      rowRawSum += item.val;
                  } else {
                      rowObj[y] = 0;
                      rowObj._rankLabels[y] = 'Sem Dados';
                      rowObj._rawValues[y] = [];
                  }
              });
              rowObj._total = rowRawSum;
              rowObj._rawSum = rowRawSum;
              finalRecords.push(rowObj);
          }
      } else {
          if (showAll || (config.xFilters && config.xFilters.length > 0)) {
              finalRecords = sortedData;
          } else {
              const topNSet = new Set();
              activeYCols.forEach(y => {
                   const sortedByY = [...sortedData].sort((a, b) => (b[y] || 0) - (a[y] || 0));
                   sortedByY.slice(0, 15).forEach(d => topNSet.add(d.name));
              });
              sortedData.slice(0, 15).forEach(d => topNSet.add(d.name));
              finalRecords = sortedData.filter(d => topNSet.has(d.name)).sort((a, b) => (b[activeYCols[0]] || 0) - (a[activeYCols[0]] || 0));
          }
      }
      
      return { records: finalRecords, yCols: activeYCols, totals };
  }
  return { records: [], yCols: activeYCols, totals }; 
};

const CustomChartCard = ({ c, result, kpiValues, onToggleSize, onDelete, onRename, onEdit, onShowDialog }) => {
  const cardRef = useRef(null);
  const [showAll, setShowAll] = useState(false);
  const [showDebug, setShowDebug] = useState(false); 
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [drilledSlice, setDrilledSlice] = useState(null);
  const [hoveredItemId, setHoveredItemId] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState({});
  const [tooltipData, setTooltipData] = useState(null);
  const [fixedTooltipPos, setFixedTooltipPos] = useState({ x: 0, y: 0 });

  const { records: rawData, yCols: rawActiveYCols, isHierarchy, totals } = useMemo(() => computeLabData(c, result, kpiValues, showAll), [c, result, kpiValues, showAll]);
  const data = rawData || [], activeYCols = Array.isArray(rawActiveYCols) ? rawActiveYCols : [];
  const max = Math.max(...data.flatMap(d => activeYCols.map(yName => Math.abs(safeExtractVal(d[yName], c.compMethod)))), 1);
  const titleText = getChartTitle(c);

  const getColFormat = (yName) => c.isComparison ? c.panelConfigs?.[yName]?.format || 'currency' : c.format || 'currency';

  const handleGlobalMouseMove = (e, targetData, type, id = null) => {
      setTooltipData({ type, data: targetData, id });
      if (!cardRef.current) return;
      let x = (e.clientX) + 20, y = (e.clientY) + 20;
      if (e.clientX + 480 > window.innerWidth) x = (e.clientX) - 480 - 20;
      if (e.clientY + 450 > window.innerHeight) { y = (e.clientY) - 450 - 20; if (y < 10) y = 10; }
      setFixedTooltipPos({ x, y });
  };
  const handleGlobalMouseLeave = () => { setTooltipData(null); if (hoveredItemId) setHoveredItemId(null); };

  const renderXRay = (d, chartConfig, activeYColsList, isGlobal = false) => {
      if (!showDebug && !isGlobal) return null;
      const containerClass = isGlobal ? "flex flex-col gap-3 h-full" : "mt-5 pt-4 border-t border-fuchsia-500/30 text-[10px] font-mono text-fuchsia-300 bg-fuchsia-950/30 p-4 rounded-xl shadow-inner border border-fuchsia-500/20 max-h-64 overflow-y-auto custom-scrollbar pointer-events-auto";
      return (
          <div className={containerClass}>
            {!isGlobal && <div className="font-black text-fuchsia-400 mb-3 uppercase tracking-widest flex items-center gap-2 sticky top-0 bg-fuchsia-950/90 py-1 backdrop-blur-sm z-10"><Calculator size={14}/> Auditoria Raio-X</div>}
            <div className={`space-y-4 ${isGlobal ? 'flex-1' : ''}`}>
              {chartConfig.isComparison ? (
                 activeYColsList.map(yName => {
                    const pData = d[yName], rVals = pData?._rawValues || [], displayVals = rVals.filter(v => v !== 0), valsToShow = displayVals.length > 0 ? displayVals : rVals;
                    return (
                       <div key={yName} className={`bg-black/40 p-3 rounded-xl border border-fuchsia-500/10 ${isGlobal ? 'text-[11px]' : ''}`}>
                          <div className="text-white font-bold mb-1.5 uppercase flex justify-between items-center"><span>Painel {chartConfig.panelTitles?.[yName] || yName}</span><span className="text-fuchsia-400/60 text-[9px]">{rVals.length} Linhas</span></div>
                          {chartConfig.compMethod === 'ticket_medio' && (
                              <div className="text-emerald-400 font-bold border-b border-fuchsia-500/10 pb-2 mb-2 flex flex-col gap-1.5">
                                 <div className="flex justify-between items-center"><span>Σ Faturamento Extraído:</span><span>{formatCustomValue(pData?._smartFat, 'sum', getColFormat(yName))}</span></div>
                                 <div className="flex justify-between items-center"><span>Σ Quantidade Extraída:</span><span>{formatCustomValue(pData?._smartQtd, 'sum', 'integer')}</span></div>
                              </div>
                          )}
                          <div className="text-fuchsia-400/80 break-words leading-relaxed text-[10px] mb-2 font-medium">{valsToShow.slice(0, 30).map(v => formatNumber(v, false)).join(' + ')}{valsToShow.length > 30 ? ` ... (+${valsToShow.length - 30} itens)` : ''}</div>
                          <div className="text-emerald-400 font-bold border-t border-fuchsia-500/10 pt-2 mt-1 flex justify-between items-center"><span>Σ Soma Bruta:</span><span>{formatCustomValue(pData?._rawSum, 'sum', getColFormat(yName))}</span></div>
                       </div>
                    )
                 })
              ) : (
                 activeYColsList.map(yName => {
                    const rVals = (chartConfig.isFormula ? d._formulaVals : d._rawValues?.[yName]) || [], displayVals = rVals.filter(v => v !== 0), valsToShow = displayVals.length > 0 ? displayVals : rVals;
                    return (
                       <div key={yName} className={`bg-black/40 p-3 rounded-xl border border-fuchsia-500/10 ${isGlobal ? 'text-[11px]' : ''}`}>
                          <div className="text-white font-bold mb-1.5 uppercase flex justify-between items-center"><span>{yName}</span><span className="text-fuchsia-400/60 text-[9px]">{rVals.length} Linhas Lidas</span></div>
                          <div className="text-fuchsia-400/80 break-words leading-relaxed text-[10px] mb-2 font-medium">{valsToShow.slice(0, 30).map(v => formatNumber(v, false)).join(' + ')}{valsToShow.length > 30 ? ` ... (+${valsToShow.length - 30} itens)` : ''}</div>
                          <div className="text-emerald-400 font-bold border-t border-fuchsia-500/10 pt-2 mt-1 flex justify-between items-center"><span>Σ Soma Lida:</span><span>{formatCustomValue(chartConfig.isFormula ? d['Fórmula'] : d[yName], 'sum', getColFormat(yName))}</span></div>
                       </div>
                    )
                 })
              )}
              {chartConfig.isComparison && (
                 <div className={`bg-indigo-900/30 p-3 rounded-xl border border-indigo-500/30 mt-2 shadow-inner ${isGlobal ? 'text-xs' : ''}`}>
                   <div className="text-indigo-300 font-bold mb-1 uppercase tracking-widest text-[9px]">Cálculo Aplicado ({COMP_METHODS[chartConfig.compMethod]?.name})</div>
                   <div className="text-indigo-200 text-xs flex justify-between items-center mt-2 border-t border-indigo-500/20 pt-2"><span>Resultado Exato:</span><span className="text-white font-black text-sm">{formatCustomValue(d.res, 'sum', chartConfig.format)}</span></div>
                 </div>
              )}
            </div>
          </div>
      );
  };

  const getGlobalRes = () => computeGlobalRes(c, totals, activeYCols);

  const getSmartInsight = (d, method, format, totalsData) => {
    if (!c.isComparison) return null; if (activeYCols.length < 2 && !['share', 'custom', 'step_formula'].includes(method)) return null;
    const aliasA = activeYCols[0], aliasB = activeYCols[activeYCols.length - 1];
    const nameA = c.panelTitles?.[aliasA] ? c.panelTitles[aliasA] : `Série ${aliasA}`, nameB = c.panelTitles?.[aliasB] ? c.panelTitles[aliasB] : `Série ${aliasB}`;
    const valA = safeExtractVal(d[aliasA], method), valB = activeYCols.length > 1 ? safeExtractVal(d[aliasB], method) : 0;
    const totalA = totalsData ? safeExtractVal(totalsData[aliasA], method) : 0, totalB = totalsData && activeYCols.length > 1 ? safeExtractVal(totalsData[aliasB], method) : 0;
    const formatA = c.panelConfigs?.[aliasA]?.format || 'currency', formatB = c.panelConfigs?.[aliasB]?.format || 'currency';
    const fValA = formatCustomValue(valA, 'sum', formatA), fValB = formatCustomValue(valB, 'sum', formatB);
    const fTotalA = formatCustomValue(totalA, 'sum', formatA), fTotalB = formatCustomValue(totalB, 'sum', formatB);
    const res = d.res, formattedRes = formatCustomValue(Math.abs(res), 'sum', format);
    let color = "text-slate-300", bg = "bg-slate-800/50", border = "border-slate-600/50", icon = "💡";
    if (res > 0 && !['ratio', 'ticket_medio', 'ratio_div', 'index_100', 'share', 'variance'].includes(method)) { color = "text-emerald-400"; bg = "bg-emerald-500/10"; border = "border-emerald-500/30"; icon = "📈"; }
    else if (res < 0 && !['ratio', 'ticket_medio', 'ratio_div', 'index_100', 'share', 'variance'].includes(method)) { color = "text-rose-400"; bg = "bg-rose-500/10"; border = "border-rose-500/30"; icon = "📉"; }
    else { color = "text-blue-400"; bg = "bg-blue-500/10"; border = "border-blue-500/30"; icon = "⚖️"; }
    const shareA = totalA ? (valA / totalA) * 100 : 0, shareB = totalB ? (valB / totalB) * 100 : 0;
    const fShareA = formatCustomValue(shareA, 'sum', 'percent'), fShareB = formatCustomValue(shareB, 'sum', 'percent');
    const sumLocal = valA + valB, sumGlobal = totalA + totalB, sumFormat = (formatA === 'currency' || formatB === 'currency') ? 'currency' : 'number';
    const fSumLocal = formatCustomValue(sumLocal, 'sum', sumFormat), fSumGlobal = formatCustomValue(sumGlobal, 'sum', sumFormat);
    const fGlobalSumPct = formatCustomValue(sumGlobal ? (sumLocal/sumGlobal)*100 : 0, 'sum', 'percent');
    const dimName = d.name && d.name !== 'N/A' ? d.name : 'Este item', biggerName = valA > valB ? nameA : nameB, smallerName = valA > valB ? nameB : nameA;
    const biggerVal = valA > valB ? valA : valB, smallerVal = valA > valB ? valB : valA, fBigger = valA > valB ? fValA : fValB, fSmaller = valA > valB ? fValB : fValA;
    const diffPct = smallerVal ? ((biggerVal - smallerVal) / Math.abs(smallerVal)) * 100 : 0, fDiffPct = formatCustomValue(diffPct, 'sum', 'percent');
    const gapRaw = Math.abs(valA - valB), fGapRaw = formatCustomValue(gapRaw, 'sum', formatA);
    const globalRes = getGlobalRes(), fGlobalRes = formatCustomValue(Math.abs(globalRes), 'sum', format);
    let parts = [];
    switch (method) {
      case 'growth':
        let growthNode = res > 0 ? <span className="text-emerald-400 font-black">📈 um crescimento de {formattedRes}</span> : res < 0 ? <span className="text-rose-400 font-black">📉 uma queda de {formattedRes}</span> : <span className="text-blue-400 font-black">➖ estabilidade plena (0%)</span>;
        parts.push(<React.Fragment key="1"><strong className="text-white">{dimName}</strong> — Avaliando a evolução de <strong>{nameA}</strong> (<span className="text-slate-300 font-mono">{fValA}</span>) para <strong>{nameB}</strong> (<span className="text-slate-300 font-mono">{fValB}</span>), registamos {growthNode}.</React.Fragment>, <React.Fragment key="2">Analisando o peso individual, a métrica <strong>{nameA}</strong> concentra <span className="text-amber-400 font-black">{fShareA}</span> do seu total geral, e <strong>{nameB}</strong> representa <span className="text-amber-400 font-black">{fShareB}</span> do seu próprio total.</React.Fragment>, <React.Fragment key="3">Considerando o ecossistema inteiro, a taxa de crescimento global consolidada está atualmente em <span className="text-indigo-400 font-mono font-black">{fGlobalRes}</span>.</React.Fragment>); break;
      case 'gap':
        let gapNode = valA === valB ? <span className="text-blue-400 font-black">estão perfeitamente equilibrados (Gap Zero)</span> : <React.Fragment>os dados de <strong>{biggerName}</strong> (<span className="text-white font-mono bg-white/10 px-1.5 py-0.5 rounded">{fBigger}</span>) superam <strong>{smallerName}</strong> (<span className="text-slate-300 font-mono">{fSmaller}</span>) gerando um Gap de <span className="text-emerald-400 font-black">📏 {formattedRes}</span></React.Fragment>;
        parts.push(<React.Fragment key="1"><strong className="text-white">{dimName}</strong> — {gapNode}.</React.Fragment>); if (valA !== valB) parts.push(<React.Fragment key="2">Isso significa que <strong>{biggerName}</strong> obteve um volume <span className="text-emerald-400 font-black">📈 {fDiffPct} superior</span> em relação à métrica oposta.</React.Fragment>); parts.push(<React.Fragment key="3">Em nível Global (somando todas as dimensões), a diferença absoluta atual entre estas duas frentes encontra-se em <span className="text-fuchsia-400 font-mono font-black">{fGlobalRes}</span>.</React.Fragment>); break;
      case 'ratio': case 'ratio_div':
        parts.push(<React.Fragment key="1"><strong className="text-white">{dimName}</strong> — A proporção direta entre as métricas é de <span className="text-indigo-400 font-black">{formattedRes}:1</span>.</React.Fragment>, <React.Fragment key="2">Isto indica que, para cada unidade da base <strong>{nameB}</strong> (<span className="text-slate-300 font-mono">{fValB}</span>), existe o equivalente a <span className="text-white font-black">{formattedRes}</span> em <strong>{nameA}</strong> (<span className="text-slate-300 font-mono">{fValA}</span>).</React.Fragment>, <React.Fragment key="3">A divisão global/acumulada destes blocos encontra-se em <span className="text-white font-mono bg-white/10 px-1.5 py-0.5 rounded">{fGlobalRes}</span>.</React.Fragment>); break;
      case 'ticket_medio':
        parts.push(<React.Fragment key="1"><strong className="text-white">{dimName}</strong> — O Motor leu perfeitamente as suas planilhas e extraiu independentemente a Quantidade e o Faturamento Real.</React.Fragment>, <React.Fragment key="2">O Ticket Médio do <strong>{nameA}</strong> ficou em <span className="text-emerald-400 font-mono">{fValA}</span> e o do <strong>{nameB}</strong> em <span className="text-emerald-400 font-mono">{fValB}</span>.</React.Fragment>, <React.Fragment key="3">Somando todas as quantidades e todos os faturamentos de ambos os painéis, o Ticket Médio Global exato é de <span className="text-white font-mono bg-white/10 px-1.5 py-0.5 rounded">{fGlobalRes}</span>.</React.Fragment>); break;
      case 'share':
        parts.push(<React.Fragment key="1"><strong className="text-white">{dimName}</strong> — O valor de <span className="text-slate-300 font-mono">{fValB}</span> (<strong>{nameB}</strong>) garante uma representação (Share) de <span className="text-amber-400 font-black">🍕 {formattedRes}</span> sobre o total de {fTotalB}.</React.Fragment>, <React.Fragment key="2">Em paralelo, <strong>{nameA}</strong> (<span className="text-slate-300 font-mono">{fValA}</span>) detém uma influência de <span className="text-amber-400 font-black">{fShareA}</span> sob a sua própria realidade global ({fTotalA}).</React.Fragment>, <React.Fragment key="3">A diferença de representatividade (peso) entre as duas métricas nesta secção é de <span className="text-indigo-400 font-black font-mono">{formatCustomValue(Math.abs(shareB - shareA), 'sum', 'number')}%</span>.</React.Fragment>); break;
      case 'index_100':
        let idxNode = res > 100 ? <React.Fragment>superou a expetativa e marcou um <span className="text-emerald-400 font-black">índice excelente de {formattedRes}</span></React.Fragment> : res < 100 ? <React.Fragment>demonstrou fraqueza e atingiu <span className="text-rose-400 font-black">apenas o índice {formattedRes}</span></React.Fragment> : <React.Fragment>está perfeitamente alinhado, atingindo a marca de <span className="text-blue-400 font-black">100 pontos exatos</span></React.Fragment>;
        parts.push(<React.Fragment key="1"><strong className="text-white">{dimName}</strong> — Utilizamos <strong>{nameA}</strong> (<span className="text-slate-300 font-mono">{fValA}</span>) como a meta central (Base Indexante = 100).</React.Fragment>, <React.Fragment key="2">Analisando <strong>{nameB}</strong> ({fValB}), verificamos que {idxNode}.</React.Fragment>, <React.Fragment key="3">Isto revela um desvio absoluto de <span className="text-white font-mono bg-white/10 px-1.5 py-0.5 rounded">{fGapRaw}</span> face à base projetada inicial.</React.Fragment>); break;
      case 'sum':
        let sumCmpNode = valA === valB ? <React.Fragment>Os valores estão <span className="text-blue-400 font-black">➖ rigorosamente iguais</span>, ambos registrando <span className="text-white font-mono bg-white/10 px-1.5 py-0.5 rounded">{fValA}</span></React.Fragment> : <React.Fragment><strong>{biggerName}</strong> (<span className="text-white font-mono bg-white/10 px-1.5 py-0.5 rounded">{fBigger}</span>) gerou volume <span className="text-emerald-400 font-black">📈 {fDiffPct} superior</span> a <strong>{smallerName}</strong> (<span className="text-slate-300 font-mono">{fSmaller}</span>)</React.Fragment>;
        parts.push(<React.Fragment key="1"><strong className="text-white">{dimName}</strong> — {sumCmpNode}.</React.Fragment>, <React.Fragment key="2"><strong>{nameA}</strong> concentra <span className="text-amber-400 font-black">{fShareA}</span> do seu total geral, enquanto <strong>{nameB}</strong> representa <span className="text-amber-400 font-black">{fShareB}</span> do seu total.</React.Fragment>, <React.Fragment key="3">Juntos, somam <span className="text-fuchsia-400 font-black">➕ {formattedRes}</span> nesta dimensão, contribuindo com <span className="text-white font-black">{fGlobalSumPct}</span> para o macro total de <span className="text-slate-300 font-mono">{fSumGlobal}</span>.</React.Fragment>); break;
      case 'avg':
        parts.push(<React.Fragment key="1"><strong className="text-white">{dimName}</strong> — Temos <strong>{nameA}</strong> com <span className="text-slate-300 font-mono">{fValA}</span>, e <strong>{nameB}</strong> com <span className="text-slate-300 font-mono">{fValB}</span>.</React.Fragment>, <React.Fragment key="2">Calculando a <strong>Média Simples</strong> entre os painéis, o valor converge para <span className="text-cyan-400 font-black">⚖️ {formattedRes}</span>.</React.Fragment>, <React.Fragment key="3">A média simples global de todas as operações consolida-se em <span className="text-white font-mono bg-white/10 px-1.5 py-0.5 rounded">{fGlobalRes}</span>.</React.Fragment>); break;
      case 'win_b':
        parts.push(<React.Fragment key="1"><strong className="text-white">{dimName}</strong> — Avaliamos um cenário de confronto competitivo direto para destacar <strong>{nameB}</strong> (Alvo).</React.Fragment>);
        if (res > 0) parts.push(<React.Fragment key="2">O Alvo <strong>VENCEU</strong> o confronto direto, alcançando <span className="text-emerald-400 font-mono font-black">🏆 {fValB}</span> contra <span className="text-rose-400 font-mono line-through opacity-70">{fValA}</span> de <strong>{nameA}</strong>.</React.Fragment>, <React.Fragment key="3">Isso garantiu uma vantagem pura de <span className="text-emerald-400 font-black">+{formattedRes}</span>, face à vantagem global acumulada de {fGlobalRes}.</React.Fragment>); else parts.push(<React.Fragment key="2">O Alvo foi <span className="text-rose-400 font-black">derrotado ou empatou</span>, não registando qualquer margem a seu favor (0).</React.Fragment>, <React.Fragment key="3">Neste perímetro competitivo, <strong>{nameA}</strong> demonstrou maior tração.</React.Fragment>); break;
      case 'win_a':
        parts.push(<React.Fragment key="1"><strong className="text-white">{dimName}</strong> — Este filtro destaca cenários defensivos onde <strong>{nameA}</strong> (Base) reteve a soberania.</React.Fragment>);
        if (res > 0) parts.push(<React.Fragment key="2">A Base <strong>MANTÉM LIDERANÇA</strong> registando <span className="text-emerald-400 font-mono font-black">🏆 {fValA}</span> e derrotando o volume de <span className="text-rose-400 font-mono line-through opacity-70">{fValB}</span> de <strong>{nameB}</strong>.</React.Fragment>, <React.Fragment key="3">Isto isola uma perda não coberta de <span className="text-rose-400 font-black">{formattedRes}</span> por parte do desafiante.</React.Fragment>); else parts.push(<React.Fragment key="2">A Base perdeu o seu lugar de destaque local, resultando num <span className="text-blue-400 font-black">déficit nulo (0)</span> no ranking.</React.Fragment>, <React.Fragment key="3">Significa que <strong>{nameB}</strong> obteve sucesso na equiparação ou ultrapassagem das forças.</React.Fragment>); break;
      case 'variance':
        parts.push(<React.Fragment key="1"><strong className="text-white">{dimName}</strong> — A variância calcula a anomalia ou dispersão pura de volumes (<span className="text-slate-300 font-mono">{fValA}</span> vs <span className="text-slate-300 font-mono">{fValB}</span>).</React.Fragment>, <React.Fragment key="2">A distância detetada pela anomalia é de <span className="text-fuchsia-400 font-black">✂️ {formattedRes}</span>, independentemente do eixo vencedor.</React.Fragment>, <React.Fragment key="3">Dispersões muito altas indicam atritos e oscilações, enquanto números menores revelam consistência (A Variância Média Global é de {fGlobalRes}).</React.Fragment>); break;
      case 'custom': case 'step_formula': default:
        parts.push(<React.Fragment key="1"><strong className="text-white">{dimName}</strong> — O Motor aplicou as regras da sua Fórmula Dinâmica aos vetores de base.</React.Fragment>, <React.Fragment key="2">A métrica <strong>{nameA}</strong> participou com <span className="text-slate-300 font-mono">{fValA}</span> e <strong>{nameB}</strong> com <span className="text-slate-300 font-mono">{fValB}</span> no fluxo matemático.</React.Fragment>, <React.Fragment key="3">Após a computação passo a passo, o algoritmo declarou o resultado final da expressão como <span className="text-indigo-400 font-black">{formattedRes}</span>.</React.Fragment>); break;
    }
    return { parts, color, bg, border, icon };
  };

  const barWidth = activeYCols.length > 8 ? 'w-4' : (activeYCols.length > 4 ? 'w-6' : 'w-10');
  const isBreakdown = !!c.breakdown && !c.isFormula && !c.isComparison;
  const primaryMetric = activeYCols[0];
  let pieData = [], pieTotal = 0, centerLabel = '';

  if (c.type === 'pie' && primaryMetric) {
      if (drilledSlice && isBreakdown) {
          const parentRow = data.find(d => d.name === drilledSlice);
          if (parentRow) { pieData = activeYCols.map((yName, i) => ({ id: yName, name: yName, value: safeExtractVal(parentRow[yName], c.compMethod), color: COLOR_MAP[THEME_COLORS[i % THEME_COLORS.length]].hex, raw: parentRow, isSubSlice: true })).filter(x => x.value !== 0); pieTotal = parentRow._total || 0; centerLabel = drilledSlice; }
      } else {
          pieData = data.map((d, i) => ({ id: d.name, name: d.name, value: isBreakdown ? (d._total || 0) : safeExtractVal(d[primaryMetric], c.compMethod), color: COLOR_MAP[THEME_COLORS[i % THEME_COLORS.length]].hex, raw: d, isSubSlice: false })).filter(x => x.value !== 0);
          pieTotal = pieData.reduce((sum, item) => sum + Math.abs(item.value), 0); centerLabel = isBreakdown ? 'Total Geral' : primaryMetric;
      }
  }

  const toggleNode = (path) => setExpandedNodes(prev => ({ ...prev, [path]: !prev[path] }));

  const renderTree = (nodes, parentPath = "") => nodes.map((node) => {
      const currentPath = parentPath ? `${parentPath}|${node.name}` : node.name, hasChildren = node.children && node.children.length > 0, isExpanded = !!expandedNodes[currentPath], activePanels = c.panels ? c.panels.filter(p => p.chartId) : [];
      return (
        <div key={currentPath} className="w-full flex flex-col">
          <div onClick={() => hasChildren && toggleNode(currentPath)} className={`flex flex-wrap justify-between items-center p-4 rounded-2xl bg-slate-900/50 border transition-all shadow-sm ${hasChildren ? 'cursor-pointer hover:bg-slate-800/80 hover:border-indigo-500/50' : 'hover:bg-slate-800/50'} ${node.level > 0 ? 'mt-2 border-white/5' : 'mt-4 border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.05)]'}`} style={{ marginLeft: `${node.level * 24}px` }}>
             <div className="flex items-center gap-3">{node.level === 0 && <Layers className="text-indigo-400" size={18}/>}{node.level === 1 && <ChevronRight className="text-emerald-400" size={18}/>}{node.level === 2 && <Waypoints className="text-teal-400" size={16}/>}<span className={`font-black uppercase tracking-wider ${node.level === 0 ? 'text-white text-sm' : 'text-slate-300 text-xs'}`}>{node.name}</span>{hasChildren && <div className={`ml-2 p-1 rounded-full bg-white/5 transition-transform duration-300 ${isExpanded ? 'rotate-90 bg-indigo-500/20 text-indigo-400' : 'text-slate-400'}`}><ChevronRight size={14} /></div>}</div>
             <div className="flex items-center gap-6 overflow-x-auto custom-scrollbar">
                 {activePanels.map(p => <div key={p.alias} className="flex flex-col items-end shrink-0"><span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">{c.panelTitles?.[p.alias] || p.alias}</span><span className="font-mono text-xs text-slate-300">{formatCustomValue(safeExtractVal(node[p.alias], c.compMethod), c.panelConfigs?.[p.alias]?.agg, c.panelConfigs?.[p.alias]?.format)}</span></div>)}
                 <div className={`min-w-[120px] px-3 py-2 rounded-xl text-xs font-black shadow-lg flex flex-col items-center justify-center border ${node.res >= 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                     <span className="text-[8px] opacity-70 uppercase tracking-widest mb-0.5">{(c.compMethod === 'custom' || c.compMethod === 'step_formula') ? 'Fórmula/Resultado' : (COMP_METHODS[c.compMethod]?.name.split(' ')[1] || 'Resultado')}</span><span>{getResultPrefix(node.res, c.compMethod)}{formatCustomValue(node.res, 'sum', c.format)}</span>
                 </div>
             </div>
          </div>
          {hasChildren && isExpanded && <div className="flex flex-col border-l-2 border-white/5 ml-6 relative animate-fade-in-up" style={{ animationDuration: '0.3s' }}>{renderTree(node.children, currentPath)}</div>}
        </div>
      );
  });

  const renderUnifiedTooltip = () => {
    if (!tooltipData) return null;
    if (tooltipData.type === 'pie') {
        const hoveredItem = tooltipData.data, pct = pieTotal ? ((Math.abs(hoveredItem.value) / pieTotal) * 100).toFixed(1) : 0;
        return (
            <div className="fixed z-[999999] pointer-events-none top-8 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-2xl border border-indigo-500/30 rounded-3xl p-6 shadow-[0_30px_100px_rgba(0,0,0,0.9)] min-w-[280px] ring-1 ring-white/10 transition-all duration-300 ease-out animate-fade-in-up max-h-[90vh] overflow-y-auto custom-scrollbar">
                <div className="flex items-center gap-3 mb-5 border-b border-white/10 pb-4"><div className="w-3.5 h-3.5 rounded-full shadow-[0_0_8px_currentColor]" style={{ backgroundColor: hoveredItem.color, color: hoveredItem.color }} /><span className="font-black text-white uppercase text-base tracking-wider">{hoveredItem.name}</span></div>
                <div className="space-y-4 mb-2">
                    <div className="flex justify-between items-center gap-8"><span className="text-slate-400 text-[11px] uppercase font-bold tracking-widest">Valor do Item</span><span className="font-mono text-white font-black text-[16px] drop-shadow-sm">{formatCustomValue(hoveredItem.value, c.agg, getColFormat(primaryMetric))}</span></div>
                    <div className="flex justify-between items-center gap-8"><span className="text-indigo-400 text-[11px] uppercase font-bold tracking-widest">Total Geral</span><span className="font-mono text-indigo-300 font-bold text-[14px]">{formatCustomValue(pieTotal, c.agg, getColFormat(primaryMetric))}</span></div>
                    <div className="flex justify-between items-center gap-8 border-t border-white/5 pt-4 mt-2"><span className="text-amber-400 text-[11px] uppercase font-black tracking-widest flex items-center gap-1.5">🍕 Participação</span><span className="font-mono text-amber-400 font-black text-sm bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20">{pct}%</span></div>
                </div>
                {!hoveredItem.isSubSlice && isBreakdown && (
                    <div className="mt-6 pt-5 border-t border-white/10">
                    <div className="text-[10px] text-fuchsia-400 font-black uppercase mb-3 tracking-widest flex items-center gap-2"><Layers size={14}/> Composição Interna</div>
                    <div className="space-y-3 pr-2">
                        {activeYCols.map((yCol, i) => {
                            const subVal = safeExtractVal(hoveredItem.raw[yCol], c.compMethod); if (subVal === 0) return null;
                            const subColor = COLOR_MAP[THEME_COLORS[i % THEME_COLORS.length]].hex;
                            return (
                                <div key={yCol} className="flex justify-between items-center gap-6 text-[11px] bg-white/5 p-2 rounded-lg">
                                <div className="flex items-center gap-2.5 truncate"><div className="w-2.5 h-2.5 rounded-full opacity-90 shadow-sm" style={{ backgroundColor: subColor }}/><span className="text-slate-300 truncate max-w-[140px] font-bold">{c.isComparison ? (c.panelTitles?.[yCol] || yCol) : yCol}</span></div>
                                <span className="font-mono text-slate-300 font-bold">{formatCustomValue(subVal, c.agg, getColFormat(yCol))}</span>
                                </div>
                            )
                        })}
                    </div></div>
                )}
            </div>
        );
    }
    if (tooltipData.type === 'bar' || tooltipData.type === 'line') {
        const d = tooltipData.data, insight = getSmartInsight(d, c.compMethod, c.format, totals);
        return (
            <div className="fixed z-[999999] pointer-events-none top-8 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-xl border border-indigo-500/30 p-6 rounded-[2rem] shadow-[0_30px_100px_rgba(0,0,0,0.9)] w-[95vw] max-w-[800px] ring-1 ring-white/10 transition-all duration-300 ease-out animate-fade-in-up max-h-[90vh] overflow-y-auto custom-scrollbar">
                <div className="text-[15px] font-black text-white mb-5 text-center border-b border-white/10 pb-4 sticky top-0 bg-slate-900/90 backdrop-blur-md uppercase tracking-widest">{d.name}</div>
                <div className="space-y-3 mb-6">
                   <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] px-3 mb-2"><span>Dimensão</span><div className="flex gap-6 text-right"><span className="w-24 text-white">Valor Local</span><span className="w-24 text-indigo-400">Total Geral</span></div></div>
                {activeYCols.map((yName, i) => (
                    <div key={yName} className="flex justify-between items-center gap-4 text-[12px] bg-white/5 p-3 rounded-xl border border-white/5">
                        <span className="text-slate-300 flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-3 h-3 rounded-full shrink-0 shadow-[0_0_8px_currentColor]" style={{ backgroundColor: COLOR_MAP[THEME_COLORS[i % THEME_COLORS.length]].hex, color: COLOR_MAP[THEME_COLORS[i % THEME_COLORS.length]].hex }} />
                            <span className="truncate font-bold uppercase tracking-wider flex items-center gap-2">
                                {c.isComparison ? (c.panelTitles?.[yName] || yName) : yName}
                                {d._isRanked && d._rankLabels?.[yName] !== 'Sem Dados' && <span className="text-[9px] text-fuchsia-400 border border-fuchsia-500/30 bg-fuchsia-500/10 px-1.5 py-0.5 rounded tracking-tighter">({d._rankLabels[yName]})</span>}
                            </span>
                        </span>
                        <div className="flex gap-6 shrink-0 text-right"><span className="font-mono text-white font-black text-[14px] w-24">{formatCustomValue(safeExtractVal(d[yName], c.compMethod), c.agg, getColFormat(yName))}</span><span className="font-mono text-indigo-300 font-bold text-[12px] w-24 flex items-center justify-end">{formatCustomValue(totals ? safeExtractVal(totals[yName], c.compMethod) : 0, c.agg, getColFormat(yName))}</span></div>
                    </div>
                ))}
                </div>
                {insight && (
                <div className={`p-6 rounded-3xl border ${insight.bg} ${insight.border} flex flex-col gap-4 shadow-inner relative overflow-hidden mt-2`}>
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-20"></div>
                    <div className={`text-[11px] font-black uppercase tracking-widest flex items-center gap-2.5 ${insight.color}`}><span className="text-xl">{insight.icon}</span> Arquiteto Analítico</div>
                    <div className={`text-[13px] text-slate-300 leading-relaxed font-medium space-y-3 mt-1`}>{insight.parts.map((p, i) => <p key={i} className="block">{p}</p>)}</div>
                    <div className={`text-3xl font-mono font-black mt-2 ${insight.color} text-right border-t border-white/5 pt-4`}>{getResultPrefix(d.res, c.compMethod)}{formatCustomValue(d.res, 'sum', c.format)}</div>
                </div>
                )}
            </div>
        );
    }
    return null;
  };

  return (
    <Card ref={cardRef} className={`h-full w-full flex flex-col min-h-[450px] transition-all duration-500 relative ${tooltipData ? 'z-[9999]' : 'z-10'}`}>
       <div className="flex flex-row justify-between items-center gap-4 mb-6 border-b border-white/10 pb-6 shrink-0">
          <div className="flex-1 min-w-0 w-full group/title">
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <input type="text" value={editedTitle} onChange={e => setEditedTitle(e.target.value)} className="bg-black/50 border border-indigo-500 rounded-lg px-3 py-1 text-2xl font-black uppercase italic text-white outline-none w-full max-w-md transition-all" autoFocus onKeyDown={e => { if (e.key === 'Enter') { onRename(c.id, editedTitle); setIsEditingTitle(false); } if (e.key === 'Escape') { setIsEditingTitle(false); setEditedTitle(c.customTitle || titleText); } }} />
                <button onClick={() => { onRename(c.id, editedTitle); setIsEditingTitle(false); }} className="text-emerald-400 p-2 hover:bg-emerald-400/20 rounded-xl transition-colors" title="Guardar Título"><Check size={20}/></button>
                <button onClick={() => { setIsEditingTitle(false); setEditedTitle(c.customTitle || titleText); }} className="text-rose-400 p-2 hover:bg-rose-400/20 rounded-xl transition-colors" title="Cancelar"><X size={20}/></button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <h3 className="text-2xl font-black uppercase italic text-white break-words leading-tight">{titleText}</h3>
                {c.ignoreYear && <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded-md text-[9px] font-black uppercase shadow-sm">Ano Oculto</span>}
                <button onClick={() => { setEditedTitle(c.customTitle || titleText); setIsEditingTitle(true); }} className="opacity-0 group-hover/title:opacity-100 text-slate-400 hover:text-indigo-400 transition-all p-1" title="Renomear Gráfico"><Edit2 size={18}/></button>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2 items-center">
              {c.isComparison && <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded-md text-[9px] font-black uppercase">{c.linkMode === 'exact' ? 'Lado a Lado (Merge Exato)' : 'Matriz Hierárquica'}</span>}
              {c.isFormula && !c.isComparison && <span className="px-2 py-1 bg-fuchsia-500/20 text-fuchsia-400 rounded-md text-[9px] font-black uppercase">Fórmula Custom</span>}
              {c.breakdown && !c.isComparison && <span className="px-2 py-1 bg-teal-500/20 text-teal-400 rounded-md text-[9px] font-black uppercase">Agrupamento Ativo</span>}
              {c.type === 'kpi' && <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-md text-[9px] font-black uppercase">Cartão KPI</span>}
              <span className="text-[10px] font-black text-indigo-400 tracking-widest uppercase">Painel Lab</span>
              {(c.xFilters || []).length > 0 && <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded-md text-[9px] font-black uppercase">Filtro Ativo</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button onClick={() => onEdit(c.id)} className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl hover:bg-blue-500 hover:text-white transition-all flex items-center justify-center" title="Editar Configuração"><Settings2 size={18}/></button>
            {(c.isFormula || c.isComparison) && !isHierarchy && <button onClick={() => setShowDebug(!showDebug)} className={`p-2.5 px-4 ${showDebug ? 'bg-fuchsia-500 text-white shadow-[0_0_15px_rgba(217,70,239,0.5)]' : 'bg-fuchsia-500/10 text-fuchsia-400 hover:bg-fuchsia-500/30'} rounded-xl transition-all flex items-center justify-center gap-2 font-black uppercase text-[10px] tracking-widest shrink-0`} title="Painel Global de Auditoria"><Calculator size={16}/> {showDebug ? 'RAIO-X ATIVO' : 'ATIVAR RAIO-X'}</button>}
            {!isHierarchy && <button onClick={() => setShowAll(!showAll)} className={`p-2.5 ${showAll || ((c.xFilters || []).length > 0) ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-emerald-500/10 text-emerald-400'} rounded-xl hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center`} title={showAll || ((c.xFilters || []).length > 0) ? "Mostrando Todos" : "Ver Todos os Registros"}><Eye size={18}/></button>}
            <button onClick={() => onToggleSize(c.id)} className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl hover:bg-indigo-500 hover:text-white transition-all flex items-center justify-center" title="Maximizar/Minimizar">{c.span === 'col-span-6' ? <Maximize2 size={18}/> : <Minimize2 size={18}/>}</button>
            <button onClick={() => onDelete(c.id)} className="p-2.5 bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center" title="Eliminar Gráfico"><Trash2 size={18}/></button>
          </div>
       </div>
       
       {!isHierarchy && c.type !== 'pie' && c.type !== 'kpi' && activeYCols.length > 0 && (
         <div className="flex flex-col gap-4 mb-8 shrink-0 border-b border-white/5 pb-6 overflow-x-auto custom-scrollbar">
            {c.isComparison && activeYCols.length >= 2 ? (
                <div className="w-full flex flex-col gap-4 min-w-max pr-4">
                    <div className="text-[11px] text-slate-300 bg-indigo-900/20 border border-indigo-500/20 p-3.5 rounded-2xl flex items-center gap-3 w-max shadow-inner">
                        <GitCompare size={16} className="text-indigo-400 shrink-0" />
                        <span>Comparação de resultados globais entre <strong className="text-white uppercase tracking-wider">{c.panelTitles?.[activeYCols[0]] || activeYCols[0]}</strong> e <strong className="text-white uppercase tracking-wider">{c.panelTitles?.[activeYCols[activeYCols.length - 1]] || activeYCols[activeYCols.length - 1]}</strong> utilizando análise matemática de <strong className="text-indigo-400">{COMP_METHODS[c.compMethod]?.name}</strong>.</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex flex-col gap-1.5 bg-black/30 px-6 py-4 rounded-3xl border border-white/5 hover:border-white/10 transition-colors shadow-inner shrink-0 min-w-[200px]">
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400"><div className="w-3.5 h-3.5 rounded-full shadow-[0_0_8px_currentColor] shrink-0" style={{ backgroundColor: COLOR_MAP[THEME_COLORS[0]].hex, color: COLOR_MAP[THEME_COLORS[0]].hex }} /><span className="truncate max-w-[250px]">{c.panelTitles?.[activeYCols[0]] || activeYCols[0]}</span></div>
                            <div className="pl-5.5 font-mono font-black text-[22px] text-white tracking-tight">{formatCustomValue(totals ? safeExtractVal(totals[activeYCols[0]], c.compMethod) : 0, c.agg, getColFormat(activeYCols[0]))}</div>
                        </div>

                        <div className="text-slate-500 font-black text-xl shrink-0 flex flex-col items-center justify-center px-2">
                             <span className="text-[10px] mb-1.5 font-bold uppercase tracking-widest text-indigo-400 opacity-80">{c.compMethod === 'gap' ? 'Subtraído por' : c.compMethod === 'ratio' || c.compMethod === 'ratio_div' ? 'Dividido por' : c.compMethod === 'sum' ? 'Somado a' : 'Comparado a'}</span>
                             <div className="bg-white/5 w-8 h-8 rounded-full flex items-center justify-center text-sm border border-white/5">{c.compMethod === 'gap' ? '-' : c.compMethod === 'ratio' || c.compMethod === 'ratio_div' ? '÷' : c.compMethod === 'sum' ? '+' : 'VS'}</div>
                        </div>

                        <div className="flex flex-col gap-1.5 bg-black/30 px-6 py-4 rounded-3xl border border-white/5 hover:border-white/10 transition-colors shadow-inner shrink-0 min-w-[200px]">
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400"><div className="w-3.5 h-3.5 rounded-full shadow-[0_0_8px_currentColor] shrink-0" style={{ backgroundColor: COLOR_MAP[THEME_COLORS[1 % THEME_COLORS.length]].hex, color: COLOR_MAP[THEME_COLORS[1 % THEME_COLORS.length]].hex }} /><span className="truncate max-w-[250px]">{c.panelTitles?.[activeYCols[activeYCols.length - 1]] || activeYCols[activeYCols.length - 1]}</span></div>
                            <div className="pl-5.5 font-mono font-black text-[22px] text-white tracking-tight">{formatCustomValue(totals ? safeExtractVal(totals[activeYCols[activeYCols.length - 1]], c.compMethod) : 0, c.agg, getColFormat(activeYCols[activeYCols.length - 1]))}</div>
                        </div>

                        <div className="text-indigo-500/50 font-black text-2xl shrink-0 mx-2">➜</div>

                        <div className="flex flex-col gap-1.5 bg-indigo-500/10 px-8 py-4 rounded-3xl border border-indigo-500/30 transition-colors shadow-[0_0_20px_rgba(99,102,241,0.15)] relative overflow-hidden shrink-0 min-w-[220px]">
                            <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500"></div>
                            <div className="flex items-center gap-2 text-[11px] font-black uppercase text-indigo-400 pl-2"><Calculator size={16} className="shrink-0" /><span>Resultado Global</span></div>
                            <div className="pl-8 font-mono font-black text-[26px] text-indigo-300 tracking-tight">
                               {getResultPrefix(getGlobalRes(), c.compMethod)}{formatCustomValue(c.compMethod === 'ticket_medio' ? Math.abs(getGlobalRes()) : Math.abs(getGlobalRes()), 'sum', c.format)}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex flex-wrap items-center gap-4 w-full">
                  {activeYCols.map((yName, i) => {
                    const hexColor = COLOR_MAP[THEME_COLORS[i % THEME_COLORS.length]].hex, totalVal = totals ? safeExtractVal(totals[yName], c.compMethod) : 0;
                    return (
                      <React.Fragment key={yName}>
                         {i > 0 && <div className="text-slate-600 font-black text-xl shrink-0">+</div>}
                         <div className="flex flex-col gap-1.5 bg-black/20 px-5 py-3 rounded-2xl border border-white/5 hover:border-white/10 transition-colors shadow-inner shrink-0">
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400"><div className="w-3 h-3 rounded-full shadow-[0_0_8px_currentColor] shrink-0" style={{ backgroundColor: hexColor, color: hexColor }} /><span className="truncate max-w-[250px]">{yName}</span></div>
                            <div className="pl-5 font-mono font-black text-[17px] text-white tracking-tight">{formatCustomValue(totalVal, c.agg, getColFormat(yName))}</div>
                         </div>
                      </React.Fragment>
                    );
                  })}
                  {activeYCols.length > 1 && (
                     <React.Fragment>
                        <div className="text-indigo-500/50 font-black text-2xl shrink-0 ml-2">=</div>
                        <div className="flex flex-col gap-1.5 bg-indigo-500/10 px-6 py-3 rounded-2xl border border-indigo-500/30 transition-colors shadow-[0_0_15px_rgba(99,102,241,0.1)] relative overflow-hidden shrink-0">
                           <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
                           <div className="flex items-center gap-2 text-[10px] font-black uppercase text-indigo-400 pl-1"><Calculator size={14} className="shrink-0" /><span>Soma Global ({activeYCols.length} Painéis)</span></div>
                           <div className="pl-7 font-mono font-black text-[19px] text-indigo-300 tracking-tight">{formatCustomValue(activeYCols.reduce((sum, yName) => sum + (totals ? safeExtractVal(totals[yName], c.compMethod) : 0), 0), 'sum', getColFormat(activeYCols[0]))}</div>
                        </div>
                     </React.Fragment>
                  )}
                </div>
            )}
         </div>
       )}

       <div className="flex-1 relative min-h-0 w-full flex flex-col">
          {c.isComparison && isHierarchy && data.length > 0 && <div className="w-full h-full overflow-y-auto custom-scrollbar pr-4 flex flex-col gap-2">{renderTree(data)}</div>}
          {c.isComparison && isHierarchy && data.length === 0 && <div className="w-full h-full flex items-center justify-center text-slate-500 font-bold uppercase tracking-widest">Sem dados para cruzar</div>}

          {(!c.isComparison || !isHierarchy) && c.type === 'kpi' && (
            <div className="w-full min-h-[350px] flex flex-col items-center justify-center p-8 text-center relative overflow-hidden bg-gradient-to-b from-transparent to-slate-900/30 rounded-2xl border border-white/5">
                <div className="text-[12px] text-slate-400 font-bold uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                    <Activity size={16} className="text-emerald-400"/> Visão de Cartão KPI
                </div>
                <div className="text-6xl md:text-7xl font-mono font-black text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.2)] tracking-tighter">
                    {formatCustomValue(c.isComparison ? getGlobalRes() : (totals ? (c.isFormula ? totals['Fórmula'] : totals._total) : 0), c.agg, c.format)}
                </div>
                {data.slice(0, 4).length > 0 && c.x && (
                    <div className="mt-12 flex flex-wrap gap-4 w-full justify-center opacity-80 hover:opacity-100 transition-opacity">
                        {data.slice(0, 4).map((d, i) => {
                            const val = safeExtractVal(d[activeYCols[0] || 'Fórmula'], c.compMethod);
                            return (
                            <div key={i} className="bg-black/30 border border-white/10 px-5 py-3 rounded-2xl flex flex-col items-center shadow-inner hover:bg-slate-800 transition-colors">
                                <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider truncate max-w-[120px] mb-1.5">{d.name}</span>
                                <span className="text-[13px] text-indigo-300 font-mono font-bold">{formatCustomValue(val, c.agg, c.format)}</span>
                            </div>
                        )})}
                    </div>
                )}
            </div>
          )}

          {(!c.isComparison || !isHierarchy) && c.type === 'bar' && (
            <div className="w-full h-[350px] flex items-end justify-start gap-8 overflow-x-auto custom-scrollbar pb-6 pt-12 px-4">
              {data.map((d,idx) => (
                <div key={idx} className="relative h-full flex flex-col justify-end items-center group shrink-0 cursor-pointer min-w-[100px]" onMouseMove={(e) => handleGlobalMouseMove(e, d, 'bar')} onMouseLeave={handleGlobalMouseLeave}>
                   <div className="flex items-end justify-center gap-2 w-full h-[240px] relative">
                      {activeYCols.map((yName, i) => {
                         const val = safeExtractVal(d[yName], c.compMethod);
                         const barH = max > 0 ? (Math.abs(val)/max)*100 : 0;
                         const isNegative = val < 0;
                         const hexColor = COLOR_MAP[THEME_COLORS[i % THEME_COLORS.length]].hex;
                         
                         return (
                           <div key={yName} className="relative h-full flex flex-col justify-end items-center group/bar">
                             <div className="absolute -top-10 opacity-0 group-hover/bar:opacity-100 transition-all duration-300 bg-slate-900/90 border border-white/10 px-2 py-1 rounded text-[10px] font-mono font-bold whitespace-nowrap z-20 shadow-xl pointer-events-none" style={{ color: isNegative ? '#ef4444' : hexColor }}>
                                {formatCustomValue(val, c.agg, getColFormat(yName))}
                             </div>
                             <div className={`rounded-t-xl transition-all duration-500 hover:opacity-100 shadow-[0_4px_15px_rgba(0,0,0,0.5)] shrink-0 ${c.isComparison ? 'w-10 md:w-14 hover:w-12 md:hover:w-16' : barWidth} ${isNegative ? 'opacity-50' : 'opacity-80'}`} style={{ height: `${Math.max(barH, 2)}%`, backgroundColor: isNegative ? '#ef4444' : hexColor, backgroundImage: `linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0) 100%)` }} />
                           </div>
                         );
                      })}
                   </div>
                   <div className="mt-5 w-full flex flex-col items-center pointer-events-none border-t border-white/5 pt-3">
                      <div className="text-[11px] text-slate-300 text-center font-bold uppercase truncate w-28" title={d.name}>{d.name}</div>
                      {c.isComparison && (
                          <div className={`text-[12px] font-black mt-2 px-3.5 py-1.5 rounded-xl border shadow-md transition-transform duration-300 group-hover:scale-110 ${d.res >= 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                              {getResultPrefix(d.res, c.compMethod)}{formatCustomValue(d.res, 'sum', c.format)}
                          </div>
                      )}
                   </div>
                </div>
              ))}
            </div>
          )}

          {(!c.isComparison || !isHierarchy) && c.type === 'horizontal_bar' && (
            <div className="w-full flex flex-col gap-8 overflow-y-auto custom-scrollbar pr-4 pb-4 pt-4">
              {data.map((d, idx) => (
                <div key={idx} className="w-full group relative bg-slate-900/30 p-4 rounded-2xl border border-transparent hover:border-white/10 hover:bg-slate-900/50 transition-all" onMouseMove={(e) => handleGlobalMouseMove(e, d, 'bar')} onMouseLeave={handleGlobalMouseLeave}>
                  <div className="text-[11px] font-black uppercase text-white mb-4 flex justify-between items-center gap-4 border-b border-white/5 pb-2">
                     <div className="flex items-center gap-3 truncate pr-2"><span className="truncate text-sm">{d.name}</span>{c.isComparison && <span className={`px-3 py-1 rounded-lg text-[10px] border shadow-sm ${d.res >= 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>{getResultPrefix(d.res, c.compMethod)}{formatCustomValue(d.res, 'sum', c.format)}</span>}</div>
                  </div>
                  <div className="flex flex-col gap-5 w-full">
                    {activeYCols.map((yName, i) => {
                      const val = safeExtractVal(d[yName], c.compMethod), isNegative = val < 0, hexColor = COLOR_MAP[THEME_COLORS[i % THEME_COLORS.length]].hex;
                      return (
                      <div key={yName} className="flex items-center gap-4">
                         <div className="w-24 truncate text-[10px] text-slate-400 font-bold uppercase shrink-0 tracking-wider" title={c.isComparison ? c.panelTitles?.[yName] : yName}>{c.isComparison ? (c.panelTitles?.[yName] || yName) : yName}</div>
                         <div className="flex-1 bg-black/40 rounded-full h-5 overflow-hidden border border-white/5 shadow-inner"><div className="h-full rounded-full transition-all duration-1000 relative shadow-[0_0_10px_currentColor]" style={{ width: `${max > 0 ? (Math.abs(val)/max)*100 : 0}%`, backgroundColor: isNegative ? '#ef4444' : hexColor, color: isNegative ? '#ef4444' : hexColor }}><div className="absolute inset-0 rounded-full" style={{ backgroundImage: `linear-gradient(to bottom, rgba(255,255,255,0.3) 0%, transparent 100%)` }}></div></div></div>
                         <span className="text-[12px] font-mono font-black text-white w-24 text-right truncate shrink-0">{formatCustomValue(val, c.agg, getColFormat(yName))}</span>
                       </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {(!c.isComparison || !isHierarchy) && (c.type === 'line' || c.type === 'area') && (
            <div className="w-full h-[350px] flex flex-col justify-end relative pb-6 px-4">
              <svg viewBox="0 0 1000 300" className="w-full h-full overflow-visible">
                 {activeYCols.map((yName, i) => {
                   const points = data.map((d, idx) => `${(idx / Math.max(data.length - 1, 1)) * 1000},${max > 0 ? 300 - ((Math.abs(safeExtractVal(d[yName], c.compMethod)) / max) * 300) : 300}`).join(' ');
                   const colorHex = COLOR_MAP[THEME_COLORS[i % THEME_COLORS.length]].hex;
                   return (
                     <g key={yName}>
                       {c.type === 'area' && <polygon points={`0,300 ${points} 1000,300`} fill={colorHex} fillOpacity="0.2" />}
                       <polyline points={points} fill="none" stroke={colorHex} strokeWidth="4" />
                       {data.map((d, idx) => <circle key={idx} cx={(idx / Math.max(data.length - 1, 1)) * 1000} cy={max > 0 ? 300 - ((Math.abs(safeExtractVal(d[yName], c.compMethod)) / max) * 300) : 300} r="6" fill={colorHex} className="hover:r-8 transition-all cursor-pointer" onMouseMove={(e) => handleGlobalMouseMove(e, d, 'line')} onMouseLeave={handleGlobalMouseLeave} />)}
                     </g>
                   )
                 })}
              </svg>
              <div className="absolute bottom-0 left-4 right-4 flex justify-between pointer-events-none">
                 {data.map((d, idx) => (
                   <div key={idx} className="text-[9px] text-slate-400 font-black uppercase truncate w-16 text-center -ml-8">{d.name}{c.isComparison && <div className={`text-[8px] font-black mt-1 ${d.res >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{getResultPrefix(d.res, c.compMethod)}{formatCustomValue(d.res, 'sum', c.format)}</div>}</div>
                 ))}
              </div>
            </div>
          )}

          {(!c.isComparison || !isHierarchy) && c.type === 'pie' && (
            <div className="w-full min-h-[350px] flex flex-row items-center justify-center gap-12 overflow-y-auto custom-scrollbar pb-4 relative">
               <div className="relative w-64 h-64 shrink-0">
                  <svg viewBox="0 0 32 32" className="w-full h-full -rotate-90 drop-shadow-2xl">
                     {pieData.map((d, idx) => {
                        const pct = pieTotal ? (Math.abs(d.value) / pieTotal) * 100 : 0, off = pieData.slice(0,idx).reduce((s,x)=>s+(Math.abs(x.value)/pieTotal)*100, 0), isHovered = hoveredItemId === d.id, anyHovered = hoveredItemId !== null;
                        return <circle key={d.id} cx="16" cy="16" r="14" fill="none" stroke={d.value < 0 ? '#ef4444' : d.color} strokeWidth="4" strokeDasharray={`${pct} ${100-pct}`} strokeDashoffset={100-off+25} className={`transition-all duration-300 ease-out ${!anyHovered && !drilledSlice && isBreakdown ? 'cursor-pointer hover:stroke-[5]' : ''} ${isHovered ? 'stroke-[5] drop-shadow-[0_0_10px_rgba(255,255,255,0.4)] z-50 cursor-pointer' : anyHovered ? 'opacity-30' : 'opacity-100'}`} onMouseMove={(e) => { setHoveredItemId(d.id); handleGlobalMouseMove(e, d, 'pie', d.id); }} onMouseLeave={handleGlobalMouseLeave} onClick={() => { if (!drilledSlice && isBreakdown) { setDrilledSlice(d.name); setHoveredItemId(null); } }} />
                     })}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white pointer-events-none transition-all duration-300">
                    <div className="font-black text-2xl px-2 truncate w-full text-center tracking-tight text-shadow-sm">{formatCustomValue(pieTotal, c.agg, getColFormat(primaryMetric))}</div>
                    <div className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1.5 truncate max-w-[85%]">{centerLabel}</div>
                  </div>
               </div>

               <div className="flex-1 w-full flex flex-col justify-center max-h-[300px]">
                  {drilledSlice && isBreakdown && <button onClick={() => { setDrilledSlice(null); setHoveredItemId(null); }} className="w-full text-xs font-black uppercase tracking-wider text-indigo-400 hover:text-white flex items-center justify-center gap-2 bg-indigo-500/10 hover:bg-indigo-500/30 p-4 rounded-2xl mb-4 transition-all border border-indigo-500/20"><ChevronLeft size={16}/> Voltar para Visão Geral</button>}
                  <div className="grid grid-cols-2 gap-3 overflow-y-auto custom-scrollbar pr-2">
                     {pieData.map((d) => (
                        <div key={d.id} onClick={() => { if (!drilledSlice && isBreakdown) { setDrilledSlice(d.name); setHoveredItemId(null); } }} onMouseMove={(e) => { setHoveredItemId(d.id); handleGlobalMouseMove(e, d, 'pie', d.id); }} onMouseLeave={handleGlobalMouseLeave} className={`flex flex-col p-4 rounded-2xl transition-all duration-300 relative overflow-hidden ${!drilledSlice && isBreakdown ? 'cursor-pointer hover:-translate-y-0.5' : ''} ${hoveredItemId === d.id ? 'bg-slate-800/90 shadow-xl border border-white/20 ring-1 ring-white/10 scale-[1.02]' : 'bg-slate-900/40 border border-white/5 hover:bg-slate-800/80'}`}>
                           <div className={`absolute top-0 left-0 w-1.5 h-full transition-opacity duration-300 ${hoveredItemId === d.id ? 'opacity-100' : 'opacity-40'}`} style={{ backgroundColor: d.color }} />
                           <div className="flex items-center justify-between text-xs w-full pl-3"><div className="flex items-center gap-3 truncate pr-2"><div className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{backgroundColor: d.value < 0 ? '#ef4444' : d.color}}></div><span className={`truncate font-bold transition-colors ${hoveredItemId === d.id ? 'text-white' : 'text-slate-300'}`}>{d.name}</span></div><span className="font-mono text-white font-black ml-auto shrink-0">{formatCustomValue(d.value, c.agg, getColFormat(primaryMetric))}</span></div>
                        </div>
                     ))}
                  </div>
               </div>
            </div>
          )}
       </div>

       {showDebug && (
          <div className="w-full mt-8 pt-6 border-t-2 border-dashed border-fuchsia-500/30 flex flex-col gap-4 max-h-[400px] shrink-0 bg-slate-950/40 p-6 rounded-3xl animate-fade-in-up shadow-inner relative z-20">
             <div className="text-fuchsia-400 font-black uppercase tracking-widest text-sm flex items-center gap-2 mb-2"><Calculator size={18}/> Painel Global de Auditoria (Raio-X)</div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 overflow-y-auto custom-scrollbar pr-2 pb-2">
                 {data.map((d, i) => (
                    <div key={i} className="flex flex-col gap-3 bg-fuchsia-950/20 p-4 rounded-2xl border border-fuchsia-500/20 shadow-lg">
                       <div className="text-white font-black uppercase tracking-widest text-[11px] border-b border-fuchsia-500/20 pb-2">{d.name}</div>
                       {renderXRay(d, c, activeYCols, true)}
                    </div>
                 ))}
             </div>
          </div>
       )}

       {renderUnifiedTooltip()}
    </Card>
  );
};

const CustomLab = ({ result, customCharts, updateWorkspaceCharts, showDialog }) => {
  const [showCreator, setShowCreator] = useState(false);
  const [editingChartId, setEditingChartId] = useState(null);
  const [creatorMode, setCreatorMode] = useState('standard');
  const [creatorState, setCreatorState] = useState({ x: '', xFilters: [], y: [], breakdown: '', type: 'bar', agg: 'sum', format: 'currency', alignMode: 'exact', ignoreYear: false });
  const [xSearch, setXSearch] = useState('');
  const [showXFilters, setShowXFilters] = useState(false);
  
  // Formula States (Standard vs Advanced)
  const [formulaInputMode, setFormulaInputMode] = useState('standard'); 
  const [formulaSteps, setFormulaSteps] = useState([]);
  const [editingStepIdx, setEditingStepIdx] = useState(null);
  const [newStep, setNewStep] = useState({ type: 'standard', op1: '', op1Type: 'col', op1File: '', operator: '+', op2: '', op2Type: 'col', op2File: '' });
  const [advancedExpr, setAdvancedExpr] = useState('');
  const [advancedSelectedFile, setAdvancedSelectedFile] = useState('');

  const [compState, setCompState] = useState({ panels: [{ alias: 'A', chartId: '' }, { alias: 'B', chartId: '' }], method: 'growth', format: 'percent', type: 'bar', linkMode: 'hierarchy', customExpression: '(B - A) / A', joinKey: '', ignoreYear: false });
  const [compFormulaSteps, setCompFormulaSteps] = useState([]);
  const [newCompStep, setNewCompStep] = useState({ op1: '', op1Type: 'panel', op1Col: '', operator: '+', op2: '', op2Type: 'panel', op2Col: '' });

  // Consolidador Dinâmico de Memória de KPIs
  const kpiValues = useMemo(() => {
    const map = {};
    if (!customCharts || customCharts.length === 0) return map;
    
    // Invertemos para processar do mais antigo pro mais novo, resolvendo as dependências caso existam
    [...customCharts].reverse().forEach(c => {
       const data = computeLabData(c, result, map, false);
       let val = 0;
       const activeYCols = c.isFormula ? ['Fórmula'] : (Array.isArray(c.y) ? c.y : []);
       
       if (c.isComparison) val = computeGlobalRes(c, data.totals, activeYCols);
       else val = data.totals ? (c.isFormula ? data.totals['Fórmula'] : data.totals._total) : 0;
       
       map[`KPI: ${c.customTitle || getChartTitle(c)}`] = val;
    });
    return map;
  }, [customCharts, result]);

  const availableXValues = useMemo(() => {
    if (!creatorState.x || !result?.processedFiles || result.processedFiles.length === 0) return [];
    const vals = new Set();
    (result.processedFiles[0]?.data || []).forEach(r => vals.add(String(r._original_row?.[creatorState.x] || 'N/A').trim()));
    return Array.from(vals).sort();
  }, [creatorState.x, result]);

  const hasMultipleFiles = (result?.processedFiles || []).length > 1;
  const activeAdvancedFile = advancedSelectedFile || (result?.processedFiles?.[0]?.name || '');
  const filteredMetrics = hasMultipleFiles
      ? (result?.availableMetrics || []).filter(m => m.startsWith(`[${activeAdvancedFile}] `))
      : (result?.availableMetrics || []);

  const toggleChartSize = (id) => updateWorkspaceCharts(customCharts.map(c => c.id === id ? { ...c, span: c.span === 'col-span-12' ? 'col-span-6' : 'col-span-12' } : c));
  const renameChart = (id, newTitle) => updateWorkspaceCharts(customCharts.map(c => c.id === id ? { ...c, customTitle: newTitle } : c));

  const addFormulaStep = async () => {
    let stepToAdd = null;
    
    if (formulaInputMode === 'advanced') {
        if (!advancedExpr.trim()) { await showDialog('alert', 'Aviso', "A expressão da fórmula não pode estar vazia."); return; }
        stepToAdd = { type: 'advanced', expression: advancedExpr };
    } else {
        if (newStep.op1 && newStep.op2) {
            stepToAdd = { ...newStep, type: 'standard' };
        } else {
            await showDialog('alert', 'Aviso', "Complete os dois lados da operação matemática antes de adicionar o passo."); return;
        }
    }

    if (editingStepIdx !== null) {
        const updated = [...formulaSteps];
        updated[editingStepIdx] = stepToAdd;
        setFormulaSteps(updated);
        setEditingStepIdx(null);
    } else {
        setFormulaSteps([...formulaSteps, stepToAdd]);
    }
    
    setNewStep({ type: 'standard', op1: '', op1Type: 'col', op1File: '', operator: '+', op2: '', op2Type: 'col', op2File: '' });
    setAdvancedExpr('');
  };

  const editFormulaStep = (index) => {
      const step = formulaSteps[index];
      if (step.type === 'advanced') {
          setFormulaInputMode('advanced');
          setAdvancedExpr(step.expression);
      } else {
          setFormulaInputMode('standard');
          setNewStep(step);
      }
      setEditingStepIdx(index);
  };

  const cancelEditStep = () => {
      setEditingStepIdx(null);
      setNewStep({ type: 'standard', op1: '', op1Type: 'col', op1File: '', operator: '+', op2: '', op2Type: 'col', op2File: '' });
      setAdvancedExpr('');
  };

  const clearFormula = () => { 
      setFormulaSteps([]); cancelEditStep(); 
  };

  const insertVariableIntoAdvanced = (varName) => {
      setAdvancedExpr(prev => prev + `{${varName}}`);
  };

  const addCompPanel = () => {
    const aliases = ['A', 'B', 'C', 'D', 'E', 'F'];
    if (compState.panels.length < 6) setCompState({ ...compState, panels: [...compState.panels, { alias: aliases[compState.panels.length], chartId: '' }] });
  };

  const addCompFormulaStep = async () => {
    if (newCompStep.op1 !== '' && newCompStep.op2 !== '') {
        if (newCompStep.op1Type === 'panel' && !newCompStep.op1Col) { await showDialog('alert', 'Aviso', "Selecione a coluna para o primeiro painel."); return; }
        if (newCompStep.op2Type === 'panel' && !newCompStep.op2Col) { await showDialog('alert', 'Aviso', "Selecione a coluna para o segundo painel."); return; }
        setCompFormulaSteps([...compFormulaSteps, { ...newCompStep }]);
        setNewCompStep({ op1: '', op1Type: 'panel', op1Col: '', operator: '+', op2: '', op2Type: 'panel', op2Col: '' });
    } else await showDialog('alert', 'Aviso', "Complete os dois lados da operação.");
  };

  const resetCreator = () => {
    setCreatorState({ x: '', xFilters: [], y: [], breakdown: '', type: 'bar', agg: 'sum', format: 'currency', alignMode: 'exact', ignoreYear: false }); 
    setCompState({ panels: [{ alias: 'A', chartId: '' }, { alias: 'B', chartId: '' }], method: 'growth', format: 'percent', type: 'bar', linkMode: 'hierarchy', customExpression: '(B - A) / A', joinKey: '', ignoreYear: false });
    clearFormula(); setCompFormulaSteps([]); setShowXFilters(false);
    setNewCompStep({ op1: '', op1Type: 'panel', op1Col: '', operator: '+', op2: '', op2Type: 'panel', op2Col: '' });
    setAdvancedSelectedFile('');
    setEditingChartId(null);
  };

  const openCreatorForNew = () => { resetCreator(); setShowCreator(true); };

  const handleEditChart = (id) => {
    const chartToEdit = customCharts.find(c => c.id === id);
    if (!chartToEdit) return;
    if (chartToEdit.isComparison) {
       setCreatorMode('compare');
       setCompState({ panels: chartToEdit.panels || [ { alias: 'A', chartId: chartToEdit.chartAConfig?.id || '' }, { alias: 'B', chartId: chartToEdit.chartBConfig?.id || '' } ], method: chartToEdit.compMethod || 'growth', format: chartToEdit.format || 'percent', type: chartToEdit.type || 'bar', linkMode: chartToEdit.linkMode || 'hierarchy', customExpression: chartToEdit.customExpression || '(B - A) / A', joinKey: chartToEdit.compJoinKey || '', ignoreYear: chartToEdit.ignoreYear || false });
       setCompFormulaSteps(chartToEdit.compSteps || []);
    } else {
       setCreatorMode(chartToEdit.isFormula ? 'formula' : 'standard');
       setCreatorState({ x: chartToEdit.x || '', xFilters: chartToEdit.xFilters || [], y: chartToEdit.isFormula ? [] : (chartToEdit.y || []), breakdown: chartToEdit.breakdown || '', type: chartToEdit.type || 'bar', agg: chartToEdit.agg || 'sum', format: chartToEdit.format || 'currency', alignMode: chartToEdit.alignMode || 'exact', ignoreYear: chartToEdit.ignoreYear || false });
       setFormulaSteps(chartToEdit.steps || []);
    }
    setEditingChartId(id); setShowCreator(true); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const validateAndAddChart = async () => {
    let newChart = null; const existingChart = editingChartId ? customCharts.find(c => c.id === editingChartId) : {};
    if (creatorMode === 'compare') {
      const activePanels = compState.panels.filter(p => p.chartId);
      if (activePanels.length < 2) { await showDialog('alert', 'Aviso', "Selecione pelo menos dois painéis para cruzar."); return; }
      if (compState.method === 'custom' && !compState.customExpression) { await showDialog('alert', 'Aviso', "Escreva uma fórmula válida usando as letras dos painéis."); return; }
      if (compState.method === 'step_formula' && compFormulaSteps.length === 0) { await showDialog('alert', 'Aviso', "Adicione os passos do cálculo na sua Matriz de Fórmulas."); return; }

      newChart = { ...existingChart, id: editingChartId || Date.now(), span: editingChartId ? existingChart.span : 'col-span-12', isComparison: true, panels: activePanels, panelConfigs: {}, panelTitles: {}, compMethod: compState.method, compMethodName: COMP_METHODS[compState.method]?.name || 'Análise', format: compState.format, type: compState.type, linkMode: compState.linkMode, customExpression: compState.customExpression, compSteps: compFormulaSteps, compJoinKey: compState.joinKey, ignoreYear: compState.ignoreYear, x: customCharts.find(c => String(c.id) === String(activePanels[0].chartId))?.x };
      activePanels.forEach(p => { const ref = customCharts.find(c => String(c.id) === String(p.chartId)); if(ref) { newChart.panelConfigs[p.alias] = ref; newChart.panelTitles[p.alias] = getPanelLegendName(ref); } });
    } else {
      // Eixo X é opcional apenas se for KPI Card
      if (!creatorState.x && creatorState.type !== 'kpi') { await showDialog('alert', 'Aviso', "Por favor, selecione a Categoria (Eixo X)."); return; }
      if (creatorMode === 'formula' && formulaSteps.length === 0) { await showDialog('alert', 'Aviso', "Adicione um passo de cálculo."); return; }
      if (creatorMode === 'standard' && (creatorState.y || []).length === 0) { await showDialog('alert', 'Aviso', "Selecione pelo menos uma Métrica (Eixo Y)."); return; }
      if (creatorMode === 'standard' && creatorState.breakdown && (creatorState.y || []).length !== 1) { await showDialog('alert', 'Aviso', "Ao utilizar a Legenda (Quebra), por favor selecione apenas UMA métrica Y."); return; }
      newChart = { ...existingChart, ...creatorState, id: editingChartId || Date.now(), span: editingChartId ? existingChart.span : 'col-span-6', isFormula: creatorMode === 'formula', steps: creatorMode === 'formula' ? [...formulaSteps] : [], y: creatorMode === 'formula' ? ['Fórmula'] : (creatorState.y || []) };
    }

    let updatedCharts = [...customCharts];
    if (editingChartId) {
       updatedCharts = updatedCharts.map(c => {
           if (c.id === editingChartId) return newChart;
           if (c.isComparison) {
               let updatedComp = { ...c }, needsUpdate = false;
               (updatedComp.panels || []).forEach(p => { if (p.chartId === editingChartId) { if (!updatedComp.panelConfigs) updatedComp.panelConfigs = {}; if (!updatedComp.panelTitles) updatedComp.panelTitles = {}; updatedComp.panelConfigs[p.alias] = newChart; updatedComp.panelTitles[p.alias] = getPanelLegendName(newChart); needsUpdate = true; } });
               return needsUpdate ? updatedComp : c;
           } return c;
       });
    } else { updatedCharts = [newChart, ...customCharts]; }
    updateWorkspaceCharts(updatedCharts); setShowCreator(false); resetCreator();
  };

  const renderFormulaOperand = (key, typeKey, fileKey) => {
    const isColOrGlobal = newStep[typeKey] === 'col' || newStep[typeKey] === 'global_col';
    const isKpi = newStep[typeKey] === 'kpi';
    const hasMultipleFilesLocal = (result?.processedFiles || []).length > 1;
    const selectedFile = newStep[fileKey] || (result?.processedFiles?.[0]?.name || '');
    
    let filteredMetricsLocal = result?.availableMetrics || [];
    if (isColOrGlobal && hasMultipleFilesLocal) { const fileObj = (result?.processedFiles || []).find(f => f.name === selectedFile); if (fileObj) filteredMetricsLocal = fileObj.numericHeaders || []; }
    return (
      <div className="flex flex-row gap-2 w-full flex-1 min-w-0">
        <select value={newStep[typeKey]} onChange={e => setNewStep({...newStep, [typeKey]: e.target.value, [key]: ''})} className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-bold text-white outline-none focus:border-indigo-500 w-[35%] shrink-0">
          <option value="col">Valor na Linha</option><option value="global_col">Soma Global</option>
          {Object.keys(kpiValues).length > 0 && <option value="kpi">Cartão KPI (Salvo)</option>}
          <option value="num">Fixo</option>{formulaSteps.length > 0 && <option value="step">Passo Anterior</option>}
        </select>
        
        {isColOrGlobal && hasMultipleFilesLocal && <select value={selectedFile} onChange={e => setNewStep({...newStep, [fileKey]: e.target.value, [key]: ''})} className="bg-slate-900 border border-amber-500/30 rounded-xl px-3 py-2 text-[10px] font-bold text-amber-400 truncate outline-none focus:border-amber-500 w-[30%] shrink-0">{(result?.processedFiles || []).map(f => <option key={f.name} value={f.name}>{f.name}</option>)}</select>}
        {isColOrGlobal && <select value={newStep[key]} onChange={e => setNewStep({...newStep, [key]: e.target.value})} className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white truncate outline-none focus:border-indigo-500 w-full flex-1"><option value="">Selecionar Coluna...</option>{filteredMetricsLocal.map(m => <option key={hasMultipleFilesLocal ? `[${selectedFile}] ${m}` : m} value={hasMultipleFilesLocal ? `[${selectedFile}] ${m}` : m}>{m}</option>)}</select>}
        
        {isKpi && <select value={newStep[key]} onChange={e => setNewStep({...newStep, [key]: e.target.value})} className="bg-emerald-900/30 border border-emerald-500/30 rounded-xl px-3 py-2 text-[10px] text-emerald-300 font-bold truncate outline-none focus:border-emerald-500 w-full flex-1"><option value="">Selecionar KPI Salvo...</option>{Object.keys(kpiValues).map(k => <option key={k} value={k}>{k.replace('KPI: ', '')}</option>)}</select>}
        
        {newStep[typeKey] === 'num' && <input type="number" placeholder="Ex: 1.20" value={newStep[key]} onChange={e => setNewStep({...newStep, [key]: e.target.value})} className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white outline-none focus:border-indigo-500 w-full flex-1" />}
        {newStep[typeKey] === 'step' && <select value={newStep[key]} onChange={e => setNewStep({...newStep, [key]: e.target.value})} className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white outline-none focus:border-indigo-500 w-full flex-1"><option value="">Selecionar Passo...</option>{formulaSteps.map((_, i) => <option key={i} value={i}>Passo {i+1}</option>)}</select>}
      </div>
    );
  };

  const renderCompFormulaOperand = (key, typeKey, colKey) => {
      const isPanel = newCompStep[typeKey] === 'panel', hasMultipleFilesLocal = (result?.processedFiles || []).length > 1; let availableColumns = [];
      if (isPanel && newCompStep[key]) {
          const panelConfig = compState.panels.find(p => p.alias === newCompStep[key]);
          if (panelConfig && panelConfig.chartId) { const chart = customCharts.find(c => String(c.id) === String(panelConfig.chartId)); if (chart) { availableColumns = [...(result?.availableMetrics || [])]; if (chart.isFormula) availableColumns.unshift('Fórmula'); } }
      }
      return (
          <div className="flex flex-row gap-2 w-full flex-1 min-w-0">
              <select value={newCompStep[typeKey]} onChange={e => setNewCompStep({...newCompStep, [typeKey]: e.target.value, [key]: '', [colKey]: ''})} className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-bold text-white outline-none focus:border-indigo-500 flex-1 min-w-0"><option value="panel">Painel</option><option value="num">Valor Fixo</option>{compFormulaSteps.length > 0 && <option value="step">Passo Ant.</option>}</select>
              {isPanel && <select value={newCompStep[key]} onChange={e => { let cols = [...(result?.availableMetrics || [])]; const pConf = compState.panels.find(p => p.alias === e.target.value); if (pConf && pConf.chartId) { const c = customCharts.find(x => String(x.id) === String(pConf.chartId)); if (c && c.isFormula) cols.unshift('Fórmula'); } setNewCompStep({...newCompStep, [key]: e.target.value, [colKey]: cols[0] || ''}); }} className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white truncate outline-none focus:border-indigo-500 flex-1 min-w-0"><option value="">Selec. Painel...</option>{compState.panels.filter(p=>p.chartId).map(p => <option key={p.alias} value={p.alias}>Painel {p.alias}</option>)}</select>}
              {isPanel && newCompStep[key] && <select value={newCompStep[colKey]} onChange={e => setNewCompStep({...newCompStep, [colKey]: e.target.value})} className="bg-slate-900 border border-fuchsia-500/30 rounded-xl px-3 py-2 text-[10px] font-bold text-fuchsia-300 truncate outline-none focus:border-fuchsia-500 flex-[1.5] min-w-0 shadow-inner"><option value="">Selecione a Coluna...</option>{availableColumns.map(col => <option key={col} value={col}>{col === 'Fórmula' ? '⚙️ Resultado da Fórmula' : (hasMultipleFilesLocal ? col : col.replace(/^\[.*?\]\s*/, ''))}</option>)}</select>}
              {newCompStep[typeKey] === 'num' && <input type="number" placeholder="Ex: 100" value={newCompStep[key]} onChange={e => setNewCompStep({...newCompStep, [key]: e.target.value})} className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white outline-none focus:border-indigo-500 w-full flex-1" />}
              {newCompStep[typeKey] === 'step' && <select value={newCompStep[key]} onChange={e => setNewCompStep({...newCompStep, [key]: e.target.value})} className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white outline-none focus:border-indigo-500 w-full flex-1"><option value="">Selecionar Passo...</option>{compFormulaSteps.map((_, i) => <option key={i} value={i}>Passo {i+1}</option>)}</select>}
          </div>
      )
  };

  const formatCompOperandDisplay = (op, type, col) => type === 'step' ? `Passo ${Number(op)+1}` : type === 'panel' ? (col && col !== '_total' ? `[Painel ${op} → ${col === 'Fórmula' ? 'Fórmula' : col.replace(/^\[.*?\]\s*/, '')}]` : `[Painel ${op} → Selecione Coluna]`) : op;

  return (
    <div className="space-y-8 animate-fade-in-up">
       <div className="flex flex-row justify-between items-center bg-white/5 p-10 rounded-[3rem] border border-white/10 gap-6">
          <div><h2 className="text-4xl font-black uppercase italic text-white">Laboratório Personalizado</h2><p className="text-slate-400 mt-2 font-bold uppercase text-xs tracking-widest">Cruze dimensões, crie fórmulas ou compare painéis.</p></div>
          <button onClick={openCreatorForNew} className="px-8 py-4 bg-indigo-600 rounded-2xl hover:bg-indigo-500 font-black uppercase flex items-center gap-3 shadow-2xl shadow-indigo-600/40 w-auto justify-center text-white shrink-0"><Plus size={20} /> Criar Painel</button>
       </div>

       {showCreator && (
         <Card className={`border-indigo-500/50 ${editingChartId ? 'bg-amber-950/20 border-amber-500/50' : 'bg-indigo-950/20'} p-10 h-full w-full`}>
            <div className="flex flex-wrap gap-4 mb-8 border-b border-white/10 pb-6">
              <button onClick={() => setCreatorMode('standard')} className={`px-6 py-3 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all ${creatorMode === 'standard' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-white/5 text-slate-500 hover:text-white'}`}>Métricas Padrão</button>
              <button onClick={() => setCreatorMode('formula')} className={`px-6 py-3 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all flex items-center gap-2 ${creatorMode === 'formula' ? 'bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-600/30' : 'bg-white/5 text-slate-500 hover:text-white'}`}><Calculator size={14}/> Fórmulas e KPIs</button>
              <button onClick={() => setCreatorMode('compare')} className={`px-6 py-3 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all flex items-center gap-2 ${creatorMode === 'compare' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30' : 'bg-white/5 text-slate-500 hover:text-white'}`}><GitCompare size={14}/> Comparar Painéis</button>
            </div>

            {creatorMode === 'compare' ? (
               <div className="flex flex-col gap-8 w-full">
                  {customCharts.filter(c => !c.isComparison).length < 2 ? (
                    <div className="py-10 text-center text-slate-400"><AlertTriangle size={40} className="mx-auto mb-4 text-amber-500 opacity-50"/><p className="font-bold">Precisa de pelo menos 2 painéis criados para poder cruzá-los.</p><p className="text-xs">Crie os seus gráficos no separador "Métricas Padrão" ou "Fórmulas" primeiro.</p></div>
                  ) : (
                    <>
                       <div className="grid grid-cols-2 gap-6 w-full mb-2">
                         {compState.panels.map((p, idx) => (
                           <div key={idx} className="space-y-3 relative">
                              <label className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex justify-between items-center"><span>Painel {p.alias}</span>{idx > 1 && <button onClick={() => setCompState({...compState, panels: compState.panels.filter((_, i) => i !== idx)})} className="text-rose-400 hover:bg-rose-500/20 p-1 rounded transition-colors" title="Remover Painel"><X size={12}/></button>}</label>
                              <select value={p.chartId} onChange={e => { const newPanels = [...compState.panels]; newPanels[idx].chartId = e.target.value; setCompState({...compState, panels: newPanels}); }} className="w-full bg-slate-900 border border-amber-500/30 p-4 rounded-2xl font-bold text-slate-200 text-xs outline-none focus:border-amber-500 shadow-inner"><option value="">Selecione o Painel para a Letra {p.alias}...</option>{customCharts.filter(c => !c.isComparison).map(c => <option key={c.id} value={c.id}>{getChartTitle(c)}</option>)}</select>
                           </div>
                         ))}
                       </div>
                       {compState.panels.length < 6 && <button onClick={addCompPanel} className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1.5 w-max bg-amber-500/10 px-4 py-2 rounded-xl border border-amber-500/20 transition-all"><Plus size={14}/> Adicionar Mais Um Painel (+1)</button>}
                       <div className="grid grid-cols-3 gap-6 w-full p-6 bg-black/20 border border-white/5 rounded-3xl mt-4">
                         <div className="space-y-3">
                             <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1.5"><Key size={12}/> Chave de Cruzamento (Opcional)</label>
                             <select value={compState.joinKey} onChange={e => setCompState({...compState, joinKey: e.target.value})} className="w-full bg-slate-900 border border-indigo-500/30 p-4 rounded-2xl font-bold text-slate-200 text-sm outline-none focus:border-indigo-500"><option value="">Automático (Eixo X dos Painéis)</option>{(result?.availableDimensions || []).map(d => <option key={d} value={d}>{d}</option>)}</select>
                             <label className="flex items-center gap-2 text-[10px] text-slate-400 cursor-pointer hover:text-white transition-colors bg-black/20 p-2 rounded-lg border border-white/5 mt-2">
                                <input type="checkbox" checked={compState.ignoreYear || false} onChange={e => setCompState({...compState, ignoreYear: e.target.checked})} className="rounded bg-black border-white/10 text-indigo-500 focus:ring-indigo-500/50" />
                                Ignorar Ano no Cruzamento (Mesclar Datas)
                             </label>
                         </div>
                         <div className="space-y-3"><label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1.5"><Link2 size={12}/> Modo de Ligação (Join)</label><select value={compState.linkMode} onChange={e => setCompState({...compState, linkMode: e.target.value})} className="w-full bg-slate-900 border border-white/10 p-4 rounded-2xl font-bold text-slate-200 text-sm outline-none focus:border-indigo-500"><option value="hierarchy">Matriz Hierárquica (Drill-down)</option><option value="exact">Mesclar por Chave Exata (Mês=Mês)</option></select></div>
                         <div className="space-y-3"><label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Análise de Arquiteto (Método)</label><select value={compState.method} onChange={e => setCompState({...compState, method: e.target.value, format: COMP_METHODS[e.target.value]?.defaultFormat || 'number'})} className="w-full bg-slate-900 border border-indigo-500/50 p-4 rounded-2xl font-black text-indigo-400 text-sm outline-none shadow-[0_0_15px_rgba(99,102,241,0.1)]">{Object.entries(COMP_METHODS).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}</select></div>
                       </div>
                       {compState.method === 'custom' && (
                         <div className="space-y-3 animate-fade-in-up mt-2"><label className="text-[10px] font-black text-fuchsia-400 uppercase tracking-widest flex items-center gap-1.5"><Calculator size={12}/> Editor de Fórmula Livre Textual</label><div className="flex gap-4"><input type="text" placeholder="Ex: (A + B) / C * 100" value={compState.customExpression} onChange={e => setCompState({...compState, customExpression: e.target.value})} className="w-full bg-slate-900 border border-fuchsia-500/50 p-4 rounded-2xl font-mono text-fuchsia-300 text-lg outline-none focus:border-fuchsia-400 shadow-inner" /><div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-center text-xs text-slate-400 font-bold whitespace-nowrap leading-relaxed">Use as Letras dos Painéis Activos: <span className="text-amber-400">{compState.panels.filter(p=>p.chartId).map(p=>p.alias).join(', ')}</span><br/>Exemplo: <span className="text-fuchsia-400">A - B</span> ou <span className="text-fuchsia-400">(A + B) / C</span></div></div></div>
                       )}
                       {compState.method === 'step_formula' && (
                         <div className="space-y-6 animate-fade-in-up border border-fuchsia-500/30 bg-fuchsia-950/10 p-6 rounded-3xl">
                            <div className="flex justify-between items-center"><label className="text-[10px] font-black text-fuchsia-400 uppercase tracking-widest flex items-center gap-2"><Calculator size={14}/> Matriz de Fórmulas Dinâmicas (Cruzamento)</label>{compFormulaSteps.length > 0 && <button onClick={()=>setCompFormulaSteps([])} className="text-xs font-bold text-rose-400 hover:text-rose-300 transition-colors">Limpar Passos</button>}</div>
                            {compFormulaSteps.length > 0 && <div className="space-y-3 bg-fuchsia-950/40 p-5 rounded-2xl border border-fuchsia-500/20">{compFormulaSteps.map((step, i) => <div key={i} className="flex items-center gap-4 text-xs font-mono text-slate-300 bg-black/40 p-3 rounded-xl border border-white/5"><span className="bg-fuchsia-500/20 text-fuchsia-400 px-3 py-1.5 rounded-lg shrink-0 font-bold">Passo {i+1}</span><span className="truncate">{formatCompOperandDisplay(step.op1, step.op1Type, step.op1Col)}</span><span className="text-fuchsia-400 font-black text-lg mx-2">{step.operator}</span><span className="truncate">{formatCompOperandDisplay(step.op2, step.op2Type, step.op2Col)}</span></div>)}</div>}
                            <div className="flex flex-row items-center gap-6 w-full">{renderCompFormulaOperand('op1', 'op1Type', 'op1Col')}<select value={newCompStep.operator} onChange={e => setNewCompStep({...newCompStep, operator: e.target.value})} className="bg-fuchsia-900/50 border border-fuchsia-500/50 rounded-xl px-4 py-3 text-2xl font-black text-fuchsia-300 text-center outline-none w-24 shrink-0 focus:border-fuchsia-400"><option value="+">+</option><option value="-">-</option><option value="*">×</option><option value="/">/</option></select>{renderCompFormulaOperand('op2', 'op2Type', 'op2Col')}<button onClick={addCompFormulaStep} className="px-8 py-3.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-xl font-black text-xs uppercase transition-all flex justify-center items-center gap-2 shrink-0 shadow-lg shadow-fuchsia-600/30"><PlusCircle size={16}/> Adicionar Passo</button></div>
                         </div>
                       )}
                       <div className="grid grid-cols-2 gap-6 w-full p-6 bg-black/20 border border-white/5 rounded-3xl mt-2">
                         <div className="space-y-3"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Formato Visual do Resultado</label><select value={compState.format} onChange={e => setCompState({...compState, format: e.target.value})} className="w-full bg-slate-900 border border-white/10 p-4 rounded-2xl font-bold text-slate-200 text-sm outline-none focus:border-white/30"><option value="percent">Percentual (%)</option><option value="currency">Valor / Moeda (R$)</option><option value="number">Número Decimal (1,50)</option><option value="integer">Quantidade Inteira (1, 2...)</option></select></div>
                         {compState.linkMode === 'exact' ? (
                            <div className="space-y-3 animate-fade-in-up"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estilo do Gráfico Comparativo</label><select value={compState.type} onChange={e => setCompState({...compState, type: e.target.value})} className="w-full bg-slate-900 border border-white/10 p-4 rounded-2xl font-bold text-slate-200 text-sm outline-none focus:border-white/30"><option value="bar">Colunas Comparativas Lado a Lado</option><option value="horizontal_bar">Barras Comparativas Horizontais</option><option value="line">Linhas Sobrepostas (Evolução)</option><option value="kpi">Cartão KPI (Número Único)</option></select></div>
                         ) : <div className="flex flex-col justify-center items-center text-slate-500 font-bold text-xs uppercase opacity-50 border-2 border-dashed border-white/10 rounded-2xl">Visualização Automática (Matriz)</div>}
                       </div>
                    </>
                  )}
               </div>
            ) : (
               <div className="flex flex-col gap-8 w-full">
                  <div className={`grid ${creatorMode === 'standard' ? 'grid-cols-5' : 'grid-cols-4'} gap-6 w-full`}>
                      <div className="space-y-3 relative z-50">
                         <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex justify-between">Eixo X (Categoria Base) {creatorState.type === 'kpi' && <span className="text-slate-500">(Opcional)</span>}</label>
                         <select value={creatorState.x} onChange={(e)=>{ setCreatorState({...creatorState, x: e.target.value, xFilters: []}); setShowXFilters(false); }} className="w-full bg-slate-900 border border-white/10 p-4 rounded-2xl font-bold text-slate-200 text-sm outline-none focus:border-indigo-500"><option value="">Selecione...</option>{(result?.availableDimensions || []).map(d => <option key={d} value={d}>{d}</option>)}</select>
                         {creatorState.x && (
                           <div className="mt-2 animate-fade-in-up flex flex-col gap-2">
                              <button onClick={() => setShowXFilters(!showXFilters)} className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 font-bold uppercase w-full bg-indigo-900/30 p-3 rounded-xl border border-indigo-500/20 transition-all"><ListFilter size={12}/> {(creatorState.xFilters || []).length > 0 ? `${creatorState.xFilters.length} Itens Filtrados` : 'Filtrar Itens Específicos'}</button>
                              
                              <label className="flex items-center gap-2 text-[10px] text-slate-400 cursor-pointer hover:text-white transition-colors bg-black/20 p-2 rounded-lg border border-white/5">
                                 <input type="checkbox" checked={creatorState.ignoreYear || false} onChange={e => setCreatorState({...creatorState, ignoreYear: e.target.checked})} className="rounded bg-black border-white/10 text-indigo-500 focus:ring-indigo-500/50" />
                                 Ignorar Ano (Mesclar 10/01/25 com 10/01/26)
                              </label>

                              {showXFilters && (
                                <div className="absolute top-full left-0 mt-2 w-full p-3 bg-slate-900 border border-indigo-500/50 rounded-xl shadow-2xl z-50">
                                  <div className="flex gap-2 items-center bg-black/40 border border-white/5 rounded-lg px-3 py-2 mb-3"><Search size={14} className="text-slate-500"/><input type="text" placeholder="Procurar..." value={xSearch} onChange={e=>setXSearch(e.target.value)} className="w-full bg-transparent text-xs text-white outline-none"/></div>
                                  <div className="max-h-40 overflow-y-auto custom-scrollbar flex flex-col gap-1.5 pr-2">
                                    {(availableXValues || []).filter(v => v.toLowerCase().includes(xSearch.toLowerCase())).map(v => { const isSel = (creatorState.xFilters || []).includes(v); return <label key={v} className="flex items-start gap-2 text-xs text-slate-300 hover:text-white cursor-pointer p-1.5 hover:bg-white/5 rounded-lg transition-colors"><input type="checkbox" checked={isSel} onChange={() => setCreatorState({...creatorState, xFilters: isSel ? (creatorState.xFilters || []).filter(x=>x!==v) : [...(creatorState.xFilters || []), v]})} className="rounded bg-black border-white/10 text-indigo-500 focus:ring-indigo-500/50 mt-0.5" /><span className="leading-tight">{v}</span></label> })}
                                  </div>
                                  {(creatorState.xFilters || []).length > 0 && <button onClick={() => setCreatorState({...creatorState, xFilters: []})} className="w-full mt-3 py-2 text-[10px] uppercase font-black text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors">Limpar Filtros</button>}
                                </div>
                              )}
                           </div>
                         )}
                      </div>
                      
                      {creatorMode === 'standard' ? (
                         <div className="space-y-3 relative z-40"><label className="text-[10px] font-black text-teal-400 uppercase tracking-widest flex items-center gap-1.5"><Layers size={12}/> Legenda / Quebra</label><select value={creatorState.breakdown} onChange={e => setCreatorState({...creatorState, breakdown: e.target.value, y: (creatorState.y || []).slice(0, 1)})} className="w-full bg-slate-900 border border-teal-500/30 p-4 rounded-2xl font-bold text-teal-200 text-sm outline-none focus:border-teal-500 shadow-[0_0_15px_rgba(45,212,191,0.05)]"><option value="">Sem Quebra...</option>{(result?.availableDimensions || []).map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                      ) : <div className="space-y-3 relative z-40"><label className="text-[10px] font-black text-fuchsia-400 uppercase tracking-widest flex items-center gap-1.5">Fórmulas</label><div className="w-full bg-slate-900 border border-white/10 p-4 rounded-2xl font-bold text-slate-500 text-sm opacity-50 cursor-not-allowed">Modo de Cálculo Matemático</div></div>}

                      {creatorMode === 'standard' && !creatorState.breakdown ? (
                         <div className="space-y-3 relative z-40"><label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Alinhamento (Eixo X)</label><select value={creatorState.alignMode || 'exact'} onChange={(e)=>setCreatorState({...creatorState, alignMode: e.target.value})} className="w-full bg-slate-900 border border-white/10 p-4 rounded-2xl font-bold text-slate-200 text-sm outline-none focus:border-indigo-500"><option value="exact">Padrão (Nome Exato)</option><option value="rank">Lado-a-Lado por Ranking (Top 1 vs 1)</option></select></div>
                      ) : creatorMode === 'standard' && creatorState.breakdown ? (
                         <div className="space-y-3 relative z-40 opacity-50"><label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Alinhamento</label><div className="w-full bg-slate-900 border border-white/10 p-4 rounded-2xl font-bold text-slate-500 text-sm">Bloqueado por Legenda</div></div>
                      ) : null}

                      <div className="space-y-3"><label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Formato Visual</label><select value={creatorState.format} onChange={(e)=>setCreatorState({...creatorState, format: e.target.value})} className="w-full bg-slate-900 border border-white/10 p-4 rounded-2xl font-bold text-slate-200 text-sm outline-none focus:border-indigo-500"><option value="currency">Valor / Moeda (R$)</option><option value="integer">Inteiro (1, 2...)</option><option value="number">Número (1,50)</option><option value="compact">Resumido (1K)</option><option value="percent">Percentual (%)</option><option value="date">Data</option></select></div>
                      <div className="space-y-3"><label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Estilo do Gráfico / Widget</label><select value={creatorState.type} onChange={(e)=>setCreatorState({...creatorState, type: e.target.value})} className="w-full bg-slate-900 border border-white/10 p-4 rounded-2xl font-bold text-slate-200 text-sm outline-none focus:border-indigo-500"><option value="bar">Colunas (Vertical)</option><option value="horizontal_bar">Barras (Horizontal)</option><option value="line">Linha</option><option value="area">Área</option><option value="pie">Rosca</option><option value="kpi">Cartão KPI (Número Único)</option></select></div>
                  </div>

                  <div className="w-full bg-black/20 border border-white/5 rounded-3xl p-6">
                     {creatorMode === 'standard' ? (
                        <div className="space-y-4">
                           <div className="flex justify-between items-center"><label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Selecione as Métricas Y</label>{creatorState.breakdown && <span className="text-[10px] text-teal-400 font-bold bg-teal-500/10 px-2 py-1 rounded">⚠️ Legenda Ativa: Apenas 1 Métrica</span>}</div>
                           <div className="flex flex-col gap-6">
                              {(result?.processedFiles || []).length > 1 ? (
                                 (result?.processedFiles || []).map(file => (
                                   <div key={file.name} className="w-full"><div className="text-[10px] text-amber-500 font-bold mb-3 border-b border-white/5 pb-2 tracking-widest uppercase">Ficheiro: {file.name}</div>
                                     <div className="flex flex-wrap gap-3">{(file.numericHeaders || []).map(h => { const mName = `[${file.name}] ${h}`, isActive = (creatorState.y || []).includes(mName); return <button key={mName} onClick={() => setCreatorState(prev => ({ ...prev, y: creatorState.breakdown ? [mName] : isActive ? (prev.y || []).filter(v => v !== mName) : [...(prev.y || []), mName] }))} className={`px-4 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${isActive ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>{h}</button> })}</div>
                                   </div>
                                 ))
                              ) : <div className="flex flex-wrap gap-3">{(result?.availableMetrics || []).map(m => { const isActive = (creatorState.y || []).includes(m); return <button key={m} onClick={() => setCreatorState(prev => ({ ...prev, y: creatorState.breakdown ? [m] : isActive ? (prev.y || []).filter(v => v !== m) : [...(prev.y || []), m] }))} className={`px-4 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${isActive ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>{m}</button> })}</div>}
                           </div>
                        </div>
                     ) : (
                        <div className="space-y-6">
                           <div className="flex justify-between items-end">
                               <label className="text-[10px] font-black text-fuchsia-400 uppercase tracking-widest flex flex-col gap-2">
                                  <span>Matriz de Fórmulas Dinâmicas (Linha a Linha)</span>
                                  <div className="flex bg-black/30 p-1 rounded-lg w-max border border-white/10">
                                      <button onClick={() => setFormulaInputMode('standard')} className={`px-4 py-1.5 rounded-md text-[10px] font-bold transition-all ${formulaInputMode === 'standard' ? 'bg-fuchsia-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>Passo-a-Passo Simplificado</button>
                                      <button onClick={() => setFormulaInputMode('advanced')} className={`px-4 py-1.5 rounded-md text-[10px] font-bold transition-all ${formulaInputMode === 'advanced' ? 'bg-fuchsia-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>Expressão Livre / Avançada</button>
                                  </div>
                               </label>
                               {formulaSteps.length > 0 && <button onClick={clearFormula} className="text-xs font-bold text-rose-400 hover:text-rose-300 transition-colors mb-2 border border-rose-500/20 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20">Limpar Matriz Total</button>}
                           </div>

                           {formulaSteps.length > 0 && (
                               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 bg-fuchsia-950/20 p-5 rounded-2xl border border-fuchsia-500/20 relative">
                                   {formulaSteps.map((step, i) => (
                                     <div key={i} className={`flex flex-col relative group text-xs text-slate-300 bg-black/40 pt-1 pb-3 px-3 rounded-xl border transition-all ${editingStepIdx === i ? 'border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.3)]' : 'border-white/5 hover:border-fuchsia-500/30'}`}>
                                         <div className="flex justify-between items-center mb-2 border-b border-white/5 pb-2">
                                            <span className="bg-fuchsia-500/20 text-fuchsia-400 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">Passo {i+1}</span>
                                            <button onClick={() => editFormulaStep(i)} className="text-slate-500 hover:text-amber-400 transition-colors" title="Editar este passo"><Edit2 size={12} /></button>
                                         </div>
                                         <div className="flex-1 flex items-center justify-center overflow-x-auto custom-scrollbar">
                                            {step.type === 'advanced' ? (
                                                <MathExpressionViewer expression={step.expression} />
                                            ) : (
                                                <div className="flex items-center gap-2 font-mono whitespace-nowrap opacity-90">
                                                    <span>{step.op1Type === 'step' ? `Passo ${Number(step.op1)+1}` : step.op1Type === 'global_col' ? `Σ Total(${step.op1})` : step.op1Type === 'kpi' ? step.op1.replace('KPI: ', 'KPI ') : step.op1}</span>
                                                    <span className="text-fuchsia-400 font-black text-sm">{step.operator}</span>
                                                    <span>{step.op2Type === 'step' ? `Passo ${Number(step.op2)+1}` : step.op2Type === 'global_col' ? `Σ Total(${step.op2})` : step.op2Type === 'kpi' ? step.op2.replace('KPI: ', 'KPI ') : step.op2}</span>
                                                </div>
                                            )}
                                         </div>
                                     </div>
                                   ))}
                               </div>
                           )}

                           {formulaInputMode === 'advanced' ? (
                               <div className={`p-6 border transition-all rounded-3xl flex flex-col gap-4 shadow-inner relative overflow-hidden ${editingStepIdx !== null ? 'bg-amber-950/20 border-amber-500/50' : 'border-fuchsia-500/40 bg-fuchsia-950/10'}`}>
                                   <div className={`absolute top-0 left-0 w-1.5 h-full ${editingStepIdx !== null ? 'bg-amber-500' : 'bg-fuchsia-500'}`}></div>
                                   <div className="flex items-center justify-between ml-2">
                                        <div className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2 text-fuchsia-400"><FunctionSquare size={14}/> Construção de Equação Livre</div>
                                        {editingStepIdx !== null && <span className="text-amber-400 text-[10px] font-bold px-2 py-1 bg-amber-500/20 rounded uppercase tracking-widest animate-pulse">Editando Passo {editingStepIdx + 1}</span>}
                                   </div>
                                   
                                   <div className="flex flex-col md:flex-row gap-4 ml-2">
                                       <div className="flex-1 flex flex-col gap-2">
                                           <textarea 
                                               value={advancedExpr} 
                                               onChange={(e) => setAdvancedExpr(e.target.value)} 
                                               placeholder="Exemplo: ({Quantidade} * {Custo}) + {Preço} / 2" 
                                               className="w-full bg-slate-900 border border-white/10 p-4 rounded-2xl font-mono text-white text-lg outline-none focus:border-fuchsia-500 shadow-inner min-h-[100px] resize-y"
                                           />
                                           <div className="text-[10px] text-slate-400 flex items-center gap-2 bg-black/30 p-2 rounded-lg"><Sigma size={12} className="text-amber-400"/> Dica: Suporta múltiplos parênteses ( ) e renderiza frações visuais se usar o sinal de divisão /</div>
                                       </div>
                                       
                                       <div className="w-full md:w-64 shrink-0 flex flex-col gap-3">
                                           {Object.keys(kpiValues).length > 0 && (
                                                <div className="bg-emerald-900/10 border border-emerald-500/20 rounded-2xl p-4 max-h-[120px] overflow-y-auto custom-scrollbar">
                                                    <div className="text-[9px] font-black uppercase text-emerald-500 mb-2 border-b border-emerald-500/20 pb-1">KPIs Salvos Anteriores (Clique)</div>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {Object.keys(kpiValues).map(k => (
                                                            <button key={k} onClick={() => insertVariableIntoAdvanced(k)} className="text-[9px] bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 font-bold px-2 py-1 rounded transition-colors whitespace-nowrap text-left truncate max-w-full shadow-sm">{k.replace('KPI: ', '')}</button>
                                                        ))}
                                                    </div>
                                                </div>
                                           )}
                                           <div className="bg-slate-900 border border-white/5 rounded-2xl p-4 max-h-[160px] flex flex-col flex-1">
                                                <div className="text-[9px] font-black uppercase text-slate-500 mb-2 border-b border-white/5 pb-2 flex flex-col gap-2 shrink-0">
                                                    <div>Variáveis da Planilha</div>
                                                    {hasMultipleFiles && (
                                                        <select 
                                                            value={activeAdvancedFile} 
                                                            onChange={e => setAdvancedSelectedFile(e.target.value)}
                                                            className="w-full bg-black/50 border border-cyan-500/30 text-cyan-300 rounded p-1 text-[9px] outline-none"
                                                        >
                                                            {result.processedFiles.map(f => (
                                                                <option key={f.name} value={f.name}>{f.name}</option>
                                                            ))}
                                                        </select>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap gap-1.5 overflow-y-auto custom-scrollbar flex-1 pr-1">
                                                    {formulaSteps.map((_, idx) => (
                                                        (editingStepIdx === null || idx < editingStepIdx) && (
                                                            <button key={`passo_${idx}`} onClick={() => insertVariableIntoAdvanced(`Passo ${idx+1}`)} className="text-[9px] bg-fuchsia-500/20 hover:bg-fuchsia-500/40 text-fuchsia-300 font-bold px-2 py-1 rounded transition-colors whitespace-nowrap text-left truncate max-w-full shrink-0">Passo {idx+1}</button>
                                                        )
                                                    ))}
                                                    {filteredMetrics.map(m => (
                                                        <button key={m} onClick={() => insertVariableIntoAdvanced(m)} className="text-[9px] bg-cyan-500/10 hover:bg-cyan-500/30 text-cyan-300 font-bold px-2 py-1 rounded transition-colors whitespace-nowrap text-left truncate max-w-full shrink-0" title={m}>{hasMultipleFiles ? m.replace(/^\[.*?\]\s*/, '') : m}</button>
                                                    ))}
                                                </div>
                                           </div>
                                       </div>
                                   </div>
                                   
                                   <div className="flex gap-4 ml-2 mt-2">
                                       {editingStepIdx !== null && <button onClick={cancelEditStep} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-black text-xs uppercase transition-all flex justify-center items-center gap-2 shadow-lg">Cancelar</button>}
                                       <button onClick={addFormulaStep} className={`px-8 py-3 w-max text-white rounded-xl font-black text-xs uppercase transition-all flex justify-center items-center gap-2 shadow-lg ${editingStepIdx !== null ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30' : 'bg-fuchsia-600 hover:bg-fuchsia-500 shadow-fuchsia-600/30'}`}>
                                           {editingStepIdx !== null ? <><Check size={16}/> Atualizar Passo {editingStepIdx + 1}</> : <><PlusCircle size={16}/> Inserir Novo Passo</>}
                                       </button>
                                   </div>
                               </div>
                           ) : (
                               <div className={`p-6 border transition-all rounded-2xl flex flex-col w-full shadow-inner relative overflow-hidden ${editingStepIdx !== null ? 'bg-amber-950/20 border-amber-500/50' : 'border-fuchsia-500/40 bg-fuchsia-950/10'}`}>
                                 <div className={`absolute top-0 left-0 w-1.5 h-full ${editingStepIdx !== null ? 'bg-amber-500' : 'bg-fuchsia-500'}`}></div>
                                 <div className="flex items-center justify-between mb-4 ml-2">
                                     <div className="text-[11px] font-black uppercase tracking-widest text-fuchsia-400">Construtor Padrão (2 Variáveis)</div>
                                     {editingStepIdx !== null && <span className="text-amber-400 text-[10px] font-bold px-2 py-1 bg-amber-500/20 rounded uppercase tracking-widest animate-pulse">Editando Passo {editingStepIdx + 1}</span>}
                                 </div>
                                 <div className="flex flex-row items-center gap-6 w-full ml-2">
                                     {renderFormulaOperand('op1', 'op1Type', 'op1File')}
                                     <select value={newStep.operator} onChange={e => setNewStep({...newStep, operator: e.target.value})} className="bg-fuchsia-900/50 border border-fuchsia-500/50 rounded-xl px-4 py-3 text-2xl font-black text-fuchsia-300 text-center outline-none w-24 shrink-0 focus:border-fuchsia-400 transition-colors"><option value="+">+</option><option value="-">-</option><option value="*">×</option><option value="/">/</option></select>
                                     {renderFormulaOperand('op2', 'op2Type', 'op2File')}
                                 </div>
                                 <div className="flex gap-4 mt-6 ml-2">
                                     {editingStepIdx !== null && <button onClick={cancelEditStep} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-black text-xs uppercase transition-all flex justify-center items-center gap-2 shadow-lg">Cancelar</button>}
                                     <button onClick={addFormulaStep} className={`w-auto px-8 py-3 text-white rounded-xl font-black text-xs uppercase transition-all flex justify-center items-center gap-3 shrink-0 shadow-lg ${editingStepIdx !== null ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30' : 'bg-fuchsia-600 hover:bg-fuchsia-500 shadow-fuchsia-600/30'}`}>
                                         {editingStepIdx !== null ? <><Check size={18}/> Atualizar Passo</> : <><ArrowRight size={18}/> Inserir Passo</>}
                                     </button>
                                 </div>
                               </div>
                           )}
                        </div>
                     )}
                  </div>
               </div>
            )}

            {!(creatorMode === 'compare' && customCharts.filter(c => !c.isComparison).length < 2) && (
               <div className="w-full mt-8 pt-6 border-t border-white/10 flex flex-row gap-4">
                  {editingChartId && <button onClick={() => { setShowCreator(false); resetCreator(); }} className="w-1/3 py-5 rounded-2xl font-black uppercase text-sm bg-slate-800 hover:bg-slate-700 text-white transition-all shadow-xl">Cancelar Edição Geral</button>}
                  <button onClick={validateAndAddChart} className={`w-full ${editingChartId ? 'w-2/3' : 'w-full'} py-5 rounded-2xl font-black uppercase text-sm text-white shadow-2xl transition-all flex items-center justify-center gap-3 ${creatorMode === 'compare' ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'}`}>
                     {creatorMode === 'compare' ? <GitCompare size={20}/> : <Activity size={20}/>}
                     {editingChartId ? 'Guardar Alterações do Painel' : 'Processar Painel e Gerar'}
                  </button>
               </div>
            )}
         </Card>
       )}

       <div className="grid grid-cols-12 gap-8 w-full items-start">
          {(customCharts || []).length === 0 && !showCreator && (
            <div className="col-span-12 py-32 text-center opacity-30 animate-fade-in-up">
              <BarChart size={100} className="mx-auto mb-6 text-indigo-400"/>
              <p className="font-black uppercase tracking-widest text-3xl italic text-white mb-2">Laboratório Vazio</p>
              <p className="text-xl font-light">Clique em "Criar Painel" para começar a processar dados ou criar seus KPIs.</p>
            </div>
          )}
          {(customCharts || []).map(c => {
            if (!c) return null;
            return <div key={c.id} className={c.span}><CustomChartCard c={c} result={result} kpiValues={kpiValues} onToggleSize={toggleChartSize} onRename={renameChart} onEdit={handleEditChart} onShowDialog={showDialog} onDelete={async (id) => { const confirmed = await showDialog('confirm', 'Eliminar Painel', 'Tem a certeza que quer eliminar este painel de visualização? Fórmulas que dependem dele poderão ficar com valor nulo.'); if (confirmed) updateWorkspaceCharts(customCharts.filter(x => x.id !== id)); }} /></div>;
          })}
       </div>
    </div>
  );
};

export default CustomLab;