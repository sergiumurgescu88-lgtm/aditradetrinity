import React, { useState, useEffect, useRef } from 'react';
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
  LineChart as LineChartIcon,
  Bell,
  AlertTriangle,
  X
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
  Area
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
}

interface DashboardData {
  account: Account;
  bots: Bot[];
  recent_trades: TradeHistory[];
  api_status?: 'connected' | 'reconnecting' | 'initializing';
}

interface Notification {
  id: string;
  type: 'info' | 'warning' | 'success' | 'alert';
  message: string;
  time: string;
}

// --- COMPONENTS ---
const BotCard = ({ bot }: { bot: Bot }) => {
  const isInTrade = bot.status === 'ÎN TRADE';
  const isProfit = bot.live_pl > 0;
  const isLoss = bot.live_pl < 0;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-slate-900/40 backdrop-blur-md border rounded-2xl p-6 transition-all duration-300 relative ${
        isInTrade ? 'glow-border-cyan border-cyan-500/40' : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-lg font-bold text-slate-100 uppercase tracking-tight">{bot.name}</h3>
          <p className="text-[9px] text-slate-500 font-mono tracking-widest uppercase">TRINITY ENGINE v4</p>
        </div>
        <div className={`px-2.5 py-1 rounded text-[9px] font-black tracking-widest border ${
          isInTrade ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'
        }`}>
          {bot.status}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="space-y-1">
          <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">ADX</p>
          <p className="text-xl font-mono font-bold text-slate-200 tabular-nums">{(bot.adx ?? 0).toFixed(1)}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">Whale</p>
          <p className="text-xl font-mono font-bold text-slate-200 tabular-nums">{(bot.whale ?? 0).toFixed(2)}x</p>
        </div>
      </div>

      <div className="space-y-3 pt-4 border-t border-slate-800/60">
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-500">H4 Bias</span>
          <span className={`font-bold ${(bot.bias ?? '').includes('BUY') ? 'text-emerald-400' : (bot.bias ?? '').includes('SELL') ? 'text-rose-400' : 'text-slate-500'}`}>
            {bot.bias}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-slate-500 font-bold uppercase">Live Result</span>
          <span className={`text-base font-mono font-bold tabular-nums ${isProfit ? 'text-emerald-400 glow-text-emerald' : isLoss ? 'text-rose-400' : 'text-slate-600'}`}>
            {isProfit ? '+' : ''}{(bot.live_pl ?? 0).toFixed(2)}$
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [connected, setConnected] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<TradeHistory | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showQuickTrade, setShowQuickTrade] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [botSettings, setBotSettings] = useState<Record<string, { threshold: number }>>({});
  const [manualTrade, setManualTrade] = useState({ symbol: 'XAUUSD', lot: 0.01 });
  const ws = useRef<WebSocket | null>(null);
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
    if (ws.current && connected) {
      const payload = {
        type: 'MANUAL_TRADE',
        side,
        symbol: manualTrade.symbol,
        lot: manualTrade.lot
      };
      ws.current.send(JSON.stringify(payload));
      addNotification('info', `REQUEST: Manual ${side} order for ${manualTrade.symbol} sent.`);
      setShowQuickTrade(false);
    }
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
      const settings = botSettings[bot.id] || { threshold: -50 }; // Default threshold

      if (prevBot) {
        // 1. Detect Status Change to 'IN TRADE'
        if (prevBot.status !== 'ÎN TRADE' && bot.status === 'ÎN TRADE') {
          addNotification('success', `ACTION: ${bot.name} executed a new trade order.`);
        }
        // 2. Detect Critical P/L Threshold
        if (bot.live_pl < settings.threshold && prevBot.live_pl >= settings.threshold) {
          addNotification('alert', `CRITICAL: ${bot.name} P/L dropped below $${Math.abs(settings.threshold)} threshold.`);
          playAlertSound();
        }
      }
    });

    prevBotsRef.current = currentBots;
  }, [data, botSettings]);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/feed`;
    
    const connect = () => {
      ws.current = new WebSocket(wsUrl);
      ws.current.onopen = () => setConnected(true);
      ws.current.onmessage = (e) => {
        try {
          setData(JSON.parse(e.data));
        } catch (err) {
          console.error("Parse error", err);
        }
      };
      ws.current.onclose = () => {
        setConnected(false);
        setTimeout(connect, 3000);
      };
    };

    connect();
    return () => ws.current?.close();
  }, []);

  if (!data) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mb-6" />
        <p className="text-cyan-400 font-mono text-xs tracking-widest uppercase animate-pulse">Establishing Secure Link...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 font-sans selection:bg-cyan-500/30">
      {/* HEADER */}
      <header className="h-20 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50 flex items-center justify-between px-10 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-gradient-to-br from-cyan-600 to-emerald-600 rounded-lg">
            <Shield className="w-6 h-6 text-slate-950" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-black tracking-[0.2em] text-cyan-400 uppercase glow-text-cyan">Trinity Terminal</h1>
            <span className="text-[9px] text-slate-600 font-mono font-bold uppercase">Alpha execution system</span>
          </div>
        </div>

        <div className="flex items-center gap-12">
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
          <div className="flex flex-col items-end">
            <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest mb-1">Live Equity</span>
            <span className="text-2xl font-mono font-bold text-white tabular-nums glow-text-emerald">
              ${(data.account?.equity ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className={`px-4 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${
            connected ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5' : 'border-rose-500/20 text-rose-500 bg-rose-500/5'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            {connected ? (data.api_status === 'connected' ? 'Live Feed' : 'API Link Failure') : 'Link Offline'}
          </div>
        </div>
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

      <main className="max-w-[1700px] mx-auto p-10 space-y-12">
        {/* KPI SECTION */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { label: 'Active Engines', value: (data.bots ?? []).filter(b => b.status === 'ÎN TRADE').length, icon: Cpu, color: 'text-cyan-400' },
            { label: 'Daily Net', value: '+$142.20', icon: TrendingUp, color: 'text-emerald-400' },
            { label: 'System Load', value: '14%', icon: Activity, color: 'text-blue-400' },
            { label: 'Link Ping', value: '12ms', icon: Network, color: 'text-purple-400' },
          ].map((kpi, i) => (
            <div key={i} className="bg-slate-900/30 border border-slate-800/60 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-600">{kpi.label}</span>
              </div>
              <p className={`text-2xl font-mono font-bold ${kpi.color} tabular-nums`}>{kpi.value}</p>
            </div>
          ))}
        </section>

        {/* BOTS GRID */}
        <section>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-1.5 h-6 bg-cyan-500 rounded-full" />
            <h2 className="text-lg font-black text-white uppercase tracking-wider italic">Operational Units</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <AnimatePresence mode="popLayout">
              {(data.bots ?? []).map((bot) => (
                <BotCard key={bot.id} bot={bot} />
              ))}
            </AnimatePresence>
          </div>
        </section>

        {/* HISTORY & INFRA */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
          <div className="xl:col-span-2 space-y-12">
            {/* PERFORMANCE CHART */}
            <section>
              <div className="flex items-center gap-3 mb-8 px-2">
                <LineChartIcon className="w-5 h-5 text-cyan-400" />
                <h2 className="text-lg font-black text-white uppercase tracking-wider">Performance History (24H)</h2>
              </div>
              <div className="bg-slate-950/40 border border-slate-800/80 rounded-3xl p-8 h-[350px] shadow-inner backdrop-blur-sm relative overflow-hidden">
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
                        backgroundColor: '#0f172a', 
                        border: '1px solid #1e293b',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontFamily: 'JetBrains Mono'
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
            <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl overflow-hidden">
              <table className="w-full text-left">
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
          </section>
        </div>
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

      {/* BOT SETTINGS MODAL */}
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
                        <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">{bot.name}</span>
                        <span className="text-[10px] font-mono text-slate-500">ID: {bot.id}</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-[9px] text-slate-600 font-bold uppercase tracking-widest">
                          <span>Loss Alert Threshold ($)</span>
                          <span className="text-rose-400">-{Math.abs(botSettings[bot.id]?.threshold || -50)}</span>
                        </div>
                        <input 
                          type="range"
                          min="10"
                          max="500"
                          step="10"
                          value={Math.abs(botSettings[bot.id]?.threshold || -50)}
                          onChange={(e) => setBotSettings(prev => ({
                            ...prev,
                            [bot.id]: { threshold: -parseInt(e.target.value) }
                          }))}
                          className="w-full accent-cyan-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
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
    </div>
  );
}
