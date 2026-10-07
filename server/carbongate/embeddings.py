"""
CarbonGate — Net-Zero Local Fast Embedding Function
High-speed, zero-network, ultra-low-carbon embedding function for ChromaDB.
Eliminates heavy ONNX model downloads and runs 100% locally with microsecond latency.
"""
import math
import re
from typing import List
from chromadb.api.types import Documents, EmbeddingFunction, Embeddings

class NetZeroEmbeddingFunction(EmbeddingFunction):
    """
    Ultra-low-carbon embedding function using Murmur-style / fnv hash projection.
    Produces deterministic 384-dimensional dense L2-normalized embeddings.
    Zero external downloads, zero network calls, zero model latency.
    """
    def __init__(self, n_dims: int = 384):
        self.n_dims = n_dims

    def _hash_token(self, token: str) -> tuple[int, float]:
        # FNV-1a 64-bit hash
        h = 14695981039346656037
        for ch in token.encode('utf-8'):
            h ^= ch
            h = (h * 1099511628211) & 0xFFFFFFFFFFFFFFFF
        dim = (h >> 16) % self.n_dims
        sign = 1.0 if (h & 1) == 1 else -1.0
        return dim, sign

    def _embed_single(self, text: str) -> List[float]:
        vec = [0.0] * self.n_dims
        text_lower = text.lower().strip()
        words = re.findall(r'\b\w+\b', text_lower)
        if not words:
            return vec

        # Word unigrams and bigrams
        for i, w in enumerate(words):
            d, s = self._hash_token(w)
            vec[d] += s * 1.5
            if i < len(words) - 1:
                bigram = f"{w}_{words[i+1]}"
                d_bi, s_bi = self._hash_token(bigram)
                vec[d_bi] += s_bi * 2.0

        # Character trigrams for morphological and misspelling robustness
        clean_str = re.sub(r'\s+', ' ', text_lower)
        for i in range(len(clean_str) - 2):
            trigram = clean_str[i:i+3]
            d_tri, s_tri = self._hash_token(trigram)
            vec[d_tri] += s_tri * 0.5

        # L2 normalize
        norm = math.sqrt(sum(x * x for x in vec))
        if norm > 1e-12:
            inv = 1.0 / norm
            vec = [x * inv for x in vec]
        return vec

    def __call__(self, input: Documents) -> Embeddings:
        return [self._embed_single(doc) for doc in input]

# Singleton instance
net_zero_embedding_fn = NetZeroEmbeddingFunction(n_dims=384)
