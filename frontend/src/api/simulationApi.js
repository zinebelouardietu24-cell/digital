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

export async function getWhatIfConfig() {
  const res = await fetch(`${API_BASE}/api/whatif/config`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch what-if config");
  return res.json();
}

export async function predictWhatIf(inputs) {
  const res = await fetch(`${API_BASE}/api/whatif/predict`, {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(inputs),
  });
  if (!res.ok) throw new Error("Failed to run what-if prediction");
  return res.json();
}