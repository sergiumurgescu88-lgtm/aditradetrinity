import json
import os
import tempfile
import logging

# Configurare logging minimal pentru boti
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("TrinityReporter")

def update_trinity_status(bot_id, name, status, adx, whale, lot, bias, current_pl=0.0):
    """
    Actualizeaza starea botului intr-un mod atomic si thread-safe.
    Foloseste un fisier temporar si os.replace pentru a evita coruperea JSON-ului
    atunci cand mai multi boti scriu simultan.
    """
    filepath = "/tmp/trinity_bot_states.json"
    
    try:
        # 1. Citim starea actuala (cu lock implicit prin logica de operare pe fisier daca e necesar, 
        # dar aici ne bazam pe scrierea atomica finala)
        data = {}
        if os.path.exists(filepath):
            try:
                with open(filepath, "r") as f:
                    data = json.load(f)
            except (json.JSONDecodeError, IOError):
                # Daca fisierul e corupt sau gol, incepem de la zero
                data = {}

        # 2. Actualizam doar datele acestui bot specific
        data[bot_id] = {
            "name": name,
            "status": status,
            "adx": round(float(adx), 2),
            "whale": round(float(whale), 2),
            "lot": round(float(lot), 2),
            "bias": str(bias).upper(),
            "last_update": os.times()[4], # Timestamp intern
            "current_pl": round(float(current_pl), 2)
        }

        # 3. Scriem intr-un fisier temporar (Atomic Write Pattern)
        # Directorul /tmp/ este ideal pentru performanta (adesea in RAM)
        fd, temp_path = tempfile.mkstemp(dir="/tmp", prefix="trinity_update_", suffix=".json")
        try:
            with os.fdopen(fd, 'w') as tmp:
                json.dump(data, tmp, indent=4)
            
            # 4. Inlocuim fisierul original cu cel temporar (Operatie atomica in Linux)
            os.replace(temp_path, filepath)
        except Exception as e:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise e

    except Exception as e:
        # Nu blocam niciodata executia botului daca raportarea esueaza
        logger.error(f"Failed to report status for {bot_id}: {e}")

# Exemplu de integrare in bot:
# if __name__ == "__main__":
#     update_trinity_status("alpha", "Alpha Sniper", "ÎN TRADE", 28.5, 1.45, 0.01, "H4 BUY")
