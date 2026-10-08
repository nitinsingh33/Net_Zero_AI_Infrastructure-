import { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Clock, Zap, TrendingDown, Play, RefreshCw, CheckCircle } from 'lucide-react';
import { api } from '../api/carbongate';
import './Scheduler.css';

const DEFERRABLE_TYPES = [
  { value: 'batch_summarization', label: 'Batch Summarization' },
  { value: 'embedding_generation', label: 'Embedding Generation' },
  { value: 'report_generation', label: 'Report Generation' },
  { value: 'dataset_processing', label: 'Dataset Processing' },
  { value: 'document_indexing', label: 'Document Indexing' },
  { value: 'bulk_analysis', label: 'Bulk Analysis' },
];

const NON_DEFERRABLE_TYPES = [
  { value: 'query', label: 'Live Query (real-time)' },
  { value: 'critical', label: 'Critical Request' },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const val = payload[0]?.value;
    const color = val < 400 ? '#00d4a0' : val < 600 ? '#eab308' : val < 750 ? '#f97316' : '#ef4444';
    return (
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-bright)',
        borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '0.8rem'
      }}>
        <div style={{ color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>{label}</div>
        <div style={{ color, fontWeight: 700, fontSize: '1rem' }}>{val} gCO₂/kWh</div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '0.2rem' }}>
          {val < 400 ? '🌿 Very Clean' : val < 600 ? '🟡 Moderate' : val < 750 ? '🟠 High' : '🔴 Very High'}
        </div>
      </div>
    );
  }
  return null;
};

