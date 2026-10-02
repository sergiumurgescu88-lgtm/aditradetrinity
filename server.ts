import express from 'express';
import { createServer } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  // --- STAREA INITIALĂ A BOȚILOR (MIRRORING PYTHON API) ---
  let botsState = {
    equity_total: 10647.41,
    bots: [
      { id: "gamma", name: "Gamma", adx: 22.1, whale: 1.12, status: "SCANEZĂ", lot: 0.01, pl: 0.0, bias: "H4 NEUTRAL" },
      { id: "alpha", name: "Alpha", adx: 24.5, whale: 1.25, status: "ÎN TRADE", lot: 0.01, pl: 12.50, bias: "H4 BUY" },
      { id: "beta", name: "Beta", adx: 23.0, whale: 1.15, status: "COOLDOWN", lot: 0.01, pl: 0.0, bias: "H4 SELL" },
      { id: "epsilon", name: "Epsilon", adx: 21.0, whale: 1.56, status: "SCANEZĂ", lot: 0.01, pl: 0.0, bias: "H4 BUY" },
      { id: "sergiu", name: "Sergiu", adx: 25.2, whale: 1.40, status: "SCANEZĂ", lot: 0.01, pl: 0.0, bias: "H4 NEUTRAL" }
    ],
    history: [
      { time: "10:15", bot: "Alpha", action: "BUY", symbol: "XAUUSD", lot: 0.01, pl: 12.50 },
      { time: "09:45", bot: "Gamma", action: "SELL", symbol: "EURUSD", lot: 0.01, pl: -2.10 },
      { time: "08:30", bot: "Epsilon", action: "BUY", symbol: "BTCUSD", lot: 0.01, pl: 45.20 },
      { time: "07:15", bot: "Beta", action: "SELL", symbol: "GBPUSD", lot: 0.01, pl: 8.40 },
      { time: "06:00", bot: "Sergiu", action: "BUY", symbol: "ETHUSD", lot: 0.01, pl: -5.30 }
    ]
  };

  // --- LOGICA DE ACTUALIZARE (BACKGROUND TASK) ---
  setInterval(() => {
    botsState.bots = botsState.bots.map(bot => {
      const adxChange = (Math.random() - 0.5);
      const whaleChange = (Math.random() - 0.5) * 0.1;
      let pl = bot.pl;
      if (bot.id === 'alpha') {
        pl += (Math.random() - 0.3); // Bias spre profit
      }
      return {
        ...bot,
        adx: Number((bot.adx + adxChange).toFixed(1)),
        whale: Number((bot.whale + whaleChange).toFixed(2)),
        pl: Number(pl.toFixed(2))
      };
    });

    botsState.equity_total = Number((10647.41 + botsState.bots.reduce((acc, b) => acc + b.pl, 0)).toFixed(2));

    if (Math.random() < 0.1) {
      const bots = ["Gamma", "Alpha", "Beta", "Epsilon", "Sergiu"];
      const newTrade = {
        time: new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }),
        bot: bots[Math.floor(Math.random() * bots.length)],
        action: Math.random() > 0.5 ? "BUY" : "SELL",
        symbol: ["XAUUSD", "EURUSD", "BTCUSD"][Math.floor(Math.random() * 3)],
        lot: 0.01,
        pl: Number((Math.random() * 30 - 10).toFixed(2))
      };
      botsState.history = [newTrade, ...botsState.history.slice(0, 4)];
    }

    // Broadcast prin WebSocket
    const message = JSON.stringify(botsState);
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }, 3000);

  // --- API ENDPOINTS ---
  app.get('/api/status', (req, res) => {
    res.json(botsState);
  });

  // --- VITE INTEGRATION ---
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  // Fallback to index.html for SPA
  app.use('*', async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const template = await vite.transformIndexHtml(url, `<!DOCTYPE html><html>...</html>`); // Minimal template if needed, but Vite handles it
      res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

startServer();
