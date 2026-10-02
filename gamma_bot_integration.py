"""
EXEMPLU DE INTEGRARE PENTRU BOT (gamma-scalp.py)
-----------------------------------------------
Acest snippet arata cum sa conectati un bot Python existent la dashboard-ul Trinity.
"""

import time
from bot_state_reporter import update_trinity_status

# Daca folositi ctrader-open-api:
# from ctrader_open_api import Protobuf, Messages

BOT_ID = "gamma"
BOT_NAME = "Gamma Scalp"

def main_bot_loop():
    while True:
        # --- 1. LOGICA DE SCANARE A BOTULUI ---
        adx_val = 32.4  # calculat din indicatori
        whale_vol = 1.31 # calculat din volume
        h4_bias = "NEUTRAL"
        current_status = "SCANEZĂ"
        
        # --- 2. RAPORTARE CATRE DASHBOARD ---
        # Aceasta functie este non-blocking si thread-safe (atomica)
        update_trinity_status(
            bot_id=BOT_ID,
            name=BOT_NAME,
            status=current_status,
            adx=adx_val,
            whale=whale_vol,
            lot=0.01,
            bias=h4_bias
        )
        
        # --- 3. LOGICA DE TRADING (DESCHIDERE ORDIN) ---
        if adx_val > 25:
            # Exemplu de deschidere ordin prin cTrader Open API
            # TREBUIE SA ADAUGATI COMMENT PENTRU CA DASHBOARD-UL SA RECUNOASCA PROFITUL LIVE
            
            # request = ProtoOANewOrderReq()
            # request.ctidTraderAccountId = ACCOUNT_ID
            # request.symbolId = SYMBOL_ID
            # request.orderType = ProtoOAOrderType.MARKET
            # request.tradeSide = ProtoOATradeSide.BUY
            # request.volume = 1000 # 0.01 lot
            
            # --- CRITIC: Dashboard-ul cauta BOT_ID in campul comment ---
            # request.comment = f"{BOT_ID}_scalp" 
            
            # client.send(request)
            
            print(f"[{BOT_NAME}] Ordin trimis cu comment='{BOT_ID}_scalp'")
            
            # Actualizam statusul in dashboard imediat dupa trade
            update_trinity_status(BOT_ID, BOT_NAME, "ÎN TRADE", adx_val, whale_vol, 0.01, h4_bias)

        time.sleep(3) # Bucla de scanare la 3 secunde

if __name__ == "__main__":
    main_bot_loop()
