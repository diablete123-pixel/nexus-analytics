import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Calculator, GitCompare, Layers, Play, Maximize, BarChart, PieChart, Activity, LineChart, AlertTriangle, Waypoints } from 'lucide-react';

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
  growth: { name: '📈 Crescimento Relativo', defaultFormat: 'percent' },
  ratio_div: { name: '➗ Divisão Direta', defaultFormat: 'number' },
  ticket_medio: { name: '🏷️ Ticket Médio', defaultFormat: 'currency' },
  gap: { name: '📏 Diferença Absoluta', defaultFormat: 'currency' },
  share: { name: '🍕 Participação / Share', defaultFormat: 'percent' },
  index_100: { name: '🎯 Índice (Base 100)', defaultFormat: 'number' },
  sum: { name: '➕ Soma Consolidada', defaultFormat: 'currency' },
  avg: { name: '⚖️ Média Simples', defaultFormat: 'currency' }, 
  win_b: { name: '🏆 Vantagem do Alvo', defaultFormat: 'currency' },
  win_a: { name: '📉 Déficit / Perda', defaultFormat: 'currency' },
  variance: { name: '✂️ Variância Absoluta', defaultFormat: 'number' },
  custom: { name: '🔤 Fórmula Livre', defaultFormat: 'number' },
  step_formula: { name: '⚙️ Matriz de Fórmulas', defaultFormat: 'number' }
};

// Funções Utilitárias Matemáticas
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

const safeExtractVal = (valObj, method) => typeof valObj !== 'object' || valObj === null ? (valObj || 0) : method === 'ticket_medio' ? (valObj._smartQtd ? valObj._smartFat / valObj._smartQtd : 0) : (valObj._total || 0);

const getChartTitle = (c) => {
  if (!c) return '';
  if (c.customTitle) return c.customTitle;
  if (c.isComparison) return `Comparativo: ${c.panels?.map(p => c.panelTitles?.[p.alias] || p.alias).join(' vs ')}`;
  const activeYCols = c.isFormula ? ['Fórmula'] : (Array.isArray(c.y) ? c.y : []);
  const baseTitle = `${AGG_LABELS[c.agg] || 'Soma'}: ${activeYCols.join(', ')} por ${c.x || '?'}`;
  return c.breakdown ? `${baseTitle} (Quebrado por ${c.breakdown})` : baseTitle;
};

const getResultPrefix = (res, method) => res > 0 && !['ratio', 'ratio_div', 'index_100', 'share', 'variance', 'ticket_medio'].includes(method) ? '+' : '';

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

