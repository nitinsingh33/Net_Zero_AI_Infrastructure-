# Carbon Gate Notes: Key Terms and Definitions

Short, team-friendly definitions for quick cross-questioning.

---

## High-carbon grid period
A time when the grid is dirtier because more electricity comes from fossil fuels. Example: evening peak hours with more coal/gas generation.

## Carbon intensity
How much CO₂ is emitted per kWh of electricity. Example: 620 gCO₂/kWh is dirtier than 280 gCO₂/kWh.

## Carbon budget
The maximum emissions a team/system is allowed to emit. Example: 100 kg budget, 82 kg used, 18 kg left.

## Carbon-aware scheduling
Running jobs when the grid is cleaner, while keeping urgent work on time. Example: delaying a report from a dirty hour to a clean hour.

## Low-carbon execution window
A period when renewable energy is higher and grid emissions are lower. Example: midday solar-heavy hours.

## Semantic cache
A cache that reuses answers for similar questions, not just identical text. Example: “hostel fee deadline?” and “when do I pay hostel fees?”

## Model routing / model right-sizing
Using the smallest suitable model for the task. Example: a simple question uses a small model; a complex one uses a bigger model.

## Context optimization
Cutting irrelevant retrieved context so the model sees only what matters. Example: 5 relevant chunks instead of 20 noisy ones.

## RAG (Retrieval-Augmented Generation)
Retrieve relevant info first, then use it to generate an answer. Example: answer university policy questions using documents.

## Query complexity
How hard a request is to answer. Example: a direct fact is low complexity; a multi-step comparison is high complexity.

## AI carbon ledger
A record of model choice, tokens used, energy, and emissions for each AI job. Example: request_id, model, carbon_g, latency_ms.

## Energy and carbon measurement
Tracking actual or estimated electricity use and emissions of AI workloads. Example: measured energy vs modeled energy.

## Baseline
The default setup without optimization. Example: all requests go to a large model immediately.

## Delay-tolerant workloads
Jobs that can wait without hurting user experience. Example: report generation, batch summaries, embeddings.

## Workload scheduling
Choosing when a job should run based on urgency and grid carbon. Example: run non-critical jobs during low-carbon windows.

## Carbon as a first-class constraint
Treating carbon as a core design requirement, not just a post-hoc metric. Example: “What is the lowest-carbon way to answer while keeping quality acceptable?”

## Measured vs simulated impact
Real observed impact versus estimated impact. Example: measured meter data vs replayed forecast data.

## Net-zero AI
Designing AI systems to minimize emissions and offset the remaining impact with cleaner infrastructure and better efficiency. Example: smaller models, caching, and cleaner scheduling.

---

## Avoid / Optimize / Compress / Shift / Enforce

These are the five design principles in CarbonGate.

### 1. Avoid
Reduce unnecessary computation.
- Example: semantic caching
- If an equivalent query has already been answered, do not run a new inference.

### 2. Optimize
Use the right model and the right amount of context.
- Example: model routing and context optimization.

### 3. Compress
Reduce waste in prompt length and retrieved context.
- Use only the minimum relevant information needed for a good answer.

### 4. Shift
Move flexible workloads to cleaner times.
- Example: carbon-aware scheduling.

### 5. Enforce
Apply limits and policies.
- Example: carbon budgets and operational rules.

---

## Simple summary

CarbonGate is trying to answer a different question from traditional AI system design:

Instead of only asking:
- "How do we answer this accurately and quickly?"

It asks:
- "How do we answer this accurately and quickly while using the least carbon-intensive computation available?"

That is the central concept behind all of the terms above.
