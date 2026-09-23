import os
from pathlib import Path
from typing import Optional

# Base Directories
BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BASE_DIR.parent.parent

# Detect data directory (Docker container mount or local root)
if Path("/data").exists() and (Path("/data") / "equipment_master.csv").exists():
    DATA_DIR = Path("/data")
elif (PROJECT_ROOT / "data").exists():
    DATA_DIR = PROJECT_ROOT / "data"
else:
    DATA_DIR = PROJECT_ROOT

class Settings:
    PROJECT_NAME: str = "Digital Twin SysCAD & MQTT Telemetry Engine"
    VERSION: str = "3.0.0"
    API_V1_STR: str = "/api/v1"

    # Environment overrides
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    MQTT_BROKER_HOST: str = os.getenv("MQTT_BROKER_HOST", "localhost")
    MQTT_BROKER_PORT: int = int(os.getenv("MQTT_BROKER_PORT", "1883"))

    NEO4J_URI: str = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    NEO4J_USER: str = os.getenv("NEO4J_USER", "neo4j")
    NEO4J_PASSWORD: str = os.getenv("NEO4J_PASSWORD", "password123")

    # JWT Authentication
    JWT_SECRET: str = os.getenv("JWT_SECRET", "industrial-digital-twin-secret-key-pfa-2026")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    DATA_DIR: Path = DATA_DIR
    ASSETS_PATH: Path = BASE_DIR / "core" / "assets.json"
    EQUIPMENT_MASTER_PATH: Path = DATA_DIR / "equipment_master.csv"
    MAINTENANCE_HISTORY_PATH: Path = DATA_DIR / "maintenance_history.csv"
    PROCESS_CSV_PATH: Path = DATA_DIR / "process_flow_timeseries.csv"
    HEALTH_CSV_PATH: Path = DATA_DIR / "machine_health_timeseries.csv"
    REGISTRY_PATH: Path = DATA_DIR / "tag_mapping_registry.csv"
    HISTORIAN_DB_PATH: Path = Path(os.getenv("HISTORIAN_DB_PATH", str(DATA_DIR / "historian" / "telemetry.db")))

settings = Settings()
