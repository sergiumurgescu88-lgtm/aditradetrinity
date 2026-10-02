import json
import os
import tempfile
import time
import logging

# Configurare logging minimala pentru boti
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("TrinityReporter")

def update_trinity_status(bot_id, name, status, adx, whale, lot, bias, current_pl=0.0):
    """
    Actualizeaza starea botului intr-un mod atomic si non-blocking.
    Aceasta functie este proiectata pentru a fi apelata din procese separate (PM2).
    Utilizeaza modelul 'tempfile + os.replace' pentru a asigura integritatea datelor
    in cazul in care mai multi boti scriu simultan in acelasi fisier de stare.
    """
    filepath = "/tmp/trinity_bot_states.json"
    
    try:
        # 1. Citim datele existente pentru a face merge (evitam suprascrierea altor boti)
        data = {}
        if os.path.exists(filepath):
            try:
                with open(filepath, "r") as f:
                    data = json.load(f)
            except (json.JSONDecodeError, IOError):
                # Daca fisierul e corupt sau gol, incepem cu un dict nou
                data = {}

        # 2. Pregatim payload-ul actualizat pentru acest bot specific
        data[bot_id] = {
            "name": name,
            "status": status,
            "adx": float(adx),
            "whale": float(whale),
            "lot": float(lot),
            "bias": str(bias).upper(),
            "last_update": time.time(),
            "reported_pl": float(current_pl)
        }

        # 3. SCRIERE ATOMICA
        # Cream un fisier temporar in acelasi director (/tmp/ este de obicei in RAM)
        # Directorul /tmp asigura viteza maxima de scriere si acces.
        dir_name = os.path.dirname(filepath)
        fd, temp_path = tempfile.mkstemp(dir=dir_name, prefix=f"trinity_{bot_id}_", suffix=".json")
        
        try:
            with os.fdopen(fd, 'w') as tmp:
                json.dump(data, tmp, indent=4)
            
            # In Linux, os.replace() este o operatie atomica.
            # Aceasta asigura ca cititorii (dashboard_api.py) vad fie varianta veche, 
            # fie varianta noua, niciodata un fisier partial scris (corupt).
            os.replace(temp_path, filepath)
        except Exception as e:
            # Curatam fisierul temporar in caz de eroare inainte de inlocuire
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise e

    except Exception as e:
        # CRITIC: Nu blocam niciodata executia principala a botului de trading daca raportarea esueaza
        logger.error(f"⚠️ [Trinity] Failed to update status for {bot_id}: {e}")

# --- EXEMPLU DE INTEGRARE IN LOGICA BOTULUI ---
# if __name__ == "__main__":
#     update_trinity_status(
#         bot_id="alpha_sniper", 
#         name="Alpha Sniper", 
#         status="ÎN TRADE", 
#         adx=28.4, 
#         whale=1.2, 
#         lot=0.10, 
#         bias="H4 BUY"
#     )
