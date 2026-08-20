from typing import Dict, Any, List, Optional
import pandas as pd
from app.domains.assets.service import AssetService
from app.core.interfaces import BaseDataProvider
from app.domains.telemetry.derived_metrics import DerivedMetricsService
from app.domains.telemetry.subscriber import MQTTSubscriberService

class TelemetryService:
    """
    Assembles raw telemetry, incoming/outgoing stream telemetry for equipment,
    and computes derived engineering metrics, integrating both historical simulation data
    and live MQTT streaming telemetry overlay.
    """

    def __init__(
        self,
        asset_service: AssetService,
        data_provider: BaseDataProvider,
        mqtt_service: Optional[MQTTSubscriberService] = None,
    ):
        self.asset_service = asset_service
        self.data_provider = data_provider
        self.mqtt_service = mqtt_service

        self.col_to_tag: Dict[str, str] = {}
        self.tag_to_col: Dict[str, str] = {}
        self._build_registry_maps()

    def _build_registry_maps(self):
        reg_df = getattr(self.data_provider, "registry_df", None)
        if isinstance(reg_df, pd.DataFrame):
            for _, row in reg_df.iterrows():
                col = str(row.get("source_column", "")).strip()
                tag_id = str(row.get("tag_id", "")).strip()
                if col and tag_id:
                    self.col_to_tag[col] = tag_id
                    self.tag_to_col[tag_id] = col

    def _extract_pipe_metrics(self, pipe_tag: str, record: Dict[str, Any], live_mqtt_data: Dict[str, Any]) -> Dict[str, float]:
        asset = self.asset_service.get_asset(pipe_tag)
        if not asset:
            return {}
        csv_cols = asset.get("csv_columns", [])
        metrics: Dict[str, float] = {}

        for col in csv_cols:
            val = record.get(col, 0.0)
            tag_id = self.col_to_tag.get(col, col)

            if live_mqtt_data:
                mqtt_msg = live_mqtt_data.get(tag_id) or live_mqtt_data.get(col)
                if isinstance(mqtt_msg, dict) and "value" in mqtt_msg:
                    val = mqtt_msg["value"]

            try:
                metrics[col] = float(val)
            except (ValueError, TypeError):
                metrics[col] = 0.0

        return metrics

    def get_asset_telemetry(self, tag: str, current_record_idx: int = 0) -> Dict[str, Any]:
        meta = self.asset_service.get_asset(tag)
        if not meta:
            return {}

        record = self.data_provider.get_record_by_index(current_record_idx)
        record_no = int(record.get("RecordNo", current_record_idx + 1))

        mqtt_active = self.mqtt_service.is_connected() if self.mqtt_service else False
        live_mqtt_data = {}
        if self.mqtt_service and mqtt_active:
            live_mqtt_data = self.mqtt_service.get_all_live_tags()

        csv_cols = meta.get("csv_columns", [])
        live_metrics: Dict[str, float] = {}
        for col in csv_cols:
            val = record.get(col, 0.0)
            tag_id = self.col_to_tag.get(col, col)

            if live_mqtt_data:
                mqtt_msg = live_mqtt_data.get(tag_id) or live_mqtt_data.get(col)
                if isinstance(mqtt_msg, dict) and "value" in mqtt_msg:
                    val = mqtt_msg["value"]

            try:
                live_metrics[col] = float(val)
            except (ValueError, TypeError):
                live_metrics[col] = 0.0

        incoming_streams: Dict[str, Dict[str, float]] = {}
        sources = meta.get("source")
        if isinstance(sources, str):
            sources = [sources]
        elif not sources:
            sources = []

        for src in sources:
            tag_name = src.split(" ")[0] if src.startswith("P_") else src
            if self.asset_service.get_asset(tag_name):
                pipe_metrics = self._extract_pipe_metrics(tag_name, record, live_mqtt_data)
                if pipe_metrics:
                    incoming_streams[tag_name] = pipe_metrics

        outgoing_streams: Dict[str, Dict[str, float]] = {}
        destinations = meta.get("destination")
        if isinstance(destinations, str):
            destinations = [destinations]
        elif not destinations:
            destinations = []

        for dest in destinations:
            tag_name = dest.split(" ")[0] if dest.startswith("P_") else dest
            if self.asset_service.get_asset(tag_name):
                pipe_metrics = self._extract_pipe_metrics(tag_name, record, live_mqtt_data)
                if pipe_metrics:
                    outgoing_streams[tag_name] = pipe_metrics

        derived_metrics = DerivedMetricsService.calculate_derived_metrics(
            tag=tag,
            incoming_streams=incoming_streams,
            outgoing_streams=outgoing_streams,
        )

        return {
            "tag": tag,
            **meta,
            "live_metrics": live_metrics,
            "record_no": record_no,
            "incoming_streams": incoming_streams,
            "outgoing_streams": outgoing_streams,
            "derived_metrics": derived_metrics,
            "mqtt": {
                "active": mqtt_active,
                "total_live_tags": len(live_mqtt_data),
            },
        }

    def get_asset_history(self, tag: str, current_record_idx: int, limit: int = 50) -> List[Dict[str, Any]]:
        meta = self.asset_service.get_asset(tag)
        if not meta:
            return []
        cols = ["ElapsedHrs", "ElapsedMin", "Timestamp"] + meta.get("csv_columns", [])
        return self.data_provider.get_history_by_index(cols, current_record_idx, limit)