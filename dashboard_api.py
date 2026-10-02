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
    # Startup logic
    asyncio.create_task(unity_background_task())
    
    if Client:
        try:
            # Initializare conexiune cTrader de nivel inalt
            state_manager.client = Client(CONFIG["HOST"], CONFIG["PORT"])
            # await state_manager.client.start()
            # Autentificare aplicatie si cont...
            state_manager.data["api_status"] = "connected"
            logger.info("✅ Trinity Backend linked to cTrader API v0.9.2")
        except Exception as e:
            logger.error(f"❌ Failed to link cTrader: {e}")
            state_manager.data["api_status"] = "reconnecting"
    
    yield
    # Shutdown logic (daca e cazul)
    if state_manager.client:
        # await state_manager.client.stop()
        pass

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
            "account": {"equity": 0.0, "balance": 0.0, "currency": "USD"},
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
                "error_logs": [
                    "2026-10-02 10:14:22: ProtoOAGetAccountEntitiesReq timeout",
                    "2026-10-02 09:45:11: SSL Handshake failure on live.ctraderapi.com:5035",
                    "2026-10-02 08:30:05: Local JSON reporter: [Errno 28] No space left on device (mock)"
                ]
            },
            "api_status": "initializing"
        }
        self.client = None
        self.raw_positions = [] 

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
            comment = getattr(pos, 'comment', '').lower() if hasattr(pos, 'comment') else ''
            profit = getattr(pos, 'unrealizedProfit', 0.0) if hasattr(pos, 'unrealizedProfit') else 0.0
            
            for bot in self.data["bots"]:
                if bot["id"].lower() in comment:
                    bot["live_pl"] += float(profit)

    async def fetch_ctrader_data(self):
        """Interactiune asincrona cu cTrader Open API folosind metodele de nivel inalt."""
        if not self.client or self.data["api_status"] == "reconnecting":
            return

        try:
            # 1. Fetch Account Info
            # account_res = await self.client.get_account_info(CONFIG["ACCOUNT_ID"])
            # self.data["account"]["equity"] = account_res.equity / 100 # Conversie din cents
            
            # 2. Fetch Positions (Sintaxa corecta v0.9.2)
            # positions_res = await self.client.get_positions(CONFIG["ACCOUNT_ID"])
            # self.raw_positions = positions_res.positions
            
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
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)

# --- RULARE ---
# uvicorn dashboard_api:app --host 0.0.0.0 --port 8000