const extractSmartQtd = (r, cfg, dsName) => {
    let q = 1;
    if(cfg?.isFormula && cfg.steps?.length > 0) {
        let col = null;
        cfg.steps.forEach(s => {
            if(/(qtd|quant|vol|peç|pec)/i.test(s.op1)) col = s.op1;
            if(/(qtd|quant|vol|peç|pec)/i.test(s.op2)) col = s.op2;
        });
        if(!col) col = cfg.steps[0].op1;
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

// --- MOTOR MATEMÁTICO COMPLETO IGUAL AO DO CUSTOMLAB ---
const computeLabData = (config, result, showAll = false) => {
  if (!result || !result.processedFiles || result.processedFiles.length === 0 || !config) return { records: [], yCols: [], totals: {} };
  const globalTotals = {};
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
                     [ {op: step.op1, type: step.op1Type}, {op: step.op2, type: step.op2Type} ].forEach(operand => {
                         if (operand.type === 'col') {
                             const match = operand.op.match(/^\[(.*?)\]\s*(.*)$/);
                             if (match) { involvesSpecificFiles = true; if (match[1] === dsName) involvesCurrentFile = true; } else involvesCurrentFile = true;
                         }
                     });
                  });
                  if (!involvesSpecificFiles || involvesCurrentFile) {
                      let stepResults = [];
                      (cfg.steps || []).forEach(step => {
                          const getVal = (op, type) => {
                              if (type === 'num') return Number(op) || 0;
                              if (type === 'step') return stepResults[Number(op)] || 0;
                              if (type === 'global_col') return globalTotals[op] || 0;
                              if (type === 'col') return res[op] || 0; return 0;
                          };
                          const v1 = getVal(step.op1, step.op1Type), v2 = getVal(step.op2, step.op2Type);
                          let sRes = 0;
                          if (step.operator === '+') sRes = v1 + v2; if (step.operator === '-') sRes = v1 - v2;
                          if (step.operator === '*') sRes = v1 * v2; if (step.operator === '/') sRes = (v2 && v2 !== 0) ? (v1 / v2) : 0;
                          stepResults.push(sRes);
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
             const cfg = config.compJoinKey ? { ...baseCfg, x: config.compJoinKey, breakdown: null } : baseCfg;
             const { records, totals: subTotals } = computeLabData(cfg, result, true) || { records: [], totals: {} };
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
                          const getVal = (op, type) => type === 'num' ? Number(op) || 0 : type === 'step' ? stepResults[Number(op)] || 0 : type === 'global_col' ? globalTotals[op] || 0 : res[op] || 0; 
                          const v1 = getVal(step.op1, step.op1Type), v2 = getVal(step.op2, step.op2Type); let sRes = 0;
                          if (step.operator === '+') sRes = v1 + v2; if (step.operator === '-') sRes = v1 - v2; if (step.operator === '*') sRes = v1 * v2; if (step.operator === '/') sRes = (v2 && v2 !== 0) ? (v1 / v2) : 0;
                          stepResults.push(sRes);
                      });
                      res['Fórmula'] = stepResults[stepResults.length - 1] || 0; res._total = res['Fórmula']; res._debug.push(`Modo: Total Agregado`);
                      (cfg.steps || []).forEach(s => { if(s.op1Type === 'col') res._debug.push(`Σ ${s.op1}: ${formatCustomValue(res[s.op1], 'sum')}`); if(s.op2Type === 'col') res._debug.push(`Σ ${s.op2}: ${formatCustomValue(res[s.op2], 'sum')}`); });
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
                  let rawVals = actualKeys.map(k => k ? String(r._original_row?.[k] || 'N/A').trim() : 'N/A');
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
          let joinCol = config.x; if (!(ds.cleanHeaders || []).includes(config.x)) joinCol = config.x === result.processedFiles[0]?.productHeader ? ds.productHeader : (config.x === result.processedFiles[0]?.entityHeader ? ds.entityHeader : null);
          let bJoinCol = config.breakdown; if (!(ds.cleanHeaders || []).includes(config.breakdown)) bJoinCol = config.breakdown === result.processedFiles[0]?.productHeader ? ds.productHeader : (config.breakdown === result.processedFiles[0]?.entityHeader ? ds.entityHeader : null);
          if (joinCol === bJoinCol) bJoinCol = null;
          (ds.data || []).forEach(r => {
             let skip = false; if (result.activeFilters && result.activeFilters.length > 0) result.activeFilters.forEach(f => { if ((ds.cleanHeaders || []).includes(f.col) && String(r._original_row?.[f.col]) !== String(f.val)) skip = true; }); if (skip) return;
             const key = String(r._original_row?.[joinCol] || 'N/A').trim(); if (config.xFilters && config.xFilters.length > 0 && !config.xFilters.includes(key)) return; 
             const bKey = bJoinCol ? String(r._original_row?.[bJoinCol] || 'Não Especificado').trim() : 'Não Especificado'; if (bJoinCol && key.toLowerCase() === bKey.toLowerCase() && key !== 'N/A') return;
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
      return { records: showAll || (config.xFilters && config.xFilters.length > 0) ? sortedData : sortedData.slice(0, 15), yCols: activeYCols, totals };
  }

  const grouped = {};
  result.processedFiles.forEach(ds => {
      let joinCol = config.x; if (!(ds.cleanHeaders || []).includes(config.x)) joinCol = config.x === result.processedFiles[0]?.productHeader ? ds.productHeader : (config.x === result.processedFiles[0]?.entityHeader ? ds.entityHeader : null);
      (ds.data || []).forEach(r => {
         let skip = false; if (result.activeFilters && result.activeFilters.length > 0) result.activeFilters.forEach(f => { if ((ds.cleanHeaders || []).includes(f.col) && String(r._original_row?.[f.col]) !== String(f.val)) skip = true; }); if (skip) return;
         const key = String(r._original_row?.[joinCol] || 'N/A').trim(); if (config.xFilters && config.xFilters.length > 0 && !config.xFilters.includes(key)) return; 
         if (!grouped[key]) { grouped[key] = { name: key, _counts: {}, _rawValues: {}, _rowHits: 0, _formulaVals: [], _smartQtdAcc: 0, _smartFatAcc: 0 }; (result.availableMetrics || []).forEach(m => { grouped[key][m] = 0; grouped[key]._counts[m] = 0; grouped[key]._rawValues[m] = []; }); }
         grouped[key]._rowHits += 1;
         grouped[key]._smartQtdAcc += extractSmartQtd(r, config, ds.name);
         let mFat = extractSmartFat(r, config, ds.name);
         if(mFat !== null) grouped[key]._smartFatAcc += mFat;

         if (config.isFormula) {
             let involvesCurrentFile = false, involvesSpecificFiles = false;
             (config.steps || []).forEach(step => { [ {op: step.op1, type: step.op1Type}, {op: step.op2, type: step.op2Type} ].forEach(operand => { if (operand.type === 'col') { const match = operand.op.match(/^\[(.*?)\]\s*(.*)$/); if (match) { involvesSpecificFiles = true; if (match[1] === ds.name) involvesCurrentFile = true; } else involvesCurrentFile = true; } }); });
             if (!involvesSpecificFiles || involvesCurrentFile) {
                 if (config.formulaMode !== 'aggregate') {
                     let stepResults = [];
                     (config.steps || []).forEach(step => {
                         const getVal = (op, type) => {
                             if (type === 'num') return Number(op) || 0; if (type === 'step') return stepResults[Number(op)] || 0; if (type === 'global_col') return globalTotals[op] || 0;
                             if (type === 'col') { let targetFile = null, rawH = op, match = op.match(/^\[(.*?)\]\s*(.*)$/); if (match) { targetFile = match[1]; rawH = match[2]; } if (targetFile && targetFile !== ds.name) return 0; return cleanNumber(r._original_row?.[rawH]) || 0; } return 0;
                         };
                         const v1 = getVal(step.op1, step.op1Type), v2 = getVal(step.op2, step.op2Type); let sRes = 0;
                         if (step.operator === '+') sRes = v1 + v2; if (step.operator === '-') sRes = v1 - v2; if (step.operator === '*') sRes = v1 * v2; if (step.operator === '/') sRes = (v2 && v2 !== 0) ? (v1 / v2) : 0; stepResults.push(sRes);
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
        rowCount += g._counts[y] || 0; rowRawSum += g[y] || 0;
    });
    finalObj._totalCount = rowCount; finalObj._rawSum = rowRawSum; finalObj._smartQtd = g._smartQtdAcc || 1;

    if (config.isFormula) {
      let fRes = 0;
      if (config.formulaMode === 'aggregate') {
          let stepResults = [];
          (config.steps || []).forEach(step => {
              const getVal = (op, type) => type === 'num' ? Number(op) || 0 : type === 'step' ? stepResults[Number(op)] || 0 : type === 'global_col' ? globalTotals[op] || 0 : g[op] || 0; 
              const v1 = getVal(step.op1, step.op1Type), v2 = getVal(step.op2, step.op2Type); let sRes = 0;
              if (step.operator === '+') sRes = v1 + v2; if (step.operator === '-') sRes = v1 - v2; if (step.operator === '*') sRes = v1 * v2; if (step.operator === '/') sRes = (v2 && v2 !== 0) ? (v1 / v2) : 0; stepResults.push(sRes);
          });
          fRes = stepResults[stepResults.length - 1] || 0;
          finalObj['Fórmula'] = fRes; finalObj._total = fRes; finalObj._rawSum = fRes; finalObj._totalCount = 1; finalObj._formulaVals = [fRes];
          finalObj._debug.push(`Modo de Cálculo: Total Agregado`);
          (config.steps || []).forEach(s => { if(s.op1Type === 'col') finalObj._debug.push(`Σ ${s.op1.replace(/^\[.*?\]\s*/, '')}: ${formatCustomValue(g[s.op1], 'sum')}`); if(s.op2Type === 'col') finalObj._debug.push(`Σ ${s.op2.replace(/^\[.*?\]\s*/, '')}: ${formatCustomValue(g[s.op2], 'sum')}`); });
      } else {
          const fVals = g._formulaVals || [];
          if (config.agg === 'avg') fRes = fVals.length ? fVals.reduce((a,b)=>a+b,0)/fVals.length : 0; else if (config.agg === 'max') fRes = Math.max(...fVals); else if (config.agg === 'min') fRes = Math.min(...fVals); else if (config.agg === 'count') fRes = fVals.length; else fRes = fVals.reduce((a,b)=>a+b,0);
          finalObj['Fórmula'] = fRes; finalObj._total = fRes; finalObj._rawSum = fVals.reduce((a,b)=>a+b,0); finalObj._totalCount = fVals.length || 1; finalObj._formulaVals = fVals;
          finalObj._debug.push(`Modo de Cálculo: Linha a Linha (${AGG_LABELS[config.agg] || 'Soma'})`);
      }
    }
    finalObj._smartFat = (g._smartFatAcc !== undefined && g._smartFatAcc !== 0) ? g._smartFatAcc : finalObj._total;
    if (!config.isFormula) finalObj._total = rowRawSum;
    return finalObj;
  }).sort((a, b) => (b[activeYCols[0]] || 0) - (a[activeYCols[0]] || 0));
  
  let totals = { _total: 0, _rawSum: 0, _totalCount: 0 }; activeYCols.forEach(y => totals[y] = 0);
  if (config.isFormula) {
      if (config.formulaMode === 'aggregate') {
          let stepResults = [];
          (config.steps || []).forEach(step => {
              const getVal = (op, type) => type === 'num' ? Number(op) || 0 : type === 'step' ? stepResults[Number(op)] || 0 : type === 'global_col' ? globalTotals[op] || 0 : globalTotals[op] || 0; 
              const v1 = getVal(step.op1, step.op1Type), v2 = getVal(step.op2, step.op2Type); let sRes = 0;
              if (step.operator === '+') sRes = v1 + v2; if (step.operator === '-') sRes = v1 - v2; if (step.operator === '*') sRes = v1 * v2; if (step.operator === '/') sRes = (v2 && v2 !== 0) ? (v1 / v2) : 0; stepResults.push(sRes);
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
      return { records: showAll || (config.xFilters && config.xFilters.length > 0) ? sortedData : sortedData.slice(0, 15), yCols: activeYCols, totals };
  }
  return { records: showAll || (config.xFilters && config.xFilters.length > 0) ? sortedData : sortedData.slice(0, 15), yCols: activeYCols, totals };
};


// Componente Principal de Apresentação
const Apresenta = ({ result, customCharts, onClose }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [hoveredData, setHoveredData] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState({});
  const [insightTooltip, setInsightTooltip] = useState(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'Space') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide]);

  if (!customCharts || customCharts.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center text-white">
        <AlertTriangle size={80} className="text-amber-500 mb-6 opacity-80" />
        <h2 className="text-3xl font-black uppercase tracking-widest mb-4">Apresentação Vazia</h2>
        <p className="text-slate-400 mb-8">Não existem painéis criados no Laboratório para exibir.</p>
        <button onClick={onClose} className="px-8 py-4 bg-indigo-600 rounded-xl font-bold uppercase hover:bg-indigo-500 transition-all flex items-center gap-2"><ChevronLeft /> Voltar ao Laboratório</button>
      </div>
    );
  }

  const nextSlide = () => setCurrentSlide(s => Math.min(s + 1, customCharts.length - 1));
  const prevSlide = () => setCurrentSlide(s => Math.max(s - 1, 0));

  const chart = customCharts[currentSlide];
  const { records: data, yCols: activeYCols, totals, isHierarchy } = useMemo(() => computeLabData(chart, result), [chart, result]);
  const maxVal = Math.max(...data.flatMap(d => activeYCols.map(yName => Math.abs(safeExtractVal(d[yName], chart.compMethod)))), 1);

  const getColFormat = (yName) => chart.isComparison ? chart.panelConfigs?.[yName]?.format || 'currency' : chart.format || 'currency';

  const getGlobalRes = () => {
    if (!chart.isComparison || activeYCols.length < 2) return 0;
    if (chart.compMethod === 'ticket_medio') {
        let totalFat = 0, totalQtd = 0;
        activeYCols.forEach(a => { totalFat += totals?.[a]?._smartFat || 0; totalQtd += totals?.[a]?._smartQtd || 0; });
        return totalQtd > 0 ? totalFat / totalQtd : 0;
    }
    const rawA = totals ? safeExtractVal(totals[activeYCols[0]], chart.compMethod) : 0, rawB = totals ? safeExtractVal(totals[activeYCols[activeYCols.length - 1]], chart.compMethod) : 0;
    switch(chart.compMethod) {
        case 'growth': return rawA ? ((rawB - rawA) / Math.abs(rawA)) * 100 : 0;
        case 'gap': return rawB - rawA;
        case 'ratio': case 'ratio_div': return rawA ? rawB / rawA : 0;
        case 'avg': return (rawA + rawB) / 2;
        case 'sum': return rawA + rawB;
        case 'win_a': return rawA > rawB ? rawA - rawB : 0;
        case 'win_b': return rawB > rawA ? rawB - rawA : 0;
        case 'variance': return Math.abs(rawA - rawB);
        case 'index_100': return rawA ? (rawB / rawA) * 100 : 0;
        default: return 0;
    }
  };

  const getStepTooltip = (step, mathName) => {
      if (step === 1) return `Aplica o cálculo de "${mathName}" confrontando diretamente os valores de A e B. Responde: "Quem ganhou localmente?" ou "Qual a diferença exata neste ponto?".`;
      if (step === 2) return `Aplica o cálculo de "${mathName}" confrontando o valor local de A com o TOTAL de A. Responde: "Qual o impacto ou peso que este item tem dentro do painel A?".`;
      if (step === 3) return `Aplica o cálculo de "${mathName}" confrontando o valor local de B com o TOTAL de B. Responde: "Qual o impacto ou peso que este item tem dentro do painel B?".`;
      if (step === 4) return `Soma as partes (A+B) e aplica o cálculo de "${mathName}" contra a soma macro (Total A + Total B). Responde: "Qual a contribuição global real desta métrica no negócio?".`;
      return '';
  };

  const getInsightMatrix = (d) => {
    if (!chart.isComparison) return null;
    const method = chart.compMethod, format = chart.format;
    const aliasA = activeYCols[0], aliasB = activeYCols[activeYCols.length - 1];
    const nameA = chart.panelTitles?.[aliasA] ? chart.panelTitles[aliasA] : `Painel ${aliasA}`;
    const nameB = chart.panelTitles?.[aliasB] ? chart.panelTitles[aliasB] : `Painel ${aliasB}`;
    
    const valA = safeExtractVal(d[aliasA], method), valB = safeExtractVal(d[aliasB], method);
    const totalA = safeExtractVal(totals[aliasA], method), totalB = safeExtractVal(totals[aliasB], method);
    const formatA = chart.panelConfigs?.[aliasA]?.format || 'currency', formatB = chart.panelConfigs?.[aliasB]?.format || 'currency';

    const applyMath = (v1, v2, m) => {
        if(m === 'growth') return v1 ? ((v2 - v1) / Math.abs(v1)) * 100 : 0;
        if(m === 'gap') return v2 - v1;
        if(m === 'ratio' || m === 'ratio_div') return v1 ? v2 / v1 : 0;
        if(m === 'share') return v2 ? (v1 / v2) * 100 : 0; 
        if(m === 'index_100') return v1 ? (v2 / v1) * 100 : 0;
        if(m === 'sum') return v1 + v2;
        if(m === 'avg') return (v1 + v2) / 2;
        if(m === 'win_b') return v2 > v1 ? v2 - v1 : 0;
        if(m === 'win_a') return v1 > v2 ? v1 - v2 : 0;
        if(m === 'variance') return Math.abs(v1 - v2);
        return v1 + v2;
    };

    let resStep1 = applyMath(valA, valB, method);
    let resStep2 = applyMath(valA, totalA, method);
    let resStep3 = applyMath(valB, totalB, method);
    let resStep4 = applyMath(valA + valB, totalA + totalB, method);

    if (method === 'ticket_medio') {
        resStep1 = d.res || getGlobalRes(); 
        resStep4 = getGlobalRes();
    }

    const dimName = d.name && d.name !== 'N/A' && d !== totals ? d.name : 'Visão: MACRO / GLOBAL';
    const mathName = COMP_METHODS[method]?.name || 'Cálculo';

    const renderBlock = (title, v1Name, v1Val, v2Name, v2Val, result, fmat, tooltipText) => (
        <div 
           className="bg-slate-900/80 p-4 rounded-2xl border border-indigo-500/20 space-y-2 relative overflow-hidden shadow-inner cursor-help hover:border-indigo-400/60 hover:bg-slate-800/90 transition-all duration-300"
           onMouseMove={(e) => {
               let x = e.clientX - 150;
               let y = e.clientY + 20;
               if (x + 320 > window.innerWidth) x = window.innerWidth - 320;
               if (x < 10) x = 10;
               if (y + 150 > window.innerHeight) y = e.clientY - 160;
               setInsightTooltip({ text: tooltipText, x, y });
           }}
           onMouseLeave={() => setInsightTooltip(null)}
        >
            <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500/50"></div>
            <div className="text-[10px] uppercase font-black text-indigo-300 tracking-widest pl-2 mb-3">{title}</div>
            <div className="flex justify-between items-center text-[13px] text-slate-300 pl-2"><span>{v1Name}:</span> <span className="font-mono bg-white/5 px-2 py-0.5 rounded">{v1Val}</span></div>
            <div className="flex justify-between items-center text-[13px] text-slate-300 pl-2 border-b border-white/10 pb-3"><span>{v2Name}:</span> <span className="font-mono bg-white/5 px-2 py-0.5 rounded">{v2Val}</span></div>
            <div className="flex justify-between items-center text-sm font-black pl-2 pt-2">
                <span className="text-slate-400">RESULTADO:</span> 
                <span className="font-mono text-[16px] text-white bg-indigo-500/20 px-3 py-1 rounded-lg border border-indigo-500/30">
                    {getResultPrefix(result, method)}{formatCustomValue(result, 'sum', fmat)}
                </span>
            </div>
        </div>
    );

    return (
        <div className="w-full flex flex-col gap-6 animate-fade-in-up">
            <div className="bg-indigo-900/30 border border-indigo-500/30 p-5 rounded-2xl shadow-[0_0_20px_rgba(99,102,241,0.1)] flex items-start gap-4">
                <div className="bg-indigo-500/20 p-3 rounded-xl"><Calculator size={24} className="text-indigo-400"/></div>
                <div>
                   <h4 className="text-white font-black text-lg uppercase tracking-wider mb-1">{mathName}</h4>
                   <p className="text-indigo-200 text-sm font-medium leading-relaxed">Cálculo matemático exigido para a dimensão <strong className="text-white bg-white/10 px-2 py-0.5 rounded">{dimName}</strong>.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {renderBlock("Etapa 1: A vs B (Local)", nameA, formatCustomValue(valA, 'sum', formatA), nameB, formatCustomValue(valB, 'sum', formatB), resStep1, format, getStepTooltip(1, mathName))}
                {renderBlock("Etapa 2: A vs Total A", nameA, formatCustomValue(valA, 'sum', formatA), "Total Geral A", formatCustomValue(totalA, 'sum', formatA), resStep2, format, getStepTooltip(2, mathName))}
                {renderBlock("Etapa 3: B vs Total B", nameB, formatCustomValue(valB, 'sum', formatB), "Total Geral B", formatCustomValue(totalB, 'sum', formatB), resStep3, format, getStepTooltip(3, mathName))}
                {renderBlock("Etapa 4: Soma vs Macro", `Soma (${dimName})`, formatCustomValue(valA+valB, 'sum', formatA), "Soma Macro (A+B)", formatCustomValue(totalA+totalB, 'sum', formatA), resStep4, format, getStepTooltip(4, mathName))}
            </div>
        </div>
    );
  };

  const renderStandardInsight = (d) => {
     if (chart.isComparison) return null;
     const primaryMetric = activeYCols[0], fmat = chart.format || 'currency';
     const targetData = d || totals;
     const isGlobal = targetData === totals;
     const isBreakdown = !!chart.breakdown && !chart.isFormula && !chart.isComparison;
     
     return (
        <div className="w-full flex flex-col gap-6 animate-fade-in-up">
            <div className="bg-emerald-900/30 border border-emerald-500/30 p-5 rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.1)] flex items-start gap-4">
                <div className="bg-emerald-500/20 p-3 rounded-xl"><BarChart size={24} className="text-emerald-400"/></div>
                <div>
                   <h4 className="text-white font-black text-lg uppercase tracking-wider mb-1">{isGlobal ? 'Resumo Global' : targetData.name}</h4>
                   <p className="text-emerald-200 text-sm font-medium leading-relaxed">Análise de distribuição para o eixo Y <strong className="text-white bg-white/10 px-2 py-0.5 rounded">{primaryMetric}</strong>.</p>
                </div>
            </div>

            <div className="flex flex-col gap-4">
                {activeYCols.map((yName, i) => {
                    const val = safeExtractVal(targetData[yName], 'sum');
                    const color = COLOR_MAP[THEME_COLORS[i % THEME_COLORS.length]].hex;
                    return (
                        <div key={yName} className="bg-slate-900/80 p-5 rounded-2xl border border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-4 h-4 rounded-full shadow-[0_0_10px_currentColor]" style={{ backgroundColor: color, color: color }}/>
                                <span className="text-slate-300 font-bold uppercase tracking-wider text-sm">{yName}</span>
                            </div>
                            <span className="text-white font-mono font-black text-xl">{formatCustomValue(val, chart.agg, fmat)}</span>
                        </div>
                    )
                })}
            </div>

            {isGlobal && data.length > 0 && (
                <div className="mt-4 bg-slate-900 border border-white/5 rounded-2xl p-5">
                    <h5 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-4">Top 3 Contribuintes</h5>
                    <div className="space-y-3">
                        {data.slice(0, 3).map((item, idx) => {
                            const itemVal = isBreakdown ? (item._total || 0) : safeExtractVal(item[primaryMetric], 'sum');
                            return (
                                <div key={idx} className="flex justify-between items-center text-sm">
                                    <div className="flex items-center gap-3"><span className="text-slate-500 font-black">#{idx+1}</span><span className="text-white font-bold truncate max-w-[150px]">{item.name}</span></div>
                                    <span className="text-emerald-400 font-mono font-bold">{formatCustomValue(itemVal, chart.agg, fmat)}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
     );
  };

  const toggleNode = (path) => setExpandedNodes(prev => ({ ...prev, [path]: !prev[path] }));

  const renderTree = (nodes, parentPath = "") => nodes.map((node) => {
      const currentPath = parentPath ? `${parentPath}|${node.name}` : node.name;
      const hasChildren = node.children && node.children.length > 0;
      const isExpanded = !!expandedNodes[currentPath];
      const activePanels = chart.panels ? chart.panels.filter(p => p.chartId) : [];
      return (
        <div key={currentPath} className="w-full flex flex-col" onMouseEnter={() => !hasChildren && setHoveredData(node)} onMouseLeave={() => !hasChildren && setHoveredData(null)}>
          <div onClick={() => hasChildren && toggleNode(currentPath)} className={`flex flex-wrap justify-between items-center p-5 rounded-2xl bg-slate-900/80 border transition-all shadow-lg ${hasChildren ? 'cursor-pointer hover:bg-slate-800/90 hover:border-indigo-500/50' : 'hover:bg-slate-800/60'} ${node.level > 0 ? 'mt-3 border-white/5' : 'mt-5 border-indigo-500/30 shadow-[0_0_20px_rgba(99,102,241,0.1)]'}`} style={{ marginLeft: `${node.level * 32}px` }}>
             <div className="flex items-center gap-4">
                 {node.level === 0 && <Layers className="text-indigo-400" size={20}/>}
                 {node.level === 1 && <ChevronRight className="text-emerald-400" size={20}/>}
                 {node.level === 2 && <Waypoints className="text-teal-400" size={18}/>}
                 <span className={`font-black uppercase tracking-wider ${node.level === 0 ? 'text-white text-lg' : 'text-slate-300 text-sm'}`}>{node.name}</span>
                 {hasChildren && <div className={`ml-3 p-1.5 rounded-full bg-white/5 transition-transform duration-300 ${isExpanded ? 'rotate-90 bg-indigo-500/20 text-indigo-400' : 'text-slate-400'}`}><ChevronRight size={16} /></div>}
             </div>
             <div className="flex items-center gap-8 overflow-x-auto custom-scrollbar">
                 {activePanels.map(p => <div key={p.alias} className="flex flex-col items-end shrink-0"><span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1.5">{chart.panelTitles?.[p.alias] || p.alias}</span><span className="font-mono text-sm text-slate-200">{formatCustomValue(safeExtractVal(node[p.alias], chart.compMethod), chart.panelConfigs?.[p.alias]?.agg, chart.panelConfigs?.[p.alias]?.format)}</span></div>)}
                 <div className={`min-w-[140px] px-4 py-3 rounded-xl text-sm font-black shadow-xl flex flex-col items-center justify-center border ${node.res >= 0 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'}`}>
                     <span className="text-[9px] opacity-70 uppercase tracking-widest mb-1">{(chart.compMethod === 'custom' || chart.compMethod === 'step_formula') ? 'Fórmula/Resultado' : (COMP_METHODS[chart.compMethod]?.name.split(' ')[1] || 'Resultado')}</span>
                     <span>{getResultPrefix(node.res, chart.compMethod)}{formatCustomValue(node.res, 'sum', chart.format)}</span>
                 </div>
             </div>
          </div>
          {hasChildren && isExpanded && <div className="flex flex-col border-l-2 border-white/5 ml-8 relative animate-fade-in-up" style={{ animationDuration: '0.3s' }}>{renderTree(node.children, currentPath)}</div>}
        </div>
      );
  });

  const renderChartGraphic = () => {
    if (chart.isComparison && isHierarchy) {
        if (data.length === 0) return <div className="w-full h-full flex items-center justify-center text-slate-500 font-bold uppercase tracking-widest">Sem dados para cruzar</div>;
        return <div className="w-full h-full overflow-y-auto custom-scrollbar pr-4 flex flex-col gap-3">{renderTree(data)}</div>;
    }

    const barWidth = activeYCols.length > 4 ? 'w-8' : 'w-16';
    if (chart.type === 'bar') {
        return (
            <div className="w-full h-full flex items-end justify-start gap-12 overflow-x-auto custom-scrollbar pb-6 px-4">
              {data.map((d,idx) => (
                <div key={idx} className="relative h-full flex flex-col justify-end items-center group shrink-0 min-w-[120px] cursor-pointer" onMouseEnter={() => setHoveredData(d)} onMouseLeave={() => setHoveredData(null)}>
                   <div className="flex-1 flex items-end justify-center gap-3 w-full relative">
                      {activeYCols.map((yName, i) => {
                         const val = safeExtractVal(d[yName], chart.compMethod);
                         const barH = maxVal > 0 ? (Math.abs(val)/maxVal)*100 : 0;
                         const hexColor = COLOR_MAP[THEME_COLORS[i % THEME_COLORS.length]].hex;
                         return (
                           <div key={yName} className="relative h-full flex flex-col justify-end items-center group/bar">
                             <div className="absolute -top-12 opacity-0 group-hover/bar:opacity-100 transition-all duration-300 bg-slate-900/95 border border-white/20 px-3 py-1.5 rounded-lg text-xs font-mono font-black whitespace-nowrap z-20 shadow-2xl pointer-events-none" style={{ color: hexColor }}>
                                {formatCustomValue(val, chart.agg, getColFormat(yName))}
                             </div>
                             <div className={`rounded-t-2xl transition-all duration-500 hover:opacity-100 shadow-[0_8px_30px_rgba(0,0,0,0.4)] shrink-0 ${barWidth} opacity-85 hover:scale-x-110`} style={{ height: `${Math.max(barH, 3)}%`, backgroundColor: hexColor, backgroundImage: `linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0) 100%)` }} />
                           </div>
                         );
                      })}
                   </div>
                   <div className="mt-6 w-full flex flex-col items-center border-t border-white/10 pt-4">
                      <div className="text-xs text-slate-300 text-center font-black uppercase truncate w-full" title={d.name}>{d.name}</div>
                      {chart.isComparison && (
                          <div className={`text-sm font-black mt-3 px-4 py-2 rounded-xl border shadow-lg transition-transform duration-300 group-hover:scale-110 ${d.res >= 0 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'}`}>
                              {getResultPrefix(d.res, chart.compMethod)}{formatCustomValue(d.res, 'sum', chart.format)}
                          </div>
                      )}
                   </div>
                </div>
              ))}
            </div>
        );
    }
    
    if (chart.type === 'horizontal_bar') {
        return (
            <div className="w-full h-full flex flex-col gap-8 overflow-y-auto custom-scrollbar pr-4">
              {data.map((d, idx) => (
                <div key={idx} className="w-full group relative bg-slate-900/40 p-6 rounded-3xl border border-white/5 hover:border-white/20 hover:bg-slate-900/80 transition-all cursor-pointer" onMouseEnter={() => setHoveredData(d)} onMouseLeave={() => setHoveredData(null)}>
                  <div className="text-sm font-black uppercase text-white mb-6 flex justify-between items-center border-b border-white/10 pb-3">
                     <span className="truncate">{d.name}</span>
                     {chart.isComparison && <span className={`px-4 py-1.5 rounded-xl border shadow-sm ${d.res >= 0 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'}`}>{getResultPrefix(d.res, chart.compMethod)}{formatCustomValue(d.res, 'sum', chart.format)}</span>}
                  </div>
                  <div className="flex flex-col gap-6">
                    {activeYCols.map((yName, i) => {
                      const val = safeExtractVal(d[yName], chart.compMethod), hexColor = COLOR_MAP[THEME_COLORS[i % THEME_COLORS.length]].hex;
                      return (
                      <div key={yName} className="flex items-center gap-6">
                         <div className="w-32 truncate text-xs text-slate-400 font-bold uppercase shrink-0" title={chart.isComparison ? chart.panelTitles?.[yName] : yName}>{chart.isComparison ? (chart.panelTitles?.[yName] || yName) : yName}</div>
                         <div className="flex-1 bg-black/50 rounded-full h-8 overflow-hidden border border-white/5 shadow-inner"><div className="h-full rounded-full transition-all duration-1000 relative shadow-[0_0_15px_currentColor]" style={{ width: `${maxVal > 0 ? (Math.abs(val)/maxVal)*100 : 0}%`, backgroundColor: hexColor, color: hexColor }}><div className="absolute inset-0 rounded-full" style={{ backgroundImage: `linear-gradient(to bottom, rgba(255,255,255,0.3) 0%, transparent 100%)` }}></div></div></div>
                         <span className="text-base font-mono font-black text-white w-32 text-right truncate shrink-0">{formatCustomValue(val, chart.agg, getColFormat(yName))}</span>
                       </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
        );
    }

    if (chart.type === 'pie') {
        const isBreakdown = !!chart.breakdown && !chart.isFormula && !chart.isComparison;
        const primaryMetric = activeYCols[0];
        const pieData = data.map((d, i) => ({ id: d.name, name: d.name, value: isBreakdown ? (d._total || 0) : safeExtractVal(d[primaryMetric], chart.compMethod), color: COLOR_MAP[THEME_COLORS[i % THEME_COLORS.length]].hex, raw: d })).filter(x => x.value !== 0);
        const pieTotal = pieData.reduce((sum, item) => sum + Math.abs(item.value), 0);
        return (
            <div className="w-full h-full flex flex-col items-center justify-center relative pb-10">
               <div className="relative w-96 h-96 shrink-0 group">
                  <svg viewBox="0 0 32 32" className="w-full h-full -rotate-90 drop-shadow-2xl">
                     {pieData.map((d, idx) => {
                        const pct = pieTotal ? (Math.abs(d.value) / pieTotal) * 100 : 0, off = pieData.slice(0,idx).reduce((s,x)=>s+(Math.abs(x.value)/pieTotal)*100, 0);
                        const isHovered = hoveredData?.name === d.name;
                        return <circle key={d.id} cx="16" cy="16" r="14" fill="none" stroke={d.color} strokeWidth="4" strokeDasharray={`${pct} ${100-pct}`} strokeDashoffset={100-off+25} className={`transition-all duration-300 ease-out cursor-pointer ${isHovered ? 'stroke-[6] drop-shadow-[0_0_15px_rgba(255,255,255,0.6)] z-50' : 'hover:stroke-[5] opacity-90'}`} onMouseEnter={() => setHoveredData(d.raw)} onMouseLeave={() => setHoveredData(null)} />
                     })}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white pointer-events-none">
                    <div className="font-black text-4xl px-2 truncate w-full text-center tracking-tight text-shadow-lg">{formatCustomValue(pieTotal, chart.agg, getColFormat(primaryMetric))}</div>
                    <div className="text-xs text-slate-400 font-black uppercase tracking-[0.2em] mt-2">Total Global</div>
                  </div>
               </div>
            </div>
        );
    }

    // Line / Area
    return (
        <div className="w-full h-full flex flex-col justify-end relative pb-10 px-8">
            <svg viewBox="0 0 1000 400" className="w-full h-full overflow-visible">
                {activeYCols.map((yName, i) => {
                const points = data.map((d, idx) => `${(idx / Math.max(data.length - 1, 1)) * 1000},${maxVal > 0 ? 400 - ((Math.abs(safeExtractVal(d[yName], chart.compMethod)) / maxVal) * 400) : 400}`).join(' ');
                const colorHex = COLOR_MAP[THEME_COLORS[i % THEME_COLORS.length]].hex;
                return (
                    <g key={yName}>
                    {chart.type === 'area' && <polygon points={`0,400 ${points} 1000,400`} fill={colorHex} fillOpacity="0.15" />}
                    <polyline points={points} fill="none" stroke={colorHex} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_5px_10px_rgba(0,0,0,0.5)]"/>
                    {data.map((d, idx) => <circle key={idx} cx={(idx / Math.max(data.length - 1, 1)) * 1000} cy={maxVal > 0 ? 400 - ((Math.abs(safeExtractVal(d[yName], chart.compMethod)) / maxVal) * 400) : 400} r="8" fill={colorHex} className="transition-all cursor-pointer hover:stroke-white hover:stroke-[3px]" onMouseEnter={() => setHoveredData(d)} onMouseLeave={() => setHoveredData(null)} />)}
                    </g>
                )
                })}
            </svg>
            <div className="absolute bottom-0 left-8 right-8 flex justify-between pointer-events-none border-t border-white/10 pt-4">
                {data.map((d, idx) => (
                <div key={idx} className="text-[10px] text-slate-400 font-black uppercase truncate w-24 text-center -ml-12">{d.name}</div>
                ))}
            </div>
        </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0F19] text-white flex flex-col font-sans animate-fade-in-up selection:bg-indigo-500/30">
      
      {/* HEADER DA APRESENTAÇÃO */}
      <div className="h-20 bg-slate-900/50 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-8 shrink-0 shadow-lg">
         <div className="flex items-center gap-4">
            <div className="bg-indigo-500/20 p-2.5 rounded-xl border border-indigo-500/30"><Play size={20} className="text-indigo-400 fill-indigo-400/50"/></div>
            <div>
               <h1 className="text-xl font-black uppercase tracking-wider text-white">Modo Apresentação</h1>
               <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Use as setas do teclado para navegar</div>
            </div>
         </div>
         <div className="flex items-center gap-6">
            <div className="text-sm font-black bg-white/5 px-4 py-2 rounded-xl border border-white/10 shadow-inner">
               Painel <span className="text-indigo-400 mx-1">{currentSlide + 1}</span> de <span className="text-white mx-1">{customCharts.length}</span>
            </div>
            <button onClick={onClose} className="p-3 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white rounded-xl transition-all shadow-sm" title="Fechar Apresentação">
               <X size={20} />
            </button>
         </div>
      </div>

      {/* CONTEÚDO DO SLIDE */}
      <div className="flex-1 flex overflow-hidden">
         
         {/* COLUNA ESQUERDA: GRÁFICO */}
         <div className="flex-[2.5] flex flex-col p-10 overflow-hidden relative">
            <div className="mb-10 text-center relative z-10">
               <h2 className="text-4xl font-black uppercase italic tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-200 to-white drop-shadow-sm mb-3">
                  {getChartTitle(chart)}
               </h2>
               {chart.isComparison && (
                  <div className="inline-block bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-inner">
                     Matriz Analítica: {COMP_METHODS[chart.compMethod]?.name}
                  </div>
               )}
            </div>
            
            <div className="flex-1 min-h-0 w-full flex items-center justify-center relative z-10">
               {renderChartGraphic()}
            </div>

            {/* Decoração de Fundo */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
         </div>

         {/* COLUNA DIREITA: ANÁLISE / METRICA EXPLICATIVA */}
         <div className="flex-[1] bg-slate-900/60 backdrop-blur-2xl border-l border-white/5 p-8 flex flex-col overflow-y-auto custom-scrollbar shadow-[-20px_0_50px_rgba(0,0,0,0.3)] z-20">
            <div className="flex items-center gap-3 border-b border-white/10 pb-6 mb-8">
               <Layers className="text-fuchsia-400" size={24} />
               <h3 className="text-2xl font-black uppercase tracking-widest text-white">Métrica Explicativa</h3>
            </div>

            {chart.isComparison ? getInsightMatrix(hoveredData || totals) : renderStandardInsight(hoveredData)}
            
            {!hoveredData && (
               <div className="mt-auto pt-10 text-center opacity-40 flex flex-col items-center">
                  <Maximize size={24} className="mb-3"/>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 max-w-[200px] leading-relaxed">
                     Passe o rato pelas colunas do gráfico para analisar itens específicos.
                  </p>
               </div>
            )}
         </div>

      </div>

      {/* BARRA INFERIOR (NAVEGAÇÃO) */}
      <div className="h-24 bg-slate-900/80 border-t border-white/5 flex items-center justify-center gap-8 shrink-0">
         <button onClick={prevSlide} disabled={currentSlide === 0} className={`p-4 rounded-2xl flex items-center gap-3 font-black uppercase tracking-widest transition-all ${currentSlide === 0 ? 'opacity-30 cursor-not-allowed text-slate-500 bg-white/5' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)]'}`}>
            <ChevronLeft size={24} /> Painel Anterior
         </button>
         
         <div className="flex gap-2">
            {customCharts.map((_, i) => (
               <button key={i} onClick={() => setCurrentSlide(i)} className={`w-12 h-2 rounded-full transition-all ${i === currentSlide ? 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.8)]' : 'bg-white/10 hover:bg-white/30'}`} />
            ))}
         </div>

         <button onClick={nextSlide} disabled={currentSlide === customCharts.length - 1} className={`p-4 rounded-2xl flex items-center gap-3 font-black uppercase tracking-widest transition-all ${currentSlide === customCharts.length - 1 ? 'opacity-30 cursor-not-allowed text-slate-500 bg-white/5' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]'}`}>
            Próximo Painel <ChevronRight size={24} />
         </button>
      </div>

      {/* TOOLTIP FLUTUANTE DA MATRIZ EXPLICATIVA */}
      {insightTooltip && (
          <div 
              className="fixed z-[999999] pointer-events-none bg-slate-900/95 backdrop-blur-2xl border border-indigo-500/50 p-5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] w-[300px] animate-fade-in-up transition-all duration-75"
              style={{ left: insightTooltip.x, top: insightTooltip.y }}
          >
              <div className="text-indigo-400 font-black uppercase tracking-widest text-[10px] mb-2 flex items-center gap-2">
                  <Calculator size={14}/> Significado da Etapa
              </div>
              <p className="text-slate-300 text-[12px] leading-relaxed font-medium">
                  {insightTooltip.text}
              </p>
          </div>
      )}

    </div>
  );
};

export default Apresenta;