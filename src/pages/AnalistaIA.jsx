import React, { useState, useMemo } from 'react';
import { AlertTriangle, BrainCircuit, Target, TrendingUp, Package, DollarSign, PieChart, Focus, Activity, Layers, ArrowRight, Zap, ShieldAlert, BarChart3 } from 'lucide-react';

// --- UTILITÁRIOS GLOBAIS DE FORMATAÇÃO ---
const formatValue = (num, format = 'currency') => {
  if (num === null || num === undefined || isNaN(num)) return '-';
  if (format === 'percent') return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(num) + '%';
  if (format === 'number') return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(num);
  if (format === 'integer') return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(Math.round(num));
  return new Intl.NumberFormat('pt-BR', { notation: "compact", maximumFractionDigits: 2, style: 'currency', currency: 'BRL' }).format(num);
};

const COLOR_PALETTE = ['#818cf8', '#34d399', '#a855f7', '#fbbf24', '#f43f5e', '#22d3ee', '#fb923c'];

// --- MOTOR MATEMÁTICO TURBO ---
const stats = {
  mean: (arr) => arr.reduce((a, b) => a + b, 0) / (arr.length || 1),
  stdDev: (arr, m) => Math.sqrt(arr.reduce((sq, n) => sq + Math.pow(n - m, 2), 0) / (arr.length > 1 ? arr.length - 1 : 1)),
  pearson: (x, y) => {
    let n = x.length, sX = x.reduce((a, b) => a + b, 0), sY = y.reduce((a, b) => a + b, 0);
    let sXY = x.reduce((a, v, i) => a + v * y[i], 0), sX2 = x.reduce((a, v) => a + v * v, 0), sY2 = y.reduce((a, v) => a + v * v, 0);
    let num = (n * sXY) - (sX * sY), den = Math.sqrt(((n * sX2) - (sX * sX)) * ((n * sY2) - (sY * sY)));
    return den === 0 ? 0 : num / den;
  },
  zScore: (val, mean, sd) => sd === 0 ? 0 : (val - mean) / sd,
  rSquared: (pearson) => pearson * pearson,
  linearRegression: (x, y) => {
    const n = x.length;
    if (n < 2) return { slope: 0, intercept: 0 };
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((a, v, i) => a + v * y[i], 0);
    const sumX2 = x.reduce((a, v) => a + v * v, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) || 0;
    const intercept = (sumY - slope * sumX) / n || 0;
    return { slope, intercept };
  }
};

