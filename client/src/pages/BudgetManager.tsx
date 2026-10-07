import { useState, useEffect, useCallback } from 'react';
import { Shield, RefreshCw, Plus, RotateCcw, TrendingUp } from 'lucide-react';
import { api } from '../api/carbongate';
import './BudgetManager.css';

const PRESSURE_CONFIG = {
  normal: { color: 'badge-green', barClass: 'progress-green', label: 'Normal' },
  moderate: { color: 'badge-blue', barClass: 'progress-yellow', label: 'Moderate' },
  high: { color: 'badge-orange', barClass: 'progress-orange', label: 'High' },
  critical: { color: 'badge-red', barClass: 'progress-red', label: 'Critical' },
  exhausted: { color: 'badge-red', barClass: 'progress-red', label: 'Exhausted' },
};

const OPTIMIZATION_INFO: Record<string, string> = {
  aggressive_caching: '🔄 Aggressive semantic caching is active — repeated or similar queries served from cache',
  model_downgrade: '⬇️ Model downgraded — queries routed to smaller models to save carbon',
  context_compression: '✂️ Context compression enhanced — fewer RAG chunks used per query',
  defer_non_critical: '⏰ Non-critical batch workloads are being deferred to lower-carbon windows',
  smallest_model_only: '🟢 Only the smallest model (1B) is used for all queries to conserve budget',
};

