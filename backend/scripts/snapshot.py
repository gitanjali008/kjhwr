"""Refresh the bundled offline data snapshot from the live Elexon API.

Usage (from backend/):  python -m scripts.snapshot
"""
import httpx

from app import config
from app.elexon import fetch_actuals, fetch_forecasts, save_snapshot

if __name__ == "__main__":
    with httpx.Client(timeout=config.HTTP_TIMEOUT_SECONDS) as client:
        actuals, forecasts = fetch_actuals(client), fetch_forecasts(client)
    save_snapshot(actuals, forecasts)
    print(f"Saved {len(actuals)} actuals and {len(forecasts)} forecasts to {config.SNAPSHOT_DIR}")
