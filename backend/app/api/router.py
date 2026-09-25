from fastapi import APIRouter

from app.api.v1.simulation_router import router as simulation_router
from app.api.v1.telemetry_router import router as telemetry_router
from app.api.v1.softsensor_router import router as softsensor_router
from app.api.v1.asset_router import router as asset_router
from app.api.v1.maintenance_router import router as maintenance_router
from app.api.v1.graph_router import router as graph_router
from app.api.v1.rag import router as rag_router
from app.api.v1.auth import router as auth_router
from app.api.v1.whatif_router import router as whatif_router

api_router = APIRouter()

# API v1 Versioned Endpoints
api_router.include_router(auth_router, prefix="/api/v1")
api_router.include_router(simulation_router, prefix="/api/v1/simulation")
api_router.include_router(telemetry_router, prefix="/api/v1/telemetry")
api_router.include_router(asset_router, prefix="/api/v1/assets")
api_router.include_router(maintenance_router, prefix="/api/v1/maintenance")
api_router.include_router(graph_router, prefix="/api/v1/graph")
api_router.include_router(rag_router, prefix="/api/v1")
api_router.include_router(whatif_router, prefix="/api/v1/whatif")
api_router.include_router(softsensor_router, prefix="/api/v1/softsensor")

# Legacy Route Aliases (100% Backward Compatibility)
api_router.include_router(auth_router, prefix="/api")
api_router.include_router(auth_router, prefix="")
api_router.include_router(simulation_router, prefix="/simulation")
api_router.include_router(telemetry_router, prefix="/api/mqtt")
api_router.include_router(asset_router, prefix="/api/assets")
api_router.include_router(maintenance_router, prefix="/api/maintenance")
api_router.include_router(graph_router, prefix="/api/graph")
api_router.include_router(rag_router, prefix="/api")
api_router.include_router(whatif_router, prefix="/api/whatif")