function BudgetCard({ dept, data, onUpdate, onReset }: {
  dept: string;
  data: any;
  onUpdate: (dept: string, kg: number) => void;
  onReset: (dept: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [newBudget, setNewBudget] = useState(data.budget_kg?.toFixed(1) || '100');
  const pressure = PRESSURE_CONFIG[data.pressure_level as keyof typeof PRESSURE_CONFIG] || PRESSURE_CONFIG.normal;

  const handleSave = () => {
    const val = parseFloat(newBudget);
    if (val > 0) onUpdate(dept, val);
    setEditing(false);
  };

  return (
    <div className={`budget-card card ${data.pressure_level === 'critical' || data.pressure_level === 'exhausted' ? 'budget-critical' : ''}`}>
      {/* Header */}
      <div className="budget-card-header">
        <div className="budget-dept-title">
          <Shield size={16} style={{ color: 'var(--green-primary)' }} />
          <span>{dept}</span>
        </div>
        <span className={`badge ${pressure.color}`}>{pressure.label}</span>
      </div>

      {/* Main numbers */}
      <div className="budget-numbers">
        <div className="budget-used">
          <div className="budget-big-num">{(data.used_kg || 0).toFixed(4)}</div>
          <div className="budget-num-label">kg CO₂ used</div>
        </div>
        <div className="budget-arrow">of</div>
        <div className="budget-total">
          {editing ? (
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <input
                className="input"
                type="number"
                value={newBudget}
                onChange={e => setNewBudget(e.target.value)}
                style={{ width: '80px', padding: '0.3rem 0.5rem', fontSize: '0.9rem' }}
                min="0.001"
              />
              <button className="btn btn-primary" onClick={handleSave} style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}>
                Save
              </button>
              <button className="btn btn-ghost" onClick={() => setEditing(false)} style={{ padding: '0.3rem', fontSize: '0.78rem' }}>
                ✕
              </button>
            </div>
          ) : (
            <>
              <div className="budget-big-num" style={{ color: 'var(--text-secondary)' }}>
                {(data.budget_kg || 0).toFixed(1)}
              </div>
              <div className="budget-num-label">kg CO₂ budget</div>
            </>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ margin: '1rem 0 0.4rem' }}>
        <div className="progress-bar" style={{ height: '10px' }}>
          <div
            className={`progress-fill ${pressure.barClass}`}
            style={{ width: `${Math.min(data.pct_used || 0, 100)}%` }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.35rem' }}>
          <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
            {(data.pct_used || 0).toFixed(1)}% used
          </span>
          <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
            {(data.remaining_kg || 0).toFixed(4)} kg remaining
          </span>
        </div>
      </div>

      {/* Active optimizations */}
      {data.optimizations_active && data.optimizations_active.length > 0 && (
        <div className="active-opts">
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>
            Active Optimizations
          </div>
          {data.optimizations_active.map((opt: string) => (
            <div key={opt} className="opt-item">
              {OPTIMIZATION_INFO[opt] || opt}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="budget-actions">
        <button className="btn btn-secondary" onClick={() => setEditing(true)} style={{ fontSize: '0.78rem', padding: '0.4rem 0.8rem' }}>
          <Plus size={13} /> Set Budget
        </button>
        <button className="btn btn-ghost" onClick={() => onReset(dept)} style={{ fontSize: '0.78rem', padding: '0.4rem 0.8rem' }}>
          <RotateCcw size={13} /> Reset Usage
        </button>
      </div>
    </div>
  );
}

export default function BudgetManager() {
  const [budgets, setBudgets] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notification, setNotification] = useState('');

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await api.allBudgets();
      setBudgets(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  const handleUpdate = async (dept: string, kg: number) => {
    await api.updateBudget(dept, kg);
    setNotification(`Budget updated for ${dept}: ${kg} kg CO₂`);
    setTimeout(() => setNotification(''), 3000);
    load();
  };

  const handleReset = async (dept: string) => {
    await api.resetBudget(dept);
    setNotification(`Usage reset for ${dept}`);
    setTimeout(() => setNotification(''), 3000);
    load();
  };

  // Total stats
  const totalUsed = Object.values(budgets).reduce((sum: number, b: any) => sum + (b.used_kg || 0), 0);
  const totalBudget = Object.values(budgets).reduce((sum: number, b: any) => sum + (b.budget_kg || 0), 0);

  return (
    <div className="budget-page">
      {/* Header */}
      <div className="budget-header">
        <div>
          <h1 className="page-title">Budget <span className="text-gradient">Manager</span></h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Configure and monitor carbon budgets per department
          </p>
        </div>
        <button className="btn btn-secondary" onClick={load} disabled={refreshing}>
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {notification && (
        <div className="notification animate-fade-in">
          ✅ {notification}
        </div>
      )}

      {/* Overview */}
      <div className="card budget-overview">
        <TrendingUp size={18} style={{ color: 'var(--green-primary)' }} />
        <div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Overall Carbon Usage</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>
            <span style={{ color: 'var(--green-primary)' }}>{totalUsed.toFixed(4)} kg</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 400 }}> / {totalBudget.toFixed(1)} kg CO₂</span>
          </div>
          <div className="progress-bar" style={{ marginTop: '0.5rem', height: '6px', maxWidth: '400px' }}>
            <div className="progress-fill progress-green" style={{ width: `${Math.min((totalUsed / Math.max(totalBudget, 1)) * 100, 100)}%` }} />
          </div>
        </div>
      </div>

      {/* How Budget Pressure Works */}
      <div className="card">
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>How Carbon Budget Pressure Works</h3>
        <div className="pressure-levels">
          {[
            { level: 'Normal', range: '< 50% used', desc: 'Standard operation — all models available', color: 'badge-green', bar: 'progress-green', pct: '40%' },
            { level: 'Moderate', range: '50-70% used', desc: 'Aggressive caching enabled', color: 'badge-blue', bar: 'progress-yellow', pct: '60%' },
            { level: 'High', range: '70-85% used', desc: 'Model downgrade + context compression', color: 'badge-orange', bar: 'progress-orange', pct: '78%' },
            { level: 'Critical', range: '85-95% used', desc: 'Smallest model only + defer batch jobs', color: 'badge-red', bar: 'progress-red', pct: '92%' },
            { level: 'Exhausted', range: '> 95% used', desc: 'Non-critical requests blocked', color: 'badge-red', bar: 'progress-red', pct: '100%' },
          ].map(({ level, range, desc, color, bar, pct }) => (
            <div key={level} className="pressure-row">
              <span className={`badge ${color}`} style={{ minWidth: 80 }}>{level}</span>
              <code style={{ fontSize: '0.75rem', color: 'var(--text-muted)', minWidth: 100 }}>{range}</code>
              <div className="progress-bar" style={{ flex: 1, height: '6px' }}>
                <div className={`progress-fill ${bar}`} style={{ width: pct }} />
              </div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Department Budget Cards */}
      <div className="budget-cards-grid">
        {loading ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            Loading budgets...
          </div>
        ) : (
          Object.entries(budgets).map(([dept, data]) => (
            <BudgetCard
              key={dept}
              dept={dept}
              data={data}
              onUpdate={handleUpdate}
              onReset={handleReset}
            />
          ))
        )}
      </div>
    </div>
  );
}
