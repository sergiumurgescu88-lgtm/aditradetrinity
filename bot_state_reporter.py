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
    In Linux, os.replace() este o operatie atomica la nivel de sistem de fisiere.
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

        # 3. SCRIERE ATOMICA (Prevenim coruperea fisierului daca boti multipli scriu simultan)
        # Cream un fisier temporar in acelasi director (/tmp/ este de obicei in RAM)
        fd, temp_path = tempfile.mkstemp(dir="/tmp", prefix=f"trinity_{bot_id}_", suffix=".json")
        try:
            with os.fdopen(fd, 'w') as tmp:
                json.dump(data, tmp, indent=4)
            
            # In Linux, os.replace() asigura ca fisierul tinta este inlocuit instantaneu
            os.replace(temp_path, filepath)
        except Exception as e:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise e

    except Exception as e:
        # CRITIC: Nu blocam niciodata executia principala a botului de trading
        logger.error(f"⚠️ [Trinity] Failed to update status for {bot_id}: {e}")

# Exemplu utilizare:
# update_trinity_status("gamma", "Gamma Scalp", "SCANEZĂ", 32.4, 1.31, 0.01, "H4 NEUTRAL")
