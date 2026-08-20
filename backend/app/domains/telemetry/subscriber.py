import json
import logging
import os
import threading
import uuid
from collections import defaultdict, deque
from typing import Dict, Any, List, Optional
import paho.mqtt.client as mqtt

from app.core.config import settings

logger = logging.getLogger(__name__)

class MQTTSubscriberService:
    """
    Subscribes to MQTT topics (plant/grinding/#) and maintains live in-memory tag state
    and rolling history for digital twin telemetry consumption.
    """

    def __init__(self, host: Optional[str] = None, port: Optional[int] = None, topic_prefix: str = "plant/grinding/#"):
        self.host = host or settings.MQTT_BROKER_HOST
        self.port = port or settings.MQTT_BROKER_PORT
        self.topic_prefix = topic_prefix

        self._latest_tags: Dict[str, Dict[str, Any]] = {}
        self._latest_tags_by_source: Dict[str, Dict[str, Dict[str, Any]]] = defaultdict(dict)
        self._topic_map: Dict[str, Dict[str, Any]] = {}
        self._history: Dict[str, deque] = defaultdict(lambda: deque(maxlen=100))
        self._lock = threading.Lock()

        self.client: Optional[mqtt.Client] = None
        self._connected = False

    def start(self):
        """Starts MQTT subscriber client in background loop."""
        if self.client and self._connected:
            return

        client_id = f"digital_twin_sub_{os.getpid()}_{uuid.uuid4().hex[:6]}"
        try:
            self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=client_id)
        except AttributeError:
            self.client = mqtt.Client(client_id=client_id)

        self.client.on_connect = self._on_connect
        self.client.on_message = self._on_message
        self.client.on_disconnect = self._on_disconnect

        try:
            logger.info(f"Connecting MQTT Subscriber to {self.host}:{self.port} with client_id={client_id}...")
            self.client.connect_async(self.host, self.port, keepalive=60)
            self.client.loop_start()
        except Exception as e:
            logger.warning(f"Could not connect MQTT Subscriber to {self.host}:{self.port}: {e}")

    def _on_connect(self, client, userdata, flags, rc, properties=None):
        rc_val = getattr(rc, "value", rc)
        if rc_val == 0:
            self._connected = True
            logger.info(f"MQTT Subscriber connected. Subscribing to '{self.topic_prefix}'")
            client.subscribe(self.topic_prefix, qos=1)
        else:
            self._connected = False
            logger.error(f"MQTT Subscriber connect failed with code: {rc_val}")

    def _on_disconnect(self, client, userdata, flags, rc=0, properties=None):
        self._connected = False
        rc_val = getattr(rc, "value", rc)
        if rc_val != 0:
            logger.warning(f"MQTT Subscriber disconnected unexpectedly (code: {rc_val})")

    def _on_message(self, client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode("utf-8"))
            topic = msg.topic
            tag_id = payload.get("tag_id")
            source = payload.get("source", "unknown")

            with self._lock:
                self._topic_map[topic] = payload
                if tag_id:
                    self._latest_tags[tag_id] = payload
                    self._latest_tags_by_source[source][tag_id] = payload
                    self._history[tag_id].append(payload)
        except Exception as e:
            logger.debug(f"Error processing MQTT message on topic {msg.topic}: {e}")

    def is_connected(self) -> bool:
        return self._connected

    def get_tag_data(self, tag_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            return self._latest_tags.get(tag_id)

    def get_topic_data(self, topic: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            return self._topic_map.get(topic)

    def get_all_live_tags(self) -> Dict[str, Dict[str, Any]]:
        with self._lock:
            return dict(self._latest_tags)

    def get_all_live_tags_by_source(self, source: str) -> Dict[str, Dict[str, Any]]:
        with self._lock:
            return dict(self._latest_tags_by_source.get(source, {}))

    def get_active_sources(self) -> List[str]:
        with self._lock:
            return list(self._latest_tags_by_source.keys())

    def get_tag_history(self, tag_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        with self._lock:
            buf = self._history.get(tag_id)
            if not buf:
                return []
            items = list(buf)
            return items[-limit:]

    def publish_control(self, action: Optional[str] = None, speed: Optional[float] = None):
        """Publishes simulation control signal (PAUSE/START/RESUME/STOP/SPEED) over MQTT."""
        if self.client and self._connected:
            payload = {}
            if action:
                payload["action"] = action
            if speed is not None:
                payload["speed"] = speed
            try:
                self.client.publish("plant/simulation/control", json.dumps(payload), qos=1)
                logger.info(f"Published MQTT control payload: {payload}")
            except Exception as e:
                logger.error(f"Failed to publish MQTT control message: {e}")

    def clear_live_tags(self):
        """Clears in-memory live tags and history buffer on simulation stop/reset."""
        with self._lock:
            self._latest_tags.clear()
            self._latest_tags_by_source.clear()
            self._topic_map.clear()
            self._history.clear()
            logger.info("Cleared in-memory MQTT telemetry buffers.")

    def stop(self):
        if self.client:
            self.client.loop_stop()
            self.client.disconnect()
            self._connected = False