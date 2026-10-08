// CarbonGate — TypeScript Types

export interface QueryRequest {
  query: string;
  department: string;
  workload_type: string;
  is_critical: boolean;
}

export interface CompressionStats {
  original_chunks: number;
  selected_chunks: number;
  original_tokens: number;
  selected_tokens: number;
  reduction_pct: number;
}

export interface BudgetStatus {
  department: string;
  budget_g: number;
  budget_kg: number;
  used_g: number;
  used_kg: number;
  remaining_g: number;
  remaining_kg: number;
  pct_used: number;
  pct_remaining: number;
  pressure_level: 'normal' | 'moderate' | 'high' | 'critical' | 'exhausted';
  pressure_score: number;
  optimizations_active: string[];
}

export interface QueryResponse {
  request_id: string;
  query: string;
  answer: string;
  cache_hit: boolean;
  similarity?: number;
  cached_query?: string;
  model: string | null;
  model_key?: string;
  model_label?: string;
  complexity: string;
  complexity_reason?: string;
  routing_confidence?: number;
  energy_wh: number;
  carbon_g: number;
  latency_ms: number;
  grid_intensity?: number;
  grid_source?: string;
  energy_source?: string;
  input_tokens?: number;
  output_tokens?: number;
  optimizations: string[];
  context_stats?: CompressionStats;
  budget_status: BudgetStatus;
  baseline?: { energy_wh: number; carbon_g: number; model: string };
  carbon_saved_g?: number;
  energy_saved_wh?: number;
  is_mock?: boolean;
  deferred?: boolean;
  blocked?: boolean;
  pipeline_trace?: string[];
}

export interface LedgerEntry {
  id: string;
  timestamp: string;
  request_id: string;
  query: string;
  department: string;
  model: string | null;
  cache_hit: number;
  input_tokens: number;
  output_tokens: number;
  energy_wh: number;
  carbon_g: number;
  latency_ms: number;
  optimizations: string[];
  answer: string;
  complexity: string;
  context_chunks: number;
  deferred: number;
}

export interface CarbonStats {
  total_requests: number;
  cache_hits: number;
  total_energy_wh: number;
  total_carbon_g: number;
  avg_latency_ms: number;
  total_tokens: number;
}

export interface DailyCarbon {
  day: string;
  carbon_g: number;
  energy_wh: number;
  requests: number;
  cache_hits: number;
}

export interface GridForecastEntry {
  hour_offset: number;
  hour: number;
  intensity: number;
  label: string;
}

export interface SystemStatus {
  gateway: string;
  department: string;
  budget_status: BudgetStatus;
  cache_stats: { total_entries: number };
  rag_stats: { indexed_chunks: number; collection: string };
  current_grid_intensity: number;
  overall_stats: CarbonStats;
  daily_carbon: DailyCarbon[];
}
