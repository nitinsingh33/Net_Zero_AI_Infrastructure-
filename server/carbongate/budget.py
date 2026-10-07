"""
CarbonGate — Carbon Budget Engine
Manages per-department carbon budgets and enforces optimization pressure.
"""
from typing import Optional
from .ledger import get_budget, ensure_budget, set_budget

# Default budget in grams CO₂ (100 kg)
DEFAULT_BUDGET_G = 100_000.0

# Pressure thresholds (fraction of budget used)
PRESSURE_THRESHOLDS = {
    "normal":   0.50,   # < 50% used → normal
    "moderate": 0.70,   # 50-70% used → moderate pressure
    "high":     0.85,   # 70-85% used → high pressure
    "critical": 0.95,   # 85-95% used → critical
    "exhausted": 1.0,   # > 95% used → exhausted
}


def get_budget_status(department: str = "default") -> dict:
    """Get full budget status for a department."""
    ensure_budget(department, DEFAULT_BUDGET_G)
    budget = get_budget(department)
    if not budget:
        return _empty_budget(department)

    budget_g = budget["budget_g"]
    used_g = budget["used_g"]
    remaining_g = max(0.0, budget_g - used_g)
    fraction_used = used_g / max(budget_g, 1)
    pct_used = round(fraction_used * 100, 2)
    pct_remaining = round(100 - pct_used, 2)

    # Determine pressure level
    pressure_level = "normal"
    if fraction_used >= 0.95:
        pressure_level = "exhausted"
    elif fraction_used >= 0.85:
        pressure_level = "critical"
    elif fraction_used >= 0.70:
        pressure_level = "high"
    elif fraction_used >= 0.50:
        pressure_level = "moderate"

    return {
        "department": department,
        "budget_g": budget_g,
        "budget_kg": round(budget_g / 1000, 3),
        "used_g": round(used_g, 3),
        "used_kg": round(used_g / 1000, 3),
        "remaining_g": round(remaining_g, 3),
        "remaining_kg": round(remaining_g / 1000, 3),
        "pct_used": pct_used,
        "pct_remaining": pct_remaining,
        "pressure_level": pressure_level,
        "pressure_score": round(min(fraction_used, 1.0), 4),
        "optimizations_active": _get_active_optimizations(pressure_level),
    }


def _empty_budget(department: str) -> dict:
    return {
        "department": department,
        "budget_g": DEFAULT_BUDGET_G,
        "budget_kg": DEFAULT_BUDGET_G / 1000,
        "used_g": 0,
        "used_kg": 0,
        "remaining_g": DEFAULT_BUDGET_G,
        "remaining_kg": DEFAULT_BUDGET_G / 1000,
        "pct_used": 0,
        "pct_remaining": 100,
        "pressure_level": "normal",
        "pressure_score": 0.0,
        "optimizations_active": [],
    }


def _get_active_optimizations(pressure_level: str) -> list:
    """Return which optimizations are active at this pressure level."""
    opts = []
    if pressure_level in ("moderate", "high", "critical", "exhausted"):
        opts.append("aggressive_caching")
    if pressure_level in ("high", "critical", "exhausted"):
        opts.extend(["model_downgrade", "context_compression"])
    if pressure_level in ("critical", "exhausted"):
        opts.extend(["defer_non_critical", "smallest_model_only"])
    return opts


def get_pressure_score(department: str = "default") -> float:
    """Return a 0.0-1.0 pressure score for budget enforcement."""
    status = get_budget_status(department)
    return status["pressure_score"]


def can_execute(department: str = "default", estimated_carbon_g: float = 0.0) -> dict:
    """Check if a workload can execute given the carbon budget."""
    status = get_budget_status(department)
    remaining = status["remaining_g"]

    if status["pressure_level"] == "exhausted":
        return {
            "allowed": False,
            "reason": f"Carbon budget exhausted for '{department}'. Reset or increase budget.",
            "status": status,
        }

    if estimated_carbon_g > 0 and estimated_carbon_g > remaining:
        return {
            "allowed": False,
            "reason": f"Estimated carbon ({estimated_carbon_g:.2f}g) exceeds remaining budget ({remaining:.2f}g)",
            "status": status,
        }

    return {"allowed": True, "reason": "Within budget", "status": status}


def update_budget_limit(department: str, new_budget_g: float):
    """Update the carbon budget for a department."""
    set_budget(department, new_budget_g)
    return get_budget_status(department)
