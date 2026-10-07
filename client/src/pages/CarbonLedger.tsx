import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Download, Filter } from 'lucide-react';
import { api } from '../api/carbongate';
import './CarbonLedger.css';

const DEPARTMENTS = ['all', 'default', 'engineering', 'mba', 'research'];

function formatTimestamp(ts: string) {
  try {
    return new Date(ts).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch {
    return ts;
  }
}

function OptimizationTags({ opts }: { opts: string[] }) {
  const colorMap: Record<string, string> = {
    semantic_cache_hit: 'badge-green',
    model_routing_low: 'badge-green',
    model_routing_medium: 'badge-blue',
    model_routing_high: 'badge-purple',
    context_compression: 'badge-teal',
    model_downgrade_budget: 'badge-orange',
    workload_deferred: 'badge-yellow',
    budget_blocked: 'badge-red',
  };
  return (
    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
      {(opts || []).map(opt => (
        <span key={opt} className={`badge ${colorMap[opt] || 'badge-gray'}`} style={{ fontSize: '0.62rem' }}>
          {opt.replace(/_/g, ' ')}
        </span>
      ))}
    </div>
  );
}

export default function CarbonLedger() {
  const [entries, setEntries] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [daily, setDaily] = useState<any[]>([]);
  const [department, setDepartment] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const dept = department === 'all' ? undefined : department;
      const [ledgerRes, statsRes] = await Promise.allSettled([
        api.ledger(dept, 100),
        api.stats(dept),
      ]);
      if (ledgerRes.status === 'fulfilled') setEntries(ledgerRes.value.entries || []);
      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value.stats);
        setDaily((statsRes.value.daily || []).reverse());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [department]);

  useEffect(() => {
    load();
  }, [load]);

  const downloadCSV = () => {
    const headers = ['request_id', 'timestamp', 'department', 'query', 'model', 'cache_hit', 'input_tokens', 'output_tokens', 'energy_wh', 'carbon_g', 'latency_ms', 'optimizations'];
    const rows = entries.map(e => [
      e.request_id, e.timestamp, e.department,
      `"${e.query?.replace(/"/g, '""')}"`,
      e.model, e.cache_hit ? 'true' : 'false',
      e.input_tokens, e.output_tokens,
      e.energy_wh, e.carbon_g, e.latency_ms,
      `"${(e.optimizations || []).join(', ')}"`
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'carbongate-ledger.csv'; a.click();
  };

  const totalCarbon = stats?.total_carbon_g || 0;
  const totalEnergy = stats?.total_energy_wh || 0;
  const cacheRate = stats?.total_requests ? Math.round((stats.cache_hits / stats.total_requests) * 100) : 0;

  return (
    <div className="ledger-page">
      {/* Header */}
      <div className="ledger-header">
        <div>
          <h1 className="page-title">Carbon <span className="text-gradient">Ledger</span></h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Complete carbon accounting for every AI request
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Filter size={14} style={{ color: 'var(--text-muted)' }} />
            <select className="input" value={department} onChange={e => setDepartment(e.target.value)}
              style={{ fontSize: '0.82rem', padding: '0.4rem 0.7rem' }}>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d === 'all' ? 'All Departments' : d}</option>)}
            </select>
          </div>
          <button className="btn btn-secondary" onClick={downloadCSV}>
            <Download size={15} /> Export CSV
          </button>
          <button className="btn btn-secondary" onClick={load} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="ledger-stats-row">
        <div className="metric-card">
          <div className="metric-value">{stats?.total_requests || 0}</div>
          <div className="metric-label">Total Requests</div>
        </div>
        <div className="metric-card">
          <div className="metric-value" style={{ color: '#60a5fa' }}>{cacheRate}%</div>
          <div className="metric-label">Cache Hit Rate</div>
          <div className="metric-sub">{stats?.cache_hits || 0} cache hits</div>
        </div>
        <div className="metric-card">
          <div className="metric-value" style={{ color: '#a78bfa' }}>{totalEnergy.toFixed(4)} Wh</div>
          <div className="metric-label">Total Energy Used</div>
        </div>
        <div className="metric-card">
          <div className="metric-value" style={{ color: '#f97316' }}>{(totalCarbon / 1000).toFixed(4)} kg</div>
          <div className="metric-label">Total CO₂ Emitted</div>
          <div className="metric-sub">{totalCarbon.toFixed(3)} grams</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{Math.round(stats?.avg_latency_ms || 0)} ms</div>
          <div className="metric-label">Avg Latency</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{stats?.total_tokens || 0}</div>
          <div className="metric-label">Total Tokens</div>
        </div>
      </div>

      {/* Daily Summary */}
      {daily.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: '0.95rem', marginBottom: '1rem', fontWeight: 700 }}>Daily Summary</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Requests</th>
                  <th>Cache Hits</th>
                  <th>Cache Rate</th>
                  <th>CO₂ (g)</th>
                  <th>Energy (Wh)</th>
                </tr>
              </thead>
              <tbody>
                {daily.map((d: any) => (
                  <tr key={d.day}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{d.day}</td>
                    <td>{d.requests}</td>
                    <td>{d.cache_hits}</td>
                    <td>
                      <span className="badge badge-green">
                        {d.requests ? Math.round((d.cache_hits / d.requests) * 100) : 0}%
                      </span>
                    </td>
                    <td className="text-mono" style={{ color: 'var(--green-primary)' }}>{(d.carbon_g || 0).toFixed(6)}</td>
                    <td className="text-mono" style={{ color: '#60a5fa' }}>{(d.energy_wh || 0).toFixed(6)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Full Ledger */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Request Log</h3>
          <span className="badge badge-gray">{entries.length} entries</span>
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading ledger...
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Time</th>
                  <th>Dept</th>
                  <th>Query</th>
                  <th>Model</th>
                  <th>Cache</th>
                  <th>Complexity</th>
                  <th>CO₂ (g)</th>
                  <th>Energy (Wh)</th>
                  <th>Latency</th>
                  <th>Optimizations</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e: any) => (
                  <tr key={e.id}>
                    <td><span className="text-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{e.request_id}</span></td>
                    <td style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatTimestamp(e.timestamp)}</td>
                    <td>
                      <span className="badge badge-gray" style={{ fontSize: '0.65rem' }}>{e.department}</span>
                    </td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                      {e.query}
                    </td>
                    <td>
                      {e.cache_hit ? (
                        <span className="badge badge-teal">⚡ cache</span>
                      ) : (
                        <span className={`badge badge-${e.model === '1b' ? 'green' : e.model === '3b' ? 'blue' : e.model === '8b' ? 'purple' : 'gray'}`}>
                          {e.model || 'N/A'}
                        </span>
                      )}
                    </td>
                    <td>
                      {e.cache_hit
                        ? <span className="badge badge-green">HIT</span>
                        : <span className="badge badge-gray">MISS</span>}
                    </td>
                    <td>
                      <span className={`badge badge-${e.complexity === 'low' ? 'green' : e.complexity === 'medium' ? 'blue' : e.complexity === 'high' ? 'purple' : 'gray'}`}>
                        {e.complexity}
                      </span>
                    </td>
                    <td className="text-mono" style={{ fontSize: '0.78rem', color: 'var(--green-primary)' }}>
                      {(e.carbon_g || 0).toFixed(6)}
                    </td>
                    <td className="text-mono" style={{ fontSize: '0.78rem', color: '#60a5fa' }}>
                      {(e.energy_wh || 0).toFixed(6)}
                    </td>
                    <td className="text-mono" style={{ fontSize: '0.78rem' }}>
                      {Math.round(e.latency_ms || 0)}ms
                    </td>
                    <td>
                      <OptimizationTags opts={e.optimizations} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {entries.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No requests recorded yet. Use the AI Helpdesk to start generating queries.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
