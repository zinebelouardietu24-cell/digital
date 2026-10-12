"""
Défauts que l'on peut injecter pendant une démonstration.

Les données du mois de juillet ne contiennent qu'un seul vrai défaut (un
cyclone hors service le 17/07). Pour montrer l'outil sur chaque type de
défaut, on modifie quelques mesures comme le ferait le défaut réel, puis on
vérifie que le jumeau le détecte et le nomme correctement.

Chaque modification est soit un décalage ("add"), soit un facteur ("mul"),
soit une valeur imposée ("set").
"""
from typing import Any, Dict, List

SCENARIOS: List[Dict[str, Any]] = [
    {
        "id": "pompe_balourd", "name": "Balourd de la roue de pompe", "equipment": "SP_001",
        "expected": ["SP_VIB"],
        "description": "La roue usée tourne de façon déséquilibrée : la vibration de la pompe augmente fortement.",
        "changes": [("SP001_Vibration_mms", "add", 2.6)],
    },
    {
        "id": "pompe_cavitation", "name": "Cavitation de la pompe", "equipment": "SP_001",
        "expected": ["SP_CAV"],
        "description": "Le bac se vide : la pompe aspire de l'air, la pression de refoulement et le courant chutent.",
        "changes": [("PB001_Level_pct", "set", 30.0), ("SP001_Discharge_Pressure_kPa", "mul", 0.65),
                    ("SP001_Motor_Current_A", "mul", 0.65)],
    },
    {
        "id": "pompe_palier", "name": "Surchauffe du palier de pompe", "equipment": "SP_001",
        "expected": ["SP_TEMP"],
        "description": "Le palier manque de graisse : sa température monte.",
        "changes": [("SP001_Bearing_Temp_C", "add", 22.0)],
    },
    {
        "id": "bac_debordement", "name": "Niveau du bac trop haut", "equipment": "PB_001",
        "expected": ["PB_HAUT"],
        "description": "L'alimentation dépasse ce que la pompe peut évacuer : le bac se remplit.",
        "changes": [("PB001_Level_pct", "set", 88.0)],
    },
    {
        "id": "broyeur_palier", "name": "Surchauffe du palier du broyeur", "equipment": "BM_001",
        "expected": ["BM_TEMP"],
        "description": "Le filtre à huile est colmaté : la température du palier côté entraînement monte.",
        "changes": [("BM001_Bearing_DE_Temp_C", "add", 22.0)],
    },
    {
        "id": "broyeur_surcharge", "name": "Surcharge du broyeur", "equipment": "BM_001",
        "expected": ["BM_SURCH"],
        "description": "Trop de matière dans le broyeur : la puissance et le courant du moteur augmentent.",
        "changes": [("BM001_Power_Draw_kW", "mul", 1.40), ("BM001_Motor_Current_A", "mul", 1.40)],
    },
    {
        "id": "broyeur_vibration", "name": "Vibration du broyeur", "equipment": "BM_001",
        "expected": ["BM_VIB"],
        "description": "Un blindage desserré ou un défaut d'engrènement fait vibrer le broyeur.",
        "changes": [("BM001_Vibration_mms", "add", 4.5)],
    },
    {
        "id": "cyclone_bouche", "name": "Apex de cyclone bouché", "equipment": "CY_001",
        "expected": ["CY_BOUCHE"],
        "description": "Un débris bouche l'apex : la pression d'entrée et la perte de charge montent.",
        "changes": [("CY001_Inlet_Pressure_kPa", "add", 100.0), ("CY001_Vortex_DP_kPa", "add", 28.0)],
    },
    {
        "id": "cyclone_arret", "name": "Cyclone hors service", "equipment": "CY_001",
        "expected": ["CY_ARRET"],
        "description": "Une vanne d'isolement se ferme : un des quatre cyclones est arrêté.",
        "changes": [("CY001_Cyclones_Online", "set", 3.0)],
    },
]

_BY_ID = {s["id"]: s for s in SCENARIOS}


def get_scenario(scenario_id: str) -> Dict[str, Any]:
    return _BY_ID.get(scenario_id)


def apply(values: Dict[str, float], scenario: Dict[str, Any]) -> Dict[str, float]:
    """Renvoie une copie des mesures modifiées par le défaut injecté."""
    out = dict(values)
    for col, op, k in scenario["changes"]:
        try:
            x = float(out.get(col, 0.0))
        except (TypeError, ValueError):
            x = 0.0
        out[col] = x + k if op == "add" else x * k if op == "mul" else k
    return out


def public_list() -> List[Dict[str, Any]]:
    return [{k: s[k] for k in ("id", "name", "equipment", "description")} for s in SCENARIOS]
