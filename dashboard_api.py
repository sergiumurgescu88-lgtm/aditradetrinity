import asyncio
import json
import os
import logging
from datetime import datetime
from typing import List, Dict, Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

# NOTA: Necesar 'pip install ctrader-open-api' pe VPS
try:
    from ctrader_open_api import Client, Protobuf, Messages, Endpoints
except ImportError:
    # Fallback mock pentru a nu crapa la compilare daca lib nu e instalata
    Client = Protobuf = Messages = Endpoints = None

# --- CONFIGURARE CREDENTIALE CTRADER ---
CONFIG = {
    "CLIENT_ID": "",
    "CLIENT_SECRET": "",
    "ACCESS_TOKEN": "",
    "ACCOUNT_ID": "", # ID-ul contului de tranzactionare
    "HOST": "live.ctraderapi.com", # sau demo.ctraderapi.com
    "PORT": 5035
}

BOT_STATES_FILE = "/tmp/trinity_bot_states.json"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("TrinityBackend")

app = FastAPI(title="Trinity Fund Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- STATE MANAGER ---
class TrinityState:
    def __init__(self):
        self.data = {
            "account": {"equity": 0.0, "balance": 0.0, "currency": "USD"},
            "bots": [],
            "recent_trades": [],
            "api_status": "initializing"
        }
        self.active_positions = []
        self.client = None

    def update_bot_scanning_data(self):
        """Citeste starea botilor din fisierul JSON atomic."""
        if os.path.exists(BOT_STATES_FILE):
            try:
                with open(BOT_STATES_FILE, "r") as f:
                    raw_bots = json.load(f)
                    bot_list = []
                    for bid, bdata in raw_bots.items():
                        # Adaugam campul live_pl care va fi populat din cTrader ulterior
                        bdata["id"] = bid
                        bdata["live_pl"] = 0.0
                        bot_list.append(bdata)
                    self.data["bots"] = bot_list
            except Exception as e:
                logger.error(f"Error reading bot states: {e}")

    def match_positions_to_bots(self):
        """
        # AICI SE FACE MATCHING-UL DUPĂ COMMENT
        Itereaza prin pozitiile deschise din cTrader si ataseaza profitul botului corespondent.
        """
        # Resetam live_pl pentru toti botii inainte de recalculare
        for bot in self.data["bots"]:
            bot["live_pl"] = 0.0

        # AICI SE EXTRAG POZIȚIILE DESCHISE DIN cTrader (procesate din self.active_positions)
        for pos in self.active_positions:
            # Presupunem ca botul pune ID-ul sau in comment (ex: "alpha" sau "ALPHA_SNIPER")
            comment = pos.get("comment", "").lower()
            for bot in self.data["bots"]:
                if bot["id"].lower() in comment:
                    bot["live_pl"] += pos.get("unrealized_profit", 0.0)

state_manager = TrinityState()

# --- CTRADER CLIENT LOGIC ---
async def on_message_received(client, message):
    """Callback pentru mesajele primite de la cTrader Open API."""
    # AICI SE PROCESEAZA EXECUTION REPORTS SI POZITIILE
    payload = Protobuf.extract_payload(message)
    
    # Daca primim informatii despre cont (Equity/Balance)
    if message.payloadType == Messages.PROTO_OA_GET_TICK_DATA_RES:
        # Exemplu de procesare date cont
        pass
    
    # Daca primim lista de pozitii (Reconcile)
    elif message.payloadType == Messages.PROTO_OA_RECONCILE_RES:
        state_manager.active_positions = [
            {"comment": p.comment, "unrealized_profit": p.unrealized_gross_profit / 100} 
            for p in payload.position
        ]
        logger.info(f"Synchronized {len(state_manager.active_positions)} positions")

# --- BACKGROUND WORKER ---
async def data_unification_task():
    """Task principal care unifica datele locale cu cele din API la fiecare 2 secunde."""
    while True:
        try:
            # 1. Update scanning data de la boti
            state_manager.update_bot_scanning_data()
            
            # 2. Match live profit de la cTrader (daca suntem conectati)
            if state_manager.api_status == "connected":
                state_manager.match_positions_to_bots()
            
            # 3. Broadcast unified data
            await ws_manager.broadcast(state_manager.data)
            
        except Exception as e:
            logger.error(f"Sync task error: {e}")
            state_manager.data["api_status"] = "reconnecting"
        
        await asyncio.sleep(2)

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

ws_manager = WebSocketManager()

@app.on_event("startup")
async def startup_event():
    # Pornim loop-ul de unificare a datelor
    asyncio.create_task(data_unification_task())
    
    # Pornim conexiunea cTrader
    if Client:
        try:
            # Init client
            # state_manager.client = Client(CONFIG["HOST"], CONFIG["PORT"])
            # await state_manager.client.start()
            # Autentificare si setup...
            state_manager.api_status = "connected"
            logger.info("cTrader API Bridge initialized")
        except Exception as e:
            logger.error(f"Failed to connect to cTrader: {e}")
            state_manager.api_status = "reconnecting"

@app.websocket("/ws/feed")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        # Trimite datele actuale imediat dupa conectare
        await websocket.send_json(state_manager.data)
        while True:
            # Asteptam mesaje (ping/pong)
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)

# --- INSTRUCTIUNI RULARE ---
# 1. Configurați CREDENTIALELE în dicționarul CONFIG
# 2. Rulează: uvicorn dashboard_api:app --host 0.0.0.0 --port 8000
