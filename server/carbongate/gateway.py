"""
CarbonGate — Main Gateway Decision Engine
Orchestrates all carbon optimization components for each AI request.
"""
import time
import uuid
from typing import Optional

from .cache import cache_lookup, cache_store, cache_stats
from .router import route
from .compressor import compress_context
from .scheduler import should_defer, is_deferrable
from .budget import get_budget_status, get_pressure_score, can_execute
from .measurer import measure_request, get_current_grid_intensity
from .ledger import record_request, init_db
from .rag import retrieve_context, answer_with_rag, ingest_documents


class CarbonGateway:
    """Main CarbonGate decision engine."""

    def __init__(self, department: str = "default"):
        self.department = department
        init_db()

    def process_query(
        self,
        query: str,
        workload_type: str = "query",
        is_critical: bool = False,
        department: Optional[str] = None,
    ) -> dict:
        """
        Full CarbonGate pipeline for a single query.
        Returns complete response with carbon metrics.
        """
        dept = department or self.department
        request_id = f"REQ-{str(uuid.uuid4())[:8].upper()}"
        start_time = time.time()
        optimizations = []

        # ── 1. ENFORCE: Check budget ──────────────────────────────────────────
        budget_status = get_budget_status(dept)
        pressure_score = budget_status["pressure_score"]
        budget_check = can_execute(dept)
        
        if not budget_check["allowed"] and not is_critical:
            return {
                "request_id": request_id,
                "query": query,
                "answer": f"⚠️ Carbon budget exhausted for department '{dept}'. Request blocked by CarbonGate. Please contact your administrator.",
                "cache_hit": False,
                "model": None,
                "complexity": "n/a",
                "energy_wh": 0,
                "carbon_g": 0,
                "latency_ms": 0,
                "optimizations": ["budget_blocked"],
                "budget_status": budget_status,
                "blocked": True,
                "pipeline_trace": ["budget_check → BLOCKED"],
            }

        # ── 2. SHIFT: Check if workload should be deferred ───────────────────
        defer_decision = should_defer(workload_type, is_critical)
        if defer_decision["defer"] and not is_critical:
            optimizations.append("workload_deferred")
            elapsed = (time.time() - start_time) * 1000
            record_request(
                request_id=request_id, query=query, department=dept,
                model=None, cache_hit=False, input_tokens=0, output_tokens=0,
                energy_wh=0, carbon_g=0, latency_ms=elapsed,
                optimizations=optimizations, answer="DEFERRED",
                complexity="n/a", context_chunks=0, deferred=True,
            )
            return {
                "request_id": request_id,
                "query": query,
                "answer": f"⏳ Workload deferred. {defer_decision['reason']}",
                "cache_hit": False,
                "model": None,
                "complexity": "n/a",
                "energy_wh": 0,
                "carbon_g": 0,
                "latency_ms": elapsed,
                "optimizations": optimizations,
                "budget_status": budget_status,
                "deferred": True,
                "defer_decision": defer_decision,
                "pipeline_trace": ["budget_check → OK", "shift → DEFERRED"],
            }

        # ── 3. AVOID: Semantic cache lookup ───────────────────────────────────
        cache_result = cache_lookup(query)
        if cache_result and cache_result["hit"]:
            optimizations.append("semantic_cache_hit")
            elapsed = (time.time() - start_time) * 1000
            
            # Cache-serving energy is not measurable without CPU process telemetry.
            energy_wh = None
            carbon_g = None
            
            record_request(
                request_id=request_id, query=query, department=dept,
                model="cache", cache_hit=True, input_tokens=0, output_tokens=0,
                energy_wh=energy_wh, carbon_g=carbon_g, latency_ms=elapsed,
                optimizations=optimizations, answer=cache_result["answer"],
                complexity="cached", context_chunks=0,
            )
            return {
                "request_id": request_id,
                "query": query,
                "answer": cache_result["answer"],
                "cache_hit": True,
                "similarity": cache_result["similarity"],
                "cached_query": cache_result["cached_query"],
                "model": "cache",
                "complexity": "cached",
                "energy_wh": energy_wh,
                "carbon_g": carbon_g,
                "energy_source": "unavailable: cache-serving CPU energy is not instrumented",
                "grid_source": "not queried",
                "energy_saved_wh": None,
                "carbon_saved_g": None,
                "latency_ms": round(elapsed, 2),
                "optimizations": optimizations,
                "budget_status": budget_status,
                "pipeline_trace": ["budget_check → OK", "shift → proceed", "cache → HIT ⚡"],
            }

        # ── 4. OPTIMIZE: Route to appropriate model ───────────────────────────
        routing = route(query, budget_pressure=pressure_score)
        if routing["downgraded_by_budget"]:
            optimizations.append("model_downgrade_budget")
        else:
            optimizations.append(f"model_routing_{routing['complexity']}")
        
        # ── 5. COMPRESS: Retrieve and compress RAG context ───────────────────
        raw_chunks = retrieve_context(query)
        compressed_chunks, compression_stats = compress_context(
            raw_chunks, query, budget_pressure=pressure_score
        )
        
        if compression_stats["reduction_pct"] > 10:
            optimizations.append("context_compression")
        
        # ── 6. Execute LLM inference ──────────────────────────────────────────
        llm_result = answer_with_rag(
            query=query,
            context_chunks=compressed_chunks,
            model=routing["model_name"],
        )
        
        end_time = time.time()
        
        # ── 7. MEASURE: Record carbon metrics ────────────────────────────────
        metrics = measure_request(
            model_key=routing["model_key"],
            input_tokens=llm_result["input_tokens"],
            output_tokens=llm_result["output_tokens"],
            start_time=start_time,
            end_time=end_time,
        )

        # Store in semantic cache for future requests
        cache_store(
            query=query,
            answer=llm_result["answer"],
            model=routing["model_key"],
            energy_wh=metrics["energy_wh"],
            carbon_g=metrics["carbon_g"],
        )
        
        # ── 8. Record in ledger ───────────────────────────────────────────────
        record_request(
            request_id=request_id,
            query=query,
            department=dept,
            model=routing["model_key"],
            cache_hit=False,
            input_tokens=llm_result["input_tokens"],
            output_tokens=llm_result["output_tokens"],
            energy_wh=metrics["energy_wh"],
            carbon_g=metrics["carbon_g"],
            latency_ms=metrics["latency_ms"],
            optimizations=optimizations,
            answer=llm_result["answer"],
            complexity=routing["complexity"],
            context_chunks=len(compressed_chunks),
        )

        return {
            "request_id": request_id,
            "query": query,
            "answer": llm_result["answer"],
            "cache_hit": False,
            "model": routing["model_name"],
            "model_key": routing["model_key"],
            "model_label": routing["model_label"],
            "complexity": routing["complexity"],
            "complexity_reason": routing["reason"],
            "routing_confidence": routing["confidence"],
            "energy_wh": metrics["energy_wh"],
            "carbon_g": metrics["carbon_g"],
            "latency_ms": metrics["latency_ms"],
            "grid_intensity": metrics["grid_intensity"],
            "energy_source": metrics["energy_source"],
            "grid_source": metrics["grid_source"],
            "input_tokens": llm_result["input_tokens"],
            "output_tokens": llm_result["output_tokens"],
            "optimizations": optimizations,
            "context_stats": compression_stats,
            "budget_status": budget_status,
            "baseline": None,
            "carbon_saved_g": None,
            "energy_saved_wh": None,
            "is_mock": llm_result.get("is_mock", False),
            "pipeline_trace": [
                "budget_check → OK",
                "shift → proceed",
                "cache → MISS",
                f"route → {routing['model_label']} ({routing['complexity']})",
                f"compress → {compression_stats['reduction_pct']}% reduction",
                "inference → complete",
                "measure → recorded",
            ],
        }

    def get_system_status(self) -> dict:
        """Get overall CarbonGate system status."""
        from .measurer import get_forecast_intensity, get_current_grid_intensity
        from .cache import cache_stats
        from .rag import get_rag_stats
        from .ledger import get_stats, get_daily_carbon
        
        return {
            "gateway": "CarbonGate v1.0",
            "department": self.department,
            "budget_status": get_budget_status(self.department),
            "cache_stats": cache_stats(),
            "rag_stats": get_rag_stats(),
            "current_grid_intensity": get_current_grid_intensity(),
            "overall_stats": get_stats(),
            "daily_carbon": get_daily_carbon(days=7),
        }
