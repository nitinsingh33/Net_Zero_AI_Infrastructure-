"""
CarbonGate — FastAPI Backend Server
Main API server exposing all CarbonGate functionality.
"""
import os
import sys
from uuid import uuid4
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, HTTPException, BackgroundTasks, UploadFile, File, Depends
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
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
from carbongate.measurer import get_grid_data
from carbongate.rag import ingest_source_directory, ingest_source_file, get_rag_stats

# Initialize DB and ingest documents on startup
init_db()

app = FastAPI(
    title="CarbonGate API",
    description="Carbon-Budgeted AI Gateway for Net-Zero AI Architecture",
    version="1.0.0",
)

# Security
security = HTTPBearer(auto_error=False)
API_KEY = os.getenv("CARBONGATE_API_KEY", "carbongate-dev-key-2024")

def verify_api_key(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> bool:
    """Verify API key for protected endpoints."""
    # Allow health endpoints without authentication
    return True
    
    # TODO: Uncomment when ready for production authentication
    # if not credentials or credentials.credentials != API_KEY:
    #     raise HTTPException(status_code=401, detail="Invalid or missing API key")
    # return True

allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
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
    budget_g: float = Field(..., gt=0, description="Carbon budget in grams CO2 (must be positive)")


class ScheduleRequest(BaseModel):
    workload_type: str = Field(default="batch_summarization")
    is_critical: bool = Field(default=False)
    max_delay_hours: int = Field(default=12, ge=1, le=48)


# ── Startup ────────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    """Initialize budgets and index approved source documents."""
    source_dir = Path(__file__).parent / "data" / "sources"
    source_dir.mkdir(parents=True, exist_ok=True)
    indexing = await run_in_threadpool(ingest_source_directory, source_dir)
    print(f"[CarbonGate] Indexed {indexing['sources_indexed']} approved source document(s).")

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
    grid = get_grid_data(24)
    current = grid["current"]
    return {
        "current_intensity": current["intensity"],
        "forecast": grid["forecast"],
        "unit": "gCO₂/kWh",
        "source": current["source"],
        "available": current["available"],
        "observed_at": current["observed_at"],
        "error": current.get("error"),
    }


# ── Core Query Endpoint ─────────────────────────────────────────────────────────

@app.post("/api/query")
async def process_query(request: QueryRequest, authenticated: bool = Depends(verify_api_key)):
    """
    Main CarbonGate query endpoint.
    Runs the full AVOID → OPTIMIZE → COMPRESS → SHIFT → ENFORCE → MEASURE pipeline.
    """
    gw = get_gateway(request.department)
    try:
        result = await run_in_threadpool(gw.process_query,
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
    return update_budget_limit(request.department, request.budget_g)


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


@app.post("/api/rag/upload")
async def upload_document(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """Upload a PDF or text document and dynamically ingest it into the CarbonGate Knowledge Base."""
    filename = file.filename or "upload"
    if not filename.lower().endswith((".pdf", ".txt", ".md")):
        raise HTTPException(status_code=400, detail="Only PDF, TXT, and MD files are supported.")
    source_id = f"source_{uuid4().hex}"
    safe_filename = Path(filename).name

    try:
        content = await file.read()
        extracted_text = ""

        if len(content) > 10 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Document exceeds the 10 MB upload limit.")

        if filename.lower().endswith(".pdf"):
            import io
            import PyPDF2
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(content))
            for page in pdf_reader.pages:
                text = page.extract_text()
                if text:
                    extracted_text += text + "\n\n"
        else:
            # Handle txt and md
            extracted_text = content.decode("utf-8")

        if not extracted_text.strip():
            raise HTTPException(status_code=400, detail="No readable text found in the document.")

        source_dir = Path(__file__).parent / "data" / "sources"
        source_dir.mkdir(parents=True, exist_ok=True)
        stored_path = source_dir / f"{source_id}_{safe_filename}"
        stored_path.write_bytes(content)

        # Ingest the dynamically extracted text in the background
        def do_dynamic_ingest():
            print(f"[CarbonGate] Ingesting approved source: {safe_filename}")
            ingest_source_file(stored_path)

        background_tasks.add_task(do_dynamic_ingest)

        return {
            "status": "success",
            "message": f"Document '{safe_filename}' uploaded successfully and is being ingested.",
            "source_id": source_id,
            "estimated_length": len(extracted_text),
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[CarbonGate] Upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process document: {str(e)}")


@app.get("/api/rag/sources")
async def get_rag_sources():
    """List approved documents retained for the knowledge base."""
    source_dir = Path(__file__).parent / "data" / "sources"
    if not source_dir.exists():
        return {"sources": []}

    return {
        "sources": [
            {
                "name": source.name,
                "size_bytes": source.stat().st_size,
                "modified_at": source.stat().st_mtime,
            }
            for source in sorted(source_dir.iterdir())
            if source.is_file()
        ]
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
