import asyncio
import json
import os
import logging
from typing import List, Dict, Any, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

# NOTA: Necesar 'pip install ctrader-open-api==0.9.2'
try:
    from ctrader_open_api import Client, EndPoints
except ImportError:
    # Mocks pentru mediul de dezvoltare
    Client = EndPoints = None

# --- CONFIGURARE PRODUCȚIE ---
CONFIG = {
    "CLIENT_ID": "",
    "CLIENT_SECRET": "",
    "ACCESS_TOKEN": "",
    "ACCOUNT_ID": 0, # Ar trebui sa fie un int
    "HOST": EndPoints.LIVE_HOST if EndPoints else "live.ctraderapi.com",
    "PORT": 5035
}

BOT_STATES_FILE = "/tmp/trinity_bot_states.json"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("TrinityDashboardAPI")

# --- LIFESPAN MANAGER (Noua sintaxa FastAPI) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- STARTUP LOGIC ---
    asyncio.create_task(unity_background_task())
    
    if Client:
        try:
            logger.info("Se inițializează conexiunea la cTrader Open API...")
            state_manager.client = Client(CONFIG["HOST"], CONFIG["PORT"])
            await state_manager.client.start() # <-- DECOMENTAT: Pornește clientul
            
            logger.info("Se autentifică...")
            await state_manager.client.authenticate(
                CONFIG["CLIENT_ID"], 
                CONFIG["CLIENT_SECRET"], 
                CONFIG["ACCESS_TOKEN"]
            )
            state_manager.data["api_status"] = "connected"
            logger.info("✅ Trinity Backend linked to cTrader API v0.9.2")
        except Exception as e:
            logger.error(f"❌ Failed to link cTrader: {e}")
            state_manager.data["api_status"] = "reconnecting"
    
    yield
    
    # --- SHUTDOWN LOGIC ---
    if state_manager.client:
        try:
            await state_manager.client.stop()
            logger.info("cTrader client oprit graceful.")
        except Exception as e:
            logger.error(f"Eroare la oprirea clientului: {e}")

