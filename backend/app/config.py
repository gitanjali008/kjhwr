"""Central configuration. Values can be overridden with environment variables."""
import os
from datetime import datetime, timezone

ELEXON_BASE_URL = os.getenv("ELEXON_BASE_URL", "https://data.elexon.co.uk/bmrs/api/v1")

# Target (delivery) window: purchase decisions made during January 2026 cover
# delivery from 1 Jan up to and including 1 Feb 2026.
WINDOW_START = datetime(2026, 1, 1, tzinfo=timezone.utc)
WINDOW_END = datetime(2026, 2, 2, tzinfo=timezone.utc)  # exclusive

# WINDFOR forecasts reach ~48h ahead, so fetch publishes from 3 days earlier.
FORECAST_PUBLISH_LOOKBACK_DAYS = 3

# Longest horizon users can select (WINDFOR publishes ~every 2-4h, reaching ~66h ahead).
MAX_HORIZON_HOURS = 48
# Forecasts with longer lead times are discarded; must exceed MAX_HORIZON_HOURS so a
# 48h query still finds the most recent publish that is *at least* 48h old.
FORECAST_MAX_LEAD_HOURS = 72

# GB day-ahead auction gate closure is 11:00 UK time on D-1 (UK = UTC in January).
DAY_AHEAD_CUTOFF_HOUR_UTC = int(os.getenv("DAY_AHEAD_CUTOFF_HOUR_UTC", "11"))

HTTP_TIMEOUT_SECONDS = float(os.getenv("HTTP_TIMEOUT_SECONDS", "60"))

# Allowed CORS origins for the React frontend (comma separated).
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]

# "live" fetches from Elexon (snapshot as fallback); "snapshot" reads bundled data only.
# Serverless hosts (Vercel) default to the snapshot to avoid refetching on every cold start.
DATA_SOURCE = os.getenv("DATA_SOURCE", "snapshot" if os.getenv("VERCEL") else "live")

SNAPSHOT_DIR =os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
