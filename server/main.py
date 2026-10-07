"""
CarbonGate — FastAPI Backend Server
Main API server exposing all CarbonGate functionality.
"""
import sys
import io
from pathlib import Path
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
import uvicorn

from carbongate.gateway import CarbonGateway
from carbongate.ledger import (
    init_db, get_ledger, get_stats, get_budget, get_daily_carbon,
    set_budget, reset_budget_usage, ensure_budget
)
from carbongate.budget import get_budget_status, update_budget_limit, get_pressure_score
from carbongate.cache import cache_stats, cache_clear
from carbongate.scheduler import get_schedule_recommendation, should_defer
from carbongate.measurer import get_current_grid_intensity, get_forecast_intensity
from carbongate.rag import ingest_documents, get_rag_stats

# Initialize DB and ingest documents on startup
init_db()

app = FastAPI(
    title="CarbonGate API",
    description="Carbon-Budgeted AI Gateway for Net-Zero AI Architecture",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global gateway instance
_gateway = None


def get_gateway(department: str = "default") -> CarbonGateway:
    return CarbonGateway(department=department)


# ── Pydantic Models ────────────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    department: str = Field(default="default")
    workload_type: str = Field(default="query")
    is_critical: bool = Field(default=False)


class BudgetUpdateRequest(BaseModel):
    department: str
    budget_kg: float = Field(..., gt=0, description="Budget in kilograms CO₂")


class ScheduleRequest(BaseModel):
    workload_type: str = Field(default="batch_summarization")
    is_critical: bool = Field(default=False)
    max_delay_hours: int = Field(default=12, ge=1, le=48)


# ── Startup ────────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    """Initialize RAG knowledge base on startup."""
    try:
        from data.amity_documents import get_all_documents
        docs = get_all_documents()
        result = ingest_documents(docs)
        print(f"[CarbonGate] RAG initialized: {result}")
    except Exception as e:
        print(f"[CarbonGate] RAG init warning: {e}")
    
    # Ensure default department budget exists
    ensure_budget("default", 100_000)
    ensure_budget("engineering", 50_000)
    ensure_budget("mba", 30_000)
    ensure_budget("research", 75_000)
    print("[CarbonGate] [READY] Gateway started successfully")


# ── Health & Status ────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "CarbonGate", "version": "1.0.0"}


@app.get("/api/status")
async def get_status():
    """Get comprehensive system status."""
    gw = get_gateway()
    return gw.get_system_status()


@app.get("/api/grid")
async def get_grid_status():
    """Get current grid carbon intensity and 24h forecast."""
    return {
        "current_intensity": get_current_grid_intensity(),
        "forecast": get_forecast_intensity(24),
        "unit": "gCO₂/kWh",
        "source": "simulated (India grid profile)",
    }


# ── Core Query Endpoint ─────────────────────────────────────────────────────────

@app.post("/api/query")
async def process_query(request: QueryRequest):
    """
    Main CarbonGate query endpoint.
    Runs the full AVOID → OPTIMIZE → COMPRESS → SHIFT → ENFORCE → MEASURE pipeline.
    """
    gw = get_gateway(request.department)
    try:
        result = gw.process_query(
            query=request.query,
            workload_type=request.workload_type,
            is_critical=request.is_critical,
            department=request.department,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Carbon Ledger ──────────────────────────────────────────────────────────────

@app.get("/api/ledger")
async def get_carbon_ledger(department: Optional[str] = None, limit: int = 50):
    """Get carbon ledger entries."""
    return {"entries": get_ledger(department=department, limit=limit)}


@app.get("/api/stats")
async def get_carbon_stats(department: Optional[str] = None):
    """Get aggregated carbon statistics."""
    stats = get_stats(department=department)
    daily = get_daily_carbon(department=department, days=7)
    return {"stats": stats, "daily": daily}


@app.get("/api/daily")
async def get_daily_stats(department: Optional[str] = None, days: int = 14):
    """Get daily carbon consumption trend."""
    return {"daily": get_daily_carbon(department=department, days=days)}


# ── Budget Management ──────────────────────────────────────────────────────────

@app.get("/api/budget")
async def get_budget_info(department: str = "default"):
    """Get carbon budget status for a department."""
    return get_budget_status(department)


@app.get("/api/budget/all")
async def get_all_budgets():
    """Get budget status for all departments."""
    departments = ["default", "engineering", "mba", "research"]
    return {dept: get_budget_status(dept) for dept in departments}


@app.post("/api/budget/update")
async def update_budget(request: BudgetUpdateRequest):
    """Update carbon budget for a department."""
    budget_g = request.budget_kg * 1000
    return update_budget_limit(request.department, budget_g)


@app.post("/api/budget/reset")
async def reset_budget(department: str = "default"):
    """Reset budget usage (not the limit) for a department."""
    reset_budget_usage(department)
    return {"status": "reset", "department": department}


# ── Cache Management ───────────────────────────────────────────────────────────

@app.get("/api/cache/stats")
async def get_cache_stats():
    """Get semantic cache statistics."""
    return cache_stats()


@app.post("/api/cache/clear")
async def clear_cache():
    """Clear the semantic cache."""
    cache_clear()
    return {"status": "cleared"}


# ── Carbon-Aware Scheduling ────────────────────────────────────────────────────

@app.post("/api/schedule/check")
async def check_schedule(request: ScheduleRequest):
    """Check if a workload should be deferred based on grid carbon intensity."""
    decision = should_defer(
        workload_type=request.workload_type,
        is_critical=request.is_critical,
        max_delay_hours=request.max_delay_hours,
    )
    recommendation = get_schedule_recommendation(request.workload_type, request.max_delay_hours)
    return {**decision, "schedule": recommendation}


@app.get("/api/schedule/forecast")
async def get_schedule_forecast():
    """Get 24h carbon intensity forecast for scheduling decisions."""
    return get_schedule_recommendation()


# ── RAG Management ─────────────────────────────────────────────────────────────

@app.get("/api/rag/stats")
async def get_rag_info():
    """Get RAG knowledge base statistics."""
    return get_rag_stats()


@app.post("/api/rag/reingest")
async def reingest_documents(background_tasks: BackgroundTasks):
    """Re-ingest all university documents into the RAG knowledge base."""
    def do_ingest():
        from data.amity_documents import get_all_documents
        docs = get_all_documents()
        ingest_documents(docs, force=True)
    
    background_tasks.add_task(do_ingest)
    return {"status": "ingestion_started", "message": "Documents are being re-indexed in the background"}


# ── Demo / Simulation Endpoints ────────────────────────────────────────────────

@app.post("/api/demo/simulate-load")
async def simulate_load(background_tasks: BackgroundTasks, requests_count: int = 10):
    """Simulate a batch of requests to populate the ledger for demo purposes."""
    demo_queries = [
        ("What is the B.Tech annual fee?", "default", "query"),
        ("When is the hostel fee deadline?", "default", "query"),
        ("What are the admission requirements?", "engineering", "query"),
        ("Tell me about placement statistics", "mba", "query"),
        ("When are the end semester exams?", "default", "query"),
        ("What is the attendance requirement?", "engineering", "query"),
        ("How much is the hostel fee?", "default", "query"),  # should cache hit
        ("What is the fee deadline for hostel?", "default", "query"),  # should cache hit
        ("Compare MBA specializations in detail", "mba", "query"),
        ("Generate a report on student performance trends", "research", "batch_summarization"),
    ]
    
    def run_queries():
        import random
        for i in range(min(requests_count, len(demo_queries))):
            q, dept, wtype = demo_queries[i]
            gw = get_gateway(dept)
            gw.process_query(query=q, workload_type=wtype, department=dept)
    
    background_tasks.add_task(run_queries)
    return {"status": "simulation_started", "queries_queued": min(requests_count, len(demo_queries))}


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