app = FastAPI(title="Trinity Fund Real-Time Engine", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CLASA STATE MANAGER ---
class TrinityState:
    def __init__(self):
        self.data = {
            "account": {"equity": 0.0, "balance": 0.0, "currency": "USD", "margin_level": 2500.0},
            "risk": {"total_exposure": 0.0, "margin_usage": "2.4%", "risk_score": "LOW"},
            "bots": [],
            "recent_trades": [],
            "sentiment": {"vix": 18.2, "dxy": 104.15, "label": "STABLE"},
            "infrastructure": {
                "ctrader_code": "OA_AUTH_SUCCESS",
                "uptime": "14d 06h 12m",
                "pm2_processes": [
                    {"name": "trinity-api", "mem": "142MB", "cpu": "2%"},
                    {"name": "bot-alpha", "mem": "88MB", "cpu": "1%"},
                    {"name": "bot-gamma", "mem": "92MB", "cpu": "4%"},
                    {"name": "bot-epsilon", "mem": "85MB", "cpu": "0.5%"}
                ],
                "error_logs": []
            },
            "api_status": "initializing",
            "market_news": [
                {"id": 1, "title": "FED signals potential rate pause in upcoming December meeting", "source": "Reuters", "time": "2m ago"},
                {"id": 2, "title": "Gold (XAUUSD) hits new ATH amid geopolitical tensions in Middle East", "source": "Bloomberg", "time": "15m ago"},
                {"id": 3, "title": "NVIDIA earnings beat expectations, AI sector rallies", "source": "CNBC", "time": "45m ago"}
            ],
            "order_book": {
                "symbol": "XAUUSD",
                "bids": [],
                "asks": []
            }
        }
        self.client = None
        self.raw_positions = [] 

    def update_order_book(self):
        """Simulează adâncimea pieței (L2 Data)."""
        import random
        base_price = 2650.0 if self.data["order_book"]["symbol"] == "XAUUSD" else 1.0850
        
        # Generăm 10 nivele de bids (cumpărare)
        bids = []
        cumulative_bid = 0
        for i in range(1, 11):
            size = random.uniform(5.0, 50.0)
            cumulative_bid += size
            bids.append({
                "price": round(base_price - (i * 0.05), 2),
                "size": round(size, 2),
                "total": round(cumulative_bid, 2)
            })
            
        # Generăm 10 nivele de asks (vânzare)
        asks = []
        cumulative_ask = 0
        for i in range(1, 11):
            size = random.uniform(5.0, 50.0)
            cumulative_ask += size
            asks.append({
                "price": round(base_price + (i * 0.05), 2),
                "size": round(size, 2),
                "total": round(cumulative_ask, 2)
            })
            
        self.data["order_book"]["bids"] = bids
        self.data["order_book"]["asks"] = asks

    def update_market_news(self):
        """Simulează sau preia știri financiare în timp real."""
        # Aici s-ar putea integra un API real precum Finnhub sau NewsAPI
        # Pentru demo, rotim știrile pentru a simula un flux live
        import random
        headlines = [
            {"title": "ECB considering faster rate cuts as inflation cools", "source": "WSJ"},
            {"title": "OPEC+ extends production cuts into Q1 2027", "source": "Reuters"},
            {"title": "Bitcoin nears $100k mark as institutional flow increases", "source": "Coindesk"},
            {"title": "US Jobless claims lower than expected, Dollar strengthens", "source": "MarketWatch"},
            {"title": "Tech sell-off intensifies as yield curve steepens", "source": "Bloomberg"}
        ]
        
        if random.random() < 0.1: # 10% șansă de update la fiecare loop
            new_story = random.choice(headlines)
            new_story["id"] = random.randint(100, 999)
            new_story["time"] = "Just now"
            # Adăugăm la început și păstrăm ultimele 5
            self.data["market_news"] = [new_story] + self.data["market_news"][:4]

    def calculate_risk_metrics(self):
        """Calculează expunerea totală și riscul contului."""
        total_lots = sum(bot.get("lot", 0) for bot in self.data["bots"] if bot.get("status") == "ÎN TRADE")
        self.data["risk"]["total_exposure"] = round(total_lots, 2)
        
        # Simulare Margin Level din cTrader
        self.data["account"]["margin_level"] = round(2500.0 + (self.data["account"]["equity"] * 0.1), 2)
        
        # Scor de risc bazat pe expunere și VIX
        vix = self.data["sentiment"]["vix"]
        if total_lots > 2.0 or vix > 30 or self.data["account"]["margin_level"] < 500:
            self.data["risk"]["risk_score"] = "CRITICAL"
        elif total_lots > 1.0 or vix > 22 or self.data["account"]["margin_level"] < 1000:
            self.data["risk"]["risk_score"] = "HIGH"
        elif total_lots > 0.5:
            self.data["risk"]["risk_score"] = "MEDIUM"
        else:
            self.data["risk"]["risk_score"] = "LOW"

    def get_market_specs(self):
        """Date despre simboluri (inspirat din ctrader-python-algo-samples)."""
        self.data["market_specs"] = [
            {"symbol": "XAUUSD", "spread": 12, "pip_value": "$1.00", "min_lot": 0.01},
            {"symbol": "EURUSD", "spread": 2, "pip_value": "$0.10", "min_lot": 0.01},
            {"symbol": "BTCUSD", "spread": 250, "pip_value": "$0.01", "min_lot": 0.01}
        ]

    def update_sentiment(self):
        """Simulează fluctuațiile sentimentului de piață."""
        import random
        self.data["sentiment"]["vix"] = round(self.data["sentiment"]["vix"] + random.uniform(-0.1, 0.1), 2)
        vix = self.data["sentiment"]["vix"]
        if vix > 25: self.data["sentiment"]["label"] = "EXTREME FEAR"
        elif vix > 20: self.data["sentiment"]["label"] = "FEAR"
        elif vix < 15: self.data["sentiment"]["label"] = "GREED"
        else: self.data["sentiment"]["label"] = "STABLE"

    def update_bot_scanning_data(self):
        """Citește starea boților din fișierul JSON local (Atomic)."""
        if os.path.exists(BOT_STATES_FILE):
            try:
                with open(BOT_STATES_FILE, "r") as f:
                    bot_states = json.load(f)
                    
                processed_bots = []
                for bot_id, bdata in bot_states.items():
                    bdata["id"] = bot_id
                    bdata["live_pl"] = 0.0 
                    processed_bots.append(bdata)
                
                self.data["bots"] = processed_bots
            except Exception as e:
                logger.error(f"Error reading local bot states: {e}")

    def match_positions_to_bots(self):
        """Unifică datele de scanare cu profitul real din pozițiile deschise."""
        for bot in self.data["bots"]:
            bot["live_pl"] = 0.0

        for pos in self.raw_positions:
            # Folosim getattr pentru a preveni erori dacă atributul lipsește în anumite versiuni
            comment = str(getattr(pos, 'comment', '')).lower()
            
            # cTrader returnează profitul în cenți. Împărțim la 100 pentru a afișa valoarea reală.
            raw_profit = getattr(pos, 'unrealized_gross_profit', getattr(pos, 'unrealizedProfit', 0.0))
            profit = float(raw_profit) / 100
            
            for bot in self.data["bots"]:
                if bot["id"].lower() in comment:
                    bot["live_pl"] += profit

    async def fetch_ctrader_data(self):
        """Interacțiune asincronă cu cTrader Open API folosind metodele de nivel înalt."""
        if not self.client or self.data["api_status"] == "reconnecting":
            return

        try:
            # 1. Fetch Account Info (cTrader API returnează valorile în cenți, împărțim la 100)
            account_res = await self.client.get_account_info(CONFIG["ACCOUNT_ID"])
            self.data["account"]["equity"] = float(getattr(account_res, 'equity', 0.0)) / 100
            self.data["account"]["balance"] = float(getattr(account_res, 'balance', 0.0)) / 100
            self.data["account"]["currency"] = getattr(account_res, 'currency', 'USD')
            
            # 2. Fetch Positions (Sintaxa corectă v0.9.2)
            positions_res = await self.client.get_positions(CONFIG["ACCOUNT_ID"])
            self.raw_positions = positions_res.positions if positions_res else []
            
            # 3. Unifică datele
            self.match_positions_to_bots()
            self.data["api_status"] = "connected"
            
        except Exception as e:
            logger.error(f"cTrader sync error: {e}")
            self.data["api_status"] = "reconnecting"

# --- WEBSOCKET MANAGER ---
class WebSocketManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                pass

state_manager = TrinityState()
ws_manager = WebSocketManager()

async def unity_background_task():
    while True:
        try:
            state_manager.update_bot_scanning_data()
            state_manager.update_sentiment()
            state_manager.calculate_risk_metrics()
            state_manager.get_market_specs()
            state_manager.update_market_news()
            state_manager.update_order_book()
            await state_manager.fetch_ctrader_data()
            await ws_manager.broadcast(state_manager.data)
        except Exception as e:
            logger.error(f"Main loop error: {e}")
        await asyncio.sleep(2)

@app.get("/api/status")
async def get_status():
    return state_manager.data

@app.websocket("/ws/feed")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        await websocket.send_json(state_manager.data)
        while True:
            message_text = await websocket.receive_text()
            try:
                payload = json.loads(message_text)
                if payload.get("type") == "MANUAL_TRADE":
                    logger.info(f"🚀 MANUAL TRADE RECEIVED: {payload.get('side')} {payload.get('lot')} {payload.get('symbol')}")
                if payload.get("type") == "BOT_COMMAND":
                    logger.info(f"🤖 BOT COMMAND RECEIVED: {payload.get('command')} FOR BOT {payload.get('botId')}")
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)

# --- RULARE ---
# uvicorn dashboard_api:app --host 0.0.0.0 --port 8000
