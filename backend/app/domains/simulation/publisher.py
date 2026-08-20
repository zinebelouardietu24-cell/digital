#!/usr/bin/env python3
"""
MQTT Publisher for Grinding Circuit Digital Twin
Replays process_flow_timeseries.csv and machine_health_timeseries.csv concurrently over MQTT.
"""

import argparse
import csv
import json
import logging
import math
import sys
import threading
import time
import uuid
from pathlib import Path
from typing import Dict, Any, Optional

import paho.mqtt.client as mqtt
from app.core.config import settings

# Configure logging format
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(threadName)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

class MQTTPublisher:
    def __init__(
        self,
        broker_host: Optional[str] = None,
        broker_port: Optional[int] = None,
        speedup: float = 60.0,
        registry_path: Optional[str | Path] = None,
        process_csv_path: Optional[str | Path] = None,
        health_csv_path: Optional[str | Path] = None,
        loop: bool = True,
        start_paused: bool = True,
    ):
        self.broker_host = broker_host or settings.MQTT_BROKER_HOST
        self.broker_port = broker_port or settings.MQTT_BROKER_PORT
        self.speedup = max(0.001, speedup)
        
        self.registry_path = Path(registry_path) if registry_path else settings.REGISTRY_PATH
        self.process_csv_path = Path(process_csv_path) if process_csv_path else settings.PROCESS_CSV_PATH
        self.health_csv_path = Path(health_csv_path) if health_csv_path else settings.HEALTH_CSV_PATH
        self.loop = loop

        self.tag_registry: Dict[str, Dict[str, Any]] = {}
        self.client: Optional[mqtt.Client] = None
        self.stop_event = threading.Event()
        self.paused = start_paused
        self.reset_stream = False
        self.control_topic = "plant/simulation/control"


    def load_registry(self):
        """Load mapping of source_column -> tag info from tag_mapping_registry.csv"""
        if not self.registry_path.exists():
            logging.error(f"Registry file not found: {self.registry_path}")
            sys.exit(1)

        with open(self.registry_path, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                src_col = row.get("source_column", "").strip()
                if src_col:
                    self.tag_registry[src_col] = {
                        "domain": row.get("domain", "").strip(),
                        "tag_id": row.get("tag_id", "").strip(),
                        "mqtt_topic": row.get("mqtt_topic", "").strip(),
                        "unit": row.get("unit", "").strip(),
                        "data_type": row.get("data_type", "float").strip(),
                        "parameter": row.get("parameter", "").strip(),
                        "description": row.get("description", "").strip(),
                    }
        logging.info(f"Loaded {len(self.tag_registry)} tag mappings from {self.registry_path}")

    def connect_broker(self):
        """Connect to Mosquitto MQTT broker and subscribe to simulation control topic"""
        client_id = f"digital_twin_pub_{int(time.time())}_{uuid.uuid4().hex[:6]}"
        try:
            self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=client_id)
        except AttributeError:
            self.client = mqtt.Client(client_id=client_id)

        def on_connect(client, userdata, flags, rc, properties=None):
            rc_val = getattr(rc, "value", rc)
            if rc_val == 0:
                logging.info(f"Connected to Mosquitto broker at {self.broker_host}:{self.broker_port}")
                client.subscribe(self.control_topic, qos=1)
                logging.info(f"Subscribed to simulation control topic: {self.control_topic}")
            else:
                logging.error(f"Failed to connect to broker (return code: {rc_val})")

        def on_message(client, userdata, msg):
            if msg.topic == self.control_topic:
                try:
                    payload = json.loads(msg.payload.decode("utf-8"))
                    action = payload.get("action")
                    speed = payload.get("speed")
                    if action == "PAUSE":
                        self.paused = True
                        logging.info("Received MQTT control signal: PAUSE")
                    elif action in ["RUNNING", "RESUME"]:
                        self.paused = False
                        logging.info("Received MQTT control signal: RESUME")
                    elif action in ["START", "RESTART"]:
                        self.paused = False
                        self.reset_stream = True
                        logging.info("Received MQTT control signal: START/RESTART")
                    elif action == "STOP":
                        self.paused = True
                        self.reset_stream = True
                        logging.info("Received MQTT control signal: STOP")
                    if speed is not None:
                        self.speedup = max(0.001, float(speed))
                        logging.info(f"Received MQTT speed update: {self.speedup}x")
                except Exception as e:
                    logging.error(f"Error handling control message: {e}")

        self.client.on_connect = on_connect
        self.client.on_message = on_message

        try:
            self.client.connect(self.broker_host, self.broker_port, keepalive=60)
            self.client.loop_start()
        except Exception as e:
            logging.error(f"Connection error to {self.broker_host}:{self.broker_port}: {e}")
            raise

    @staticmethod
    def parse_value(raw_val: str, data_type: str) -> Any:
        try:
            if "int" in data_type.lower():
                return int(float(raw_val))
            val = float(raw_val)
            if math.isnan(val) or math.isinf(val):
                return 0.0
            return round(val, 4)
        except (ValueError, TypeError):
            return raw_val

    def replay_stream(self):
        """Replays unified 1-minute time-series dataset synchronously across all MQTT topics."""
        if not self.process_csv_path.exists() or not self.health_csv_path.exists():
            logging.error(f"CSV files not found: process={self.process_csv_path}, health={self.health_csv_path}")
            return

        import pandas as pd

        logging.info("Loading and merging simulation datasets for synchronized 1-minute replay...")
        p_df = pd.read_csv(self.process_csv_path)
        h_df = pd.read_csv(self.health_csv_path)

        p_df["dt"] = pd.to_datetime(p_df["Timestamp"])
        h_df["dt"] = pd.to_datetime(h_df["Timestamp"])

        p_df = p_df.sort_values("dt")
        h_df = h_df.sort_values("dt")

        merged = pd.merge_asof(
            h_df,
            p_df.drop(columns=["RecordNo"], errors="ignore"),
            on="dt",
            suffixes=("", "_process"),
            direction="backward",
        )
        if "Timestamp_process" in merged.columns:
            merged.drop(columns=["Timestamp_process"], inplace=True)
        if "dt" in merged.columns:
            merged.drop(columns=["dt"], inplace=True)
        merged = merged.loc[:, ~merged.columns.duplicated()].fillna(0.0)

        rows = merged.to_dict(orient="records")
        logging.info(f"Loaded {len(rows)} merged simulation records.")

        while not self.stop_event.is_set():
            self.reset_stream = False
            logging.info(f"Starting synchronized replay pass (Speedup factor: {self.speedup}x)")

            start_wall_time = time.time()
            start_row_idx = 0

            for idx, row in enumerate(rows):
                if self.stop_event.is_set() or self.reset_stream:
                    break

                while self.paused and not self.stop_event.is_set() and not self.reset_stream:
                    time.sleep(0.05)
                    start_wall_time = time.time()
                    start_row_idx = idx

                if self.stop_event.is_set() or self.reset_stream:
                    break

                timestamp_str = str(row.get("Timestamp", ""))

                published_count = 0
                for col, raw_val in row.items():
                    if col in ["Timestamp", "RecordNo", "ElapsedHrs", "ElapsedMin", "dt"]:
                        continue

                    tag_meta = self.tag_registry.get(col)
                    if not tag_meta:
                        continue

                    topic = tag_meta["mqtt_topic"]
                    tag_id = tag_meta["tag_id"]
                    unit = tag_meta["unit"]
                    data_type = tag_meta["data_type"]

                    parsed_val = self.parse_value(raw_val, data_type)

                    payload = {
                        "tag_id": tag_id,
                        "value": parsed_val,
                        "unit": unit,
                        "timestamp": timestamp_str,
                        "quality": "SIM",
                        "domain": tag_meta.get("domain", ""),
                        "source": "csv_replay_mqtt",
                    }

                    self.client.publish(
                        topic=topic,
                        payload=json.dumps(payload),
                        qos=1,
                        retain=False,
                    )
                    published_count += 1

                rows_advanced = (idx - start_row_idx) + 1
                target_wall_time = start_wall_time + (rows_advanced * 60.0 / max(0.001, self.speedup))

                rem = target_wall_time - time.time()
                if rem > 0:
                    self.stop_event.wait(timeout=rem)

                logging.debug(f"Published {published_count} topics for timestamp {timestamp_str}")

            if not self.loop:
                logging.info("Completed single replay pass.")
                break

    def start(self):
        """Starts tag registry loading, MQTT connection, and replay engine."""
        self.load_registry()
        self.connect_broker()

        t_replay = threading.Thread(
            target=self.replay_stream,
            name="SynchronizedReplayThread",
            daemon=True,
        )
        t_replay.start()

        try:
            while t_replay.is_alive() and not self.stop_event.is_set():
                time.sleep(0.5)
        except KeyboardInterrupt:
            logging.info("Received interrupt signal. Stopping MQTT publisher...")
            self.stop_event.set()

        self.stop_event.set()
        if self.client:
            self.client.loop_stop()
            self.client.disconnect()
        logging.info("MQTT Publisher terminated successfully.")


