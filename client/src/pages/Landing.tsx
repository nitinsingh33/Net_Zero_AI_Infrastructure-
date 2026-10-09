import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Leaf, ArrowRight, Zap, Cpu, BarChart3, Shield,
  GitBranch, Globe, ChevronDown, Activity, Database,
  TrendingDown, Lock, Clock
} from 'lucide-react';
import './Landing.css';

function useCounter(target: number, duration = 1800) {
  const [value, setValue] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStarted(true); },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(ease * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [started, target, duration]);

  return { value, ref };
}

function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animId: number;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    const particles = Array.from({ length: 55 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 1.4 + 0.4, alpha: Math.random() * 0.35 + 0.08,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,212,160,${p.alpha})`; ctx.fill();
      });
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 110) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(0,212,160,${0.07 * (1 - dist / 110)})`;
            ctx.lineWidth = 0.5; ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(animId); };
  }, []);

  return <canvas ref={canvasRef} className="particle-canvas" />;
}

const Landing = () => {
  const navigate = useNavigate();
  const chunksCounter = useCounter(5296, 2000);
  const savingsCounter = useCounter(60, 1600);
  const budgetCounter = useCounter(100, 1400);

  const features = [
    { icon: Shield, title: 'AVOID', description: 'Semantic caching eliminates redundant AI inference using vector similarity search.', stat: '~60% reduction', color: 'green' },
    { icon: Cpu, title: 'OPTIMIZE', description: 'Intelligent model routing assigns queries to the minimal sufficient model tier.', stat: '1B to 3B to 8B', color: 'blue' },
    { icon: BarChart3, title: 'COMPRESS', description: 'Context window optimisation trims token usage without losing semantic fidelity.', stat: '~40% savings', color: 'purple' },
    { icon: Zap, title: 'SHIFT', description: 'Carbon-aware scheduling defers non-urgent jobs to low-carbon grid windows.', stat: '15% threshold', color: 'yellow' },
    { icon: Leaf, title: 'ENFORCE', description: 'Department-level carbon budgets with real-time tracking and hard cut-offs.', stat: '100% transparency', color: 'teal' },
  ];

  const pipeline = [
    { icon: Globe, label: 'Incoming', sub: 'User / API' },
    { icon: Database, label: 'Cache', sub: 'ChromaDB' },
    { icon: Activity, label: 'CarbonGate', sub: 'Router' },
    { icon: Cpu, label: 'Model', sub: '1B/3B/8B' },
    { icon: TrendingDown, label: 'Optimised', sub: 'Tracked' },
  ];

  const steps = [
    { icon: Globe, title: 'Query Arrives', desc: 'An AI request hits the CarbonGate proxy layer from your application.' },
    { icon: Database, title: 'Cache Check', desc: 'Semantic similarity search finds near-duplicate responses already computed.' },
    { icon: Activity, title: 'Carbon Routing', desc: 'Budget checker and grid carbon intensity decide the optimal model and timing.' },
    { icon: Clock, title: 'Scheduled or Served', desc: 'Response is served instantly or deferred to a greener grid window.' },
  ];

  return (
    <div className="landing-page">
      <ParticleCanvas />

      <nav className="lp-nav">
        <div className="lp-nav-inner">
          <div className="lp-logo">
            <Leaf className="lp-logo-icon" />
            <span>CarbonGate</span>
          </div>
          <div className="lp-nav-links">
            <button className="lp-nav-link" onClick={() => navigate('/dashboard')}>Dashboard</button>
            <button className="lp-nav-link" onClick={() => navigate('/helpdesk')}>AI Helpdesk</button>
            <button className="lp-nav-link" onClick={() => navigate('/carbon-ledger')}>Ledger</button>
            <button className="lp-btn-launch" onClick={() => navigate('/dashboard')}>
              Launch App <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </nav>

      <section className="lp-hero">
        <div className="lp-hero-glow lp-hero-glow-1" />
        <div className="lp-hero-glow lp-hero-glow-2" />
        <div className="lp-hero-inner">
          <div className="lp-hero-content">
            <div className="lp-badge">
              <span className="lp-badge-dot" />
              <Leaf size={13} />
              Greenovators Hackathon Winner
            </div>
            <h1 className="lp-title">
              The World&apos;s First<br />
              <span className="lp-gradient-text">Carbon-Budgeted</span><br />
              AI Gateway
            </h1>
            <p className="lp-subtitle">
              CarbonGate makes carbon a <strong>first-class architectural constraint</strong> alongside
              cost, latency, and reliability. Not just a metric. A control loop.
            </p>
            <div className="lp-actions">
              <button className="lp-btn-primary" onClick={() => navigate('/dashboard')}>
                Launch Dashboard <ArrowRight size={18} />
              </button>
              <a className="lp-btn-ghost" href="https://github.com" target="_blank" rel="noreferrer">
                <GitBranch size={18} /> View Source
              </a>
            </div>
            <div className="lp-stats">
              <div className="lp-stat" ref={chunksCounter.ref}>
                <div className="lp-stat-value">{chunksCounter.value.toLocaleString()}</div>
                <div className="lp-stat-label">Indexed Chunks</div>
              </div>
              <div className="lp-stat-divider" />
              <div className="lp-stat" ref={savingsCounter.ref}>
                <div className="lp-stat-value">~{savingsCounter.value}%</div>
                <div className="lp-stat-label">Cache Hit Rate</div>
              </div>
              <div className="lp-stat-divider" />
              <div className="lp-stat" ref={budgetCounter.ref}>
                <div className="lp-stat-value">{budgetCounter.value}kg</div>
                <div className="lp-stat-label">CO2 Budget</div>
              </div>
            </div>
          </div>

          <div className="lp-hero-panel">
            <div className="lp-panel-header">
              <span className="lp-panel-dot red" />
              <span className="lp-panel-dot yellow" />
              <span className="lp-panel-dot green" />
              <span className="lp-panel-title">carbongate.live</span>
            </div>
            <div className="lp-panel-body">
              <div className="lp-live-badge"><span className="lp-live-dot" />Live</div>
              <div className="lp-mini-metrics">
                <div className="lp-mini-metric">
                  <Leaf size={16} className="lp-mm-icon green" />
                  <div><div className="lp-mm-value">0.31g</div><div className="lp-mm-label">CO2 / query</div></div>
                </div>
                <div className="lp-mini-metric">
                  <Zap size={16} className="lp-mm-icon yellow" />
                  <div><div className="lp-mm-value">0.42Wh</div><div className="lp-mm-label">Energy saved</div></div>
                </div>
                <div className="lp-mini-metric">
                  <Activity size={16} className="lp-mm-icon blue" />
                  <div><div className="lp-mm-value">142ms</div><div className="lp-mm-label">Avg latency</div></div>
                </div>
              </div>
              <div className="lp-flow">
                {pipeline.map((step, i) => {
                  const Icon = step.icon;
                  return (
                    <React.Fragment key={i}>
                      <div className={`lp-flow-step lp-flow-step-${i}`}>
                        <div className="lp-flow-icon"><Icon size={14} /></div>
                        <div className="lp-flow-label">{step.label}</div>
                        <div className="lp-flow-sub">{step.sub}</div>
                      </div>
                      {i < pipeline.length - 1 && (
                        <div className="lp-flow-arrow">
                          <div className="lp-flow-line" />
                          <ArrowRight size={10} className="lp-flow-chevron" />
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
              <div className="lp-budget-section">
                <div className="lp-budget-header">
                  <Lock size={11} /><span>Carbon Budget</span><span className="lp-budget-pct">67%</span>
                </div>
                <div className="lp-budget-bar"><div className="lp-budget-fill" style={{ width: '67%' }} /></div>
                <div className="lp-budget-labels"><span>67kg used</span><span>100kg limit</span></div>
              </div>
            </div>
          </div>
        </div>
        <div className="lp-scroll-hint"><ChevronDown size={20} className="lp-scroll-icon" /></div>
      </section>

      <section className="lp-features">
        <div className="lp-container">
          <div className="lp-section-label">Five Principles</div>
          <h2 className="lp-section-title">Carbon Optimization Pipeline</h2>
          <p className="lp-section-sub">From intake to inference, every step is carbon-conscious by design.</p>
          <div className="lp-features-grid">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <div key={i} className={`lp-feature-card lp-feature-card-${f.color}`}>
                  <div className="lp-feature-number">0{i + 1}</div>
                  <div className={`lp-feature-icon lp-fi-${f.color}`}><Icon size={22} /></div>
                  <h3 className="lp-feature-title">{f.title}</h3>
                  <p className="lp-feature-desc">{f.description}</p>
                  <div className="lp-feature-stat">{f.stat}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="lp-how">
        <div className="lp-container">
          <div className="lp-section-label">Architecture</div>
          <h2 className="lp-section-title">How CarbonGate Works</h2>
          <div className="lp-steps">
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className="lp-step">
                  <div className="lp-step-num">{i + 1}</div>
                  <div className="lp-step-icon-wrap"><Icon size={24} /></div>
                  <h4 className="lp-step-title">{s.title}</h4>
                  <p className="lp-step-desc">{s.desc}</p>
                  {i < steps.length - 1 && <div className="lp-step-connector" />}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="lp-cta">
        <div className="lp-cta-glow" />
        <div className="lp-container lp-cta-inner">
          <Leaf size={40} className="lp-cta-icon" />
          <h2 className="lp-cta-title">Experience CarbonGate Live</h2>
          <p className="lp-cta-sub">
            See the complete carbon optimization pipeline with our interactive AI helpdesk demo.
            Watch queries get cached, routed, compressed, and tracked in real-time.
          </p>
          <div className="lp-cta-actions">
            <button className="lp-btn-primary" onClick={() => navigate('/dashboard')}>
              Open Dashboard <ArrowRight size={18} />
            </button>
            <button className="lp-btn-outline" onClick={() => navigate('/helpdesk')}>
              Try AI Helpdesk
            </button>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-footer-top">
            <div className="lp-footer-brand">
              <div className="lp-logo"><Leaf className="lp-logo-icon" /><span>CarbonGate</span></div>
              <p className="lp-footer-tagline">Net-Zero AI Architecture for Sustainable Computing</p>
              <div className="lp-footer-badges">
                <span className="lp-fbadge green">Open Source</span>
                <span className="lp-fbadge teal">Hackathon Winner</span>
              </div>
            </div>
            <div className="lp-footer-links">
              <div className="lp-footer-col">
                <h4>Platform</h4>
                <button onClick={() => navigate('/dashboard')}>Dashboard</button>
                <button onClick={() => navigate('/helpdesk')}>AI Helpdesk</button>
                <button onClick={() => navigate('/carbon-ledger')}>Carbon Ledger</button>
                <button onClick={() => navigate('/budget')}>Budget Manager</button>
                <button onClick={() => navigate('/scheduler')}>Scheduler</button>
              </div>
              <div className="lp-footer-col">
                <h4>Technology</h4>
                <span>React + TypeScript</span>
                <span>FastAPI + Python</span>
                <span>ChromaDB + RAG</span>
                <span>Ollama (local LLMs)</span>
                <span>Electricity Maps API</span>
              </div>
              <div className="lp-footer-col">
                <h4>Principles</h4>
                <span>Avoid</span>
                <span>Optimize</span>
                <span>Compress</span>
                <span>Shift</span>
                <span>Enforce</span>
              </div>
            </div>
          </div>
          <div className="lp-footer-bottom">
            <p>2024 CarbonGate - Built for Greenovators Hackathon. Net Zero AI Architecture</p>
            <a href="https://github.com" target="_blank" rel="noreferrer" className="lp-footer-gh">
              <GitBranch size={16} />GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
