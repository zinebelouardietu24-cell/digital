import csv
import io
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from app.api.dependencies import get_telemetry_service, get_historian
from app.domains.telemetry.historian import TelemetryHistorian
from app.domains.telemetry.service import TelemetryService

router = APIRouter(tags=["MQTT Live Telemetry"])

@router.get("/status")
def get_mqtt_status(telemetry_service: TelemetryService = Depends(get_telemetry_service)) -> Dict[str, Any]:
    if not telemetry_service or not telemetry_service.mqtt_service:
        return {"connected": False, "total_live_tags": 0}

    svc = telemetry_service.mqtt_service
    all_tags = svc.get_all_live_tags()

    process_count = 0
    health_count = 0
    for tag_id, payload in all_tags.items():
        if isinstance(payload, dict):
            domain = payload.get("domain", "")
            if domain == "process" or "." in tag_id or "process" in tag_id.lower():
                process_count += 1
            else:
                health_count += 1
        else:
            process_count += 1

    return {
        "connected": svc.is_connected(),
        "broker_host": svc.host,
        "broker_port": svc.port,
        "topic_prefix": svc.topic_prefix,
        "total_live_tags": len(all_tags),
        "process_tags": process_count,
        "health_tags": health_count,
    }

@router.get("/tags")
def get_all_mqtt_tags(telemetry_service: TelemetryService = Depends(get_telemetry_service)) -> Dict[str, Any]:
    if not telemetry_service or not telemetry_service.mqtt_service:
        return {}
    return telemetry_service.mqtt_service.get_all_live_tags()

@router.get("/tags/{tag_id}/history")
def get_mqtt_tag_history(
    tag_id: str,
    limit: int = 50,
    telemetry_service: TelemetryService = Depends(get_telemetry_service),
) -> List[Dict[str, Any]]:
    if not telemetry_service or not telemetry_service.mqtt_service:
        return []
    return telemetry_service.mqtt_service.get_tag_history(tag_id, limit)

@router.get("/tags/historical")
def get_historical_source_tags(
    telemetry_service: TelemetryService = Depends(get_telemetry_service),
) -> Dict[str, Any]:
    """
    Returns the tags currently published by the Python CSV->MQTT publisher
    (source = 'csv_replay_mqtt'), i.e. the data pipeline you already had running.
    """
    if not telemetry_service or not telemetry_service.mqtt_service:
        return {}
    return telemetry_service.mqtt_service.get_all_live_tags_by_source("csv_replay_mqtt")

@router.get("/tags/nodered")
def get_nodered_source_tags(
    telemetry_service: TelemetryService = Depends(get_telemetry_service),
) -> Dict[str, Any]:
    """
    Returns the tags currently published by the Node-RED / KEPServerEX OPC UA
    pipeline (source = 'nodered_opcua').
    """
    if not telemetry_service or not telemetry_service.mqtt_service:
        return {}
    return telemetry_service.mqtt_service.get_all_live_tags_by_source("nodered_opcua")

@router.get("/sources")
def get_active_sources(
    telemetry_service: TelemetryService = Depends(get_telemetry_service),
) -> Dict[str, Any]:
    if not telemetry_service or not telemetry_service.mqtt_service:
        return {"sources": []}
    return {"sources": telemetry_service.mqtt_service.get_active_sources()}


# ------------------------------------------------------------------ historien persistant

def _require_historian(historian: Optional[TelemetryHistorian]) -> TelemetryHistorian:
    if historian is None:
        raise HTTPException(status_code=503, detail="Telemetry historian is not running")
    return historian

@router.get("/historian/stats")
def get_historian_stats(historian: TelemetryHistorian = Depends(get_historian)) -> Dict[str, Any]:
    return _require_historian(historian).stats()

@router.get("/historian/query")
def query_historian(
    tag_id: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    source: Optional[str] = None,
    limit: int = 1000,
    historian: TelemetryHistorian = Depends(get_historian),
) -> List[Dict[str, Any]]:
    """Recorded messages, oldest first. start/end are ISO-8601 UTC bounds on reception time."""
    return _require_historian(historian).query(tag_id=tag_id, start=start, end=end, source=source,
                                               limit=min(limit, 100_000))

@router.get("/historian/export.csv")
def export_historian_csv(
    tag_id: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    source: Optional[str] = None,
    limit: int = 1_000_000,
    historian: TelemetryHistorian = Depends(get_historian),
):
    rows = _require_historian(historian).query(tag_id=tag_id, start=start, end=end, source=source, limit=limit)
    buf = io.StringIO()
    fields = ["received_at", "ts", "tag_id", "value", "unit", "quality", "source", "domain", "topic"]
    writer = csv.DictWriter(buf, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=telemetry_history.csv"})
