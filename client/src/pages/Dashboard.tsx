import { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Zap, Wind, Activity, TrendingDown, Database,
  RefreshCw, Cpu, Shield, Clock
} from 'lucide-react';
import { api } from '../api/carbongate';
import './Dashboard.css';

const COLORS = {
  green: '#00d4a0',
  blue: '#3b82f6',
  purple: '#8b5cf6',
  orange: '#f97316',
  red: '#ef4444',
  teal: '#20b2aa',
  yellow: '#eab308',
};

const MODEL_COLORS: Record<string, string> = {
  '1b': COLORS.green,
  '3b': COLORS.blue,
  '8b': COLORS.purple,
  'cache': COLORS.teal,
  'null': COLORS.teal,
};

function StatCard({
  label, value, sub, icon: Icon, color = 'green', glow = false
}: {
  label: string; value: string; sub?: string; icon: any; color?: string; glow?: boolean;
}) {
  return (
    <div className={`metric-card ${glow ? 'card-glow' : ''}`}>
      <div className="stat-card-inner">
        <div className="stat-icon" style={{ background: `rgba(${color === 'green' ? '0,212,160' : color === 'blue' ? '59,130,246' : color === 'purple' ? '139,92,246' : color === 'orange' ? '249,115,22' : '0,212,160'}, 0.12)` }}>
          <Icon size={18} style={{ color: color === 'green' ? COLORS.green : color === 'blue' ? COLORS.blue : color === 'purple' ? COLORS.purple : color === 'orange' ? COLORS.orange : COLORS.green }} />
        </div>
        <div>
          <div className="metric-value">{value}</div>
          <div className="metric-label">{label}</div>
          {sub && <div className="metric-sub">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

function GridIntensityBar({ value }: { value: number | null }) {
  if (value === null) {
    return <div className="grid-intensity-widget" style={{ color: 'var(--text-muted)' }}>Live grid carbon data is unavailable. Configure Electricity Maps to enable it.</div>;
  }
  const max = 900;
  const pct = Math.min((value / max) * 100, 100);
  const color = value < 400 ? 'progress-green' : value < 600 ? 'progress-yellow' : value < 750 ? 'progress-orange' : 'progress-red';
  const label = value < 400 ? '🌿 Very Clean' : value < 600 ? '🟡 Moderate' : value < 750 ? '🟠 High' : '🔴 Very High';

  return (
    <div className="grid-intensity-widget">
      <div className="flex justify-between items-center" style={{ marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Current Grid Intensity</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--green-primary)', fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>gCO₂<br />per kWh</div>
        <div style={{ flex: 1 }}>
          <div className="progress-bar">
            <div className={`progress-fill ${color}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-bright)',
        borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '0.8rem'
      }}>
        <div style={{ color: 'var(--text-secondary)', marginBottom: '0.3rem', fontWeight: 600 }}>{label}</div>
        {payload.map((p: any) => (
          <div key={p.name} style={{ color: p.color, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
            <span style={{ color: 'var(--text-muted)' }}>{p.name}:</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {typeof p.value === 'number' ? p.value.toFixed(4) : p.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const [status, setStatus] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [daily, setDaily] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [allBudgets, setAllBudgets] = useState<any>({});
  const [grid, setGrid] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [statusRes, statsRes, dailyRes, ledgerRes, budgetRes, gridRes] = await Promise.allSettled([
        api.status(),
        api.stats(),
        api.daily(undefined, 14),
        api.ledger(undefined, 20),
        api.allBudgets(),
        api.grid(),
      ]);
      if (statusRes.status === 'fulfilled') setStatus(statusRes.value);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.stats);
      if (dailyRes.status === 'fulfilled') setDaily((dailyRes.value.daily || []).reverse());
      if (ledgerRes.status === 'fulfilled') setLedger(ledgerRes.value.entries || []);
      if (budgetRes.status === 'fulfilled') setAllBudgets(budgetRes.value);
      if (gridRes.status === 'fulfilled') setGrid(gridRes.value);
    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
  };

  // Build model distribution pie data
  const modelDist = ledger.reduce((acc: any, e: any) => {
    const key = e.cache_hit ? 'cache' : (e.model || 'cache');
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const pieData = Object.entries(modelDist).map(([name, value]) => ({ name, value }));

  // Cache hit rate
  const cacheHitRate = stats?.total_requests
    ? Math.round((stats.cache_hits / stats.total_requests) * 100)
    : 0;

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, border: '3px solid rgba(0,212,160,0.2)', borderTopColor: 'var(--green-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading CarbonGate Dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">
            <span className="text-gradient">CarbonGate</span> Dashboard
          </h1>
          <p className="dashboard-subtitle">
            Real-time carbon accounting for your AI workloads · Greenovators Hackathon 2026
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Grid Intensity Banner */}
      {grid && (
        <GridIntensityBar value={grid.current_intensity} />
      )}

      {/* Main KPI Cards */}
      <div className="stats-grid">
        <StatCard
          label="Total Requests"
          value={String(stats?.total_requests || 0)}
          sub="All time"
          icon={Activity}
          glow
        />
        <StatCard
          label="Cache Hit Rate"
          value={`${cacheHitRate}%`}
          sub={`${stats?.cache_hits || 0} hits saved`}
          icon={Zap}
          color="blue"
        />
        <StatCard
          label="Total Energy"
          value={`${((stats?.total_energy_wh || 0)).toFixed(4)} Wh`}
          sub="vs baseline savings"
          icon={Wind}
          color="purple"
        />
        <StatCard
          label="Total CO₂"
          value={`${((stats?.total_carbon_g || 0) / 1000).toFixed(4)} kg`}
          sub="grams emitted"
          icon={TrendingDown}
          color="orange"
        />
        <StatCard
          label="Cached Entries"
          value={String(status?.cache_stats?.total_entries || 0)}
          sub="Semantic cache"
          icon={Database}
        />
        <StatCard
          label="Avg Latency"
          value={`${Math.round(stats?.avg_latency_ms || 0)} ms`}
          sub="Per request"
          icon={Clock}
        />
        <StatCard
          label="RAG Chunks"
          value={String(status?.rag_stats?.indexed_chunks || 0)}
          sub="Amity knowledge base"
          icon={Cpu}
          color="purple"
        />
        <StatCard
          label="Active Budgets"
          value={String(Object.keys(allBudgets).length)}
          sub="Departments"
          icon={Shield}
          color="blue"
        />
      </div>

      {/* Charts Row */}
      <div className="charts-row">
        {/* Daily Carbon Chart */}
        <div className="card chart-card">
          <div className="chart-header">
            <h3>Daily Carbon Consumption</h3>
            <span className="badge badge-green">14 days</span>
          </div>
          {daily.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={daily} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="carbonGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00d4a0" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#00d4a0" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="energyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="day" tick={{ fill: '#4a6a8a', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#4a6a8a', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="carbon_g" name="CO₂ (g)" stroke="#00d4a0" fill="url(#carbonGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-chart">No data yet — run some queries!</div>
          )}
        </div>

        {/* Model Distribution Pie */}
        <div className="card chart-card">
          <div className="chart-header">
            <h3>Model Distribution</h3>
            <span className="badge badge-blue">Recent {ledger.length}</span>
          </div>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry: any, i: number) => (
                    <Cell key={i} fill={MODEL_COLORS[entry.name] || COLORS.green} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  formatter={(val) => <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{val}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-chart">No data yet</div>
          )}
        </div>
      </div>

      {/* Department Budgets */}
      <div className="card">
        <div className="chart-header" style={{ marginBottom: '1.25rem' }}>
          <h3>Department Carbon Budgets</h3>
          <span className="badge badge-orange">Live</span>
        </div>
        <div className="budget-grid">
          {Object.entries(allBudgets).map(([dept, b]: [string, any]) => {
            const pct = b.pct_used || 0;
            const pressureColor =
              b.pressure_level === 'normal' ? 'progress-green' :
              b.pressure_level === 'moderate' ? 'progress-yellow' :
              b.pressure_level === 'high' ? 'progress-orange' : 'progress-red';
            return (
              <div key={dept} className="budget-dept-card">
                <div className="budget-dept-header">
                  <span className="budget-dept-name">{dept}</span>
                  <span className={`badge badge-${b.pressure_level === 'normal' ? 'green' : b.pressure_level === 'moderate' ? 'blue' : b.pressure_level === 'high' ? 'orange' : 'red'}`}>
                    {b.pressure_level}
                  </span>
                </div>
                <div className="budget-dept-values">
                  <span>{b.used_kg?.toFixed(3)} kg</span>
                  <span style={{ color: 'var(--text-muted)' }}>of {b.budget_kg?.toFixed(1)} kg CO₂</span>
                </div>
                <div className="progress-bar" style={{ marginTop: '0.5rem' }}>
                  <div className={`progress-fill ${pressureColor}`} style={{ width: `${pct}%` }} />
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem', textAlign: 'right' }}>
                  {pct.toFixed(1)}% used
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid Forecast */}
      {grid?.forecast && (
        <div className="card">
          <div className="chart-header" style={{ marginBottom: '1rem' }}>
            <h3>24h Carbon Intensity Forecast</h3>
            <span className="badge badge-teal">{grid.source || 'Live provider'}</span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={grid.forecast.slice(0, 24)} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="label" tick={{ fill: '#4a6a8a', fontSize: 9 }} tickLine={false} axisLine={false}
                interval={2} />
              <YAxis tick={{ fill: '#4a6a8a', fontSize: 9 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="intensity" name="gCO₂/kWh" radius={[3, 3, 0, 0]}>
                {grid.forecast.slice(0, 24).map((entry: any, i: number) => (
                  <Cell
                    key={i}
                    fill={
                      entry.intensity < 400 ? '#00d4a0' :
                      entry.intensity < 600 ? '#eab308' :
                      entry.intensity < 750 ? '#f97316' : '#ef4444'
                    }
                    opacity={entry.hour_offset === 0 ? 1 : 0.65}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
            {[
              { color: '#00d4a0', label: '< 400 Very Clean' },
              { color: '#eab308', label: '400-600 Moderate' },
              { color: '#f97316', label: '600-750 High' },
              { color: '#ef4444', label: '> 750 Very High' },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block' }} />
                {label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Requests */}
      <div className="card">
        <div className="chart-header" style={{ marginBottom: '1rem' }}>
          <h3>Recent Requests</h3>
          <span className="badge badge-gray">{ledger.length} shown</span>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Request ID</th>
                <th>Query</th>
                <th>Model</th>
                <th>Cache</th>
                <th>CO₂ (g)</th>
                <th>Energy (Wh)</th>
                <th>Latency</th>
                <th>Optimizations</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((e: any) => (
                <tr key={e.id}>
                  <td><span className="text-mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{e.request_id}</span></td>
                  <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)', fontSize: '0.82rem' }}>{e.query}</td>
                  <td>
                    <span className={`badge badge-${e.model === '1b' ? 'green' : e.model === '3b' ? 'blue' : e.model === '8b' ? 'purple' : 'teal'}`}>
                      {e.cache_hit ? '⚡ Cache' : (e.model || 'N/A')}
                    </span>
                  </td>
                  <td>{e.cache_hit ? <span className="badge badge-green">HIT</span> : <span className="badge badge-gray">MISS</span>}</td>
                  <td className="text-mono" style={{ fontSize: '0.8rem', color: 'var(--green-primary)' }}>{(e.carbon_g || 0).toFixed(6)}</td>
                  <td className="text-mono" style={{ fontSize: '0.8rem', color: '#60a5fa' }}>{(e.energy_wh || 0).toFixed(6)}</td>
                  <td className="text-mono" style={{ fontSize: '0.8rem' }}>{Math.round(e.latency_ms || 0)}ms</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                      {(e.optimizations || []).slice(0, 2).map((opt: string) => (
                        <span key={opt} className="badge badge-gray" style={{ fontSize: '0.62rem' }}>
                          {opt.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {ledger.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No requests yet. Use the AI Helpdesk or click "Run Demo Queries" above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
