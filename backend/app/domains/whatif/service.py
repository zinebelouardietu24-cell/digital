import logging
from typing import Any, Dict, List, Optional

import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score

from app.providers.csv_provider import CSVDataProvider

logger = logging.getLogger(__name__)

# Things an operator would actually adjust upstream of the circuit.
INPUT_COLUMNS = [
    "Feed Solid Flow",
    "Feed BPL",
    "Feed P80",
    "Feed Solid Fraction",
    "Process Water Solid Flow",
    "SP001_Speed_RPM",
    "BM001_Mill_Speed_pctCritical",
    "PB001_Level_Setpoint_pct",
]

INPUT_UNITS = {
    "Feed Solid Flow": "t/h",
    "Feed BPL": "%",
    "Feed P80": "um",
    "Feed Solid Fraction": "%",
    "Process Water Solid Flow": "t/h",
    "SP001_Speed_RPM": "RPM",
    "BM001_Mill_Speed_pctCritical": "% of critical",
    "PB001_Level_Setpoint_pct": "%",
}

# Downstream results to predict, grouped for the UI.
OUTPUT_GROUPS = {
    "Cyclone": [
        "Cyclone Feed Solid Flow",
        "Cyclone Feed BPL",
        "Cyclone Feed P80",
        "Cyclone Underflow Solid Flow",
        "Cyclone Underflow BPL",
        "Cyclone Underflow P80",
        "CY001_Inlet_Pressure_kPa",
        "CY001_Vortex_DP_kPa",
    ],
    "Grind & Grade": [
        "Ball Mill Discharge Solid Flow",
        "Ball Mill Discharge BPL",
        "Ball Mill Discharge P80",
        "Output Slurry Solid Flow",
        "Output Slurry BPL",
        "Output Slurry P80",
        "Circulating_Load_Ratio_pct",
        "Mill_Reduction_Ratio",
    ],
    "Ball Mill Health": [
        "BM001_Power_Draw_kW",
        "BM001_Motor_Current_A",
        "BM001_Bearing_DE_Temp_C",
        "BM001_Bearing_NDE_Temp_C",
        "BM001_Vibration_mms",
    ],
    "Pump Health": [
        "SP001_Motor_Power_kW",
        "SP001_Discharge_Pressure_kPa",
    ],
}

OUTPUT_UNITS = {
    "Cyclone Feed Solid Flow": "t/h",
    "Cyclone Feed BPL": "%",
    "Cyclone Feed P80": "um",
    "Cyclone Underflow Solid Flow": "t/h",
    "Cyclone Underflow BPL": "%",
    "Cyclone Underflow P80": "um",
    "CY001_Inlet_Pressure_kPa": "kPa",
    "CY001_Vortex_DP_kPa": "kPa",
    "Ball Mill Discharge Solid Flow": "t/h",
    "Ball Mill Discharge BPL": "%",
    "Ball Mill Discharge P80": "um",
    "Output Slurry Solid Flow": "t/h",
    "Output Slurry BPL": "%",
    "Output Slurry P80": "um",
    "Circulating_Load_Ratio_pct": "%",
    "Mill_Reduction_Ratio": "ratio",
    "BM001_Power_Draw_kW": "kW",
    "BM001_Motor_Current_A": "A",
    "BM001_Bearing_DE_Temp_C": "degC",
    "BM001_Bearing_NDE_Temp_C": "degC",
    "BM001_Vibration_mms": "mm/s",
    "SP001_Motor_Power_kW": "kW",
    "SP001_Discharge_Pressure_kPa": "kPa",
}

OUTPUT_COLUMNS: List[str] = [col for cols in OUTPUT_GROUPS.values() for col in cols]


class WhatIfService:
    """
    ML-driven process what-if simulator. Trains one multi-output
    RandomForestRegressor, lazily, on the same merged historical
    process+health table the rest of the backend already loads via
    CSVDataProvider — no separate data pipeline.
    """

    def __init__(self, csv_provider: CSVDataProvider):
        self.csv_provider = csv_provider
        self._model: Optional[RandomForestRegressor] = None
        self._r2_scores: Dict[str, float] = {}
        self._baseline: Dict[str, float] = {}
        self._input_ranges: Dict[str, Dict[str, float]] = {}

    def _ensure_trained(self):
        if self._model is not None:
            return

        df = self.csv_provider.df
        missing_inputs = [c for c in INPUT_COLUMNS if c not in df.columns]
        missing_outputs = [c for c in OUTPUT_COLUMNS if c not in df.columns]
        if missing_inputs or missing_outputs:
            raise ValueError(
                f"What-if training data missing columns. inputs={missing_inputs} outputs={missing_outputs}"
            )

        X = df[INPUT_COLUMNS].astype(float)
        y = df[OUTPUT_COLUMNS].astype(float)

        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

        # n_jobs kept small (not -1) — under a constrained/virtualized CPU
        # environment, "use every detected core" can cause severe
        # oversubscription/thrashing that makes training far slower than a
        # modest, bounded parallelism would.
        model = RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=2)
        model.fit(X_train, y_train)

        y_pred = model.predict(X_test)
        scores = r2_score(y_test, y_pred, multioutput="raw_values")
        self._r2_scores = {col: round(float(s), 3) for col, s in zip(OUTPUT_COLUMNS, scores)}

        self._model = model
        self._baseline = df[INPUT_COLUMNS + OUTPUT_COLUMNS].iloc[-1].astype(float).to_dict()
        self._input_ranges = {
            col: {
                "min": round(float(X[col].min()), 2),
                "max": round(float(X[col].max()), 2),
                "default": round(float(self._baseline[col]), 2),
                "unit": INPUT_UNITS.get(col, ""),
            }
            for col in INPUT_COLUMNS
        }
        logger.info("What-if model trained on %d rows. Mean R2=%.3f", len(df), float(np.mean(scores)))

    def get_config(self) -> Dict[str, Any]:
        self._ensure_trained()
        return {
            "inputs": self._input_ranges,
            "output_groups": {group: cols for group, cols in OUTPUT_GROUPS.items()},
            "output_units": OUTPUT_UNITS,
        }

    def predict(self, inputs: Dict[str, float]) -> Dict[str, Any]:
        self._ensure_trained()

        row = []
        resolved_inputs = {}
        for col in INPUT_COLUMNS:
            value = inputs.get(col, self._baseline[col])
            resolved_inputs[col] = float(value)
            row.append(float(value))

        prediction = self._model.predict([row])[0]
        predictions = {col: round(float(v), 3) for col, v in zip(OUTPUT_COLUMNS, prediction)}
        baseline_outputs = {col: round(float(self._baseline[col]), 3) for col in OUTPUT_COLUMNS}
        delta = {col: round(predictions[col] - baseline_outputs[col], 3) for col in OUTPUT_COLUMNS}

        return {
            "inputs": resolved_inputs,
            "predictions": predictions,
            "baseline": baseline_outputs,
            "delta": delta,
            "r2_scores": self._r2_scores,
        }