def main():
    parser = argparse.ArgumentParser(description="Grinding Circuit MQTT Telemetry Publisher")
    parser.add_argument("--host", default=settings.MQTT_BROKER_HOST, help="Mosquitto MQTT broker hostname/IP")
    parser.add_argument("--port", type=int, default=settings.MQTT_BROKER_PORT, help="Mosquitto MQTT broker port")
    parser.add_argument(
        "--speedup",
        type=float,
        default=60.0,
        help="Simulated time to real time speedup multiplier",
    )
    parser.add_argument(
        "--registry",
        default=str(settings.REGISTRY_PATH),
        help="Path to tag_mapping_registry.csv",
    )
    parser.add_argument(
        "--process-csv",
        default=str(settings.PROCESS_CSV_PATH),
        help="Path to process_flow_timeseries.csv",
    )
    parser.add_argument(
        "--health-csv",
        default=str(settings.HEALTH_CSV_PATH),
        help="Path to machine_health_timeseries.csv",
    )
    parser.add_argument(
        "--no-loop",
        action="store_true",
        help="Disable continuous looping and stop after replaying datasets once",
    )
    parser.add_argument(
        "--unpaused",
        action="store_true",
        help="Start publishing data immediately upon launch without waiting for Play signal",
    )

    args = parser.parse_args()

    publisher = MQTTPublisher(
        broker_host=args.host,
        broker_port=args.port,
        speedup=args.speedup,
        registry_path=args.registry,
        process_csv_path=args.process_csv,
        health_csv_path=args.health_csv,
        loop=not args.no_loop,
        start_paused=not args.unpaused,
    )
    publisher.start()



if __name__ == "__main__":
    main()