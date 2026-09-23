"""
KEPServerEX OPC UA -> MQTT bridge.

Free, Java-free alternative to KEPServerEX's IoT Gateway plug-in (whose trial
license expires separately from the base server). This script uses
KEPServerEX's built-in OPC UA server -- a base feature available for the
full trial period, no extra license needed -- and forwards live tag values
to the project's Mosquitto broker in the same JSON schema the backend
already understands (see backend/app/domains/telemetry/subscriber.py).

Requirements (install once):
    pip install asyncua paho-mqtt

Before running:
    1. In KEPServerEX Configuration, go to Project > OPC UA Configuration.
    2. Set "OPC UA Server Enabled" to Yes (default endpoint is
       opc.tcp://<hostname>:49320).
    3. Under Endpoints, edit the default endpoint and enable the "None"
       security policy for a simple local demo (fine for a class project,
       not for production).
    4. Apply, then restart the KEPServerEX Runtime.

Usage:
    python kepserver_opcua_bridge.py
    # or override defaults:
    python kepserver_opcua_bridge.py --opcua-url opc.tcp://192.168.1.10:49320 \
        --mqtt-host localhost --channel Channel1 --device GrindingCircuit
"""

import argparse
import asyncio
import csv
import json
import logging
import socket
import time
from pathlib import Path
from typing import Dict, Any, Optional

from asyncua import Client
import paho.mqtt.client as mqtt
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID
import datetime

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("kepserver_bridge")

DEFAULT_REGISTRY_PATH = Path(__file__).resolve().parent / "data" / "tag_mapping_registry.csv"
CERT_DIR = Path(__file__).resolve().parent / "opcua_certs"
APPLICATION_URI = f"urn:{socket.gethostname()}:kepserver-opcua-bridge:client"


def ensure_client_certificate():
    """
    Generates a self-signed client certificate/key pair on first run (KEPServerEX
    requires session-level identification via a certificate even for otherwise
    unsecured connections on some versions — see FreeOpcUa/opcua-asyncio #1128).
    """
    CERT_DIR.mkdir(exist_ok=True)
    cert_path = CERT_DIR / "client_cert.der"
    key_path = CERT_DIR / "client_key.pem"

    if cert_path.exists() and key_path.exists():
        return str(cert_path), str(key_path)

    logger.info("Generating a new self-signed OPC UA client certificate...")
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = issuer = x509.Name(
        [
            x509.NameAttribute(NameOID.COMMON_NAME, "kepserver-opcua-bridge"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Student Project"),
        ]
    )
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime.datetime.utcnow())
        .not_valid_after(datetime.datetime.utcnow() + datetime.timedelta(days=3650))
        .add_extension(
            x509.SubjectAlternativeName([x509.UniformResourceIdentifier(APPLICATION_URI)]),
            critical=False,
        )
        .add_extension(
            x509.BasicConstraints(ca=False, path_length=None),
            critical=True,
        )
        .add_extension(
            x509.KeyUsage(
                digital_signature=True,
                key_encipherment=True,
                content_commitment=False,
                data_encipherment=True,
                key_agreement=False,
                key_cert_sign=False,
                crl_sign=False,
                encipher_only=False,
                decipher_only=False,
            ),
            critical=True,
        )
        .sign(key, hashes.SHA256())
    )

    key_path.write_bytes(
        key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        )
    )
    cert_path.write_bytes(cert.public_bytes(serialization.Encoding.DER))
    logger.info(f"Certificate written to {cert_path}")
    return str(cert_path), str(key_path)


