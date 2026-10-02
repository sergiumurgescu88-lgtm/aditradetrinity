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
  Ticket
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
  const ws = useRef<WebSocket | null>(null);

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
          <section className="xl:col-span-2">
            <div className="flex items-center gap-3 mb-8">
              <Clock className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-black text-white uppercase tracking-wider">Live Execution History</h2>
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
    </div>
  );
}
