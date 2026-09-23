from fastapi import Request, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.providers.csv_provider import CSVDataProvider
from app.domains.assets.service import AssetService
from app.domains.assets.repository import EquipmentRepository, MaintenanceRepository
from app.domains.telemetry.subscriber import MQTTSubscriberService
from app.domains.telemetry.historian import TelemetryHistorian
from app.domains.telemetry.service import TelemetryService
from app.domains.simulation.manager import SimulationManager
from app.domains.knowledge_graph.service import KnowledgeGraphService
from app.domains.knowledge_graph.rag_service import GraphRAGService
from app.domains.auth.service import AuthService
from app.domains.auth.schemas import UserResponse
from app.domains.whatif.service import WhatIfService
from app.core.security import decode_access_token
from app.core.config import settings

# Global singletons
_csv_provider: CSVDataProvider = None
_asset_service: AssetService = None
_mqtt_service: MQTTSubscriberService = None
_telemetry_service: TelemetryService = None
_sim_manager: SimulationManager = None
_kg_service: KnowledgeGraphService = None
_rag_service: GraphRAGService = None
_auth_service: AuthService = None
_whatif_service: WhatIfService = None
_historian: TelemetryHistorian = None

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=True)

def init_app_services():
    global _csv_provider, _asset_service, _mqtt_service, _telemetry_service, _sim_manager, _kg_service, _rag_service, _auth_service, _whatif_service, _historian

    _csv_provider = CSVDataProvider(settings.DATA_DIR)
    _whatif_service = WhatIfService(_csv_provider)
    _asset_service = AssetService(
        assets_file_path=settings.ASSETS_PATH,
        equipment_repo=EquipmentRepository(settings.EQUIPMENT_MASTER_PATH),
        maintenance_repo=MaintenanceRepository(settings.MAINTENANCE_HISTORY_PATH),
    )
    _kg_service = KnowledgeGraphService(_asset_service, _csv_provider)
    _historian = TelemetryHistorian(settings.HISTORIAN_DB_PATH)
    _historian.start()
    _mqtt_service = MQTTSubscriberService(host=settings.MQTT_BROKER_HOST, port=settings.MQTT_BROKER_PORT, historian=_historian)
    _mqtt_service.start()

    _telemetry_service = TelemetryService(_asset_service, _csv_provider, _mqtt_service)
    _sim_manager = SimulationManager(_csv_provider, mqtt_service=_mqtt_service)
    _rag_service = GraphRAGService(_kg_service, _telemetry_service, _asset_service)
    _auth_service = AuthService()

def shutdown_app_services():
    global _mqtt_service, _kg_service, _historian
    if _mqtt_service:
        _mqtt_service.stop()
    if _historian:
        _historian.stop()  # vide la file d'attente sur le disque avant l'arrêt
    if _kg_service:
        _kg_service.close()

def get_csv_provider() -> CSVDataProvider:
    return _csv_provider

def get_asset_service() -> AssetService:
    return _asset_service

def get_mqtt_service() -> MQTTSubscriberService:
    return _mqtt_service

def get_telemetry_service() -> TelemetryService:
    return _telemetry_service

def get_sim_manager() -> SimulationManager:
    return _sim_manager

def get_kg_service() -> KnowledgeGraphService:
    return _kg_service

def get_rag_service() -> GraphRAGService:
    return _rag_service

def get_whatif_service() -> WhatIfService:
    return _whatif_service

def get_historian() -> TelemetryHistorian:
    return _historian

def get_auth_service() -> AuthService:
    global _auth_service
    if _auth_service is None:
        _auth_service = AuthService()
    return _auth_service

def get_current_user(
    token: str = Depends(oauth2_scheme),
    auth_service: AuthService = Depends(get_auth_service)
) -> UserResponse:
    """Validate JWT bearer token and return authenticated user model."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials or token expired",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if not payload:
        raise credentials_exception
    username: str = payload.get("sub")
    if not username:
        raise credentials_exception
    user = auth_service.get_user_by_username(username)
    if not user:
        raise credentials_exception
    return user

