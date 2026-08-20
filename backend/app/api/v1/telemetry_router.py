from typing import Dict, Any, List
from fastapi import APIRouter, Depends

from app.api.dependencies import get_telemetry_service
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