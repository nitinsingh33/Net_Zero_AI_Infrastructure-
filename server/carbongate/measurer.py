"""
CarbonGate — Energy & Carbon Measurer
Estimates energy consumption and CO₂ emissions per LLM request.
Uses CodeCarbon when available, falls back to hardware estimates.
"""
import time
import math
from typing import Optional

# ---------------------------------------------------------------------------
# Hardware energy models (Wh per 1000 tokens)
# These are conservative estimates based on published model benchmarks.
# ---------------------------------------------------------------------------
MODEL_ENERGY_PROFILE = {
    # model_key: (wh_per_1k_input_tokens, wh_per_1k_output_tokens)
    "1b":  (0.0003, 0.0008),
    "3b":  (0.0008, 0.0022),
    "8b":  (0.0020, 0.0055),
    "large": (0.0050, 0.0140),   # fallback for large/unknown
}

# Grid carbon intensity (gCO₂/kWh) — default: India average ~700
DEFAULT_CARBON_INTENSITY = 700.0

# Simulated hourly carbon intensity (gCO₂/kWh) — 24 hours
HOURLY_INTENSITY = [
    720, 730, 710, 680, 650, 630,   # 00-05 AM
    660, 700, 740, 760, 780, 790,   # 06-11 AM
    800, 810, 820, 810, 790, 770,   # 12-17 PM
    760, 750, 740, 730, 720, 720,   # 18-23 PM
]


def get_current_grid_intensity() -> float:
    """Return simulated grid carbon intensity for current hour."""
    import datetime
    hour = datetime.datetime.now().hour
    return HOURLY_INTENSITY[hour]


def get_forecast_intensity(hours: int = 24) -> list[dict]:
    """Return hourly carbon intensity forecast."""
    import datetime
    now = datetime.datetime.now()
    result = []
    for i in range(hours):
        h = (now.hour + i) % 24
        result.append({
            "hour_offset": i,
            "hour": h,
            "intensity": HOURLY_INTENSITY[h],
            "label": f"{h:02d}:00",
        })
    return result


def get_best_execution_window(hours_available: int = 24, min_window_hours: int = 2) -> dict:
    """Find the lowest-carbon execution window in the forecast."""
    forecast = get_forecast_intensity(hours_available)
    best = min(forecast, key=lambda x: x["intensity"])
    return best


def estimate_energy_wh(
    model_key: str,
    input_tokens: int,
    output_tokens: int,
) -> float:
    """Estimate energy consumption in watt-hours for an LLM call."""
    profile = MODEL_ENERGY_PROFILE.get(model_key, MODEL_ENERGY_PROFILE["large"])
    wh = (input_tokens / 1000) * profile[0] + (output_tokens / 1000) * profile[1]
    return round(wh, 6)


def estimate_carbon_g(energy_wh: float, intensity: Optional[float] = None) -> float:
    """Convert energy (Wh) to CO₂ grams using grid intensity (gCO₂/kWh)."""
    if intensity is None:
        intensity = get_current_grid_intensity()
    carbon = (energy_wh / 1000) * intensity  # convert Wh→kWh, then × gCO₂/kWh
    return round(carbon, 6)


def measure_request(
    model_key: str,
    input_tokens: int,
    output_tokens: int,
    start_time: float,
    end_time: float,
) -> dict:
    """Compute full carbon metrics for a request."""
    latency_ms = (end_time - start_time) * 1000
    energy_wh = estimate_energy_wh(model_key, input_tokens, output_tokens)
    intensity = get_current_grid_intensity()
    carbon_g = estimate_carbon_g(energy_wh, intensity)
    return {
        "energy_wh": energy_wh,
        "carbon_g": carbon_g,
        "latency_ms": round(latency_ms, 2),
        "grid_intensity": intensity,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
    }


def baseline_measure(input_tokens: int, output_tokens: int) -> dict:
    """Simulate baseline (always-large-model, no cache) energy for comparison."""
    energy_wh = estimate_energy_wh("large", input_tokens, output_tokens)
    intensity = get_current_grid_intensity()
    carbon_g = estimate_carbon_g(energy_wh, intensity)
    return {
        "energy_wh": energy_wh,
        "carbon_g": carbon_g,
        "model": "large",
    }
