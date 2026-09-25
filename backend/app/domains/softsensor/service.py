import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib
import pandas as pd

from app.core.config import settings
from app.providers.csv_provider import CSVDataProvider

logger = logging.getLogger(__name__)

MODEL_PATH: Path = settings.DATA_DIR / "models" / "xgb_soft_sensor_p80.joblib"
HEALTH_PREFIXES = ("PB001_", "SP001_", "BM001_", "CY001_", "Ambient_")


class SoftSensorService:
    """
    Online XGBoost soft sensor for the cyclone overflow P80.

    The model is trained offline by ml/soft_sensor_p80/train_xgboost.py. At
    runtime it is fed the record currently replayed by the simulation, with
    health signals averaged over the preceding 15 minutes — the same features
    it was trained on.
    """

    def __init__(self, csv_provider: CSVDataProvider, model_path: Path = MODEL_PATH):
        self.csv_provider = csv_provider
        self.model_path = Path(model_path)
        self._bundle: Optional[Dict[str, Any]] = None
        self._load_error: Optional[str] = None

    def _ensure_loaded(self) -> bool:
        if self._bundle is not None:
            return True
        if not self.model_path.exists():
            self._load_error = f"Model file not found: {self.model_path}"
            return False
        try:
            self._bundle = joblib.load(self.model_path)
            logger.info("Soft sensor model loaded from %s", self.model_path)
            return True
        except Exception as e:  # e.g. xgboost not installed
            self._load_error = f"Could not load soft sensor model: {e}"
            logger.warning(self._load_error)
            return False

    def _features_at(self, index: int) -> pd.DataFrame:
        df = self.csv_provider.df
        features: List[str] = self._bundle["features"]
        window = int(self._bundle.get("health_window_min", 15))
        row = df.iloc[index]
        values = {}
        health_window = df.iloc[max(0, index - window + 1): index + 1]
        for col in features:
            if col.startswith(HEALTH_PREFIXES):
                values[col] = float(health_window[col].mean())
            else:
                values[col] = float(row[col])
        return pd.DataFrame([values], columns=features)

    def estimate(self, index: int, history_points: int = 0) -> Dict[str, Any]:
        if not self._ensure_loaded():
            return {"available": False, "error": self._load_error}

        df = self.csv_provider.df
        index = max(0, min(index, len(df) - 1))
        target = self._bundle["target"]
        model = self._bundle["model"]

        estimated = float(model.predict(self._features_at(index))[0])
        measured = float(df.iloc[index][target])
        result: Dict[str, Any] = {
            "available": True,
            "model": "XGBoost",
            "target": target,
            "timestamp": str(df.iloc[index].get("Timestamp", "")),
            "estimated_p80_um": round(estimated, 2),
            "measured_p80_um": round(measured, 2),
            "error_um": round(estimated - measured, 2),
            "test_metrics": self._bundle.get("test_metrics", {}),
        }

        if history_points > 0:
            # One point per process sample (every 15 health records).
            step = int(self._bundle.get("health_window_min", 15))
            idxs = list(range(index, -1, -step))[:history_points][::-1]
            X = pd.concat([self._features_at(i) for i in idxs], ignore_index=True)
            preds = model.predict(X)
            result["history"] = [
                {
                    "timestamp": str(df.iloc[i].get("Timestamp", "")),
                    "measured": round(float(df.iloc[i][target]), 2),
                    "estimated": round(float(p), 2),
                }
                for i, p in zip(idxs, preds)
            ]
        return result
