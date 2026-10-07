"""
CarbonGate — Carbon-Aware Scheduler
Decides whether a workload should be deferred to a lower-carbon window.
"""
from typing import Optional
from .measurer import get_current_grid_intensity, get_forecast_intensity, get_best_execution_window

# ---------------------------------------------------------------------------
# Workload types that can be deferred
# ---------------------------------------------------------------------------
DEFERRABLE_TYPES = {
    "batch_summarization",
    "embedding_generation",
    "report_generation",
    "dataset_processing",
    "document_indexing",
    "bulk_analysis",
    "batch",
}

# Carbon intensity threshold: if current > threshold, consider deferring
DEFER_INTENSITY_THRESHOLD = 700.0   # gCO₂/kWh

# Minimum savings to justify deferring (percent)
MIN_SAVINGS_PCT = 15.0


def is_deferrable(workload_type: str, is_critical: bool = False) -> bool:
    """Check if a workload type can be deferred."""
    if is_critical:
        return False
    return workload_type.lower() in DEFERRABLE_TYPES


def should_defer(
    workload_type: str,
    is_critical: bool = False,
    max_delay_hours: int = 12,
) -> dict:
    """
    Decide whether to defer this workload.
    
    Returns:
        dict with: defer (bool), reason, best_window, savings_pct, current_intensity
    """
    current = get_current_grid_intensity()

    if is_critical:
        return {
            "defer": False,
            "reason": "Critical workload — executing immediately",
            "current_intensity": current,
            "best_window": None,
            "savings_pct": 0,
        }

    if not is_deferrable(workload_type):
        return {
            "defer": False,
            "reason": f"Workload type '{workload_type}' is not deferrable (latency-sensitive)",
            "current_intensity": current,
            "best_window": None,
            "savings_pct": 0,
        }

    # Find best window in the allowed delay period
    best = get_best_execution_window(hours_available=max_delay_hours)
    best_intensity = best["intensity"]
    savings_pct = round((1 - best_intensity / max(current, 1)) * 100, 1)

    if current <= DEFER_INTENSITY_THRESHOLD:
        return {
            "defer": False,
            "reason": f"Current grid intensity ({current} gCO₂/kWh) is acceptable",
            "current_intensity": current,
            "best_window": best,
            "savings_pct": savings_pct,
        }

    if savings_pct < MIN_SAVINGS_PCT:
        return {
            "defer": False,
            "reason": f"Potential savings ({savings_pct}%) too small to justify deferral",
            "current_intensity": current,
            "best_window": best,
            "savings_pct": savings_pct,
        }

    return {
        "defer": True,
        "reason": (
            f"High grid intensity now ({current} gCO₂/kWh). "
            f"Best window at {best['label']} ({best_intensity} gCO₂/kWh) saves ~{savings_pct}% CO₂"
        ),
        "current_intensity": current,
        "best_window": best,
        "savings_pct": savings_pct,
    }


def get_schedule_recommendation(workload_type: str = "batch", max_delay_hours: int = 24) -> dict:
    """Get a full scheduling recommendation with 24h forecast."""
    forecast = get_forecast_intensity(24)
    current = get_current_grid_intensity()
    best = get_best_execution_window(max_delay_hours)
    
    return {
        "current_intensity": current,
        "best_window": best,
        "forecast": forecast,
        "recommendation": (
            f"Execute at {best['label']} for {best['intensity']} gCO₂/kWh "
            f"vs {current} gCO₂/kWh now"
        ),
    }
