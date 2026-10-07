"""
CarbonGate — Complexity-Based Model Router
Analyzes query complexity and routes to the appropriate model tier.
"""
import re
from typing import Tuple

# ---------------------------------------------------------------------------
# Model tier definitions — maps complexity → Ollama model name + key
# ---------------------------------------------------------------------------
MODEL_TIERS = {
    "low":    {"name": "llama3.2:1b",  "key": "1b",  "label": "1B (Small)"},
    "medium": {"name": "llama3.2:3b",  "key": "3b",  "label": "3B (Medium)"},
    "high":   {"name": "llama3.1:8b",  "key": "8b",  "label": "8B (Large)"},
}

# ---------------------------------------------------------------------------
# Complexity heuristics
# ---------------------------------------------------------------------------
LOW_COMPLEXITY_PATTERNS = [
    r"\bwhat is\b",
    r"\bwhen is\b",
    r"\bwho is\b",
    r"\bhow much\b",
    r"\bwhere is\b",
    r"\bwhat are\b",
    r"\bdeadline\b",
    r"\bfee\b",
    r"\bdate\b",
    r"\btime\b",
    r"\bcontact\b",
    r"\bphone\b",
    r"\bemail\b",
    r"\baddress\b",
    r"\bschedule\b",
    r"\btimetable\b",
    r"\bhostel\b",
    r"\bcanteen\b",
]

HIGH_COMPLEXITY_PATTERNS = [
    r"\bcompare\b",
    r"\banalyze\b",
    r"\banalyse\b",
    r"\bdifference between\b",
    r"\bpros and cons\b",
    r"\badvantage\b",
    r"\bdisadvantage\b",
    r"\bexplain in detail\b",
    r"\bwrite an essay\b",
    r"\bsummarize\b",
    r"\bsummarise\b",
    r"\bcritically\b",
    r"\bevaluate\b",
    r"\bjustify\b",
    r"\bdiscuss\b",
    r"\bhow does .+ work\b",
    r"\bstep by step\b",
    r"\bdetailed\b",
    r"\bcomprehensive\b",
    r"\bmultiple\b",
    r"\bvarious\b",
]

TOKEN_THRESHOLDS = {
    "low_max": 20,     # ≤20 tokens → low
    "high_min": 40,    # ≥40 tokens → high
}


def count_tokens(text: str) -> int:
    """Rough token count (whitespace split ×1.3 factor)."""
    return int(len(text.split()) * 1.3)


def classify_complexity(query: str) -> Tuple[str, float, str]:
    """
    Returns (complexity_level, confidence, reason).
    complexity_level: 'low', 'medium', 'high'
    """
    q_lower = query.lower().strip()
    token_count = count_tokens(q_lower)

    low_hits = sum(1 for p in LOW_COMPLEXITY_PATTERNS if re.search(p, q_lower))
    high_hits = sum(1 for p in HIGH_COMPLEXITY_PATTERNS if re.search(p, q_lower))

    # Token-length signal
    if token_count <= TOKEN_THRESHOLDS["low_max"] and high_hits == 0:
        length_signal = "low"
    elif token_count >= TOKEN_THRESHOLDS["high_min"]:
        length_signal = "high"
    else:
        length_signal = "medium"

    # Pattern signal
    if high_hits > 0 and high_hits >= low_hits:
        pattern_signal = "high"
    elif low_hits > 0 and low_hits > high_hits:
        pattern_signal = "low"
    else:
        pattern_signal = "medium"

    # Combine signals
    if pattern_signal == "high" or length_signal == "high":
        level = "high"
        confidence = 0.85 + min(high_hits * 0.05, 0.15)
        reason = f"Complex query patterns detected ({high_hits} high-complexity signals, {token_count} tokens)"
    elif pattern_signal == "low" and length_signal != "high":
        level = "low"
        confidence = 0.80 + min(low_hits * 0.05, 0.15)
        reason = f"Simple factual query ({low_hits} low-complexity signals, {token_count} tokens)"
    else:
        level = "medium"
        confidence = 0.70
        reason = f"Medium complexity query ({token_count} tokens, {low_hits} low / {high_hits} high signals)"

    return level, min(confidence, 0.99), reason


def get_model_for_complexity(complexity: str, budget_pressure: float = 0.0) -> dict:
    """
    Select model tier. budget_pressure 0.0-1.0 can downgrade model.
    budget_pressure > 0.5 forces one tier down.
    budget_pressure > 0.8 forces to lowest tier.
    """
    if budget_pressure > 0.8:
        return MODEL_TIERS["low"]
    if budget_pressure > 0.5 and complexity == "high":
        return MODEL_TIERS["medium"]
    return MODEL_TIERS.get(complexity, MODEL_TIERS["medium"])


def route(query: str, budget_pressure: float = 0.0) -> dict:
    """Full routing decision for a query."""
    complexity, confidence, reason = classify_complexity(query)
    model = get_model_for_complexity(complexity, budget_pressure)
    downgraded = budget_pressure > 0.5
    return {
        "complexity": complexity,
        "confidence": round(confidence, 3),
        "reason": reason,
        "model_name": model["name"],
        "model_key": model["key"],
        "model_label": model["label"],
        "downgraded_by_budget": downgraded,
    }
