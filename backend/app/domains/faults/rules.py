"""
Règles de détection et de diagnostic des défauts du circuit de broyage.

Chaque règle se lit comme le raisonnement d'un technicien :
    SI <condition sur les mesures> ALORS <défaut> -> <action conseillée>.

Les seuils viennent de trois sources, indiquées dans chaque règle :
  - une norme (ISO 10816-3 pour les vibrations des machines tournantes) ;
  - l'historique de maintenance (GMAO) ;
  - les limites de fonctionnement du circuit : la plage observée pendant
    un mois de fonctionnement normal (juillet 2026), avec une marge.

Ce module ne dépend de rien d'autre que de Python : il peut être testé seul.
"""
from typing import Any, Callable, Dict, List, Optional

ALERTE = "alerte"   # à surveiller, intervention à planifier
ALARME = "alarme"   # action immédiate


def _v(values: Dict[str, float], col: str) -> Optional[float]:
    value = values.get(col)
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _seuils(col: str, alerte: float, alarme: float, bande: float) -> Callable[..., Optional[str]]:
    """Règle à deux niveaux sur une seule mesure, avec hystérésis : une fois
    active, elle ne disparaît que si la mesure redescend de `bande` sous le
    seuil d'alerte. Une mesure bruitée qui oscille autour du seuil ne fait
    donc pas « clignoter » l'alarme."""
    def regle(values: Dict[str, float], deja_actif: bool = False) -> Optional[str]:
        x = _v(values, col)
        if x is None:
            return None
        if x >= alarme:
            return ALARME
        if x >= (alerte - bande if deja_actif else alerte):
            return ALERTE
        return None
    return regle


def _cavitation(values: Dict[str, float], deja_actif: bool = False) -> Optional[str]:
    # Trois symptômes ensemble : niveau du bac bas, pression de refoulement
    # et courant moteur qui chutent. Un seul symptôme ne suffit pas.
    niveau = _v(values, "PB001_Level_pct")
    pression = _v(values, "SP001_Discharge_Pressure_kPa")
    courant = _v(values, "SP001_Motor_Current_A")
    if None in (niveau, pression, courant):
        return None
    if niveau < 38 and pression < 250 and courant < 100:
        return ALARME
    return None


def _surcharge_broyeur(values: Dict[str, float], deja_actif: bool = False) -> Optional[str]:
    puissance = _v(values, "BM001_Power_Draw_kW")
    courant = _v(values, "BM001_Motor_Current_A")
    if None in (puissance, courant):
        return None
    if puissance > 2300 and courant > 380:
        return ALARME
    if puissance > 2180 and courant > 360:
        return ALERTE
    return None


def _cyclone_bouche(values: Dict[str, float], deja_actif: bool = False) -> Optional[str]:
    pression = _v(values, "CY001_Inlet_Pressure_kPa")
    dp = _v(values, "CY001_Vortex_DP_kPa")
    if None in (pression, dp):
        return None
    if pression > 350 and dp > 115:
        return ALARME
    if pression > 330 and dp > 110:
        return ALERTE
    return None


def _cyclone_arrete(values: Dict[str, float], deja_actif: bool = False) -> Optional[str]:
    en_service = _v(values, "CY001_Cyclones_Online")
    if en_service is None:
        return None
    return ALARME if en_service < 3 else ALERTE if en_service < 4 else None


