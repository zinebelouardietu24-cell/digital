# KEPServerEX → Node-RED (OPC UA) → MQTT pipeline

This is the **second telemetry source** for the digital twin, alongside the Python
CSV→MQTT replay publisher. Tags published by this pipeline carry
`"source": "nodered_opcua"` and are served to the frontend by
`GET /api/v1/telemetry/tags/nodered` (legacy alias `/api/mqtt/tags/nodered`).

```
KEPServerEX Simulator driver            Node-RED                       Mosquitto            FastAPI backend         React frontend
 channel  Circuit_Broyage         ┌── OpcUa-Endpoint  opc.tcp://localhost:49320
 device   Broyeur_Boulets         │   OpcUa-Client    subscribe (10 s)
 45 tags, RAMP(...) addresses  ───┤   fn Build Tag List (45 nodeIds)      ──► mqtt out ──►  localhost:1883  ──►  MQTTSubscriberService  ──►  Flowsheet
 OPC UA endpoint :49320           │   fn Map Tag → Topic MQTT                                (buckets by "source")     "Node-RED (OPC UA)" drawer
 security: None + anonymous       └── payload matches subscriber.py schema                                             + live equipment readouts
```

## Files here

| File | What it is | Where it normally lives |
|---|---|---|
| `kepserverex_tags_import.csv` | The 45-tag table. KEPServerEX CSV import format. `RAMP(period,low,high,rate)` simulator addresses; each row's Description ends with `source: <dotted tag_id>`. | import into KEPServerEX |
| `node-red-flow.json` | Full Node-RED export. Tab **"OCP - KEPServerEX to MQTT (Digital Twin)"** does the bridging. | `~/.node-red/flows.json` |
| `kepserver_opcua_bridge.py` | Pure-Python alternative to Node-RED (`asyncua` + `paho-mqtt`). Same output schema. Use if Node-RED is unavailable. | run standalone |
| `kepserverex_project.opf` | Full KEPServerEX project (channel, device, 45 simulated tags, OPC UA endpoint). Restore via *File > Open* in the KEPServerEX Configuration tool. | `C:\ProgramData\Kepware\KEPServerEX\V6\default.opf` |
| `node-red-package.json` | Node-RED palette dependencies (`node-red-contrib-opcua`, …). Copy to `~/.node-red/package.json` then run `npm install` there. | `~/.node-red/package.json` |

The flow hard-codes channel/device **`Circuit_Broyage.Broyeur_Boulets`** and node ids
`ns=2;s=Circuit_Broyage.Broyeur_Boulets.<TagName>`. If you name the KEPServerEX
channel/device differently, edit `CHANNEL_DEVICE` in the flow's *Build Tag List* function.

---

## Startup runbook

### 1. Infra stack (Mosquitto + backend + frontend + Neo4j)

Start Docker Desktop, then from the repo root:

```bash
docker compose up -d mosquitto neo4j backend frontend
# optional: also start the CSV replay pipeline (separate source, "CSV Data" drawer)
docker compose up -d mqtt-publisher
```

- Mosquitto → `localhost:1883`
- Backend  → `http://localhost:8000`
- Frontend → `http://localhost:5173`

### 2. KEPServerEX

1. Open **KEPServerEX Configuration**.
2. Channel: **Simulator** driver, name it `Circuit_Broyage`.
3. Device under it, name it `Broyeur_Boulets` (Model: any; Simulator ignores it).
4. Select the device → in the tag pane, right-click → **Import CSV…** → pick
   `kepserverex_tags_import.csv`. Expect **45 tags**.
5. **Project → OPC UA Configuration** (or *Administration → OPC UA Configuration*):
   - OPC UA server **enabled**.
   - Endpoint `opc.tcp://<host>:49320` — edit it and **enable Security Policy `None`**
     (default install only allows `Basic256Sha256`).
   - **Allow anonymous login = Yes**.
6. **Apply** → right-click the KEPServerEX tray icon → **Reinitialize Runtime**.
7. Quick check: open the tray **Quick Client** (or UaExpert / `~/Documents/UA.uap`)
   and confirm `Circuit_Broyage.Broyeur_Boulets.Ambient_Temp_C` returns a changing value.

### 3. Node-RED

```bash
node-red
```

Open `http://localhost:1880`. The flow is already in `~/.node-red/flows.json`.

1. Open the **OpcUa-Endpoint** config node — confirm `opc.tcp://localhost:49320`,
   Security Policy **None**, Message Security Mode **None**, no login.
2. **Deploy** (Full).
3. The *Start (au deploiement)* inject fires automatically once, 1 s after deploy
   (or click it). Watch the debug sidebar:
   - **Raw OPC UA output** → array of DataValues.
   - **Publish → Mosquitto** → 45 messages on `plant/grinding/...` topics.
4. If you see `Tag non reconnu` warnings → the `CHANNEL_DEVICE` string in *Build Tag
   List* doesn't match your KEPServerEX names.

**First-connect certificate gotcha:** even with Security `None`, KEPServerEX may park
the Node-RED client under *OPC UA Configuration → Trusted Clients* as **Rejected** on
the first attempt. Select it → **Trust** → Deploy again in Node-RED.

### 4. Verify end-to-end

```bash
curl http://localhost:8000/api/mqtt/sources
# → {"sources":[...,"nodered_opcua"]}

curl http://localhost:8000/api/mqtt/tags/nodered
# → 45 tag objects, each {tag_id, value, unit, parameter?, quality:"Good", source:"nodered_opcua", ...}
```

In the frontend (`http://localhost:5173`, log in with a demo role):

- **Flowsheet** → toolbar **🔌 Node-RED (OPC UA)** button opens the drawer → 45 grouped tags.
- Click an equipment (BM_001, SP_001, CY_001, PB_001) → the small live-readout pill
  under its title animates green with a live value.
- Equipment telemetry drawer → **NODE-RED · OPC UA (LIVE)** section lists that
  equipment's tags.

---

## Fallback: skip Node-RED

If Node-RED misbehaves during the demo:

```bash
pip install asyncua paho-mqtt cryptography
python infrastructure/kepserverex/kepserver_opcua_bridge.py \
    --opcua-url opc.tcp://localhost:49320 \
    --mqtt-host localhost \
    --channel Circuit_Broyage --device Broyeur_Boulets
```

This repo copy of the bridge already stamps `"source": "nodered_opcua"`, so its tags
land in the same drawer as the Node-RED pipeline.
