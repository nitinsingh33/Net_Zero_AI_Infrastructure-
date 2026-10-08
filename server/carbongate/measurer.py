"""Live energy and grid-carbon measurement helpers."""
import os
import subprocess
import time
from datetime import datetime
from typing import Optional

import httpx

ELECTRICITY_MAPS_BASE_URL = "https://api.electricitymaps.com/v4"
GRID_CACHE_TTL_SECONDS = 300
_grid_cache: dict[str, object] = {"expires_at": 0.0, "current": None, "forecast": []}


def get_live_gpu_power() -> tuple[Optional[float], Optional[str]]:
    """Read instantaneous NVIDIA GPU power draw, if NVIDIA tooling is available."""
    try:
        output = subprocess.check_output(
            ["nvidia-smi", "--query-gpu=power.draw,name", "--format=csv,noheader,nounits"],
            encoding="utf-8",
            timeout=1.5,
            stderr=subprocess.DEVNULL,
        ).strip()
        if output:
            watts, *name = [value.strip() for value in output.splitlines()[0].split(",")]
            return float(watts), name[0] if name else "NVIDIA GPU"
    except (FileNotFoundError, subprocess.SubprocessError, ValueError):
        pass
    return None, None


def _unavailable_grid(message: str) -> dict:
    return {
        "available": False,
        "intensity": None,
        "source": "unavailable",
        "observed_at": None,
        "error": message,
    }


def _grid_request(path: str, params: dict[str, object]) -> dict:
    api_key = os.getenv("ELECTRICITY_MAPS_API_KEY")
    zone = os.getenv("GRID_ZONE")
    if not api_key or not zone:
        raise RuntimeError("Set ELECTRICITY_MAPS_API_KEY and GRID_ZONE to enable live grid-carbon data.")

    response = httpx.get(
        f"{ELECTRICITY_MAPS_BASE_URL}{path}",
        params={**params, "zone": zone},
        headers={"auth-token": api_key},
        timeout=8.0,
    )
    response.raise_for_status()
    return response.json()


def get_grid_data(hours: int = 24) -> dict:
    """Return current and forecast carbon intensity from Electricity Maps, never simulated data."""
    now = time.time()
    if now < float(_grid_cache["expires_at"]):
        return {"current": _grid_cache["current"], "forecast": _grid_cache["forecast"]}

    try:
        latest = _grid_request("/carbon-intensity/latest", {})
        forecast_response = _grid_request(
            "/carbon-intensity/forecast",
            {"horizonHours": min(max(hours, 6), 72), "temporalGranularity": "hourly"},
        )
        current = {
            "available": True,
            "intensity": float(latest["carbonIntensity"]),
            "source": "Electricity Maps",
            "observed_at": latest.get("datetime"),
            "zone": latest.get("zone", os.getenv("GRID_ZONE")),
            "is_estimated": latest.get("isEstimated", False),
        }
        forecast = [
            {
                "hour_offset": index,
                "label": item["datetime"],
                "intensity": float(item["carbonIntensity"]),
                "observed_at": item["datetime"],
            }
            for index, item in enumerate(forecast_response.get("forecast", [])[:hours])
            if item.get("carbonIntensity") is not None
        ]
        _grid_cache.update({"expires_at": now + GRID_CACHE_TTL_SECONDS, "current": current, "forecast": forecast})
        return {"current": current, "forecast": forecast}
    except (httpx.HTTPError, KeyError, TypeError, ValueError, RuntimeError) as error:
        current = _unavailable_grid(str(error))
        _grid_cache.update({"expires_at": now + 30, "current": current, "forecast": []})
        return {"current": current, "forecast": []}


def get_current_grid_reading() -> dict:
    return get_grid_data(24)["current"]


def get_current_grid_intensity() -> Optional[float]:
    return get_current_grid_reading()["intensity"]


def get_forecast_intensity(hours: int = 24) -> list[dict]:
    return get_grid_data(hours)["forecast"]


def get_best_execution_window(hours_available: int = 24) -> Optional[dict]:
    forecast = get_forecast_intensity(hours_available)
    return min(forecast, key=lambda item: item["intensity"]) if forecast else None


def measure_request(
    model_key: str,
    input_tokens: int,
    output_tokens: int,
    start_time: float,
    end_time: float,
) -> dict:
    """Measure local GPU energy when possible and calculate carbon from live grid data."""
    latency_sec = max(end_time - start_time, 0.001)
    gpu_watts, gpu_name = get_live_gpu_power()
    if gpu_watts is None:
        energy_wh = None
        energy_source = "unavailable: NVIDIA GPU telemetry was not detected"
    else:
        energy_wh = round(gpu_watts * latency_sec / 3600, 6)
        energy_source = f"NVIDIA GPU telemetry ({gpu_name})"

    grid = get_current_grid_reading()
    carbon_g = None
    if energy_wh is not None and grid["intensity"] is not None:
        carbon_g = round(energy_wh * float(grid["intensity"]) / 1000, 6)

    return {
        "energy_wh": energy_wh,
        "carbon_g": carbon_g,
        "latency_ms": round(latency_sec * 1000, 2),
        "grid_intensity": grid["intensity"],
        "grid_source": grid["source"],
        "energy_source": energy_source,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
    }


def baseline_measure(input_tokens: int, output_tokens: int) -> dict:
    """A baseline cannot be measured without executing it, so do not fabricate one."""
    return {"energy_wh": None, "carbon_g": None, "model": "not measured"}