RULES: List[Dict[str, Any]] = [
    # ------------------------------------------------------------ pompe SP_001
    {
        "id": "SP_VIB", "equipment": "SP_001", "equipment_name": "Pompe à pulpe",
        "fault": "Vibration excessive (usure ou balourd de la roue)",
        "measure": "SP001_Vibration_mms", "unit": "mm/s",
        "condition": "Vibration ≥ 2,8 mm/s (alerte) · ≥ 4,5 mm/s (alarme)",
        "source": "ISO 10816-3, groupe 2, zones B/C et C/D",
        "action": "Planifier une inspection de la roue et du revêtement d'usure.",
        "check": _seuils("SP001_Vibration_mms", 2.8, 4.5, bande=0.2),
    },
    {
        "id": "SP_TEMP", "equipment": "SP_001", "equipment_name": "Pompe à pulpe",
        "fault": "Surchauffe du palier",
        "measure": "SP001_Bearing_Temp_C", "unit": "°C",
        "condition": "Température palier ≥ 60 °C (alerte) · ≥ 70 °C (alarme)",
        "source": "Limite de fonctionnement (normal : 46 à 54 °C)",
        "action": "Vérifier la lubrification et l'alignement de la pompe.",
        "check": _seuils("SP001_Bearing_Temp_C", 60, 70, bande=2),
    },
    {
        "id": "SP_CAV", "equipment": "SP_001", "equipment_name": "Pompe à pulpe",
        "fault": "Cavitation",
        "measure": "SP001_Discharge_Pressure_kPa", "unit": "kPa",
        "condition": "Niveau du bac < 38 % ET pression < 250 kPa ET courant < 100 A",
        "source": "Règle métier (trois symptômes simultanés)",
        "action": "Remonter le niveau du bac ou réduire la vitesse de la pompe.",
        "check": _cavitation,
    },
    # ------------------------------------------------------------ bac PB_001
    {
        "id": "PB_HAUT", "equipment": "PB_001", "equipment_name": "Bac de pompage",
        "fault": "Niveau trop haut (risque de débordement)",
        "measure": "PB001_Level_pct", "unit": "%",
        "condition": "Niveau ≥ 75 % (alerte) · ≥ 85 % (alarme)",
        "source": "Limite de fonctionnement (normal : 42 à 69 %)",
        "action": "Augmenter la vitesse de la pompe ou réduire l'alimentation.",
        "check": _seuils("PB001_Level_pct", 75, 85, bande=3),
    },
    # ------------------------------------------------------------ broyeur BM_001
    {
        "id": "BM_VIB", "equipment": "BM_001", "equipment_name": "Broyeur à boulets",
        "fault": "Vibration excessive",
        "measure": "BM001_Vibration_mms", "unit": "mm/s",
        "condition": "Vibration ≥ 4,5 mm/s (alerte) · ≥ 7,1 mm/s (alarme)",
        "source": "ISO 10816-3, groupe 1, zones B/C et C/D",
        "action": "Contrôler les paliers, l'engrènement et la fixation des blindages.",
        "check": _seuils("BM001_Vibration_mms", 4.5, 7.1, bande=0.2),
    },
    {
        "id": "BM_TEMP", "equipment": "BM_001", "equipment_name": "Broyeur à boulets",
        "fault": "Surchauffe du palier",
        "measure": "BM001_Bearing_DE_Temp_C", "unit": "°C",
        "condition": "Température palier ≥ 68 °C (alerte) · ≥ 75 °C (alarme)",
        "source": "GMAO : alerte palier à 68 °C (WO-2026-0820)",
        "action": "Vérifier le filtre et le niveau d'huile de lubrification.",
        "check": _seuils("BM001_Bearing_DE_Temp_C", 68, 75, bande=2),
    },
    {
        "id": "BM_SURCH", "equipment": "BM_001", "equipment_name": "Broyeur à boulets",
        "fault": "Surcharge",
        "measure": "BM001_Power_Draw_kW", "unit": "kW",
        "condition": "Puissance > 2 180 kW ET courant > 360 A (alerte) · > 2 300 kW ET > 380 A (alarme)",
        "source": "Limite de fonctionnement (normal : ≤ 2 130 kW et ≤ 352 A)",
        "action": "Réduire le débit d'alimentation du circuit.",
        "check": _surcharge_broyeur,
    },
    # ------------------------------------------------------------ hydrocyclones CY_001
    {
        "id": "CY_APEX", "equipment": "CY_001", "equipment_name": "Hydrocyclones",
        "fault": "Usure des apex",
        "measure": "CY001_Apex_Wear_Index_pct", "unit": "%",
        "condition": "Usure ≥ 45 % (alerte) · ≥ 50 % (alarme)",
        "source": "GMAO : apex remplacés à 50 % d'usure (19/07/2026)",
        "action": "Préparer puis remplacer les apex.",
        "check": _seuils("CY001_Apex_Wear_Index_pct", 45, 50, bande=3),
    },
    {
        "id": "CY_BOUCHE", "equipment": "CY_001", "equipment_name": "Hydrocyclones",
        "fault": "Engorgement (apex bouché)",
        "measure": "CY001_Inlet_Pressure_kPa", "unit": "kPa",
        "condition": "Pression d'entrée > 330 kPa ET ΔP > 110 kPa (alerte) · > 350 et > 115 (alarme)",
        "source": "Limite de fonctionnement (normal : ≤ 320 kPa et ≤ 107 kPa)",
        "action": "Déboucher l'apex et rincer le collecteur d'alimentation.",
        "check": _cyclone_bouche,
    },
    {
        "id": "CY_ARRET", "equipment": "CY_001", "equipment_name": "Hydrocyclones",
        "fault": "Cyclone hors service",
        "measure": "CY001_Cyclones_Online", "unit": "cyclones",
        "condition": "Moins de 4 cyclones en service (alerte) · moins de 3 (alarme)",
        "source": "Configuration nominale : 4 cyclones",
        "action": "Vérifier la vanne d'isolement et remettre le cyclone en service.",
        "check": _cyclone_arrete,
    },
]

# Les règles s'appliquent à la médiane des dernières minutes, et non à la
# dernière mesure seule : cela évite qu'une alarme « clignote » quand une
# mesure bruitée oscille autour de son seuil.
FENETRE_MIN = 10

# Colonnes dont les règles ont besoin.
RULE_COLUMNS = sorted({
    "SP001_Vibration_mms", "SP001_Bearing_Temp_C", "SP001_Discharge_Pressure_kPa", "SP001_Motor_Current_A",
    "PB001_Level_pct", "BM001_Vibration_mms", "BM001_Bearing_DE_Temp_C", "BM001_Power_Draw_kW",
    "BM001_Motor_Current_A", "CY001_Apex_Wear_Index_pct", "CY001_Inlet_Pressure_kPa", "CY001_Vortex_DP_kPa",
    "CY001_Cyclones_Online",
})


def diagnose(values: Dict[str, float], deja_actifs: Optional[set] = None) -> List[Dict[str, Any]]:
    """Applique toutes les règles et renvoie les défauts actifs, alarmes d'abord.

    `deja_actifs` : identifiants des défauts actifs à l'instant précédent
    (pour l'hystérésis)."""
    deja_actifs = deja_actifs or set()
    faults = []
    for rule in RULES:
        level = rule["check"](values, rule["id"] in deja_actifs)
        if level:
            faults.append({
                "id": rule["id"], "equipment": rule["equipment"], "equipment_name": rule["equipment_name"],
                "fault": rule["fault"], "level": level,
                "value": _v(values, rule["measure"]), "unit": rule["unit"],
                "condition": rule["condition"], "source": rule["source"], "action": rule["action"],
            })
    faults.sort(key=lambda f: 0 if f["level"] == ALARME else 1)
    return faults


def rules_table() -> List[Dict[str, str]]:
    """La liste des règles, sans les fonctions, pour l'affichage."""
    return [{k: v for k, v in rule.items() if k != "check"} for rule in RULES]
