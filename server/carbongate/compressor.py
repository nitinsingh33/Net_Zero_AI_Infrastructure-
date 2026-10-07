"""
CarbonGate — Context Compressor
Reduces RAG context to the minimum number of chunks needed for an acceptable answer.
Ranks retrieved chunks by relevance and returns the top-K.
"""
from typing import List, Tuple
import re

MAX_CHUNKS_DEFAULT = 5
MAX_TOKENS_DEFAULT = 1200


def _score_chunk(chunk: str, query: str) -> float:
    """Score a chunk's relevance to the query using keyword overlap (TF-style)."""
    query_words = set(re.findall(r'\b\w+\b', query.lower()))
    chunk_words = re.findall(r'\b\w+\b', chunk.lower())
    
    if not query_words or not chunk_words:
        return 0.0
    
    # Remove stop words
    stop_words = {
        'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
        'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
        'would', 'could', 'should', 'may', 'might', 'shall', 'can',
        'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
        'and', 'or', 'but', 'if', 'then', 'than', 'that', 'this',
        'it', 'its', 'i', 'me', 'my', 'we', 'our', 'you', 'your',
        'what', 'when', 'where', 'who', 'how', 'which',
    }
    query_keywords = query_words - stop_words
    
    hits = sum(1 for w in chunk_words if w in query_keywords)
    score = hits / (len(chunk_words) ** 0.5 + 1)
    return score


def _count_tokens(text: str) -> int:
    return int(len(text.split()) * 1.3)


def compress_context(
    chunks: List[str],
    query: str,
    max_chunks: int = MAX_CHUNKS_DEFAULT,
    max_tokens: int = MAX_TOKENS_DEFAULT,
    budget_pressure: float = 0.0,
) -> Tuple[List[str], dict]:
    """
    Compress context chunks to the most relevant subset.
    
    Returns:
        (selected_chunks, stats)
        stats contains: original_chunks, selected_chunks, original_tokens, selected_tokens, reduction_pct
    """
    if not chunks:
        return [], {"original_chunks": 0, "selected_chunks": 0, "original_tokens": 0, "selected_tokens": 0, "reduction_pct": 0}

    # Under budget pressure, reduce limits further
    if budget_pressure > 0.7:
        max_chunks = max(2, max_chunks - 2)
        max_tokens = int(max_tokens * 0.6)
    elif budget_pressure > 0.4:
        max_chunks = max(3, max_chunks - 1)
        max_tokens = int(max_tokens * 0.8)

    original_count = len(chunks)
    original_tokens = sum(_count_tokens(c) for c in chunks)

    # Score and rank chunks
    scored = [(chunk, _score_chunk(chunk, query)) for chunk in chunks]
    scored.sort(key=lambda x: x[1], reverse=True)

    # Select top chunks within token budget
    selected = []
    token_budget = max_tokens
    for chunk, score in scored:
        chunk_tokens = _count_tokens(chunk)
        if len(selected) >= max_chunks:
            break
        if chunk_tokens <= token_budget:
            selected.append(chunk)
            token_budget -= chunk_tokens

    selected_tokens = sum(_count_tokens(c) for c in selected)
    reduction = round((1 - selected_tokens / max(original_tokens, 1)) * 100, 1)

    stats = {
        "original_chunks": original_count,
        "selected_chunks": len(selected),
        "original_tokens": original_tokens,
        "selected_tokens": selected_tokens,
        "reduction_pct": reduction,
    }
    return selected, stats
