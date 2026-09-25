from typing import Any, Dict

from fastapi import APIRouter, Depends

from app.api.dependencies import get_sim_manager, get_softsensor_service
from app.domains.simulation.manager import SimulationManager
from app.domains.softsensor.service import SoftSensorService

router = APIRouter(tags=["Soft Sensor (XGBoost P80)"])


@router.get("/p80")
def get_p80_estimate(
    history: int = 24,
    sim_manager: SimulationManager = Depends(get_sim_manager),
    softsensor: SoftSensorService = Depends(get_softsensor_service),
) -> Dict[str, Any]:
    """P80 estimated by the XGBoost soft sensor at the record currently replayed, vs the measured value."""
    index = sim_manager.current_record_idx if sim_manager else 0
    return softsensor.estimate(index, history_points=max(0, min(history, 200)))