def load_registry(path: Path) -> Dict[str, Dict[str, Any]]:
    """tag_id (e.g. 'PB001.IN.SolidFlow') -> {mqtt_topic, unit, domain}."""
    by_tag_id: Dict[str, Dict[str, Any]] = {}
    if not path.exists():
        logger.warning(f"Tag registry not found at {path} — topics will be auto-generated.")
        return by_tag_id
    with open(path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            tag_id = row.get("tag_id", "").strip()
            if tag_id:
                by_tag_id[tag_id] = {
                    "mqtt_topic": row.get("mqtt_topic", "").strip(),
                    "unit": row.get("unit", "").strip(),
                    "domain": row.get("domain", "").strip(),
                }
    return by_tag_id


def kep_tag_to_registry_lookup(kep_tag_name: str, registry: Dict[str, Dict[str, Any]]):
    """
    Matches a KEPServerEX tag name (e.g. 'PB001_IN_SolidFlow', underscores only
    since KEPServerEX forbids dots in tag names) back to our dotted tag_id and
    its registry metadata, case-insensitively.
    """
    candidate = kep_tag_name.replace("_", ".").lower()
    for tag_id, meta in registry.items():
        if candidate == tag_id.lower():
            return tag_id, meta
    return kep_tag_name, {}


async def discover_tags(client: Client, channel: str, device: str):
    """Browses Channel/Device under the OPC UA Objects node and returns child tag nodes."""
    objects = client.nodes.objects
    channel_node = await objects.get_child([f"2:{channel}"])
    device_node = await channel_node.get_child([f"2:{device}"])
    children = await device_node.get_children()
    tags = []
    for node in children:
        name = (await node.read_browse_name()).Name
        tags.append((name, node))
    return tags


async def run_bridge(opcua_url: str, mqtt_host: str, mqtt_port: int, channel: str, device: str, poll_interval: float):
    registry = load_registry(DEFAULT_REGISTRY_PATH)

    mqtt_client = mqtt.Client(client_id="kepserver_opcua_bridge")
    mqtt_client.connect(mqtt_host, mqtt_port, keepalive=60)
    mqtt_client.loop_start()
    logger.info(f"Connected to MQTT broker at {mqtt_host}:{mqtt_port}")

    cert_path, key_path = ensure_client_certificate()

    client = Client(url=opcua_url)
    client.application_uri = APPLICATION_URI
    await client.set_security_string(f"Basic256Sha256,SignAndEncrypt,{cert_path},{key_path}")

    async with client:
        logger.info(f"Connected to KEPServerEX OPC UA server at {opcua_url}")
        tags = await discover_tags(client, channel, device)
        logger.info(f"Discovered {len(tags)} tag(s) under {channel}.{device}: {[t[0] for t in tags]}")

        if not tags:
            logger.error(
                f"No tags found under '{channel}.{device}'. Check the channel/device "
                f"names match KEPServerEX exactly (case-sensitive)."
            )
            return

        while True:
            for kep_name, node in tags:
                try:
                    value = await node.read_value()
                except Exception as e:
                    logger.debug(f"Could not read {kep_name}: {e}")
                    continue

                tag_id, meta = kep_tag_to_registry_lookup(kep_name, registry)
                topic = meta.get("mqtt_topic") or f"plant/grinding/kepserver/{kep_name}"

                payload = {
                    "tag_id": tag_id,
                    "value": value,
                    "unit": meta.get("unit", ""),
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime()),
                    "quality": "Good",
                    "domain": meta.get("domain", ""),
                    # Same source tag the Node-RED flow stamps, so the backend buckets
                    # these under /api/mqtt/tags/nodered and the frontend shows them
                    # in the "Node-RED (OPC UA)" drawer.
                    "source": "nodered_opcua",
                }
                mqtt_client.publish(topic, json.dumps(payload), qos=1)
                logger.info(f"Published {tag_id} = {value} -> {topic}")

            await asyncio.sleep(poll_interval)


def main():
    parser = argparse.ArgumentParser(description="KEPServerEX OPC UA -> MQTT bridge")
    parser.add_argument("--opcua-url", default="opc.tcp://localhost:49320", help="KEPServerEX OPC UA endpoint")
    parser.add_argument("--mqtt-host", default="localhost", help="Mosquitto broker host")
    parser.add_argument("--mqtt-port", type=int, default=1883, help="Mosquitto broker port")
    parser.add_argument("--channel", default="Channel1", help="KEPServerEX channel name")
    parser.add_argument("--device", default="GrindingCircuit", help="KEPServerEX device name")
    parser.add_argument("--interval", type=float, default=2.0, help="Poll interval in seconds")
    args = parser.parse_args()

    try:
        asyncio.run(
            run_bridge(args.opcua_url, args.mqtt_host, args.mqtt_port, args.channel, args.device, args.interval)
        )
    except KeyboardInterrupt:
        logger.info("Stopped.")


if __name__ == "__main__":
    main()