// --- O CÉREBRO SÊNIOR TURBO ---
const useSeniorAnalyst = (result) => {
  return useMemo(() => {
    if (!result || !result.processedFiles || result.processedFiles.length === 0) return null;

    const file = result.processedFiles[0];
    const data = file.data || [];
    const rawHeaders = file.cleanHeaders || [];

    const detectAll = (regex) => rawHeaders.filter(h => regex.test(h));
    const fields = {
      financeiro: detectAll(/valor|venda|faturamento|receita|total|preço|lucro|custo|r\$/i),
      estoque: detectAll(/estoque|qtd|quantidade|saldo|volume|peso/i),
      entidade: detectAll(/cliente|vendedor|loja|filial|região/i),
      produto: detectAll(/produto|item|sku|categoria/i),
      tempo: detectAll(/data|mês|ano|dia|periodo/i)
    };

    const mainFinance = fields.financeiro[0] || null;
    const mainStock = fields.estoque[0] || null;
    const mainEntity = fields.entidade[0] || file.entityHeader;
    const mainProduct = fields.produto[0] || file.productHeader;

    let totalFaturamento = 0, totalEstoque = 0, linhasValidas = 0, nullCount = 0;
    const entityStats = {}, productStats = {}, scatterPoints = [];
    const financeArray = [], stockArray = [];

    data.forEach(row => {
      const orig = row._original_row || row;
      const fat = mainFinance ? (parseFloat(orig[mainFinance]) || 0) : 0;
      const est = mainStock ? (parseFloat(orig[mainStock]) || 0) : 0;
      const ent = orig[mainEntity] ? String(orig[mainEntity]).trim() : 'Desconhecido';
      const prod = orig[mainProduct] ? String(orig[mainProduct]).trim() : 'Desconhecido';

      if (fat === 0 && est === 0 && (!orig[mainEntity] || !orig[mainProduct])) nullCount++;
      if (fat !== 0 || est !== 0) linhasValidas++;
      
      totalFaturamento += fat;
      totalEstoque += est;

      if (!entityStats[ent]) entityStats[ent] = { fat: 0, est: 0, count: 0 };
      entityStats[ent].fat += fat; entityStats[ent].est += est; entityStats[ent].count++;

      if (!productStats[prod]) productStats[prod] = { fat: 0, est: 0, count: 0 };
      productStats[prod].fat += fat; productStats[prod].est += est; productStats[prod].count++;

      if (mainFinance && mainStock && (fat !== 0 || est !== 0)) {
        scatterPoints.push({ name: prod, entity: ent, x: est, y: fat });
        financeArray.push(fat); stockArray.push(est);
      }
    });

    const dataQualityScore = 100 - ((nullCount / (data.length || 1)) * 100);

    const sortedEntities = Object.entries(entityStats).map(([name, vals]) => ({ name, ...vals })).sort((a, b) => b.fat - a.fat);
    let acumulado = 0, paretoIndex = 0;
    sortedEntities.forEach((e, i) => {
      acumulado += e.fat;
      if (acumulado / totalFaturamento <= 0.8 && paretoIndex === 0) paretoIndex = i + 1;
    });
    const paretoPercentEntities = sortedEntities.length > 0 ? ((paretoIndex / sortedEntities.length) * 100) : 0;

    const allEntFats = sortedEntities.map(e => e.fat);
    const entMean = stats.mean(allEntFats);
    const entStdDev = stats.stdDev(allEntFats, entMean);
    const anomalies = sortedEntities.filter(e => Math.abs(stats.zScore(e.fat, entMean, entStdDev)) > 2.0);

    const pearsonScore = financeArray.length > 1 ? stats.pearson(stockArray, financeArray) : 0;
    const regression = (mainFinance && mainStock && financeArray.length > 1) 
      ? stats.linearRegression(stockArray, financeArray) 
      : { slope: 0, intercept: 0 };
    const rSquared = stats.rSquared(pearsonScore);

    let diagnostico = "";
    if (mainFinance) {
      diagnostico += `Auditamos a métrica "${mainFinance}" resultando em ${formatValue(totalFaturamento)}. `;
      if (paretoPercentEntities > 0) {
        diagnostico += `Identificamos uma curva ABC onde ${formatValue(paretoPercentEntities, 'percent')} de "${mainEntity}" representam 80% do resultado. `;
        diagnostico += paretoPercentEntities <= 20 ? `ALERTA DE RISCO: Elevada concentração de receita. ` : `Carteira pulverizada: risco de evasão diluído e saudável. `;
      }
      if (anomalies.length > 0) {
        diagnostico += `A análise de Desvio Padrão (Z-Score > 2) isolou ${anomalies.length} entidade(s) com comportamento anómalo extremo. `;
      }
    }

    if (mainStock && mainFinance) {
      let correlInfo = Math.abs(pearsonScore) > 0.7 ? "Forte" : Math.abs(pearsonScore) > 0.4 ? "Moderada" : "Fraca/Nula";
      diagnostico += `O Coeficiente de Pearson entre "${mainStock}" e "${mainFinance}" é de ${pearsonScore.toFixed(2)} (${correlInfo}). `;
      diagnostico += `Regressão linear: slope = ${regression.slope.toFixed(2)} | R² = ${rSquared.toFixed(2)}. `;
      if (rSquared > 0.65) diagnostico += `Escala EXCELENTE e previsível! `;
      else if (rSquared > 0.3) diagnostico += `Escala moderada. `;
      else diagnostico += `Prova matemática de ineficiência: aumento de estoque NÃO gera faturamento proporcional. `;
    }

    const recomendacoes = [];
    if (paretoPercentEntities <= 20 && paretoPercentEntities > 0) recomendacoes.push("Fortaleça contratos com os Top 20% de clientes – risco sistêmico alto.");
    if (anomalies.length > 0) recomendacoes.push(`Investigue imediatamente os ${anomalies.length} outliers detectados.`);
    if (pearsonScore < 0.4) recomendacoes.push("Correlação fraca: faça análise ABC de estoque para eliminar itens mortos.");
    if (rSquared < 0.5 && mainStock && mainFinance) recomendacoes.push("R² baixo: considere segmentação por categoria ou modelos não-lineares.");
    if (dataQualityScore < 80) recomendacoes.push("Priorize limpeza de dados – alta taxa de nulos compromete toda a análise.");

    return {
      metrics: { totalFaturamento, totalEstoque, linhasValidas, paretoPercentEntities, dataQualityScore, pearsonScore, rSquared, regression, mainFinance, mainStock, mainEntity, mainProduct },
      pareto: { data: sortedEntities, top: sortedEntities.slice(0, 5) },
      scatter: { data: scatterPoints },
      anomalies: anomalies.slice(0, 10),
      treemap: { data: Object.entries(productStats).map(([name, v]) => ({ name, val: v.fat || v.est })).sort((a,b)=>b.val - a.val).slice(0, 20) },
      diagnostico,
      recomendacoes
    };
  }, [result]);
};