export default function Scheduler() {
  const [forecast, setForecast] = useState<any[]>([]);
  const [currentIntensity, setCurrentIntensity] = useState<number | null>(null);
  const [gridSource, setGridSource] = useState('');
  const [bestWindow, setBestWindow] = useState<any>(null);
  const [checking, setChecking] = useState(false);
  const [workloadType, setWorkloadType] = useState('batch_summarization');
  const [isCritical, setIsCritical] = useState(false);
  const [maxDelay, setMaxDelay] = useState(12);
  const [checkResult, setCheckResult] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [gridRes, schedRes] = await Promise.allSettled([
        api.grid(),
        api.scheduleForecast(),
      ]);
      if (gridRes.status === 'fulfilled') {
        setCurrentIntensity(gridRes.value.current_intensity);
        setForecast(gridRes.value.forecast || []);
        setGridSource(gridRes.value.source || 'Live provider');
      }
      if (schedRes.status === 'fulfilled') {
        setBestWindow(schedRes.value.best_window);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [load]);

  const handleCheck = async () => {
    setChecking(true);
    try {
      const result = await api.scheduleCheck({
        workload_type: workloadType,
        is_critical: isCritical,
        max_delay_hours: maxDelay,
      });
      setCheckResult(result);
    } catch (e) {
      console.error(e);
    } finally {
      setChecking(false);
    }
  };

  const intensityColor = currentIntensity === null ? '#94a3b8' : currentIntensity < 400 ? '#00d4a0' : currentIntensity < 600 ? '#eab308' : currentIntensity < 750 ? '#f97316' : '#ef4444';
  const intensityLabel = currentIntensity === null ? 'Unavailable' : currentIntensity < 400 ? 'Very Clean' : currentIntensity < 600 ? 'Moderate' : currentIntensity < 750 ? 'High' : 'Very High';

  return (
    <div className="scheduler-page">
      {/* Header */}
      <div className="scheduler-header">
        <div>
          <h1 className="page-title">Carbon-Aware <span className="text-gradient">Scheduler</span></h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Shift delay-tolerant workloads to lower-carbon execution windows
          </p>
        </div>
        <button className="btn btn-secondary" onClick={load} disabled={refreshing}>
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Current Status */}
      <div className="scheduler-status-row">
        <div className="metric-card current-intensity-card">
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
            Current Grid Intensity
          </div>
          <div style={{ fontSize: '3rem', fontWeight: 900, color: intensityColor, lineHeight: 1 }}>
            {currentIntensity ?? '—'}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            gCO₂/kWh · {intensityLabel}
          </div>
          <div className="progress-bar" style={{ marginTop: '0.75rem' }}>
            <div className="progress-fill" style={{
              width: `${currentIntensity === null ? 0 : Math.min((currentIntensity / 900) * 100, 100)}%`,
              background: intensityColor,
            }} />
          </div>
        </div>

        <div className="metric-card">
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
            Best Window (Next 24h)
          </div>
          {bestWindow ? (
            <>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--green-primary)', lineHeight: 1 }}>
                {bestWindow.label}
              </div>
              <div style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
                {bestWindow.intensity} gCO₂/kWh
              </div>
              {currentIntensity !== null && currentIntensity > 0 && (
                <div style={{ fontSize: '0.8rem', color: '#00d4a0', marginTop: '0.4rem' }}>
                  🌿 {Math.round((1 - bestWindow.intensity / currentIntensity) * 100)}% cleaner than now
                </div>
              )}
            </>
          ) : (
            <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
          )}
        </div>

        <div className="metric-card">
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
            Defer Decision Logic
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {[
              { icon: '🔴', text: 'Current intensity > 700 gCO₂/kWh' },
              { icon: '📦', text: 'Workload type is deferrable' },
              { icon: '💰', text: 'Savings > 15% CO₂' },
              { icon: '⚡', text: 'Not marked as critical' },
            ].map(({ icon, text }) => (
              <div key={text} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                <span>{icon}</span><span>{text}</span>
              </div>
            ))}
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
              All conditions must be met to defer.
            </div>
          </div>
        </div>
      </div>

      {/* 24h Forecast Chart */}
      {forecast.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>24-Hour Grid Carbon Intensity Forecast</h3>
            <span className="badge badge-teal">{gridSource || 'Live provider'}</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={forecast} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="intensityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00d4a0" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#00d4a0" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="label" tick={{ fill: '#4a6a8a', fontSize: 10 }} tickLine={false} axisLine={false} interval={2} />
              <YAxis tick={{ fill: '#4a6a8a', fontSize: 10 }} tickLine={false} axisLine={false} domain={[200, 900]} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={700} stroke="rgba(249,115,22,0.4)" strokeDasharray="4 4"
                label={{ value: 'Defer Threshold', fill: '#f97316', fontSize: 10, position: 'insideTopRight' }} />
              <Area
                type="monotone"
                dataKey="intensity"
                name="gCO₂/kWh"
                stroke="#00d4a0"
                fill="url(#intensityGrad)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#00d4a0' }}
              />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            Orange dashed line = 700 gCO₂/kWh defer threshold. Workloads submitted above this threshold will be considered for deferral.
          </div>
        </div>
      )}

      {/* Workload Checker */}
      <div className="card">
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>
          <Zap size={16} style={{ display: 'inline', marginRight: '0.4rem', color: 'var(--green-primary)' }} />
          Workload Scheduling Advisor
        </h3>
        <div className="scheduler-form">
          <div className="form-group">
            <label className="control-label">Workload Type</label>
            <select className="input" value={workloadType} onChange={e => setWorkloadType(e.target.value)}>
              <optgroup label="Deferrable">
                {DEFERRABLE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </optgroup>
              <optgroup label="Non-Deferrable (immediate)">
                {NON_DEFERRABLE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </optgroup>
            </select>
          </div>
          <div className="form-group">
            <label className="control-label">Max Delay (hours)</label>
            <input
              className="input"
              type="number"
              value={maxDelay}
              onChange={e => setMaxDelay(parseInt(e.target.value) || 12)}
              min={1} max={48}
              style={{ fontSize: '0.85rem' }}
            />
          </div>
          <div className="form-group">
            <label className="control-label">Priority</label>
            <button
              className={`btn ${isCritical ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setIsCritical(!isCritical)}
              style={{ fontSize: '0.78rem' }}
            >
              {isCritical ? '🔴 Critical — Execute Now' : '⚪ Normal — Can Defer'}
            </button>
          </div>
          <button className="btn btn-primary" onClick={handleCheck} disabled={checking}>
            <Play size={15} className={checking ? 'animate-pulse-green' : ''} />
            {checking ? 'Checking...' : 'Check Schedule'}
          </button>
        </div>

        {checkResult && (
          <div className={`schedule-result animate-fade-in ${checkResult.defer ? 'defer' : 'execute'}`}>
            <div className="schedule-result-header">
              {checkResult.defer
                ? <><Clock size={20} /> <span>Defer Recommended</span></>
                : <><CheckCircle size={20} /> <span>Execute Now</span></>
              }
            </div>
            <p className="schedule-reason">{checkResult.reason}</p>
            {checkResult.savings_pct > 0 && (
              <div style={{ fontSize: '0.82rem', marginTop: '0.5rem', color: 'var(--green-primary)' }}>
                🌿 Potential CO₂ savings: {checkResult.savings_pct}%
              </div>
            )}
            {checkResult.defer && checkResult.best_window && (
              <div className="best-window-info">
                <TrendingDown size={14} />
                <span>
                  Best window: <strong>{checkResult.best_window.label}</strong> at {checkResult.best_window.intensity} gCO₂/kWh
                  (vs {checkResult.current_intensity} gCO₂/kWh now)
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Deferrable vs Non-Deferrable */}
      <div className="workload-types-grid">
        <div className="card">
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--green-primary)', marginBottom: '0.75rem' }}>
            ✅ Deferrable Workloads
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            Can be delayed to a lower-carbon execution window without impacting user experience.
          </p>
          {DEFERRABLE_TYPES.map(t => (
            <div key={t.value} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <span style={{ color: 'var(--green-primary)' }}>•</span> {t.label}
            </div>
          ))}
        </div>
        <div className="card">
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f87171', marginBottom: '0.75rem' }}>
            ⚡ Non-Deferrable Workloads
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            Require immediate execution regardless of grid intensity. Always processed in real-time.
          </p>
          {NON_DEFERRABLE_TYPES.map(t => (
            <div key={t.value} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <span style={{ color: '#f87171' }}>•</span> {t.label}
            </div>
          ))}
          <div style={{ marginTop: '0.75rem', padding: '0.6rem', background: 'rgba(239,68,68,0.06)', borderRadius: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            ℹ️ Marking a request as "critical" always bypasses deferral decisions.
          </div>
        </div>
      </div>
    </div>
  );
}
