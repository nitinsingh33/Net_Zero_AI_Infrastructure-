"""
CarbonGate — Semantic Cache
Uses ChromaDB to store and retrieve semantically similar Q&A pairs.
"""
import hashlib
import time
from typing import Optional
from pathlib import Path

CACHE_COLLECTION = "semantic_cache"
CACHE_THRESHOLD = 0.85      # cosine similarity threshold for a cache hit
CHROMA_PATH = str(Path(__file__).parent.parent / "data" / "chroma_cache")

_client = None
_collection = None


def _get_collection():
    global _client, _collection
    if _collection is None:
        import chromadb
        import os
        from carbongate.embeddings import net_zero_embedding_fn
        os.makedirs(CHROMA_PATH, exist_ok=True)
        _client = chromadb.PersistentClient(path=CHROMA_PATH)
        _collection = _client.get_or_create_collection(
            name=CACHE_COLLECTION,
            embedding_function=net_zero_embedding_fn,
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


def _embed(text: str) -> list[float]:
    """Generate embedding using Net-Zero local embedding function."""
    from carbongate.embeddings import net_zero_embedding_fn
    return net_zero_embedding_fn([text])[0]


def cache_lookup(query: str) -> Optional[dict]:
    """
    Look up the semantic cache. Returns cached result if found, else None.
    """
    col = _get_collection()
    if col.count() == 0:
        return None
    try:
        results = col.query(
            query_texts=[query],
            n_results=1,
            include=["documents", "metadatas", "distances"],
        )
        if not results["distances"][0]:
            return None
        distance = results["distances"][0][0]
        # ChromaDB cosine distance: 0=identical, 1=orthogonal
        similarity = 1.0 - distance
        if similarity >= CACHE_THRESHOLD:
            meta = results["metadatas"][0][0]
            def optional_float(value):
                try:
                    return float(value)
                except (TypeError, ValueError):
                    return None

            return {
                "hit": True,
                "similarity": round(similarity, 4),
                "cached_query": results["documents"][0][0],
                "answer": meta.get("answer", ""),
                "model": meta.get("model", "cached"),
                "original_energy_wh": optional_float(meta.get("energy_wh")),
                "original_carbon_g": optional_float(meta.get("carbon_g")),
            }
    except Exception as e:
        print(f"[Cache] Lookup error: {e}")
    return None


def cache_store(query: str, answer: str, model: str, energy_wh: float, carbon_g: float):
    """Store a Q&A pair in the semantic cache."""
    col = _get_collection()
    doc_id = hashlib.md5(query.encode()).hexdigest()
    try:
        col.upsert(
            ids=[doc_id],
            documents=[query],
            metadatas=[{
                "answer": answer[:2000],  # truncate for metadata size limits
                "model": model,
                "energy_wh": str(energy_wh),
                "carbon_g": str(carbon_g),
                "timestamp": str(time.time()),
            }],
        )
    except Exception as e:
        print(f"[Cache] Store error: {e}")


def cache_stats() -> dict:
    """Return cache statistics."""
    col = _get_collection()
    return {"total_entries": col.count()}


def cache_clear():
    """Clear all cache entries."""
    global _client, _collection
    import chromadb
    from carbongate.embeddings import net_zero_embedding_fn
    _client = chromadb.PersistentClient(path=CHROMA_PATH)
    try:
        _client.delete_collection(CACHE_COLLECTION)
    except Exception:
        pass
    _collection = _client.get_or_create_collection(
        name=CACHE_COLLECTION,
        embedding_function=net_zero_embedding_fn,
        metadata={"hnsw:space": "cosine"},
    )