// --- COMPONENTES VISUAIS ---
const Card = ({ children, className = "" }) => (
  <div className={`bg-slate-900/60 backdrop-blur-2xl border border-white/5 rounded-[1.5rem] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.3)] min-w-0 flex flex-col ${className}`}>
    {children}
  </div>
);

const ScatterPlot = ({ data, xLabel, yLabel, pearson, rSquared, regression }) => {
  const [tooltip, setTooltip] = useState(null);
  if (!data || data.length === 0) return <div className="text-slate-500 italic flex-1 flex items-center justify-center">Dados insuficientes para matriz de dispersão estatística.</div>;
  
  const points = data.slice(0, 400);
  const minX = Math.min(...points.map(p => p.x), 0); 
  const maxX = Math.max(...points.map(p => p.x), 1);
  const minY = Math.min(...points.map(p => p.y), 0); 
  const maxY = Math.max(...points.map(p => p.y), 1);
  const rangeX = maxX - minX || 1; 
  const rangeY = maxY - minY || 1;

  // Linha de regressão
  let regressionLine = null;
  if (regression && regression.slope !== undefined) {
    const y1Pred = regression.intercept + regression.slope * minX;
    const y2Pred = regression.intercept + regression.slope * maxX;
    const cy1 = 98 - ((y1Pred - minY) / rangeY) * 96;
    const cy2 = 98 - ((y2Pred - minY) / rangeY) * 96;
    regressionLine = { x1: 2, y1: Math.max(0, Math.min(100, cy1)), x2: 98, y2: Math.max(0, Math.min(100, cy2)) };
  }

  const pearsonColor = pearson > 0.7 ? 'text-emerald-400' : pearson < -0.3 ? 'text-rose-400' : 'text-amber-400';
  const r2Color = rSquared > 0.7 ? 'text-emerald-400' : rSquared > 0.4 ? 'text-amber-400' : 'text-rose-400';

  return (
    <div className="flex-1 flex flex-col mt-2">
      <div className="flex justify-end mb-2 pr-2">
        <span className="text-[10px] font-black uppercase tracking-widest bg-slate-900/80 px-3 py-1 rounded-lg border border-white/5">
          Pearson (r): <span className={pearsonColor}>{pearson.toFixed(3)}</span> | 
          R²: <span className={r2Color}>{rSquared.toFixed(3)}</span>
        </span>
      </div>
      <div className="flex-1 relative mb-5 ml-8 mr-2 border-l-2 border-b-2 border-slate-700/50">
        <div className="absolute -left-10 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] font-black tracking-widest text-slate-500 uppercase truncate w-max max-w-[200px]">{yLabel}</div>
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-black tracking-widest text-slate-500 uppercase truncate w-max max-w-[250px]">{xLabel} (Volume)</div>

        <div className="absolute top-0 left-0 w-1/2 h-1/2 border-r border-b border-dashed border-white/10 flex items-center justify-center pointer-events-none"><span className="text-[10px] font-black uppercase text-amber-500/20 tracking-widest text-center">Alto Valor<br/>Baixo Vol</span></div>
        <div className="absolute top-0 right-0 w-1/2 h-1/2 border-b border-dashed border-white/10 flex items-center justify-center pointer-events-none"><span className="text-[10px] font-black uppercase text-emerald-500/20 tracking-widest text-center">Eficiência Máxima<br/>(Outliers de Elite)</span></div>
        <div className="absolute bottom-0 right-0 w-1/2 h-1/2 border-l border-dashed border-white/10 flex items-center justify-center pointer-events-none"><span className="text-[10px] font-black uppercase text-blue-500/20 tracking-widest text-center">Giro Rápido<br/>(Margem Baixa)</span></div>

        <div className="absolute inset-0 overflow-visible">
          <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible" preserveAspectRatio="none">
            {regressionLine && (
              <line x1={regressionLine.x1} y1={regressionLine.y1} x2={regressionLine.x2} y2={regressionLine.y2}
                stroke="#67e8f9" strokeWidth="1.8" strokeDasharray="4 2" opacity="0.9" />
            )}
            {points.map((p, i) => {
              const cx = 2 + ((p.x - minX) / rangeX) * 96;
              const cy = 98 - ((p.y - minY) / rangeY) * 96;
              const isStar = cx > 50 && cy < 50;
              return (
                <circle key={i} cx={cx} cy={cy} r="1.5" 
                  className={`transition-all duration-300 cursor-crosshair hover:r-[4px] hover:stroke-white hover:stroke-[0.5px] ${isStar ? 'fill-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.9)]' : 'fill-indigo-500/60'}`}
                  onMouseMove={(e) => {
                    let x = e.clientX + 15, y = e.clientY + 15;
                    if (x + 240 > window.innerWidth) x = e.clientX - 255;
                    if (y + 140 > window.innerHeight) y = e.clientY - 155;
                    setTooltip({ x, y, data: p });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              )
            })}
          </svg>
        </div>
      </div>

      {tooltip && (
        <div className="fixed z-[9999] pointer-events-none bg-slate-900/95 backdrop-blur-xl border border-indigo-500/50 p-4 rounded-xl shadow-[0_30px_60px_rgba(0,0,0,0.8)] min-w-[200px] animate-fade-in-up"
             style={{ left: tooltip.x, top: tooltip.y }}>
          <div className="text-[10px] font-black uppercase text-emerald-400 tracking-widest mb-1.5 flex items-center gap-1.5"><Target size={12}/> Nó Vectorial</div>
          <div className="text-white font-bold text-sm truncate border-b border-white/10 pb-2 mb-2">{tooltip.data.name}</div>
          <div className="flex justify-between text-xs text-slate-300 mb-1.5"><span>{xLabel}:</span> <span className="font-mono font-bold text-white">{formatValue(tooltip.data.x, 'integer')}</span></div>
          <div className="flex justify-between text-xs text-slate-300"><span>{yLabel}:</span> <span className="font-mono text-indigo-400 font-black text-sm">{formatValue(tooltip.data.y, 'currency')}</span></div>
        </div>
      )}
    </div>
  );
};

const TreemapPlot = ({ data }) => {
  const [tooltip, setTooltip] = useState(null);
  if (!data || data.length === 0) return null;
  const total = data.reduce((s, i) => s + i.val, 0);

  return (
    <div className="w-full flex-1 flex flex-wrap gap-1 mt-5 relative">
      {data.map((item, i) => {
        const pct = total ? (item.val / total) * 100 : 0;
        const color = COLOR_PALETTE[i % COLOR_PALETTE.length];
        if (pct < 0.5) return null; 
        return (
          <div key={i} 
               className="relative group overflow-hidden rounded-xl border shadow-sm transition-all hover:scale-[1.02] hover:z-10 hover:shadow-2xl flex flex-col justify-between p-3 cursor-crosshair"
               style={{ width: `calc(${Math.max(pct, 12)}% - 4px)`, backgroundColor: `${color}20`, borderColor: `${color}40`, flexGrow: pct }}
               onMouseMove={(e) => {
                   let x = e.clientX + 15, y = e.clientY + 15;
                   if (x + 250 > window.innerWidth) x = e.clientX - 260;
                   if (y + 130 > window.innerHeight) y = e.clientY - 140;
                   setTooltip({ x, y, data: item, pct, color });
               }}
               onMouseLeave={() => setTooltip(null)}
           >
            <div className="text-white font-black text-[11px] uppercase truncate transition-all">{item.name}</div>
            <div className="text-left mt-auto pt-4">
               <div className="text-[10px] font-black tracking-widest opacity-80 uppercase mb-0.5" style={{ color }}>{pct.toFixed(1)}%</div>
               <div className="font-mono text-base font-black text-white leading-none truncate">{formatValue(item.val, 'compact')}</div>
            </div>
          </div>
        )
      })}

      {tooltip && (
        <div className="fixed z-[9999] pointer-events-none bg-slate-900/95 backdrop-blur-xl border p-4 rounded-xl shadow-[0_30px_60px_rgba(0,0,0,0.8)] min-w-[200px] animate-fade-in-up"
             style={{ left: tooltip.x, top: tooltip.y, borderColor: `${tooltip.color}50` }}>
          <div className="text-[10px] font-black uppercase tracking-widest mb-1.5 flex items-center gap-1.5" style={{ color: tooltip.color }}><PieChart size={12}/> Fragmento</div>
          <div className="text-white font-bold text-sm border-b border-white/10 pb-2 mb-2 whitespace-normal break-words">{tooltip.data.name}</div>
          <div className="flex justify-between text-xs text-slate-300 mb-1.5"><span>Share:</span> <span className="font-mono font-bold text-white">{tooltip.pct.toFixed(1)}%</span></div>
          <div className="flex justify-between text-xs text-slate-300"><span>Volume Absoluto:</span> <span className="font-mono font-black text-sm" style={{ color: tooltip.color }}>{formatValue(tooltip.data.val, 'currency')}</span></div>
        </div>
      )}
    </div>
  );
};

// --- COMPONENTE PRINCIPAL ---
const AnalistaIA = ({ result, handleAction }) => {
  const analysis = useSeniorAnalyst(result);

  if (!analysis) {
    return (
      <div className="flex flex-col items-center justify-center py-32 opacity-40 animate-fade-in-up w-full">
        <BrainCircuit size={80} className="mb-6 text-indigo-400 animate-pulse"/>
        <h2 className="text-3xl font-black italic uppercase tracking-widest text-white">Motor de Inferência Turbo Ativo</h2>
        <p className="text-lg mt-2">Aguardando injeção de dados para regressão linear + R²...</p>
      </div>
    );
  }

  const { metrics, pareto, scatter, anomalies, treemap, diagnostico, recomendacoes } = analysis;

  return (
    <div className="w-full flex flex-col gap-6 animate-fade-in-up pb-20">
      
      {/* PARECER EXECUTIVO + HEALTH SCORE */}
      <div className="w-full flex flex-row flex-nowrap gap-6">
        <div className="w-9/12 flex flex-col justify-center bg-gradient-to-r from-indigo-900/60 to-slate-900/60 p-8 rounded-[2rem] border border-indigo-500/30 shadow-[0_20px_50px_rgba(0,0,0,0.4)] relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="relative z-10 w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-indigo-500 p-2.5 rounded-xl shadow-[0_0_20px_rgba(99,102,241,0.6)]"><BrainCircuit size={20} className="text-white"/></div>
              <span className="text-indigo-400 font-black uppercase tracking-[0.3em] text-[11px]">Brain.IA — Parecer Algorítmico C-Level</span>
            </div>
            <p className="text-[17px] font-medium leading-relaxed text-slate-200 border-l-4 border-indigo-500 pl-6 py-2">
              {diagnostico}
            </p>
          </div>
        </div>

        <Card className="w-3/12 shrink-0 bg-slate-900/80 border-slate-700 justify-center items-center text-center">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 flex items-center gap-2 justify-center"><ShieldAlert size={14}/> Qualidade do Dataset</div>
          <div className="relative w-32 h-32 flex items-center justify-center mb-2 mx-auto">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="16" fill="none" className="stroke-slate-800" strokeWidth="3"></circle>
              <circle cx="18" cy="18" r="16" fill="none" className={`transition-all duration-1000 ease-out ${metrics.dataQualityScore > 90 ? 'stroke-emerald-400' : metrics.dataQualityScore > 70 ? 'stroke-amber-400' : 'stroke-rose-500'}`} strokeWidth="3" strokeDasharray={`${metrics.dataQualityScore} 100`} strokeDashoffset="0" strokeLinecap="round"></circle>
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-3xl font-black font-mono text-white">{metrics.dataQualityScore.toFixed(0)}%</span>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-2">Health Score Baseado<br/>em Células Nulas/Lixo</div>
        </Card>
      </div>

      {/* MACRO KPIS (agora com 5 cards) */}
      <div className="w-full flex flex-row flex-nowrap gap-6 overflow-x-auto pb-2">
        {metrics.mainFinance && (
          <Card className="flex-1 bg-indigo-950/20 border-indigo-500/20">
            <div className="flex justify-between items-start mb-4"><div className="p-3 rounded-xl bg-indigo-500/20"><DollarSign className="text-indigo-400" size={20}/></div><span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Fluxo Bruto</span></div>
            <div className="text-3xl font-black text-white font-mono tracking-tight truncate">{formatValue(metrics.totalFaturamento, 'compact')}</div>
            <div className="text-[10px] font-bold text-indigo-400 mt-2 uppercase tracking-wider truncate">{metrics.mainFinance}</div>
          </Card>
        )}
        {metrics.paretoPercentEntities > 0 && (
          <Card className="flex-1 bg-amber-950/20 border-amber-500/20">
            <div className="flex justify-between items-start mb-4"><div className="p-3 rounded-xl bg-amber-500/20"><Focus className="text-amber-400" size={20}/></div><span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Risco Pareto</span></div>
            <div className="text-3xl font-black text-white font-mono tracking-tight truncate">{metrics.paretoPercentEntities.toFixed(1)}%</div>
            <div className="text-[10px] font-bold text-amber-400 mt-2 uppercase tracking-wider truncate">Foco Analítico: {metrics.mainEntity}s</div>
          </Card>
        )}
        {metrics.mainStock && (
          <Card className="flex-1 bg-emerald-950/20 border-emerald-500/20">
            <div className="flex justify-between items-start mb-4"><div className="p-3 rounded-xl bg-emerald-500/20"><Package className="text-emerald-400" size={20}/></div><span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Volume Total</span></div>
            <div className="text-3xl font-black text-white font-mono tracking-tight truncate">{formatValue(metrics.totalEstoque, 'compact')}</div>
            <div className="text-[10px] font-bold text-emerald-400 mt-2 uppercase tracking-wider truncate">{metrics.mainStock} Base</div>
          </Card>
        )}
        <Card className="flex-1 bg-fuchsia-950/20 border-fuchsia-500/20">
          <div className="flex justify-between items-start mb-4"><div className="p-3 rounded-xl bg-fuchsia-500/20"><Activity className="text-fuchsia-400" size={20}/></div><span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Linhas Processadas</span></div>
          <div className="text-3xl font-black text-white font-mono tracking-tight truncate">{formatValue(metrics.linhasValidas, 'compact')}</div>
          <div className="text-[10px] font-bold text-fuchsia-400 mt-2 uppercase tracking-wider truncate">Tamanho da Amostra</div>
        </Card>

        {/* NOVO KPI TURBO */}
        {metrics.mainStock && metrics.mainFinance && (
          <Card className="flex-1 bg-cyan-950/20 border-cyan-500/20">
            <div className="flex justify-between items-start mb-4"><div className="p-3 rounded-xl bg-cyan-500/20"><BarChart3 className="text-cyan-400" size={20}/></div><span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Eficiência de Escala</span></div>
            <div className="text-3xl font-black text-white font-mono tracking-tight">{metrics.rSquared.toFixed(2)}</div>
            <div className="text-[10px] font-bold text-cyan-400 mt-2 uppercase tracking-wider">R² (Regressão Linear)</div>
          </Card>
        )}
      </div>

      {/* DISPERSÃO + ANOMALIAS */}
      <div className="w-full flex flex-row flex-nowrap gap-6 h-[450px]">
        {metrics.mainFinance && metrics.mainStock && (
          <Card className="w-7/12 flex flex-col shrink-0">
            <div className="flex items-center gap-4 mb-3 border-b border-white/5 pb-4 shrink-0">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center"><TrendingUp size={18} className="text-blue-400"/></div>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-black uppercase tracking-widest text-white truncate">Estatística de Dispersão + Regressão Linear</h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5 truncate">Volume Físico vs Retorno de Valor • Linha de tendência em ciano</p>
              </div>
            </div>
            <ScatterPlot data={scatter.data} xLabel={metrics.mainStock} yLabel={metrics.mainFinance} pearson={metrics.pearsonScore} rSquared={metrics.rSquared} regression={metrics.regression} />
          </Card>
        )}

        {/* PAINEL DE ANOMALIAS (mantido exatamente como original) */}
        <Card className={`${metrics.mainFinance && metrics.mainStock ? 'w-5/12' : 'w-full'} flex flex-col shrink-0 border-rose-500/20 bg-rose-950/10`}>
          <div className="flex flex-row flex-nowrap items-center justify-between mb-4 border-b border-rose-500/10 pb-4 shrink-0">
            <div className="flex items-center gap-3 min-w-0 pr-4">
              <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center shrink-0"><Zap size={18} className="text-rose-400 fill-rose-400/20"/></div>
              <div className="min-w-0">
                <h3 className="text-lg font-black uppercase tracking-widest text-rose-300 truncate">Alerta Z-Score</h3>
                <p className="text-xs text-rose-400/60 font-medium mt-0.5 truncate">Detetados {anomalies.length} desvios de padrão (Outliers).</p>
              </div>
            </div>
          </div>
          {anomalies.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center opacity-50">
              <ShieldAlert size={40} className="text-emerald-500 mb-3"/>
              <span className="text-sm font-black uppercase tracking-widest text-emerald-400">Sem Anomalias Detetadas</span>
              <span className="text-xs text-slate-400 mt-1">Todos os registos encontram-se dentro do desvio padrão seguro.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-4 flex-1 overflow-y-auto custom-scrollbar pr-2 mt-2">
              {anomalies.map((item, i) => (
                <div key={i} className="bg-black/40 border border-rose-500/20 rounded-xl p-3 flex justify-between items-center group hover:border-rose-500/50 transition-colors">
                  <div className="min-w-0 flex-1 pr-4">
                    <div className="text-xs font-bold text-white uppercase tracking-wider truncate mb-1">{item.name}</div>
                    <div className="text-[10px] text-rose-400 font-mono">Outlier (Absurdo Estatístico)</div>
                  </div>
                  <div className="font-mono text-base font-black text-rose-300 shrink-0">{formatValue(item.fat, 'compact')}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* CURVA ABC + TREEMAP */}
      <div className="w-full flex flex-row flex-nowrap gap-6 h-[480px]">
        {pareto.top.length > 0 && (
          <Card className="w-6/12 flex flex-col shrink-0">
            <div className="flex flex-row flex-nowrap items-center justify-between mb-3 border-b border-white/5 pb-4 shrink-0">
              <div className="flex items-center gap-3 min-w-0 pr-4">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0"><Layers size={18} className="text-amber-400"/></div>
                <div className="min-w-0">
                  <h3 className="text-lg font-black uppercase tracking-widest text-white truncate">Olimpo de Resultados (ABC)</h3>
                  <p className="text-xs text-slate-400 font-medium mt-0.5 truncate">Base de dominância: {metrics.mainEntity}.</p>
                </div>
              </div>
              <button onClick={() => handleAction({type: 'push', col: metrics.mainEntity, val: pareto.top[0].name})} className="text-[10px] shrink-0 font-black bg-white/5 px-3 py-2 rounded-xl uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-2 border border-white/10">Isolar Top 1 <ArrowRight size={12}/></button>
            </div>
            <div className="flex flex-col gap-5 flex-1 justify-center overflow-y-auto custom-scrollbar pr-2 mt-2">
              {pareto.top.map((item, i) => {
                const isFat = !!metrics.mainFinance;
                const val = isFat ? item.fat : item.est;
                const pct = metrics.totalFaturamento ? (val / metrics.totalFaturamento) * 100 : ((val / metrics.totalEstoque) * 100) || 0;
                return (
                  <div key={i} className="group w-full shrink-0">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider flex-nowrap">
                      <span className="truncate pr-3 group-hover:text-white transition-colors">{i+1}. {item.name}</span>
                      <span className="font-mono text-white shrink-0 bg-white/5 px-2 py-0.5 rounded">{formatValue(val, isFat ? 'currency' : 'integer')}</span>
                    </div>
                    <div className="h-3 w-full bg-black/50 rounded-full overflow-hidden border border-white/5 relative shadow-inner">
                      <div className="h-full bg-gradient-to-r from-rose-600 to-amber-400 relative transition-all duration-1000" style={{ width: `${Math.max(pct, 1)}%` }}>
                        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.3)_0%,transparent_100%)]"></div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {treemap.data.length > 0 && (
          <Card className="w-6/12 flex flex-col shrink-0">
            <div className="flex items-center gap-3 mb-4 border-b border-white/5 pb-4 shrink-0">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0"><PieChart size={18} className="text-emerald-400"/></div>
              <div className="min-w-0">
                <h3 className="text-lg font-black uppercase tracking-widest text-white truncate">Fragmentação de Peso</h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5 truncate">Mapa de Calor Volumétrico para: {metrics.mainProduct}</p>
              </div>
            </div>
            <TreemapPlot data={treemap.data} />
          </Card>
        )}
      </div>

      {/* RECOMENDAÇÕES ESTRATÉGICAS IA (NOVA SEÇÃO) */}
      {recomendacoes.length > 0 && (
        <Card className="bg-gradient-to-r from-amber-950/30 to-slate-900/60 border-amber-500/30">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center"><Zap size={20} className="text-amber-400"/></div>
            <h3 className="text-xl font-black uppercase tracking-widest text-amber-300">Recomendações Estratégicas IA Sênior</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recomendacoes.map((rec, i) => (
              <div key={i} className="flex gap-4 bg-black/30 p-4 rounded-2xl border border-amber-500/10 hover:border-amber-500/30 transition-all">
                <span className="text-2xl text-amber-400 mt-0.5">→</span>
                <span className="text-slate-200 leading-relaxed">{rec}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default AnalistaIA;