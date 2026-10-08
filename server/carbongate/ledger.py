"""
CarbonGate — Carbon Ledger
SQLite-based ledger recording every AI request's carbon footprint.
"""
import sqlite3
import json
import time
import uuid
from pathlib import Path
from typing import Optional
from datetime import datetime

DB_PATH = Path(__file__).parent.parent / "data" / "carbongate.db"


def _get_conn():
    """Get a database connection with basic optimizations."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize database with indexes for better performance."""
    conn = _get_conn()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS carbon_ledger (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            request_id TEXT NOT NULL,
            query TEXT NOT NULL,
            department TEXT DEFAULT 'default',
            model TEXT,
            cache_hit INTEGER DEFAULT 0,
            input_tokens INTEGER DEFAULT 0,
            output_tokens INTEGER DEFAULT 0,
            energy_wh REAL DEFAULT 0,
            carbon_g REAL DEFAULT 0,
            latency_ms REAL DEFAULT 0,
            optimizations TEXT DEFAULT '[]',
            answer TEXT,
            complexity TEXT DEFAULT 'medium',
            context_chunks INTEGER DEFAULT 0,
            deferred INTEGER DEFAULT 0
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS carbon_budgets (
            department TEXT PRIMARY KEY,
            budget_g REAL NOT NULL,
            used_g REAL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)
    
    # Add indexes for better query performance
    try:
        conn.execute("CREATE INDEX IF NOT EXISTS idx_ledger_department_time ON carbon_ledger(department, timestamp)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_ledger_timestamp ON carbon_ledger(timestamp)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_ledger_cache_hit ON carbon_ledger(cache_hit)")
    except sqlite3.OperationalError:
        pass  # Index might already exist
    
    conn.commit()
    conn.close()


def record_request(
    request_id: str,
    query: str,
    department: str,
    model: Optional[str],
    cache_hit: bool,
    input_tokens: int,
    output_tokens: int,
    energy_wh: float,
    carbon_g: float,
    latency_ms: float,
    optimizations: list,
    answer: str,
    complexity: str = "medium",
    context_chunks: int = 0,
    deferred: bool = False,
):
    """Record a request with optimized database transaction."""
    conn = _get_conn()
    row_id = str(uuid.uuid4())
    ts = datetime.utcnow().isoformat()
    
    # Use a single transaction for both operations
    with conn:
        conn.execute(
            """
            INSERT INTO carbon_ledger
            (id, timestamp, request_id, query, department, model, cache_hit,
             input_tokens, output_tokens, energy_wh, carbon_g, latency_ms,
             optimizations, answer, complexity, context_chunks, deferred)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                row_id, ts, request_id, query, department, model,
                1 if cache_hit else 0, input_tokens, output_tokens,
                energy_wh, carbon_g, latency_ms,
                json.dumps(optimizations), answer, complexity, context_chunks,
                1 if deferred else 0,
            ),
        )
        # Update budget usage in same transaction
        conn.execute(
            """
            UPDATE carbon_budgets
            SET used_g = used_g + ?, updated_at = ?
            WHERE department = ?
            """,
            (carbon_g or 0.0, ts, department),
        )
    
    conn.close()
    return row_id


def get_ledger(department: Optional[str] = None, limit: int = 100):
    """Get ledger entries with optimized query."""
    conn = _get_conn()
    if department:
        rows = conn.execute(
            "SELECT * FROM carbon_ledger WHERE department=? ORDER BY timestamp DESC LIMIT ?",
            (department, limit),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM carbon_ledger ORDER BY timestamp DESC LIMIT ?",
            (limit,),
        ).fetchall()
    
    result = []
    for r in rows:
        d = dict(r)
        try:
            d["optimizations"] = json.loads(d["optimizations"])
        except (json.JSONDecodeError, TypeError):
            d["optimizations"] = []
        result.append(d)
    conn.close()
    return result


def get_stats(department: Optional[str] = None):
    """Get aggregated statistics with optimized query."""
    conn = _get_conn()
    where = "WHERE department=?" if department else ""
    params = (department,) if department else ()
    row = conn.execute(
        f"""
        SELECT
            COUNT(*) as total_requests,
            SUM(CASE WHEN cache_hit=1 THEN 1 ELSE 0 END) as cache_hits,
            COALESCE(SUM(energy_wh), 0) as total_energy_wh,
            COALESCE(SUM(carbon_g), 0) as total_carbon_g,
            COALESCE(AVG(latency_ms), 0) as avg_latency_ms,
            COALESCE(SUM(input_tokens + output_tokens), 0) as total_tokens
        FROM carbon_ledger {where}
        """,
        params,
    ).fetchone()
    
    conn.close()
    return dict(row) if row else {}


def ensure_budget(department: str, budget_g: float = 100_000):
    """Ensure a department budget row exists."""
    conn = _get_conn()
    ts = datetime.utcnow().isoformat()
    with conn:
        conn.execute(
            """
            INSERT OR IGNORE INTO carbon_budgets (department, budget_g, used_g, created_at, updated_at)
            VALUES (?, ?, 0, ?, ?)
            """,
            (department, budget_g, ts, ts),
        )
    conn.close()


def get_budget(department: str):
    """Get budget for department with connection pooling."""
    conn = _get_conn()
    row = conn.execute(
        "SELECT * FROM carbon_budgets WHERE department=?", (department,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def set_budget(department: str, budget_g: float):
    """Set budget with optimized upsert."""
    conn = _get_conn()
    ts = datetime.utcnow().isoformat()
    with conn:
        conn.execute(
            """
            INSERT INTO carbon_budgets (department, budget_g, used_g, created_at, updated_at)
            VALUES (?, ?, 0, ?, ?)
            ON CONFLICT(department) DO UPDATE SET budget_g=excluded.budget_g, updated_at=excluded.updated_at
            """,
            (department, budget_g, ts, ts),
        )
    conn.close()


def get_daily_carbon(department: Optional[str] = None, days: int = 7):
    """Get daily carbon stats with optimized aggregation."""
    conn = _get_conn()
    where = "WHERE department=?" if department else ""
    params = (department,) if department else ()
    rows = conn.execute(
        f"""
        SELECT DATE(timestamp) as day, 
               COALESCE(SUM(carbon_g), 0) as carbon_g, 
               COALESCE(SUM(energy_wh), 0) as energy_wh,
               COUNT(*) as requests, 
               SUM(CASE WHEN cache_hit=1 THEN 1 ELSE 0 END) as cache_hits
        FROM carbon_ledger {where}
        GROUP BY day ORDER BY day DESC LIMIT ?
        """,
        (*params, days),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def reset_budget_usage(department: str):
    """Reset budget usage with transaction."""
    conn = _get_conn()
    ts = datetime.utcnow().isoformat()
    with conn:
        conn.execute(
            "UPDATE carbon_budgets SET used_g=0, updated_at=? WHERE department=?",
            (ts, department),
        )
    conn.close()
