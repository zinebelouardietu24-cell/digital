import json
import logging
import queue
import sqlite3
import threading
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

SCHEMA = """
CREATE TABLE IF NOT EXISTS telemetry (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ts          TEXT,              -- horodatage porté par le message (timestamp)
    received_at TEXT NOT NULL,     -- horodatage de réception par le backend (UTC)
    topic       TEXT NOT NULL,
    tag_id      TEXT,
    value       REAL,
    unit        TEXT,
    quality     TEXT,
    source      TEXT,
    domain      TEXT,
    payload     TEXT NOT NULL      -- message JSON complet, pour ne rien perdre
);
CREATE INDEX IF NOT EXISTS idx_telemetry_tag_time ON telemetry (tag_id, received_at);
CREATE INDEX IF NOT EXISTS idx_telemetry_received ON telemetry (received_at);
"""


def _to_float(value: Any) -> Optional[float]:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


class TelemetryHistorian:
    """
    Persists every MQTT telemetry message to a SQLite file so the plant history
    survives a backend, Docker or PC restart.

    MQTT callbacks only enqueue messages; a dedicated writer thread commits them
    in batches, so disk I/O never slows down message reception.
    """

    def __init__(self, db_path: Path, batch_size: int = 500, flush_interval_s: float = 1.0):
        self.db_path = Path(db_path)
        self.batch_size = batch_size
        self.flush_interval_s = flush_interval_s
        self._queue: "queue.Queue[tuple]" = queue.Queue(maxsize=100_000)
        self._stop = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._dropped = 0

    def start(self):
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with closing(self._connect()) as conn:
            conn.executescript(SCHEMA)
            conn.commit()
        self._stop.clear()
        self._thread = threading.Thread(target=self._writer_loop, name="telemetry-historian", daemon=True)
        self._thread.start()
        logger.info("Telemetry historian writing to %s", self.db_path)

    def stop(self):
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=5)

    def record(self, topic: str, payload: Dict[str, Any]):
        row = (
            payload.get("timestamp"),
            datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
            topic,
            payload.get("tag_id"),
            _to_float(payload.get("value")),
            payload.get("unit"),
            payload.get("quality"),
            payload.get("source"),
            payload.get("domain"),
            json.dumps(payload, ensure_ascii=False),
        )
        try:
            self._queue.put_nowait(row)
        except queue.Full:
            self._dropped += 1
            if self._dropped % 1000 == 1:
                logger.warning("Historian queue full — %d messages dropped so far", self._dropped)

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=10)
        conn.execute("PRAGMA journal_mode=WAL")  # lectures possibles pendant l'écriture
        conn.execute("PRAGMA synchronous=NORMAL")
        return conn

    def _writer_loop(self):
        conn = self._connect()
        try:
            while not (self._stop.is_set() and self._queue.empty()):
                batch = []
                try:
                    batch.append(self._queue.get(timeout=self.flush_interval_s))
                    while len(batch) < self.batch_size:
                        batch.append(self._queue.get_nowait())
                except queue.Empty:
                    pass
                if batch:
                    try:
                        conn.executemany(
                            "INSERT INTO telemetry (ts, received_at, topic, tag_id, value, unit, quality, source, domain, payload)"
                            " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                            batch,
                        )
                        conn.commit()
                    except sqlite3.Error as e:
                        logger.error("Historian failed to write %d rows: %s", len(batch), e)
        finally:
            conn.close()

    # ------------------------------------------------------------------ lecture

    def stats(self) -> Dict[str, Any]:
        if not self.db_path.exists():
            return {"rows": 0, "tags": 0, "first": None, "last": None}
        with closing(self._connect()) as conn:
            rows, tags, first, last = conn.execute(
                "SELECT COUNT(*), COUNT(DISTINCT tag_id), MIN(received_at), MAX(received_at) FROM telemetry"
            ).fetchone()
        return {
            "db_path": str(self.db_path),
            "size_MB": round(self.db_path.stat().st_size / 1e6, 2),
            "rows": rows,
            "tags": tags,
            "first": first,
            "last": last,
            "queued": self._queue.qsize(),
            "dropped": self._dropped,
        }

    def query(self, tag_id: Optional[str] = None, start: Optional[str] = None, end: Optional[str] = None,
              source: Optional[str] = None, limit: int = 1000) -> List[Dict[str, Any]]:
        sql = "SELECT ts, received_at, topic, tag_id, value, unit, quality, source, domain FROM telemetry WHERE 1=1"
        params: List[Any] = []
        if tag_id:
            sql += " AND tag_id = ?"
            params.append(tag_id)
        if source:
            sql += " AND source = ?"
            params.append(source)
        if start:
            sql += " AND received_at >= ?"
            params.append(start)
        if end:
            sql += " AND received_at <= ?"
            params.append(end)
        sql += " ORDER BY received_at DESC LIMIT ?"
        params.append(limit)
        with closing(self._connect()) as conn:
            conn.row_factory = sqlite3.Row
            rows = [dict(r) for r in conn.execute(sql, params).fetchall()]
        return rows[::-1]

    def recent_by_tag(self, per_tag: int = 100) -> Dict[str, List[Dict[str, Any]]]:
        """Derniers messages de chaque tag, pour restaurer l'historique en mémoire au démarrage."""
        if not self.db_path.exists():
            return {}
        with closing(self._connect()) as conn:
            rows = conn.execute(
                "SELECT tag_id, payload FROM ("
                "  SELECT tag_id, payload, id, ROW_NUMBER() OVER (PARTITION BY tag_id ORDER BY id DESC) AS rn"
                "  FROM telemetry WHERE tag_id IS NOT NULL"
                ") WHERE rn <= ? ORDER BY id",
                (per_tag,),
            ).fetchall()
        history: Dict[str, List[Dict[str, Any]]] = {}
        for tag_id, payload in rows:
            history.setdefault(tag_id, []).append(json.loads(payload))
        return history
