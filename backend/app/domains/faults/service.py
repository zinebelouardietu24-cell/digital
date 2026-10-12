import logging
import threading
from collections import deque
from typing import Any, Deque, Dict, List, Optional

import pandas as pd

from app.domains.faults import rules, scenarios
from app.providers.csv_provider import CSVDataProvider

logger = logging.getLogger(__name__)


class FaultService:
    """
    Détection et diagnostic des défauts du circuit, à l'instant rejoué par la
    simulation.

    À chaque appel, les règles de `rules.py` sont appliquées à la médiane des
    dernières minutes de mesures. Si un défaut a été injecté pour la
    démonstration, ses modifications sont appliquées avant le diagnostic.
    """

    def __init__(self, csv_provider: CSVDataProvider, max_events: int = 50):
        self.csv_provider = csv_provider
        self._lock = threading.Lock()
        self._injected: Optional[Dict[str, Any]] = None
        self._injected_since: Optional[str] = None
        self._active: set = set()
        self._last_index: Optional[int] = None
        self._events: Deque[Dict[str, Any]] = deque(maxlen=max_events)

    # ------------------------------------------------------------ injection
    def inject(self, scenario_id: str, sim_time: str = "") -> Dict[str, Any]:
        scenario = scenarios.get_scenario(scenario_id)
        if scenario is None:
            raise ValueError(f"Défaut inconnu : {scenario_id}")
        with self._lock:
            self._injected = scenario
            self._injected_since = sim_time
        logger.info("Défaut injecté : %s", scenario_id)
        return {"injected": scenario["id"], "name": scenario["name"]}

    def clear(self) -> Dict[str, Any]:
        with self._lock:
            self._injected = None
            self._injected_since = None
        return {"injected": None}

    def overlay(self, metrics: Dict[str, float]) -> Dict[str, float]:
        """Applique le défaut injecté aux mesures affichées (fiche équipement),
        sans ajouter de colonne qui n'y figurait pas."""
        scenario = self._injected
        if scenario is None:
            return metrics
        modified = scenarios.apply(metrics, scenario)
        return {k: modified[k] for k in metrics}

    # ------------------------------------------------------------ diagnostic
    def _values_at(self, index: int) -> Dict[str, float]:
        df = self.csv_provider.df
        columns = [c for c in rules.RULE_COLUMNS if c in df.columns]
        window = df[columns].iloc[max(0, index - rules.FENETRE_MIN + 1): index + 1].astype(float)
        values = window.median().to_dict()
        if self._injected is not None:
            values = scenarios.apply(values, self._injected)
        return values

    def status(self, index: int) -> Dict[str, Any]:
        df = self.csv_provider.df
        if df is None or df.empty:
            return {"available": False, "error": "Aucune donnée chargée"}
        index = max(0, min(index, len(df) - 1))
        sim_time = str(df.iloc[index].get("Timestamp", ""))

        with self._lock:
            # Une remise à zéro de la simulation efface l'hystérésis.
            if self._last_index is not None and index < self._last_index:
                self._active = set()
            values = self._values_at(index)
            faults = rules.diagnose(values, self._active)
            current = {f["id"] for f in faults}
            for f in faults:
                if f["id"] not in self._active:
                    self._events.appendleft({
                        "time": sim_time, "equipment": f["equipment"], "equipment_name": f["equipment_name"],
                        "fault": f["fault"], "level": f["level"], "injected": self._injected is not None,
                    })
            self._active = current
            self._last_index = index
            injected = self._injected

        levels = {f["level"] for f in faults}
        overall = "alarme" if "alarme" in levels else "alerte" if "alerte" in levels else "normal"
        by_equipment: Dict[str, str] = {}
        for f in faults:
            if by_equipment.get(f["equipment"]) != "alarme":
                by_equipment[f["equipment"]] = f["level"]
        return {
            "available": True,
            "simulation_time": sim_time,
            "status": overall,
            "faults": faults,
            "equipment_status": {eq: by_equipment.get(eq, "normal") for eq in ("PB_001", "SP_001", "CY_001", "BM_001")},
            "injected": {"id": injected["id"], "name": injected["name"], "since": self._injected_since} if injected else None,
            "window_min": rules.FENETRE_MIN,
        }

    def events(self) -> List[Dict[str, Any]]:
        with self._lock:
            return list(self._events)

    @staticmethod
    def rules() -> List[Dict[str, Any]]:
        return rules.rules_table()

    @staticmethod
    def scenarios() -> List[Dict[str, Any]]:
        return scenarios.public_list()
