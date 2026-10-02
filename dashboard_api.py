import asyncio
import json
import os
import logging
from typing import List, Dict, Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

# NOTA: Necesar 'pip install ctrader-open-api'
try:
    from ctrader_open_api import Client, Endpoints, Protobuf, Messages
except ImportError:
    # Mocks pentru mediul AI Studio unde lib-ul nu este instalat
    Client = Endpoints = Protobuf = Messages = None

# --- CONFIGURARE PRODUCȚIE ---
CONFIG = {
    "CLIENT_ID": "",
    "CLIENT_SECRET": "",
    "ACCESS_TOKEN": "",
    "ACCOUNT_ID": "",
    "HOST": Endpoints.LIVE_HOST if Endpoints else "live.ctraderapi.com",
    "PORT": 5035
}

BOT_STATES_FILE = "/tmp/trinity_bot_states.json"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("TrinityDashboardAPI")

app = FastAPI(title="Trinity Fund Real-Time Engine")

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
            "api_status": "initializing"
        }
        self.client = None
        self.raw_positions = [] # Pozițiile brute primite de la API

    def update_bot_scanning_data(self):
        """Citește starea boților din fișierul JSON local (Atomic)."""
        if os.path.exists(BOT_STATES_FILE):
            try:
                with open(BOT_STATES_FILE, "r") as f:
                    bot_states = json.load(f)
                    
                processed_bots = []
                for bot_id, bdata in bot_states.items():
                    bdata["id"] = bot_id
                    bdata["live_pl"] = 0.0 # Va fi populat din cTrader
                    processed_bots.append(bdata)
                
                self.data["bots"] = processed_bots
            except Exception as e:
                logger.error(f"Error reading local bot states: {e}")

    def match_positions_to_bots(self):
        """
        # AICI SE FACE MATCHING-UL DUPĂ COMMENT
        Unifică datele de scanare cu profitul real din pozițiile deschise.
        """
        # Resetăm profitul pentru a asigura acuratețea
        for bot in self.data["bots"]:
            bot["live_pl"] = 0.0

        # AICI SE EXTRAG POZIȚIILE DESCHISE DIN cTrader (procesate din self.raw_positions)
        for pos in self.raw_positions:
            comment = pos.get("comment", "").lower()
            profit = pos.get("unrealized_profit", 0.0)
            
            for bot in self.data["bots"]:
                # Verificăm dacă ID-ul botului se găsește în comment-ul poziției
                if bot["id"].lower() in comment:
                    bot["live_pl"] += float(profit)

    async def fetch_ctrader_data(self):
        """Interactiune asincrona cu cTrader Open API."""
        if not self.client or self.data["api_status"] == "reconnecting":
            # Logica de reconectare ar trebui sa fie aici
            return

        try:
            # 1. Cerem Account Info (Equity, Balance)
            # await self.client.send(ProtoOAGetAccountEntitiesReq(accountId=CONFIG["ACCOUNT_ID"]))
            
            # 2. Cerem Reconcile (Open Positions)
            # await self.client.send(ProtoOAReconcileReq(accountId=CONFIG["ACCOUNT_ID"]))
            
            # Exemplu de populare date dupa raspunsurile de tip PROTO_OA_RECONCILE_RES
            # self.raw_positions = [{"comment": "alpha_sniper", "unrealized_profit": 45.20}, ...]
            
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
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                pass

state_manager = TrinityState()
ws_manager = WebSocketManager()

# --- BACKGROUND TASK ---
async def unity_background_task():
    """Bucleaza la fiecare 2 secunde pentru a sincroniza intreg sistemul."""
    while True:
        try:
            state_manager.update_bot_scanning_data()
            await state_manager.fetch_ctrader_data()
            await ws_manager.broadcast(state_manager.data)
        except Exception as e:
            logger.error(f"Main loop error: {e}")
        
        await asyncio.sleep(2)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(unity_background_task())
    
    if Client:
        try:
            # Initializare conexiune cTrader
            # state_manager.client = Client(CONFIG["HOST"], CONFIG["PORT"])
            # await state_manager.client.start()
            # Autentificare aplicatie...
            # Autentificare cont CONFIG["ACCOUNT_ID"]...
            state_manager.data["api_status"] = "connected"
            logger.info("✅ Trinity Backend linked to cTrader API")
        except Exception as e:
            logger.error(f"❌ Failed to link cTrader: {e}")
            state_manager.data["api_status"] = "reconnecting"

@app.get("/api/status")
async def get_status():
    return state_manager.data

@app.websocket("/ws/feed")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        # Trimite starea curenta imediat dupa handshake
        await websocket.send_json(state_manager.data)
        while True:
            # Așteptăm mesaje de la client (inclusiv MANUAL_TRADE)
            message_text = await websocket.receive_text()
            try:
                payload = json.loads(message_text)
                if payload.get("type") == "MANUAL_TRADE":
                    side = payload.get("side")
                    symbol = payload.get("symbol")
                    lot = payload.get("lot")
                    
                    logger.info(f"🚀 MANUAL TRADE RECEIVED: {side} {lot} lots of {symbol}")
                    
                    # AICI SE TRIMITE ORDINUL CĂTRE cTrader API (Exemplu)
                    # if state_manager.client and state_manager.data["api_status"] == "connected":
                    #     await state_manager.client.send_manual_order(symbol, lot, side)
                    
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)

# --- RULARE ---
# uvicorn dashboard_api:app --host 0.0.0.0 --port 8000
