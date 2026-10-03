import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import { 
  Shield, 
  Activity, 
  TrendingUp, 
  Zap, 
  Clock, 
  Monitor, 
  Database, 
  Cpu, 
  Waves,
  Server,
  Network,
  Ticket,
  ShieldAlert,
  ShieldCheck,
  LineChart as LineChartIcon,
  Bell,
  AlertTriangle,
  X,
  Sun,
  Moon,
  Newspaper,
  Search,
  Menu
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell
} from 'recharts';

// --- MOCK CHART DATA ---
const equityHistory = [
  { time: '04:00', equity: 10200 },
  { time: '05:00', equity: 10250 },
  { time: '06:00', equity: 10230 },
  { time: '07:00', equity: 10300 },
  { time: '08:00', equity: 10450 },
  { time: '09:00', equity: 10420 },
  { time: '10:00', equity: 10500 },
  { time: '11:00', equity: 10580 },
  { time: '12:00', equity: 10620 },
  { time: '13:00', equity: 10600 },
  { time: '14:00', equity: 10647 },
];

const dailyNetTrend = [
  { day: 1, net: 45 }, { day: 2, net: 52 }, { day: 3, net: 48 }, { day: 4, net: 61 }, 
  { day: 5, net: 55 }, { day: 6, net: 67 }, { day: 7, net: 72 }, { day: 8, net: 68 }, 
  { day: 9, net: 82 }, { day: 10, net: 95 }, { day: 11, net: 88 }, { day: 12, net: 102 }, 
  { day: 13, net: 98 }, { day: 14, net: 115 }, { day: 15, net: 125 }, { day: 16, net: 120 }, 
  { day: 17, net: 132 }, { day: 18, net: 145 }, { day: 19, net: 138 }, { day: 20, net: 152 }, 
  { day: 21, net: 165 }, { day: 22, net: 158 }, { day: 23, net: 172 }, { day: 24, net: 185 }, 
  { day: 25, net: 178 }, { day: 26, net: 192 }, { day: 27, net: 205 }, { day: 28, net: 198 }, 
  { day: 29, net: 212 }, { day: 30, net: 225 }
];

// --- TYPES ---
interface Bot {
  id: string;
  name: string;
  status: string;
  adx: number;
  whale: number;
  lot: number;
  bias: string;
  live_pl: number;
  reported_pl?: number;
}

interface TradeHistory {
  time: string;
  bot: string;
  action: string;
  symbol: string;
  lot: number;
  pl: number;
  ticket: number;
  sl?: number;
  tp?: number;
  commission?: number;
}

interface Account {
  equity: number;
  balance: number;
  currency: string;
  margin_level?: number;
}

interface DashboardData {
  account: Account;
  bots: Bot[];
  recent_trades: TradeHistory[];
  sentiment?: {
    vix: number;
    dxy: number;
    gold: number;
    label: string;
  };
  risk?: {
    total_exposure: number;
    margin_usage: string;
    risk_score: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  };
  market_specs?: {
    symbol: string;
    spread: number;
    pip_value: string;
    min_lot: number;
  }[];
  market_news?: {
    id: number;
    title: string;
    source: string;
    time: string;
  }[];
  order_book?: {
    symbol: string;
    bids: { price: number; size: number; total: number }[];
    asks: { price: number; size: number; total: number }[];
  };
  infrastructure?: {
    ctrader_code: string;
    uptime: string;
    pm2_processes: { name: string; mem: string; cpu: string }[];
    error_logs: string[];
  };
  api_status?: 'connected' | 'reconnecting' | 'initializing';
}

interface Notification {
  id: string;
  type: 'info' | 'warning' | 'success' | 'alert';
  message: string;
  time: string;
}

interface LogEntry {
  id: string;
  timestamp: string;
  botId: string;
  level: 'info' | 'warn' | 'error' | 'trade';
  message: string;
}

// --- CUSTOM HOOKS ---
const useWebSocket = (url: string) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [status, setStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('disconnected');
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number>(0);
  const backoffRef = useRef<number>(3000);

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;

    setStatus('reconnecting');
    ws.current = new WebSocket(url);

    ws.current.onopen = () => {
      setStatus('connected');
      backoffRef.current = 3000; // Reset backoff on success
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
    };

    ws.current.onmessage = (event) => {
      try {
        const parsedData = JSON.parse(event.data);
        setData(parsedData);
      } catch (err) {
        console.error('Terminal Data Stream Parse Error:', err);
      }
    };

    ws.current.onclose = () => {
      setStatus('reconnecting');
      
      // Exponential backoff capped at 30 seconds
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect();
        backoffRef.current = Math.min(backoffRef.current * 1.5, 30000);
      }, backoffRef.current);
    };

    ws.current.onerror = (err) => {
      console.error('Socket Protocol Error:', err);
      ws.current?.close();
    };
  }, [url]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
      ws.current?.close();
    };
  }, [connect]);

  const sendMessage = useCallback((message: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    } else {
      console.warn('Cannot send message: WebSocket is not open.');
    }
  }, []);

  return { data, status, sendMessage, ws: ws.current };
};

// --- LOG LINE COMPONENT (OPTIMIZED) ---
const LogLine = React.memo(({ log }: { log: LogEntry }) => {
  return (
    <div className="flex gap-4 font-mono text-[11px] leading-relaxed group py-0.5 border-b border-slate-900/10 dark:border-slate-800/10 last:border-0">
      <span className="text-slate-500 dark:text-slate-600 shrink-0 select-none">[{log.timestamp}]</span>
      <span className={`shrink-0 font-bold uppercase w-16 ${
        log.botId === 'alpha' ? 'text-cyan-500 dark:text-cyan-400' :
        log.botId === 'gamma' ? 'text-purple-500 dark:text-purple-400' :
        'text-slate-500 dark:text-slate-400'
      }`}>{log.botId}</span>
      <span className={`shrink-0 font-bold uppercase w-12 ${
        log.level === 'error' ? 'text-rose-600 dark:text-rose-500' :
        log.level === 'warn' ? 'text-amber-600 dark:text-amber-500' :
        log.level === 'trade' ? 'text-emerald-600 dark:text-emerald-400' :
        'text-slate-500 dark:text-slate-600'
      }`}>{log.level}</span>
      <span className="text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors flex-1 truncate" title={log.message}>
        {log.message}
      </span>
    </div>
  );
});

