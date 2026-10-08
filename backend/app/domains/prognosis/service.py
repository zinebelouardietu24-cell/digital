import logging
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

from app.domains.assets.service import AssetService
from app.providers.csv_provider import CSVDataProvider

logger = logging.getLogger(__name__)

# One wear indicator per critical equipment, with its alarm threshold.
INDICATORS: Dict[str, Dict[str, Any]] = {
    "SP_001": {
        "column": "SP001_Vibration_mms", "label": "Vibration pompe", "unit": "mm/s",
        "threshold": 2.8, "threshold_source": "ISO 10816-3, groupe 2, limite zones B/C",
    },
    "BM_001": {
        "column": "BM001_Vibration_mms", "label": "Vibration broyeur", "unit": "mm/s",
        "threshold": 4.5, "threshold_source": "ISO 10816-3, groupe 1, limite zones B/C",
    },
    "CY_001": {
        "column": "CY001_Apex_Wear_Index_pct", "label": "Usure des apex", "unit": "%",
        "threshold": 50.0, "threshold_source": "niveau de remplacement observé le 19/07/2026",
    },
}

JUMP_SIGMA = 8           # an intervention = hourly drop larger than 8 noise standard deviations
MIN_CYCLE_HOURS = 48     # below this, the slope is too uncertain to forecast (see backtest)
REL_ERR_Q90 = 0.08       # 90th percentile of the relative RUL error measured by the backtest

# Offline validation, ml/maintenance_predictive/pronostic.py (5 cycles, 1 543 forecasts).
BACKTEST = {
    "cycles": 5,
    "forecasts": 1543,
    "mean_error_h": {"7_days_before": 4.6, "3_days_before": 2.4, "1_day_before": 2.5},
}


class PrognosisService:
    """
    Remaining-useful-life (RUL) forecast for the pump, the ball mill and the
    hydrocyclones, computed at the simulation's current time.

    Same method as the offline study in ml/maintenance_predictive/pronostic.py:
    interventions are detected as sharp drops of the wear indicator, the
    current cycle is fitted with a linear degradation model, and the RUL is
    the time left before the indicator reaches its alarm threshold.
    """

    def __init__(self, csv_provider: CSVDataProvider, asset_service: AssetService):
        self.csv_provider = csv_provider
        self.asset_service = asset_service
        self._cache: Optional[Tuple[int, Dict[str, Any]]] = None

    def _hourly(self, index: int) -> pd.DataFrame:
        df = self.csv_provider.df.iloc[: index + 1]
        columns = [cfg["column"] for cfg in INDICATORS.values()]
        hourly = df[columns].astype(float)
        hourly.index = pd.to_datetime(df["Timestamp"], errors="coerce")
        return hourly[hourly.index.notna()].resample("1h").mean()

    @staticmethod
    def _interventions(series: pd.Series) -> List[pd.Timestamp]:
        diff = series.diff().dropna()
        if len(diff) < 3:
            return []
        noise = 1.4826 * float((diff - diff.median()).abs().median())
        if noise <= 0:
            return []
        events: List[pd.Timestamp] = []
        for t in diff[diff < -JUMP_SIGMA * noise].index:
            if not events or (t - events[-1]) > pd.Timedelta(hours=24):
                events.append(t)
        return events

    def _work_orders(self, equipment_id: str, day: pd.Timestamp) -> List[str]:
        orders = []
        for wo in self.asset_service.get_maintenance_history():
            if not str(wo.get("equipment_id", "")).startswith(equipment_id):
                continue
            try:
                date = pd.Timestamp(str(wo.get("maintenance_date", "")).split()[0])
            except (ValueError, TypeError):
                continue
            if abs((date - day.normalize()).days) <= 1:
                orders.append(str(wo.get("log_id", "")))
        return sorted(set(orders))

    def _forecast(self, equipment_id: str, cfg: Dict[str, Any], series: pd.Series) -> Dict[str, Any]:
        series = series.dropna()
        events = self._interventions(series)
        interventions = []
        for t in events:
            orders = self._work_orders(equipment_id, t)
            interventions.append({"date": str(t.date()), "in_cmms": bool(orders), "work_orders": orders})

        start = events[-1] if events else series.index[0]
        cycle = series[start:]
        level = float(cycle.iloc[-6:].mean())
        hours = len(cycle)
        result: Dict[str, Any] = {
            "equipment_id": equipment_id,
            "indicator": cfg["label"],
            "unit": cfg["unit"],
            "threshold": cfg["threshold"],
            "threshold_source": cfg["threshold_source"],
            "current_level": round(level, 3),
            "cycle_start": str(start),
            "cycle_hours": hours,
            "interventions": interventions,
        }
        if level >= cfg["threshold"]:
            return {**result, "status": "alarm", "rul_days": 0.0}
        if hours < MIN_CYCLE_HOURS:
            return {**result, "status": "learning"}

        t_h = np.arange(hours, dtype=float)
        slope, intercept = np.polyfit(t_h, cycle.values, 1)
        result["slope_per_day"] = round(float(slope) * 24, 4)
        if slope <= 0:
            return {**result, "status": "stable"}

        rul_h = max((cfg["threshold"] - intercept) / slope - t_h[-1], 0.0)
        now = series.index[-1]
        rul_days = rul_h / 24
        result.update({
            "rul_days": round(rul_days, 1),
            "rul_interval_days": [round(rul_days * (1 - REL_ERR_Q90), 1), round(rul_days * (1 + REL_ERR_Q90), 1)],
            "forecast_date": str((now + pd.Timedelta(hours=rul_h)).date()),
            "status": "plan" if rul_days <= 7 else "watch" if rul_days <= 14 else "ok",
        })
        return result

    def forecast(self, index: int) -> Dict[str, Any]:
        df = self.csv_provider.df
        if df is None or df.empty or "Timestamp" not in df.columns:
            return {"available": False, "error": "No health history loaded"}
        index = max(0, min(index, len(df) - 1))
        hour_key = index // 60
        if self._cache and self._cache[0] == hour_key:
            return self._cache[1]

        hourly = self._hourly(index)
        equipments = []
        for equipment_id, cfg in INDICATORS.items():
            if cfg["column"] not in hourly.columns:
                continue
            try:
                equipments.append(self._forecast(equipment_id, cfg, hourly[cfg["column"]]))
            except Exception as e:  # keep the other equipment available
                logger.warning("Prognosis failed for %s: %s", equipment_id, e)

        result = {
            "available": True,
            "simulation_time": str(df.iloc[index].get("Timestamp", "")),
            "equipments": equipments,
            "method": "Dégradation linéaire depuis la dernière intervention détectée",
            "backtest": BACKTEST,
        }
        self._cache = (hour_key, result)
        return result
