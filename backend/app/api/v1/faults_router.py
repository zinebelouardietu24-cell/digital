from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import get_fault_service, get_sim_manager
from app.domains.faults.service import FaultService
from app.domains.simulation.manager import SimulationManager

router = APIRouter(tags=["Détection des défauts"])


def _index(sim_manager: SimulationManager) -> int:
    return sim_manager.current_record_idx if sim_manager else 0


@router.get("/status")
def get_fault_status(
    sim_manager: SimulationManager = Depends(get_sim_manager),
    faults: FaultService = Depends(get_fault_service),
) -> Dict[str, Any]:
    """Défauts actifs à l'instant rejoué : état global, liste des défauts et état de chaque équipement."""
    return faults.status(_index(sim_manager))


@router.get("/events")
def get_fault_events(faults: FaultService = Depends(get_fault_service)) -> List[Dict[str, Any]]:
    """Journal des défauts apparus depuis le démarrage (le plus récent en premier)."""
    return faults.events()


@router.get("/rules")
def get_fault_rules(faults: FaultService = Depends(get_fault_service)) -> List[Dict[str, Any]]:
    """Les règles de détection, avec leur seuil, leur source et l'action conseillée."""
    return faults.rules()


@router.get("/scenarios")
def get_fault_scenarios(faults: FaultService = Depends(get_fault_service)) -> List[Dict[str, Any]]:
    """Les défauts que l'on peut injecter pour une démonstration."""
    return faults.scenarios()


@router.post("/inject/{scenario_id}")
def inject_fault(
    scenario_id: str,
    sim_manager: SimulationManager = Depends(get_sim_manager),
    faults: FaultService = Depends(get_fault_service),
) -> Dict[str, Any]:
    status = sim_manager.get_status() if sim_manager else {}
    try:
        return faults.inject(scenario_id, str(status.get("simulation_time", "")))
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.post("/clear")
def clear_fault(faults: FaultService = Depends(get_fault_service)) -> Dict[str, Any]:
    """Retire le défaut injecté : le circuit revient à ses mesures réelles."""
    return faults.clear()