const PerformanceMetricsTable = ({ bots }: { bots: Bot[] }) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredBots = bots.filter(bot => 
    bot.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Mock metrics for demo
  const getMetrics = (botId: string) => {
    const seed = botId.length;
    return {
      winRate: (60 + (seed % 15)).toFixed(1) + '%',
      profitFactor: (1.5 + (seed % 10) / 10).toFixed(2),
      avgWin: '$' + (40 + (seed % 20)).toFixed(2),
      avgLoss: '-$' + (25 + (seed % 10)).toFixed(2)
    };
  };

  return (
    <section>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 px-2">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-emerald-400" />
          <h2 className="text-sm md:text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">Performance Metrics</h2>
        </div>
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input 
            type="text" 
            placeholder="Search bot..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-slate-100 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-700 dark:text-slate-300 focus:outline-none focus:border-cyan-500/50 transition-all w-full sm:w-48"
          />
        </div>
      </div>
      <div className="bg-white dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-x-auto shadow-sm dark:shadow-none">
        <table className="w-full text-left min-w-[600px]">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900/30 border-b border-slate-200 dark:border-slate-800/60 text-[9px] uppercase tracking-widest text-slate-500 dark:text-slate-600">
              <th className="px-6 py-4">Bot Name</th>
              <th className="px-6 py-4 text-center">Win Rate</th>
              <th className="px-6 py-4 text-center">Profit Factor</th>
              <th className="px-6 py-4 text-center">Avg Win</th>
              <th className="px-6 py-4 text-center">Avg Loss</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
            {filteredBots.map((bot) => {
              const m = getMetrics(bot.id);
              return (
                <tr key={bot.id} className="hover:bg-cyan-500/[0.02] dark:hover:bg-cyan-500/[0.05] transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-300">{bot.name}</span>
                      <span className="text-[8px] font-mono text-slate-400 uppercase">Engine v4.2</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-xs font-mono font-bold text-emerald-500 dark:text-emerald-400">{m.winRate}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400">{m.profitFactor}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">{m.avgWin}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-xs font-mono font-bold text-rose-500">{m.avgLoss}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

const MarketDepth = ({ orderBook, isDarkMode }: { orderBook?: DashboardData['order_book'], isDarkMode: boolean }) => {
  if (!orderBook) return null;

  const data = [
    ...orderBook.bids.map(b => ({ ...b, side: 'bid' })).reverse(),
    ...orderBook.asks.map(a => ({ ...a, side: 'ask' }))
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Market Depth</h3>
        </div>
        <span className="text-[10px] font-mono font-bold text-cyan-500">{orderBook.symbol}</span>
      </div>
      
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
            <XAxis type="number" hide />
            <YAxis dataKey="price" type="category" hide />
            <Tooltip 
              cursor={{ fill: 'transparent' }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  return (
                    <div className="bg-slate-900 border border-slate-800 p-2 rounded-lg shadow-xl">
                      <p className="text-[10px] font-mono text-slate-400">Price: <span className="text-white font-bold">{d.price}</span></p>
                      <p className="text-[10px] font-mono text-slate-400">Size: <span className={d.side === 'bid' ? 'text-emerald-400' : 'text-rose-400'}>{d.size}</span></p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="size" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.side === 'bid' ? '#10b981' : '#f43f5e'} fillOpacity={0.6} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-4 text-[9px] font-bold uppercase tracking-widest">
        <div className="text-emerald-500 border-l-2 border-emerald-500 pl-2">
          Buy Pressure
          <p className="text-xs font-mono text-slate-400 dark:text-slate-600 mt-1">{orderBook.bids.reduce((a, b) => a + b.size, 0).toFixed(1)} Units</p>
        </div>
        <div className="text-rose-500 border-r-2 border-rose-500 pr-2 text-right">
          Sell Pressure
          <p className="text-xs font-mono text-slate-400 dark:text-slate-600 mt-1">{orderBook.asks.reduce((a, b) => a + b.size, 0).toFixed(1)} Units</p>
        </div>
      </div>
    </div>
  );
};

const VolatilityHeatmap = ({ isDarkMode }: { isDarkMode: boolean }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const margin = { top: 40, right: 30, bottom: 40, left: 80 };
    const width = 480 - margin.left - margin.right;
    const height = 320 - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const myGroups = ["Alpha", "Beta", "Gamma", "Epsilon", "Sergiu"];
    const myVars = ["Low Vol", "Med Vol", "High Vol", "Extreme Vol"];

    const x = d3.scaleBand()
      .range([0, width])
      .domain(myGroups)
      .padding(0.08);

    g.append("g")
      .style("font-size", 10)
      .style("font-family", "JetBrains Mono")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).tickSize(0))
      .select(".domain").remove();

    const y = d3.scaleBand()
      .range([height, 0])
      .domain(myVars)
      .padding(0.08);

    g.append("g")
      .style("font-size", 10)
      .style("font-family", "JetBrains Mono")
      .call(d3.axisLeft(y).tickSize(0))
      .select(".domain").remove();

    // Enhanced color scale - Cyan to Emerald
    const myColor = d3.scaleSequential()
      .interpolator(d3.interpolateSinebow) // Using a more vibrant interpolator
      .domain([100, 1]); // Reversed for better effect

    const data: any[] = [];
    myGroups.forEach(gr => {
      myVars.forEach(v => {
        // Bias data for more "realistic" correlation
        let bias = 50;
        if (gr === "Alpha" && v === "High Vol") bias = 85;
        if (gr === "Gamma" && v === "Low Vol") bias = 90;
        if (gr === "Sergiu" && v === "Extreme Vol") bias = 75;
        
        data.push({ 
          group: gr, 
          variable: v, 
          value: Math.min(100, Math.max(0, bias + (Math.random() * 30 - 15))) 
        });
      });
    });

    const tooltip = d3.select(tooltipRef.current);

    g.selectAll()
      .data(data, (d: any) => d.group + ':' + d.variable)
      .enter()
      .append("rect")
      .attr("x", (d: any) => x(d.group)!)
      .attr("y", (d: any) => y(d.variable)!)
      .attr("rx", 6)
      .attr("ry", 6)
      .attr("width", x.bandwidth())
      .attr("height", y.bandwidth())
      .style("fill", (d: any) => d3.interpolateGnBu(d.value / 100))
      .style("stroke-width", 2)
      .style("stroke", "none")
      .style("opacity", 0.8)
      .on("mouseover", function(event, d: any) {
        d3.select(this).style("opacity", 1).style("stroke", "#22d3ee");
        tooltip.style("opacity", 1)
          .html(`
            <div class="text-[10px] font-bold text-white uppercase tracking-wider">${d.group} // ${d.variable}</div>
            <div class="text-xs font-mono text-cyan-400 mt-1">Efficacy: ${d.value.toFixed(1)}%</div>
          `)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseleave", function() {
        d3.select(this).style("opacity", 0.8).style("stroke", "none");
        tooltip.style("opacity", 0);
      });

    // Add legend
    const legendWidth = 200;
    const legendHeight = 8;
    const legend = svg.append("g")
      .attr("transform", `translate(${margin.left + (width - legendWidth) / 2}, ${height + margin.top + 30})`);

    const linGrad = svg.append("defs")
      .append("linearGradient")
      .attr("id", "heatmap-gradient")
      .attr("x1", "0%").attr("y1", "0%")
      .attr("x2", "100%").attr("y2", "0%");

    linGrad.append("stop").attr("offset", "0%").attr("stop-color", d3.interpolateGnBu(0));
    linGrad.append("stop").attr("offset", "100%").attr("stop-color", d3.interpolateGnBu(1));

    legend.append("rect")
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .style("fill", "url(#heatmap-gradient)")
      .attr("rx", 4);

    legend.append("text")
      .attr("x", 0)
      .attr("y", legendHeight + 12)
      .style("font-size", "8px")
      .style("font-weight", "bold")
      .text("MIN EFFICIENCY");

    legend.append("text")
      .attr("x", legendWidth)
      .attr("y", legendHeight + 12)
      .style("text-anchor", "end")
      .style("font-size", "8px")
      .style("font-weight", "bold")
      .text("MAX EFFICIENCY");

    g.selectAll("text").style("fill", isDarkMode ? "#94a3b8" : "#475569");
    legend.selectAll("text").style("fill", isDarkMode ? "#64748b" : "#94a3b8");

  }, [isDarkMode]);

  return (
    <div className="bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/60 rounded-3xl p-6 h-full flex flex-col justify-center items-center relative group">
      <div className="flex items-center gap-3 mb-4 w-full px-2">
        <div className="w-1.5 h-4 bg-cyan-500 rounded-full" />
        <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider italic">Engine Volatility Matrix</h3>
      </div>
      <svg ref={svgRef} width="480" height="320" className="max-w-full h-auto"></svg>
      <div 
        ref={tooltipRef} 
        className="fixed pointer-events-none bg-slate-950/90 border border-slate-800 p-3 rounded-xl shadow-2xl opacity-0 transition-opacity duration-200 z-[200] backdrop-blur-md"
      ></div>
    </div>
  );
};

// --- COMPONENTS ---
const BotCard = ({ bot, onAnalyze, isPaused, settings, onTogglePause }: { bot: Bot, onAnalyze: (bot: Bot) => void, isPaused: boolean, settings: any, onTogglePause: () => void }) => {
  const isInTrade = bot.status === 'ÎN TRADE' && !isPaused;
  const isProfit = bot.live_pl > 0;
  const isLoss = bot.live_pl < 0;
  const [activeTab, setActiveTab] = useState<'info' | 'chart'>('info');
  const drawdownPct = settings?.maxDrawdownPct || 5;

  // Mock 7-day history per bot
  const history = [
    { day: 'Mon', pl: 12 },
    { day: 'Tue', pl: -5 },
    { day: 'Wed', pl: 18 },
    { day: 'Thu', pl: 25 },
    { day: 'Fri', pl: 10 },
    { day: 'Sat', pl: 0 },
    { day: 'Sun', pl: bot.live_pl },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => onAnalyze(bot)}
      className={`bg-white dark:bg-slate-900/40 backdrop-blur-md border rounded-2xl p-6 transition-all duration-300 relative cursor-pointer group/card ${
        isPaused 
          ? 'border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)] ring-1 ring-rose-500' 
          : isInTrade 
            ? 'glow-border-cyan border-cyan-500/40' 
            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
      }`}
    >
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight">{bot.name}</h3>
          <p className="text-[9px] text-slate-500 font-mono tracking-widest uppercase">TRINITY ENGINE v4</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className={`px-2.5 py-1 rounded text-[9px] font-black tracking-widest border ${
            isPaused 
              ? 'bg-rose-500 text-white border-rose-400 animate-pulse'
              : isInTrade 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700'
          }`}>
            {isPaused ? 'PAUSED' : bot.status}
          </div>
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-950/40 p-1 rounded-lg border border-slate-200 dark:border-slate-800/40">
            <button 
              onClick={() => setActiveTab('info')}
              className={`p-1 rounded-md transition-colors ${activeTab === 'info' ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm dark:shadow-none' : 'text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400'}`}
            >
              <Activity className="w-3 h-3" />
            </button>
            <button 
              onClick={() => setActiveTab('chart')}
              className={`p-1 rounded-md transition-colors ${activeTab === 'chart' ? 'bg-slate-800 text-cyan-400' : 'text-slate-600 hover:text-slate-400'}`}
            >
              <LineChartIcon className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      <div className="h-24 mb-6">
        <AnimatePresence mode="wait">
          {activeTab === 'info' ? (
            <motion.div 
              key="info"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="grid grid-cols-2 gap-4"
            >
              <div className="space-y-1">
                <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">ADX</p>
                <p className="text-xl font-mono font-bold text-slate-200 tabular-nums">{(bot.adx ?? 0).toFixed(1)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">Whale</p>
                <p className="text-xl font-mono font-bold text-slate-200 tabular-nums">{(bot.whale ?? 0).toFixed(2)}x</p>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="chart"
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="h-full w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <XAxis dataKey="day" hide />
                  <YAxis hide domain={['dataMin - 10', 'dataMax + 10']} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '9px' }}
                    itemStyle={{ color: '#22d3ee' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="pl" 
                    stroke="#22d3ee" 
                    strokeWidth={2} 
                    dot={false}
                    animationDuration={1000}
                  />
                </LineChart>
              </ResponsiveContainer>
              <p className="text-[8px] text-center text-slate-600 uppercase tracking-widest mt-2 font-bold">7D P/L Trend</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800/60">
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-400 dark:text-slate-500">H4 Bias</span>
          <span className={`font-bold ${(bot.bias ?? '').includes('BUY') ? 'text-emerald-400' : (bot.bias ?? '').includes('SELL') ? 'text-rose-400' : 'text-slate-400 dark:text-slate-500'}`}>
            {bot.bias}
          </span>
        </div>
        
        <div className="flex items-center justify-between pt-1">
          <div className="flex flex-col">
            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Drawdown Protection</span>
            <span className="text-[10px] font-mono text-cyan-500 font-bold">{drawdownPct}% Limit</span>
          </div>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onTogglePause();
            }}
            className={`p-1.5 rounded-lg border transition-all ${
              settings?.autoPauseEnabled 
                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' 
                : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400'
            }`}
            title={settings?.autoPauseEnabled ? "Protection Active" : "Protection Disabled"}
          >
            <ShieldCheck className={`w-3.5 h-3.5 ${settings?.autoPauseEnabled ? 'opacity-100' : 'opacity-30'}`} />
          </button>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">Live Result</span>
          <span className={`text-base font-mono font-bold tabular-nums ${isProfit ? 'text-emerald-500 dark:text-emerald-400 glow-text-emerald' : isLoss ? 'text-rose-500 dark:text-rose-400' : 'text-slate-400 dark:text-slate-600'}`}>
            {isProfit ? '+' : ''}{(bot.live_pl ?? 0).toFixed(2)}$
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default function App() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws/feed`;
  
  const { data, status, sendMessage } = useWebSocket(wsUrl);
  const connected = status === 'connected';

  const [selectedTrade, setSelectedTrade] = useState<TradeHistory | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showQuickTrade, setShowQuickTrade] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showInfra, setShowInfra] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [selectedAnalysisBot, setSelectedAnalysisBot] = useState<Bot | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('trinity-theme');
      return saved ? saved === 'dark' : true;
    }
    return true;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('trinity-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('trinity-theme', 'light');
    }
  }, [isDarkMode]);

  const [botSettings, setBotSettings] = useState<Record<string, { threshold: number, autoPauseEnabled: boolean, maxDrawdownPct: number }>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('trinity-bot-settings');
      return saved ? JSON.parse(saved) : {};
    }
    return {};
  });

  const [pausedBotIds, setPausedBotIds] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('trinity-paused-bots');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    }
    return new Set();
  });

  useEffect(() => {
    localStorage.setItem('trinity-bot-settings', JSON.stringify(botSettings));
  }, [botSettings]);

  useEffect(() => {
    localStorage.setItem('trinity-paused-bots', JSON.stringify(Array.from(pausedBotIds)));
  }, [pausedBotIds]);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [manualTrade, setManualTrade] = useState({ symbol: 'XAUUSD', lot: 0.01 });
  const prevBotsRef = useRef<Bot[]>([]);
  const audioContext = useRef<AudioContext | null>(null);

  const playAlertSound = () => {
    try {
      if (!audioContext.current) {
        audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContext.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.error("Audio playback failed", e);
    }
  };

  const sendManualTrade = (side: 'BUY' | 'SELL') => {
    const payload = {
      type: 'MANUAL_TRADE',
      side,
      symbol: manualTrade.symbol,
      lot: manualTrade.lot
    };
    sendMessage(payload);
    addNotification('info', `REQUEST: Manual ${side} order for ${manualTrade.symbol} sent.`);
    setShowQuickTrade(false);
  };

  const sendBotCommand = (botId: string, command: string) => {
    const payload = {
      type: 'BOT_COMMAND',
      botId,
      command
    };
    sendMessage(payload);
    addNotification('warning', `SYSTEM: Sent ${command} signal to ${botId}.`);
  };

  const addNotification = (type: Notification['type'], message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    setNotifications(prev => [{ id, type, message, time }, ...prev].slice(0, 5));
    // Auto-remove after 8 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 8000);
  };

  useEffect(() => {
    if (!data) return;

    const currentBots = data.bots ?? [];
    const prevBots = prevBotsRef.current;

    currentBots.forEach(bot => {
      const prevBot = prevBots.find(b => b.id === bot.id);
      const settings = botSettings[bot.id] || { threshold: -50, autoPauseEnabled: false, maxDrawdownPct: 5 }; 
      const currentPL = bot.reported_pl ?? bot.live_pl;
      const accountBalance = data.account?.balance || 10000;
      const drawdownPct = (Math.abs(currentPL) / accountBalance) * 100;

      if (prevBot) {
        // 1. Detect Status Change to 'IN TRADE'
        if (prevBot.status !== 'ÎN TRADE' && bot.status === 'ÎN TRADE') {
          addNotification('success', `ACTION: ${bot.name} executed a new trade order.`);
        }
        
        // 2. Detect Critical Drawdown
        if (settings.autoPauseEnabled && !pausedBotIds.has(bot.id) && currentPL < 0 && drawdownPct >= settings.maxDrawdownPct) {
          setPausedBotIds(prev => new Set(prev).add(bot.id));
          sendBotCommand(bot.id, 'PAUSE');
          addNotification('alert', `SAFETY: Auto-pausing ${bot.name} due to ${drawdownPct.toFixed(1)}% drawdown protection.`);
          playAlertSound();
        }

        // 3. Detect Critical P/L Threshold (Legacy absolute check)
        if (bot.live_pl < settings.threshold && prevBot.live_pl >= settings.threshold) {
          addNotification('alert', `CRITICAL: ${bot.name} P/L dropped below $${Math.abs(settings.threshold)} threshold.`);
          if (!settings.autoPauseEnabled) playAlertSound();
        }
      }
    });

    prevBotsRef.current = currentBots;
  }, [data, botSettings]);

  useEffect(() => {
    // Mock Log Stream Simulation
    const botIds = ['alpha', 'beta', 'gamma', 'epsilon', 'sergiu'];
    const levels: LogEntry['level'][] = ['info', 'warn', 'error', 'trade'];
    const messages = [
      "Scanning market for liquidity gaps...",
      "ADX trend confirmed on H1 timeframe.",
      "Adjusting trailing stop for active position.",
      "Network latency spike detected (142ms).",
      "Order execution successful at 2642.45.",
      "Entering cooldown period after target reached."
    ];

    const interval = setInterval(() => {
      const newLog: LogEntry = {
        id: Math.random().toString(36).substring(7),
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        botId: botIds[Math.floor(Math.random() * botIds.length)],
        level: levels[Math.floor(Math.random() * levels.length)],
        message: messages[Math.floor(Math.random() * messages.length)]
      };
      setLogs(prev => [newLog, ...prev].slice(0, 100));
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  if (!data) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#020617] flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mb-6" />
        <p className="text-cyan-600 dark:text-cyan-400 font-mono text-xs tracking-widest uppercase animate-pulse">
          {status === 'reconnecting' ? 'Link Severed. Retrying...' : 'Establishing Secure Link...'}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617] text-slate-900 dark:text-slate-300 font-sans selection:bg-cyan-500/30 transition-colors duration-500">
      {/* HEADER */}
      <header className="h-20 border-b border-slate-200 dark:border-slate-800/60 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50 flex items-center justify-between px-4 md:px-10 shadow-sm dark:shadow-2xl">
        <div className="flex items-center gap-2 md:gap-4">
          <div className="p-1 bg-slate-900 rounded-lg overflow-hidden border border-slate-800">
            <img src="/src/assets/images/trinity_fund_logo_1791015441723.jpg" alt="Trinity Logo" className="w-8 h-8 md:w-10 md:h-10 object-contain" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-sm md:text-lg font-black tracking-[0.1em] md:tracking-[0.2em] text-cyan-600 dark:text-cyan-400 uppercase glow-text-cyan">Trinity Terminal</h1>
            <span className="text-[8px] md:text-[9px] text-slate-400 dark:text-slate-600 font-mono font-bold uppercase">Alpha execution system</span>
          </div>
        </div>

        <div className="flex items-center gap-3 md:gap-6 lg:gap-12">
          {/* DESKTOP NAV */}
          <div className="hidden lg:flex items-center gap-4 xl:gap-8">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-white transition-all"
              title="Switch Theme"
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button 
              onClick={() => {
                if (confirm("⚠️ EMERGENCY: ARE YOU SURE YOU WANT TO CLOSE ALL POSITIONS IMMEDIATELY?")) {
                  addNotification('alert', 'EMERGENCY: Termination signal broadcast to all engines.');
                }
              }}
              className="px-4 py-2.5 bg-rose-900/30 border border-rose-500/30 rounded-xl text-rose-400 hover:bg-rose-500 hover:text-white transition-all flex items-center gap-2 animate-pulse hover:animate-none"
              title="EMERGENCY KILL SWITCH"
            >
              <ShieldAlert className="w-4 h-4" />
              <span className="text-[9px] font-black uppercase tracking-widest">Kill Switch</span>
            </button>

            <button 
              onClick={() => setShowInfra(true)}
              className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white hover:border-slate-700 transition-all flex items-center gap-2 group"
              title="System Diagnostics"
            >
              <Cpu className="w-5 h-5 group-hover:text-cyan-400" />
              <span className="text-[10px] font-black uppercase tracking-widest hidden xl:inline">Diag</span>
            </button>
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white hover:border-slate-700 transition-all"
              title="Bot Settings"
            >
              <Server className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setShowQuickTrade(true)}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-[0_0_20px_rgba(6,182,212,0.3)]"
            >
              <Zap className="w-4 h-4" />
              Quick Trade
            </button>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-[8px] md:text-[9px] text-slate-600 font-bold uppercase tracking-widest mb-1">Live Equity</span>
            <span className="text-lg md:text-2xl font-mono font-bold text-slate-900 dark:text-white tabular-nums glow-text-emerald">
              ${(data.account?.equity ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <button 
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="lg:hidden p-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-500 dark:text-slate-400"
          >
            {showMobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className={`hidden sm:flex px-4 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest items-center gap-2 transition-all duration-300 ${
            status === 'connected' 
              ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5' 
              : 'border-rose-500/20 text-rose-500 bg-rose-500/5 animate-pulse'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${status === 'connected' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span className="hidden md:inline">{status === 'connected' ? 'Live' : 'Reconnecting...'}</span>
          </div>
        </div>

        {/* MOBILE MENU */}
        <AnimatePresence>
          {showMobileMenu && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-20 left-0 w-full bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 shadow-2xl z-40 lg:hidden"
            >
              <div className="p-6 grid grid-cols-2 gap-4">
                <button 
                  onClick={() => { setIsDarkMode(!isDarkMode); setShowMobileMenu(false); }}
                  className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col items-center gap-2"
                >
                  {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  <span className="text-[10px] font-bold uppercase">Theme</span>
                </button>
                <button 
                  onClick={() => { setShowInfra(true); setShowMobileMenu(false); }}
                  className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col items-center gap-2"
                >
                  <Cpu className="w-5 h-5" />
                  <span className="text-[10px] font-bold uppercase">Diagnostics</span>
                </button>
                <button 
                  onClick={() => { setShowSettings(true); setShowMobileMenu(false); }}
                  className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col items-center gap-2"
                >
                  <Server className="w-5 h-5" />
                  <span className="text-[10px] font-bold uppercase">Settings</span>
                </button>
                <button 
                  onClick={() => { setShowQuickTrade(true); setShowMobileMenu(false); }}
                  className="p-4 bg-cyan-500 text-slate-950 rounded-xl flex flex-col items-center gap-2"
                >
                  <Zap className="w-5 h-5" />
                  <span className="text-[10px] font-bold uppercase">Quick Trade</span>
                </button>
                <button 
                  onClick={() => {
                    if (confirm("⚠️ EMERGENCY KILL SWITCH?")) {
                      addNotification('alert', 'EMERGENCY: Termination signal broadcast.');
                    }
                    setShowMobileMenu(false);
                  }}
                  className="p-4 bg-rose-500 text-white rounded-xl col-span-2 flex items-center justify-center gap-3"
                >
                  <ShieldAlert className="w-5 h-5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">EMERGENCY KILL SWITCH</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* NOTIFICATION OVERLAY */}
      <div className="fixed top-24 right-10 z-[60] w-80 space-y-4 pointer-events-none">
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className="pointer-events-auto"
            >
              <div className={`p-4 rounded-2xl border backdrop-blur-xl shadow-2xl flex gap-4 relative overflow-hidden ${
                n.type === 'success' ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-100' :
                n.type === 'alert' ? 'bg-rose-950/40 border-rose-500/30 text-rose-100' :
                'bg-slate-900/80 border-slate-700 text-slate-100'
              }`}>
                <div className="absolute top-0 left-0 w-1 h-full bg-current opacity-50" />
                <div className={`mt-0.5 ${
                  n.type === 'success' ? 'text-emerald-400' :
                  n.type === 'alert' ? 'text-rose-400' : 'text-cyan-400'
                }`}>
                  {n.type === 'alert' ? <AlertTriangle className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[9px] font-black uppercase tracking-widest opacity-60">{n.type}</span>
                    <span className="text-[9px] font-mono opacity-40">{n.time}</span>
                  </div>
                  <p className="text-[11px] font-medium leading-relaxed">{n.message}</p>
                </div>
                <button 
                  onClick={() => setNotifications(prev => prev.filter(notif => notif.id !== n.id))}
                  className="text-white/20 hover:text-white/60 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <main className="max-w-[1700px] mx-auto p-4 md:p-10 space-y-8 md:y-12">
        {/* KPI SECTION */}
        <section className="grid grid-cols-2 lg:grid-cols-6 gap-4 md:gap-6">
          {[
            { label: 'Active Engines', value: (data.bots ?? []).filter(b => b.status === 'ÎN TRADE').length, icon: Cpu, color: 'text-cyan-400' },
            { 
              label: 'Daily Net', 
              value: '+$142.20', 
              icon: TrendingUp, 
              color: 'text-emerald-400',
              showChart: true
            },
            { 
              label: 'Margin Level', 
              value: `${(data.account?.margin_level ?? 2500).toFixed(0)}%`, 
              icon: Zap, 
              color: (data.account?.margin_level ?? 2500) < 500 ? 'text-rose-500 animate-pulse' : 'text-cyan-400' 
            },
            { 
              label: 'Sentiment', 
              value: data.sentiment?.label ?? 'STABLE', 
              icon: Waves, 
              color: data.sentiment?.label === 'EXTREME FEAR' ? 'text-rose-400' : 'text-blue-400',
              subValue: `VIX: ${data.sentiment?.vix ?? 18.2}`
            },
            { 
              label: 'Global Risk', 
              value: data.risk?.risk_score ?? 'LOW', 
              icon: ShieldCheck, 
              color: data.risk?.risk_score === 'CRITICAL' ? 'text-rose-500' : data.risk?.risk_score === 'HIGH' ? 'text-orange-400' : 'text-emerald-400',
              subValue: `Exposure: ${data.risk?.total_exposure ?? 0} Lots`
            },
            { label: 'System Load', value: '14%', icon: Activity, color: 'text-slate-400' },
          ].map((kpi, i) => (
            <div key={i} className="bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/60 rounded-2xl p-4 md:p-6 shadow-sm dark:shadow-none">
              <div className="flex items-center gap-3 mb-2 md:mb-4">
                <kpi.icon className={`w-3.5 h-3.5 md:w-4 md:h-4 ${kpi.color}`} />
                <span className="text-[8px] md:text-[9px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-600 truncate">{kpi.label}</span>
              </div>
              <p className={`text-lg md:text-2xl font-mono font-black ${kpi.color} tabular-nums`}>{kpi.value}</p>
              
              {'showChart' in kpi && kpi.showChart && (
                <div className="h-10 mt-4 -mx-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyNetTrend}>
                      <Line 
                        type="monotone" 
                        dataKey="net" 
                        stroke="#10b981" 
                        strokeWidth={2} 
                        dot={false} 
                        animationDuration={2000}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {'subValue' in kpi && (
                <p className="text-[9px] font-mono text-slate-500 dark:text-slate-600 mt-2">{kpi.subValue}</p>
              )}
            </div>
          ))}
        </section>

        {/* NEWS TICKER SECTION */}
        <section className="bg-white dark:bg-slate-900/20 border border-slate-200 dark:border-slate-800/40 rounded-2xl h-12 flex items-center overflow-hidden relative group">
          <div className="flex items-center gap-3 px-6 h-full bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-10">
            <Newspaper className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 whitespace-nowrap">Market News</span>
          </div>
          <div className="flex-1 relative h-full flex items-center overflow-hidden">
            <div className="flex gap-20 animate-infinite-scroll whitespace-nowrap px-10 hover:[animation-play-state:paused] cursor-default">
              {(data.market_news ?? []).map((news) => (
                <div key={news.id} className="flex items-center gap-4 group/item">
                  <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-600">[{news.time}]</span>
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 group-hover/item:text-cyan-600 dark:group-hover/item:text-cyan-400 transition-colors">
                    {news.title}
                  </span>
                  <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-[8px] font-black rounded uppercase border border-slate-200 dark:border-slate-700">
                    {news.source}
                  </span>
                </div>
              ))}
              {/* Duplicăm pentru loop infinit fluid */}
              {(data.market_news ?? []).map((news) => (
                <div key={`dup-${news.id}`} className="flex items-center gap-4 group/item">
                  <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-600">[{news.time}]</span>
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 group-hover/item:text-cyan-600 dark:group-hover/item:text-cyan-400 transition-colors">
                    {news.title}
                  </span>
                  <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-[8px] font-black rounded uppercase border border-slate-200 dark:border-slate-700">
                    {news.source}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* BOTS GRID */}
        <section>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-1.5 h-6 bg-cyan-500 rounded-full" />
            <h2 className="text-sm md:text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider italic">Operational Units</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 md:gap-10">
            <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
              <AnimatePresence mode="popLayout">
                {(data.bots ?? []).map((bot) => (
                  <BotCard 
                    key={bot.id} 
                    bot={bot} 
                    onAnalyze={setSelectedAnalysisBot} 
                    isPaused={pausedBotIds.has(bot.id)}
                    settings={botSettings[bot.id]}
                    onTogglePause={() => {
                      setBotSettings(prev => ({
                        ...prev,
                        [bot.id]: {
                          threshold: prev[bot.id]?.threshold || -50,
                          maxDrawdownPct: prev[bot.id]?.maxDrawdownPct || 5,
                          autoPauseEnabled: !prev[bot.id]?.autoPauseEnabled
                        }
                      }));
                    }}
                  />
                ))}
              </AnimatePresence>
            </div>
            <div className="lg:col-span-1">
              <VolatilityHeatmap isDarkMode={isDarkMode} />
            </div>
          </div>
        </section>

        {/* HISTORY & INFRA */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 md:gap-10">
          <div className="xl:col-span-2 space-y-8 md:space-y-12">
            {/* PERFORMANCE CHART */}
            <section>
              <div className="flex items-center gap-3 mb-6 md:mb-8 px-2">
                <LineChartIcon className="w-4 h-4 md:w-5 md:h-5 text-cyan-400" />
                <h2 className="text-sm md:text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">Performance History (24H)</h2>
              </div>
              <div className="bg-white dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/80 rounded-3xl p-4 md:p-8 h-[250px] md:h-[350px] shadow-sm dark:shadow-inner backdrop-blur-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={equityHistory}>
                    <defs>
                      <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis 
                      dataKey="time" 
                      stroke="#475569" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false}
                      dy={10}
                    />
                    <YAxis 
                      stroke="#475569" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(value) => `$${value}`}
                      domain={['dataMin - 100', 'dataMax + 100']}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: isDarkMode ? '#0f172a' : '#ffffff', 
                        border: isDarkMode ? '1px solid #1e293b' : '1px solid #e2e8f0',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontFamily: 'JetBrains Mono',
                        boxShadow: isDarkMode ? 'none' : '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                      }}
                      itemStyle={{ color: '#22d3ee' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="equity" 
                      stroke="#22d3ee" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorEquity)" 
                      animationDuration={2000}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            <PerformanceMetricsTable bots={data.bots ?? []} />

            <section>
              <div className="flex items-center justify-between mb-8 px-1">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-cyan-400" />
                <h2 className="text-lg font-black text-white uppercase tracking-wider">Live Execution History</h2>
              </div>
              <button 
                onClick={() => {
                  const trades = data?.recent_trades ?? [];
                  if (trades.length === 0) return;
                  
                  const headers = ["Timestamp", "Operator", "Command", "Asset", "Ticket ID", "Net P/L", "SL", "TP", "Commission"];
                  const rows = trades.map(t => [
                    t.time,
                    t.bot,
                    t.action,
                    t.symbol,
                    `#${t.ticket}`,
                    t.pl.toFixed(2),
                    t.sl ?? 'N/A',
                    t.tp ?? 'N/A',
                    t.commission ?? '0.00'
                  ]);
                  
                  const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
                  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.setAttribute("href", url);
                  link.setAttribute("download", `trinity_trades_${new Date().toISOString().split('T')[0]}.csv`);
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-cyan-400 hover:border-cyan-500/50 transition-all flex items-center gap-2 group"
              >
                <Database className="w-3.5 h-3.5 group-hover:animate-pulse" />
                Export CSV
              </button>
            </div>
            <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl overflow-x-auto">
              <table className="w-full text-left min-w-[600px]">
                <thead>
                  <tr className="bg-slate-900/30 border-b border-slate-800/60 text-[9px] uppercase tracking-widest text-slate-600">
                    <th className="px-6 py-4">Time</th>
                    <th className="px-6 py-4">Bot</th>
                    <th className="px-6 py-4">Command</th>
                    <th className="px-6 py-4">Asset</th>
                    <th className="px-6 py-4">Ticket ID</th>
                    <th className="px-6 py-4 text-right">Net P/L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {(data.recent_trades ?? []).map((trade, i) => (
                    <tr 
                      key={i} 
                      onClick={() => setSelectedTrade(trade)}
                      className="hover:bg-cyan-500/[0.05] transition-colors group cursor-pointer"
                    >
                      <td className="px-6 py-4 text-xs font-mono text-slate-600">{trade.time}</td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-300">{trade.bot}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black ${trade.action === 'BUY' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                          {trade.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-400">{trade.symbol}</td>
                      <td className="px-6 py-4 text-[10px] font-mono text-slate-700">#{trade.ticket}</td>
                      <td className={`px-6 py-4 text-xs font-mono font-bold text-right tabular-nums ${trade.pl >= 0 ? 'text-emerald-400 glow-text-emerald' : 'text-rose-400'}`}>
                        {trade.pl >= 0 ? '+' : ''}{(trade.pl ?? 0).toFixed(2)}$
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <section className="space-y-8">
            <div className="flex items-center gap-3 mb-8">
              <Server className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-black text-white uppercase tracking-wider">Infrastructure Health</h2>
            </div>
            <div className="bg-slate-900/30 border border-slate-800/60 rounded-2xl p-8 space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  <span>cTrader API Link</span>
                  <span className="text-emerald-400">98% STABLE</span>
                </div>
                <div className="h-1 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div className="h-full bg-cyan-500 w-[98%]" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  <span>PM2 Core Process</span>
                  <span className="text-cyan-400">ACTIVE</span>
                </div>
                <div className="h-1 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div className="h-full bg-emerald-500 w-[92%]" />
                </div>
              </div>
            </div>

            <div className="bg-slate-900/30 border border-slate-800/60 rounded-2xl p-8">
              <MarketDepth orderBook={data.order_book} isDarkMode={isDarkMode} />
            </div>
          </section>
        </div>

        {/* MARKET SPECS SECTION */}
        <section>
          <div className="flex items-center gap-3 mb-8 px-2">
            <Ticket className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-black text-white uppercase tracking-wider italic underline decoration-cyan-500/30 underline-offset-8">Market Conditions (Live Specs)</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-8">
            {(data.market_specs ?? []).map((spec, i) => (
              <div key={i} className="bg-slate-900/30 border border-slate-800/40 p-6 md:p-8 rounded-[2rem] group hover:border-cyan-500/40 transition-all relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-cyan-500/10 transition-colors" />
                <div className="flex justify-between items-center mb-6 relative">
                  <span className="text-base font-black text-white uppercase tracking-tighter italic">{spec.symbol}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Pricing Active</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6 relative">
                  <div className="space-y-1">
                    <p className="text-[9px] text-slate-600 font-black uppercase tracking-[0.2em]">Spread</p>
                    <p className="text-sm font-mono font-bold text-slate-200">{spec.spread} pts</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] text-slate-600 font-black uppercase tracking-[0.2em]">Pip Value</p>
                    <p className="text-sm font-mono font-bold text-cyan-400">{spec.pip_value}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] text-slate-600 font-black uppercase tracking-[0.2em]">Min Lot</p>
                    <p className="text-sm font-mono font-bold text-slate-400">{spec.min_lot}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] text-slate-600 font-black uppercase tracking-[0.2em]">Execution</p>
                    <p className="text-[10px] font-black text-slate-500 uppercase">STP / NDD</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* REAL-TIME SYSTEM LOGS */}
        <section className="space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Monitor className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-black text-white uppercase tracking-wider">System Execution Logs</h2>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Live Stream</span>
              </div>
              <button 
                onClick={() => setLogs([])}
                className="text-[9px] font-bold text-slate-600 hover:text-slate-400 uppercase tracking-widest transition-colors"
              >
                Clear Console
              </button>
            </div>
          </div>
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-6 h-[300px] overflow-hidden flex flex-col shadow-inner backdrop-blur-md">
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 pr-4">
              {logs.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-slate-500 dark:text-slate-700 font-mono text-[10px] uppercase tracking-widest italic">Awaiting secure stream initialization...</p>
                </div>
              ) : (
                logs.map((log) => (
                  <LogLine key={log.id} log={log} />
                ))
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-800/40 flex justify-between items-center">
              <div className="text-[9px] font-mono text-slate-600">
                PROCESSED BY TRINITY ENGINE V4 // NODE: VPS-EU-01
              </div>
              <div className="flex gap-2">
                <div className="w-1 h-1 bg-cyan-500/20 rounded-full" />
                <div className="w-1 h-1 bg-cyan-500/40 rounded-full" />
                <div className="w-1 h-1 bg-cyan-500/60 rounded-full animate-pulse" />
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800/50 p-10 bg-slate-950/90 text-center">
        <p className="text-[10px] text-slate-700 font-bold uppercase tracking-[0.3em]">Trinity Fund Terminal // Secure Execution Environment v1.5.0</p>
      </footer>

      {/* TRADE DETAIL MODAL */}
      <AnimatePresence>
        {selectedTrade && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTrade(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h3 className="text-xl font-black text-white uppercase tracking-wider mb-1">Trade Details</h3>
                    <p className="text-[10px] text-slate-500 font-mono font-bold uppercase tracking-widest">Ticket #{selectedTrade.ticket}</p>
                  </div>
                  <button 
                    onClick={() => setSelectedTrade(null)}
                    className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-slate-500 hover:text-white"
                  >
                    <Activity className="w-5 h-5 rotate-45" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-950/50 border border-slate-800/50 p-4 rounded-2xl">
                      <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest mb-2">Operator</p>
                      <p className="text-sm font-bold text-slate-200">{selectedTrade.bot.toUpperCase()}</p>
                    </div>
                    <div className="bg-slate-950/50 border border-slate-800/50 p-4 rounded-2xl">
                      <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest mb-2">Asset Pair</p>
                      <p className="text-sm font-mono font-bold text-cyan-400">{selectedTrade.symbol}</p>
                    </div>
                  </div>

                  <div className="bg-slate-950/50 border border-slate-800/50 p-6 rounded-2xl space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Stop Loss</span>
                      <span className="text-xs font-mono font-bold text-rose-400/80">{selectedTrade.sl ? selectedTrade.sl.toFixed(5) : 'NONE'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Take Profit</span>
                      <span className="text-xs font-mono font-bold text-emerald-400/80">{selectedTrade.tp ? selectedTrade.tp.toFixed(5) : 'NONE'}</span>
                    </div>
                    <div className="flex justify-between items-center pt-4 border-t border-slate-800/50">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Commission</span>
                      <span className="text-xs font-mono font-bold text-slate-400">-{selectedTrade.commission ? selectedTrade.commission.toFixed(2) : '0.00'}$</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center px-2">
                    <span className="text-[11px] text-slate-500 font-bold uppercase tracking-[0.2em]">Net Result</span>
                    <span className={`text-2xl font-mono font-black tabular-nums ${selectedTrade.pl >= 0 ? 'text-emerald-400 glow-text-emerald' : 'text-rose-400'}`}>
                      {selectedTrade.pl >= 0 ? '+' : ''}{selectedTrade.pl.toFixed(2)}$
                    </span>
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedTrade(null)}
                  className="w-full mt-8 py-4 bg-slate-800 hover:bg-slate-700 text-white text-xs font-black uppercase tracking-[0.3em] rounded-2xl transition-all active:scale-95"
                >
                  Close Terminal
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* QUICK TRADE MODAL */}
      <AnimatePresence>
        {showQuickTrade && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowQuickTrade(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-xl font-black text-white uppercase tracking-wider">Quick Trade</h3>
                  <button onClick={() => setShowQuickTrade(false)} className="text-slate-500 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Asset Symbol</label>
                    <input 
                      type="text" 
                      value={manualTrade.symbol}
                      onChange={(e) => setManualTrade({...manualTrade, symbol: e.target.value.toUpperCase()})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-mono text-cyan-400 focus:outline-none focus:border-cyan-500/50 transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Execution Lot Size</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={manualTrade.lot}
                      onChange={(e) => setManualTrade({...manualTrade, lot: parseFloat(e.target.value)})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-mono text-slate-200 focus:outline-none focus:border-cyan-500/50 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <button 
                      onClick={() => sendManualTrade('BUY')}
                      className="py-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all active:scale-95 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                    >
                      BUY
                    </button>
                    <button 
                      onClick={() => sendManualTrade('SELL')}
                      className="py-4 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all active:scale-95 shadow-[0_0_20px_rgba(244,63,94,0.2)]"
                    >
                      SELL
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* BOT ANALYSIS MODAL */}
      <AnimatePresence>
        {selectedAnalysisBot && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedAnalysisBot(null)}
              className="absolute inset-0 bg-slate-950/95 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="relative w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[3rem] shadow-2xl overflow-hidden"
            >
              <div className="p-12">
                <div className="flex justify-between items-start mb-12">
                  <div className="flex items-center gap-6">
                    <div className={`w-16 h-16 rounded-3xl flex items-center justify-center border ${
                      selectedAnalysisBot.status === 'ÎN TRADE' ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-slate-800 border-slate-700 text-slate-500'
                    }`}>
                      <TrendingUp className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">{selectedAnalysisBot.name}</h3>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono font-black uppercase tracking-[0.4em] mt-1">Deep Intelligence Analytics // 30D Performance</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedAnalysisBot(null)} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-colors">
                    <X className="w-8 h-8 text-slate-400 dark:text-slate-600" />
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-6 mb-12">
                  <div className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/40 p-6 rounded-3xl">
                    <p className="text-[9px] text-slate-400 dark:text-slate-600 font-black uppercase tracking-widest mb-3 text-center">Winning Ratio</p>
                    <p className="text-3xl font-mono font-black text-emerald-500 dark:text-emerald-400 text-center">68.4%</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/40 p-6 rounded-3xl">
                    <p className="text-[9px] text-slate-400 dark:text-slate-600 font-black uppercase tracking-widest mb-3 text-center">Peak Drawdown</p>
                    <p className="text-3xl font-mono font-black text-rose-500 text-center">-14.2%</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/40 p-6 rounded-3xl">
                    <p className="text-[9px] text-slate-400 dark:text-slate-600 font-black uppercase tracking-widest mb-3 text-center">Avg Trade Time</p>
                    <p className="text-3xl font-mono font-black text-slate-900 dark:text-slate-200 text-center">4.2H</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/40 p-6 rounded-3xl">
                    <p className="text-[9px] text-slate-400 dark:text-slate-600 font-black uppercase tracking-widest mb-3 text-center">Total Factor</p>
                    <p className="text-3xl font-mono font-black text-cyan-600 dark:text-cyan-400 text-center">2.41</p>
                  </div>
                </div>

                <div className="h-[350px] w-full bg-slate-50 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-800/40 rounded-[2rem] p-10 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={[
                      { day: '1', pl: 10 }, { day: '5', pl: 45 }, { day: '10', pl: 32 },
                      { day: '15', pl: 88 }, { day: '20', pl: 72 }, { day: '25', pl: 124 },
                      { day: '30', pl: 156 }
                    ]}>
                      <defs>
                        <linearGradient id="colorAnalysis" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#1e293b" : "#e2e8f0"} vertical={false} />
                      <XAxis dataKey="day" hide />
                      <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: isDarkMode ? '#0f172a' : '#ffffff', 
                          border: isDarkMode ? '1px solid #1e293b' : '1px solid #e2e8f0', 
                          borderRadius: '12px' 
                        }}
                        itemStyle={{ color: '#10b981' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="pl" 
                        stroke="#10b981" 
                        strokeWidth={4} 
                        fillOpacity={1} 
                        fill="url(#colorAnalysis)" 
                        animationDuration={1500}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-12 flex justify-between items-center text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-700">
                  <span>Engine: Trinity Kernel v4.2 // Optimized for {selectedAnalysisBot.bias}</span>
                  <div className="flex gap-4">
                    <span className="text-slate-500 dark:text-slate-600">Sample Size: 242 Trades</span>
                    <span className="text-cyan-600 dark:text-cyan-500/50">Verified Strategy</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-xl font-black text-white uppercase tracking-wider">Alert Thresholds</h3>
                  <button onClick={() => setShowSettings(false)} className="text-slate-500 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {(data.bots ?? []).map(bot => (
                    <div key={bot.id} className="bg-slate-950/50 border border-slate-800/50 p-6 rounded-2xl space-y-4">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">{bot.name}</span>
                          {pausedBotIds.has(bot.id) && (
                            <span className="px-2 py-0.5 bg-rose-500/20 text-rose-500 text-[8px] font-black rounded uppercase">Paused</span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">ID: {bot.id}</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex justify-between text-[9px] text-slate-600 font-bold uppercase tracking-widest">
                            <span>Max Drawdown (%)</span>
                            <span className="text-cyan-400">{botSettings[bot.id]?.maxDrawdownPct || 5}%</span>
                          </div>
                          <input 
                            type="number"
                            min="0.1"
                            max="50"
                            step="0.1"
                            value={botSettings[bot.id]?.maxDrawdownPct || 5}
                            onChange={(e) => setBotSettings(prev => ({
                              ...prev,
                              [bot.id]: { 
                                ...prev[bot.id],
                                threshold: prev[bot.id]?.threshold || -50,
                                autoPauseEnabled: prev[bot.id]?.autoPauseEnabled || false,
                                maxDrawdownPct: parseFloat(e.target.value) || 1
                              }
                            }))}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-cyan-400 focus:outline-none focus:border-cyan-500/50 transition-colors"
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-[9px] text-slate-600 font-bold uppercase tracking-widest">
                            <span>Loss Threshold ($)</span>
                            <span className="text-rose-400">-{Math.abs(botSettings[bot.id]?.threshold || 50)}</span>
                          </div>
                          <input 
                            type="number"
                            min="10"
                            max="5000"
                            step="10"
                            value={Math.abs(botSettings[bot.id]?.threshold || 50)}
                            onChange={(e) => setBotSettings(prev => ({
                              ...prev,
                              [bot.id]: { 
                                ...prev[bot.id],
                                threshold: -Math.abs(parseFloat(e.target.value)) || -50,
                                autoPauseEnabled: prev[bot.id]?.autoPauseEnabled || false,
                                maxDrawdownPct: prev[bot.id]?.maxDrawdownPct || 5
                              }
                            }))}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-rose-400 focus:outline-none focus:border-rose-500/50 transition-colors"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/50">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Auto-Pause Protocol</p>
                          <p className="text-[8px] text-slate-600 font-medium">Emergency halt on drawdown hit</p>
                        </div>
                        <button 
                          onClick={() => setBotSettings(prev => ({
                            ...prev,
                            [bot.id]: { 
                              ...prev[bot.id],
                              threshold: prev[bot.id]?.threshold || -50,
                              maxDrawdownPct: prev[bot.id]?.maxDrawdownPct || 5,
                              autoPauseEnabled: !prev[bot.id]?.autoPauseEnabled 
                            }
                          }))}
                          className={`w-10 h-5 rounded-full relative transition-colors duration-200 ${botSettings[bot.id]?.autoPauseEnabled ? 'bg-cyan-500' : 'bg-slate-800'}`}
                        >
                          <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-200 ${botSettings[bot.id]?.autoPauseEnabled ? 'left-6' : 'left-1'}`} />
                        </button>
                      </div>

                      {pausedBotIds.has(bot.id) && (
                        <button 
                          onClick={() => setPausedBotIds(prev => {
                            const next = new Set(prev);
                            next.delete(bot.id);
                            return next;
                          })}
                          className="w-full py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 text-[10px] font-black uppercase tracking-widest rounded-xl border border-emerald-500/20 transition-all"
                        >
                          Resume Execution
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button 
                  onClick={() => setShowSettings(false)}
                  className="w-full mt-8 py-4 bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs font-black uppercase tracking-[0.3em] rounded-2xl transition-all active:scale-95"
                >
                  Save Configuration
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* INFRASTRUCTURE MODAL */}
      <AnimatePresence>
        {showInfra && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowInfra(false)}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-10">
                <div className="flex justify-between items-center mb-10">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-cyan-500/10 rounded-2xl">
                      <Cpu className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-wider">Infrastructure Node Diagnostics</h3>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono uppercase tracking-[0.2em]">Live system telemetry // ID: VPS-EU-FRA-01</p>
                    </div>
                  </div>
                  <button onClick={() => setShowInfra(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                    <X className="w-6 h-6 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-white" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-10">
                  <div className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/50 p-6 rounded-3xl">
                    <p className="text-[9px] text-slate-400 dark:text-slate-600 font-bold uppercase tracking-[0.3em] mb-4">cTrader Link Protocol</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-mono text-cyan-600 dark:text-cyan-400 font-bold">{data.infrastructure?.ctrader_code}</span>
                      <div className="px-2 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[8px] font-black rounded uppercase">Verified</div>
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/50 p-6 rounded-3xl">
                    <p className="text-[9px] text-slate-400 dark:text-slate-600 font-bold uppercase tracking-[0.3em] mb-4">API Core Uptime</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-mono text-slate-900 dark:text-slate-200 font-bold">{data.infrastructure?.uptime}</span>
                      <Clock className="w-4 h-4 text-slate-300 dark:text-slate-700" />
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  <section>
                    <h4 className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] mb-4">PM2 Process Clusters</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {(data.infrastructure?.pm2_processes ?? []).map((proc, i) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/40 rounded-2xl">
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{proc.name}</span>
                          <div className="flex gap-4">
                            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-600">{proc.mem}</span>
                            <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-500/80">{proc.cpu}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section>
                    <h4 className="text-[10px] text-rose-600 dark:text-rose-500/80 font-black uppercase tracking-[0.3em] mb-4">Recent Exception Stack</h4>
                    <div className="bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/60 rounded-2xl p-6 font-mono text-[10px] text-slate-500 space-y-2 overflow-y-auto max-h-32 custom-scrollbar">
                      {(data.infrastructure?.error_logs ?? []).map((log, i) => (
                        <div key={i} className="flex gap-3">
                          <span className="text-rose-700 dark:text-rose-900 shrink-0 select-none">!!</span>
                          <span className="leading-relaxed">{log}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

                <div className="mt-10 pt-8 border-t border-slate-200 dark:border-slate-800/40 flex justify-between items-center text-[9px] text-slate-400 dark:text-slate-700 font-bold uppercase tracking-widest">
                  <span>Trinity Diagnostic Engine v1.2</span>
                  <span className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    Kernel Stable
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
