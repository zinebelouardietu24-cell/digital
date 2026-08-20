from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, Body

from app.api.dependencies import get_whatif_service
from app.domains.whatif.service import WhatIfService

router = APIRouter(tags=["What-If Simulator"])

@router.get("/config")
def get_whatif_config(
    whatif_service: WhatIfService = Depends(get_whatif_service),
) -> Dict[str, Any]:
    if not whatif_service:
        raise HTTPException(500, "What-if service not initialized")
    return whatif_service.get_config()

@router.post("/predict")
def predict_whatif(
    inputs: Dict[str, float] = Body(default={}),
    whatif_service: WhatIfService = Depends(get_whatif_service),
) -> Dict[str, Any]:
    if not whatif_service:
        raise HTTPException(500, "What-if service not initialized")
    try:
        return whatif_service.predict(inputs)
    except ValueError as e:
        raise HTTPException(400, str(e))
