"""Carbon-aware scheduling decisions based on live grid forecasts."""
from .measurer import get_best_execution_window, get_current_grid_reading, get_forecast_intensity

DEFERRABLE_TYPES = {
    "batch_summarization", "embedding_generation", "report_generation",
    "dataset_processing", "document_indexing", "bulk_analysis", "batch",
}
MIN_SAVINGS_PCT = 15.0


def is_deferrable(workload_type: str, is_critical: bool = False) -> bool:
    return not is_critical and workload_type.lower() in DEFERRABLE_TYPES


def should_defer(workload_type: str, is_critical: bool = False, max_delay_hours: int = 12) -> dict:
    current = get_current_grid_reading()
    intensity = current["intensity"]
    if intensity is None:
        return {
            "defer": False,
            "reason": "Live grid carbon data is unavailable; CarbonGate will not make a simulated scheduling claim.",
            "current_intensity": None,
            "best_window": None,
            "savings_pct": None,
            "grid_source": current["source"],
        }
    if is_critical:
        return {"defer": False, "reason": "Critical workload — executing immediately", "current_intensity": intensity, "best_window": None, "savings_pct": 0, "grid_source": current["source"]}
    if not is_deferrable(workload_type):
        return {"defer": False, "reason": f"Workload type '{workload_type}' is latency-sensitive", "current_intensity": intensity, "best_window": None, "savings_pct": 0, "grid_source": current["source"]}

    best = get_best_execution_window(max_delay_hours)
    if best is None:
        return {"defer": False, "reason": "Live grid forecast is unavailable; executing without a scheduling decision.", "current_intensity": intensity, "best_window": None, "savings_pct": None, "grid_source": current["source"]}

    savings_pct = round((1 - best["intensity"] / max(intensity, 1)) * 100, 1)
    defer = savings_pct >= MIN_SAVINGS_PCT
    return {
        "defer": defer,
        "reason": (
            f"Best live forecast window is {best['label']} ({best['intensity']} gCO₂/kWh), saving about {savings_pct}% CO₂."
            if defer else f"Potential savings ({savings_pct}%) do not justify deferral."
        ),
        "current_intensity": intensity,
        "best_window": best,
        "savings_pct": savings_pct,
        "grid_source": current["source"],
    }


def get_schedule_recommendation(workload_type: str = "batch", max_delay_hours: int = 24) -> dict:
    current = get_current_grid_reading()
    best = get_best_execution_window(max_delay_hours)
    return {
        "current_intensity": current["intensity"],
        "best_window": best,
        "forecast": get_forecast_intensity(24),
        "grid_source": current["source"],
        "recommendation": (
            f"Execute at {best['label']} for {best['intensity']} gCO₂/kWh versus {current['intensity']} gCO₂/kWh now."
            if best and current["intensity"] is not None else "Live grid forecast is unavailable."
        ),
    }
