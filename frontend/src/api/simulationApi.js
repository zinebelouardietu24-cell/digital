import { API_BASE } from "../config/api.config.js";

/**
 * Helper to build headers with Authorization Bearer token if present.
 */
function getAuthHeaders(customHeaders = {}) {
  const token = localStorage.getItem("twin_auth_token");
  const headers = { ...customHeaders };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * REST API client for the SysCAD Simulation Engine & MQTT Live Telemetry.
 */
export async function getSimulationStatus() {
  const res = await fetch(`${API_BASE}/simulation/status`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch simulation status");
  return res.json();
}

export async function startSimulation() {
  const res = await fetch(`${API_BASE}/simulation/start`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to start simulation");
  return res.json();
}

export async function pauseSimulation() {
  const res = await fetch(`${API_BASE}/simulation/pause`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to pause simulation");
  return res.json();
}

export async function resumeSimulation() {
  const res = await fetch(`${API_BASE}/simulation/resume`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to resume simulation");
  return res.json();
}

export async function stopSimulation() {
  const res = await fetch(`${API_BASE}/simulation/stop`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to stop simulation");
  return res.json();
}

export async function restartSimulation() {
  const res = await fetch(`${API_BASE}/simulation/restart`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to restart simulation");
  return res.json();
}

export async function setSimulationSpeed(speed) {
  const res = await fetch(`${API_BASE}/simulation/speed`, {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ speed: Number(speed) }),
  });
  if (!res.ok) throw new Error("Failed to update simulation speed");
  return res.json();
}

export async function getMqttStatus() {
  const res = await fetch(`${API_BASE}/api/mqtt/status`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch MQTT status");
  return res.json();
}

export async function getMqttTags() {
  const res = await fetch(`${API_BASE}/api/mqtt/tags`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch MQTT live tags");
  return res.json();
}

export async function getHistoricalTags() {
  const res = await fetch(`${API_BASE}/api/mqtt/tags/historical`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch CSV->MQTT publisher tags");
  return res.json();
}

export async function getNoderedTags() {
  const res = await fetch(`${API_BASE}/api/mqtt/tags/nodered`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch Node-RED/OPC UA tags");
  return res.json();
}

/** Défauts actifs à l'instant rejoué (état global, liste, état par équipement). */
export async function getFaultStatus() {
  const res = await fetch(`${API_BASE}/api/v1/faults/status`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch fault status");
  return res.json();
}

/** Journal des défauts apparus depuis le démarrage, le plus récent en premier. */
export async function getFaultEvents() {
  const res = await fetch(`${API_BASE}/api/v1/faults/events`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch fault events");
  return res.json();
}

/** Règles de détection (seuils, sources, actions conseillées). */
export async function getFaultRules() {
  const res = await fetch(`${API_BASE}/api/v1/faults/rules`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch fault rules");
  return res.json();
}

/** Défauts que l'on peut injecter pour une démonstration. */
export async function getFaultScenarios() {
  const res = await fetch(`${API_BASE}/api/v1/faults/scenarios`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch fault scenarios");
  return res.json();
}

export async function injectFault(scenarioId) {
  const res = await fetch(`${API_BASE}/api/v1/faults/inject/${scenarioId}`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to inject fault");
  return res.json();
}

export async function clearFault() {
  const res = await fetch(`${API_BASE}/api/v1/faults/clear`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to clear fault");
  return res.json();
}

/** Statistiques de l'historien de télémétrie (nombre de mesures enregistrées, période couverte). */
export async function getHistorianStats() {
  const res = await fetch(`${API_BASE}/api/v1/telemetry/historian/stats`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch historian stats");
  return res.json();
}
