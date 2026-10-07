"""
CarbonGate — RAG Pipeline
Retrieval-Augmented Generation using ChromaDB for vector storage and Ollama for LLM inference.
"""
import time
from pathlib import Path
from typing import Optional
import chromadb

RAG_COLLECTION = "amity_knowledge"
CHROMA_RAG_PATH = str(Path(__file__).parent.parent / "data" / "chroma_rag")
CHUNK_SIZE = 500        # characters per chunk
CHUNK_OVERLAP = 100     # overlap between chunks
TOP_K_RESULTS = 8       # number of chunks to retrieve before compression

_client = None
_collection = None


def _get_rag_collection():
    global _client, _collection
    if _collection is None:
        from carbongate.embeddings import net_zero_embedding_fn
        _client = chromadb.PersistentClient(path=CHROMA_RAG_PATH)
        _collection = _client.get_or_create_collection(
            name=RAG_COLLECTION,
            embedding_function=net_zero_embedding_fn,
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


def _chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping chunks safely without infinite loops."""
    chunks = []
    start = 0
    text_len = len(text)
    while start < text_len:
        end = min(start + chunk_size, text_len)
        # Try to end at a sentence boundary
        if end < text_len:
            for sep in ['\n\n', '\n', '. ', ', ']:
                pos = text.rfind(sep, start, end)
                if pos > start + chunk_size // 2:
                    end = pos + len(sep)
                    break
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= text_len:
            break
        start = max(end - overlap, start + 1)
    return chunks


def ingest_documents(documents: list[str], force: bool = False) -> dict:
    """Ingest university documents into ChromaDB RAG collection."""
    col = _get_rag_collection()
    
    # Check if already populated
    if col.count() > 0 and not force:
        return {"status": "already_indexed", "chunks": col.count()}

    all_chunks = []
    all_ids = []
    all_metas = []

    for doc_idx, doc in enumerate(documents):
        chunks = _chunk_text(doc)
        for chunk_idx, chunk in enumerate(chunks):
            chunk_id = f"doc{doc_idx}_chunk{chunk_idx}"
            all_chunks.append(chunk)
            all_ids.append(chunk_id)
            all_metas.append({"doc_idx": doc_idx, "chunk_idx": chunk_idx})

    # Batch upsert
    batch_size = 50
    for i in range(0, len(all_chunks), batch_size):
        col.upsert(
            ids=all_ids[i:i+batch_size],
            documents=all_chunks[i:i+batch_size],
            metadatas=all_metas[i:i+batch_size],
        )

    return {"status": "indexed", "chunks": len(all_chunks)}


def retrieve_context(query: str, n_results: int = TOP_K_RESULTS) -> list[str]:
    """Retrieve relevant context chunks for a query."""
    col = _get_rag_collection()
    if col.count() == 0:
        return []
    
    try:
        results = col.query(
            query_texts=[query],
            n_results=min(n_results, col.count()),
            include=["documents"],
        )
        return results["documents"][0] if results["documents"] else []
    except Exception as e:
        print(f"[RAG] Retrieval error: {e}")
        return []


def call_ollama(
    prompt: str,
    model: str = "llama3.2:1b",
    system: str = "",
    temperature: float = 0.3,
) -> dict:
    """Call Ollama LLM and return response with token counts."""
    try:
        import ollama
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        start = time.time()
        resp = ollama.chat(
            model=model,
            messages=messages,
            options={"temperature": temperature, "num_predict": 512},
        )
        end = time.time()

        content = resp["message"]["content"]
        usage = resp.get("prompt_eval_count", 0), resp.get("eval_count", 0)
        return {
            "answer": content,
            "input_tokens": usage[0] or _estimate_tokens(prompt),
            "output_tokens": usage[1] or _estimate_tokens(content),
            "latency_ms": (end - start) * 1000,
            "model": model,
            "success": True,
        }
    except Exception as e:
        # Fallback: return mock answer if Ollama is not running
        print(f"[RAG] Ollama error ({model}): {e}")
        return _mock_llm_response(prompt, model)


def _estimate_tokens(text: str) -> int:
    return int(len(text.split()) * 1.3)


def _mock_llm_response(prompt: str, model: str) -> dict:
    """Fallback mock response when Ollama is unavailable."""
    import random, time
    base_time = {"llama3.2:1b": 0.3, "llama3.2:3b": 0.8, "llama3.1:8b": 2.0}
    delay = base_time.get(model, 1.0) + random.uniform(0.1, 0.5)
    time.sleep(min(delay, 2.0))
    
    prompt_lower = prompt.lower()
    answers = {
        "fee": "The annual fee for B.Tech is Rs. 2,16,000 per year (tuition + development + exam + lab + sports fees). Fee payment deadline is August 15 for the first semester and January 15 for the second semester. Late payment incurs a penalty of Rs. 500 per day.",
        "hostel": "Hostel fees range from Rs. 45,000 (Non-AC, 4-sharing) to Rs. 80,000 (AC, double sharing) per year, plus mandatory mess charges of Rs. 42,000. First installment deadline is August 10, 2025.",
        "admission": "Applications for 2025-26 are open from January 1 to June 30, 2025. AJEE will be conducted on April 12-13 and May 17-18. The minimum eligibility for B.Tech is 60% in PCM in Class 12.",
        "exam": "The End-Semester Examination for the odd semester is scheduled from November 20 to December 5, 2025. Results will be declared by December 20. Minimum 75% attendance is required to appear for exams.",
        "placement": "The placement rate for B.Tech is 93.3% with an average CTC of Rs. 8.2 LPA. Top recruiters include Microsoft, Google, Amazon, TCS, and Infosys. The highest package offered was Rs. 45 LPA by Microsoft.",
    }
    
    answer = "Thank you for your query. Based on the Amity University guidelines, I recommend contacting the relevant department for the most accurate and up-to-date information. Please visit the student portal at amity.edu or call the main helpline at 0120-4392000."
    for keyword, ans in answers.items():
        if keyword in prompt_lower:
            answer = ans
            break
    
    tokens_in = _estimate_tokens(prompt)
    tokens_out = _estimate_tokens(answer)
    return {
        "answer": f"[DEMO MODE — Ollama not running] {answer}",
        "input_tokens": tokens_in,
        "output_tokens": tokens_out,
        "latency_ms": delay * 1000,
        "model": model,
        "success": True,
        "is_mock": True,
    }


def answer_with_rag(
    query: str,
    context_chunks: list[str],
    model: str = "llama3.2:1b",
) -> dict:
    """Generate an answer using RAG context."""
    context_text = "\n\n---\n\n".join(context_chunks)
    
    system_prompt = """You are the Amity University AI Helpdesk Assistant. 
Answer student questions accurately and helpfully based on the provided university information.
Keep answers concise but complete. If you cannot find the answer in the context, say so clearly.
Do not make up information. Always mention relevant contact details when appropriate."""

    user_prompt = f"""University Information:
{context_text}

Student Question: {query}

Please provide a clear, helpful answer based on the information above."""

    return call_ollama(prompt=user_prompt, model=model, system=system_prompt)


def get_rag_stats() -> dict:
    col = _get_rag_collection()
    return {"indexed_chunks": col.count(), "collection": RAG_COLLECTION}
