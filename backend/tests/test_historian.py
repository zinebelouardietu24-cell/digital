import tempfile
import time
import unittest
from pathlib import Path

from app.domains.telemetry.historian import TelemetryHistorian


def _msg(tag_id: str, value: float) -> dict:
    return {"tag_id": tag_id, "value": value, "unit": "t/h", "quality": "GOOD",
            "source": "nodered_opcua", "domain": "process", "timestamp": "2026-07-01T00:15:00Z"}


class TestTelemetryHistorian(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Path(self.tmp.name) / "historian" / "telemetry.db"

    def tearDown(self):
        self.tmp.cleanup()

    def test_data_survives_restart(self):
        h = TelemetryHistorian(self.db, flush_interval_s=0.05)
        h.start()
        for i in range(250):
            h.record("plant/grinding/CY001/process/feed/solid_flow", _msg("CY001.FEED.SolidFlow", 1700 + i))
        h.record("plant/grinding/BM001/health/vibration", _msg("BM001.HEALTH.Vibration", 2.7))
        h.stop()  # simulates shutting the PC down

        restarted = TelemetryHistorian(self.db)
        restarted.start()
        try:
            stats = restarted.stats()
            self.assertEqual(stats["rows"], 251)
            self.assertEqual(stats["tags"], 2)

            recent = restarted.recent_by_tag(per_tag=100)
            self.assertEqual(len(recent["CY001.FEED.SolidFlow"]), 100)
            self.assertEqual(recent["CY001.FEED.SolidFlow"][-1]["value"], 1949)

            rows = restarted.query(tag_id="BM001.HEALTH.Vibration")
            self.assertEqual(len(rows), 1)
            self.assertAlmostEqual(rows[0]["value"], 2.7)
            self.assertEqual(rows[0]["source"], "nodered_opcua")
        finally:
            restarted.stop()

    def test_non_numeric_value_is_kept_in_payload(self):
        h = TelemetryHistorian(self.db, flush_interval_s=0.05)
        h.start()
        h.record("plant/grinding/CY001/health/status", {"tag_id": "CY001.STATUS", "value": "RUNNING"})
        h.stop()
        rows = TelemetryHistorian(self.db).query(tag_id="CY001.STATUS")
        self.assertIsNone(rows[0]["value"])


if __name__ == "__main__":
    unittest.main()
