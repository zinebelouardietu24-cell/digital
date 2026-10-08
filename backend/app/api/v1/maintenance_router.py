from datetime import datetime
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import get_telemetry_service, get_sim_manager, get_prognosis_service
from app.domains.telemetry.service import TelemetryService
from app.domains.simulation.manager import SimulationManager
from app.core.exceptions import EquipmentNotFoundError
from app.domains.prognosis.service import PrognosisService

router = APIRouter(tags=["Predictive Maintenance"])

def _compute_maintenance_fields(eq_item: Dict[str, Any], sim_now_str: str) -> Dict[str, Any]:
    item = dict(eq_item)
    try:
        sim_date_part = sim_now_str.split()[0] if " " in sim_now_str else sim_now_str.split("T")[0]
        sim_dt = datetime.strptime(sim_date_part, "%Y-%m-%d")
    except Exception:
        sim_dt = datetime(2026, 7, 1)

    last_maint_str = str(item.get("last_maintenance_date", ""))
    next_due_str = str(item.get("next_maintenance_due", ""))

    days_since = 0
    days_until = 0

    if last_maint_str:
        try:
            last_dt = datetime.strptime(last_maint_str.split()[0], "%Y-%m-%d")
            days_since = (sim_dt - last_dt).days
        except Exception:
            pass

    if next_due_str:
        try:
            next_dt = datetime.strptime(next_due_str.split()[0], "%Y-%m-%d")
            days_until = (next_dt - sim_dt).days
        except Exception:
            pass

    item["days_since_last_maintenance"] = days_since
    item["days_until_due"] = days_until
    item["is_overdue"] = days_until < 0
    return item

@router.get("/prognosis")
def get_prognosis(
    sim_manager: SimulationManager = Depends(get_sim_manager),
    prognosis: PrognosisService = Depends(get_prognosis_service),
) -> Dict[str, Any]:
    """Remaining useful life of the pump, mill and hydrocyclones at the replayed time."""
    if not prognosis:
        raise HTTPException(500, "Prognosis service not initialized")
    index = sim_manager.current_record_idx if sim_manager else 0
    return prognosis.forecast(index)

@router.get("/equipment")
def get_all_maintenance_equipment(
    telemetry_service: TelemetryService = Depends(get_telemetry_service),
    sim_manager: SimulationManager = Depends(get_sim_manager),
) -> List[Dict[str, Any]]:
    if not telemetry_service or not sim_manager:
        raise HTTPException(500, "Backend services not initialized")

    sim_status = sim_manager.get_status()
    sim_now_str = str(sim_status.get("simulation_time", "2026-07-01 00:00:00"))

    raw_items = telemetry_service.asset_service.get_all_equipment_master()
    computed_items = [_compute_maintenance_fields(item, sim_now_str) for item in raw_items]
    computed_items.sort(key=lambda x: x.get("days_until_due", 999999))
    return computed_items

@router.get("/equipment/{equipment_id}")
def get_maintenance_equipment_detail(
    equipment_id: str,
    telemetry_service: TelemetryService = Depends(get_telemetry_service),
    sim_manager: SimulationManager = Depends(get_sim_manager),
) -> Dict[str, Any]:
    if not telemetry_service or not sim_manager:
        raise HTTPException(500, "Backend services not initialized")

    sim_status = sim_manager.get_status()
    sim_now_str = str(sim_status.get("simulation_time", "2026-07-01 00:00:00"))

    raw_item = telemetry_service.asset_service.get_equipment_master_item(equipment_id)
    if not raw_item:
        raise EquipmentNotFoundError(equipment_id)

    computed_item = _compute_maintenance_fields(raw_item, sim_now_str)

    base_tag = equipment_id
    if equipment_id.startswith("CY_001_"):
        base_tag = "CY_001"

    health_history = telemetry_service.get_asset_history(base_tag, sim_manager.current_record_idx, limit=100)
    maintenance_logs = telemetry_service.asset_service.get_maintenance_history(equipment_id)

    return {
        "equipment": computed_item,
        "health_history": health_history,
        "maintenance_logs": maintenance_logs,
        "simulation_time": sim_now_str,
    }

@router.get("/equipment/{equipment_id}/history")
def get_equipment_maintenance_logs(
    equipment_id: str,
    telemetry_service: TelemetryService = Depends(get_telemetry_service),
) -> Dict[str, Any]:
    if not telemetry_service:
        raise HTTPException(500, "Telemetry service not initialized")

    logs = telemetry_service.asset_service.get_maintenance_history(equipment_id)
    raw_item = telemetry_service.asset_service.get_equipment_master_item(equipment_id)
    return {
        "equipment_id": equipment_id,
        "equipment": raw_item,
        "logs": logs,
        "total_logs": len(logs),
    }
