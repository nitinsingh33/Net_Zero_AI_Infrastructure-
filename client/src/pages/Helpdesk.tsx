import { useState, useRef, useEffect } from 'react';
import {
  Send, Bot, User, ChevronDown, ChevronUp,
  Leaf, AlertCircle, Clock, ArrowRight, Info
} from 'lucide-react';
import { api } from '../api/carbongate';
import './Helpdesk.css';

const DEPARTMENTS = ['default', 'engineering', 'mba', 'research'];
const WORKLOAD_TYPES = [
  { value: 'query', label: 'Live Query (immediate)' },
  { value: 'batch_summarization', label: 'Batch Summarization (deferrable)' },
  { value: 'embedding_generation', label: 'Embedding Generation (deferrable)' },
  { value: 'report_generation', label: 'Report Generation (deferrable)' },
];

const EXAMPLE_QUESTIONS = [
  "What is the annual fee for B.Tech?",
  "When is the hostel fee deadline?",
  "What are the admission requirements for 2025-26?",
  "Tell me about the placement statistics",
  "What is the attendance requirement for exams?",
  "Compare MBA specializations in detail",
  "What are the library timings and borrowing rules?",
  "How does the scholarship program work?",
];

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  data?: any;
  timestamp: Date;
};

function CarbonBadge({ result }: { result: any }) {
  if (!result) return null;
  return (
    <div className="carbon-badge-row">
      {result.cache_hit ? (
        <span className="badge badge-green">⚡ Cache HIT ({(result.similarity * 100).toFixed(1)}% match)</span>
      ) : (
        <span className={`badge badge-${result.complexity === 'low' ? 'green' : result.complexity === 'medium' ? 'blue' : 'purple'}`}>
          🤖 {result.model_label || result.model || 'Model'} · {result.complexity}
        </span>
      )}
      <span className="badge badge-gray">
        🌿 {(result.carbon_g || 0).toFixed(6)}g CO₂
      </span>
      <span className="badge badge-gray">
        ⚡ {(result.energy_wh || 0).toFixed(6)} Wh
      </span>
      <span className="badge badge-gray">
        ⏱ {Math.round(result.latency_ms || 0)}ms
      </span>
      {result.is_mock && <span className="badge badge-orange">Demo Mode</span>}
    </div>
  );
}

function PipelineTrace({ trace }: { trace: string[] }) {
  const [open, setOpen] = useState(false);
  if (!trace || trace.length === 0) return null;
  return (
    <div className="pipeline-trace-container">
      <button className="pipeline-toggle" onClick={() => setOpen(!open)}>
        <Info size={12} />
        Pipeline Trace
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && (
        <div className="pipeline-trace-steps animate-fade-in">
          {trace.map((step, i) => {
            const isHit = step.includes('HIT') || step.includes('OK') || step.includes('complete') || step.includes('recorded');
            const isDeferred = step.includes('DEFERRED') || step.includes('BLOCKED');
            return (
              <div key={i} className={`pipeline-step ${isHit && !isDeferred ? 'active' : ''}`}>
                <div className={`pipeline-dot ${isHit && !isDeferred ? 'active' : ''}`} />
                {step}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  const data = msg.data;

  return (
    <div className={`message-wrapper ${isUser ? 'user' : 'assistant'} animate-fade-in`}>
      <div className="message-avatar">
        {isUser ? <User size={15} /> : <Bot size={15} />}
      </div>
      <div className="message-content-area">
        <div className={`message-bubble ${isUser ? 'user-bubble' : 'assistant-bubble'}`}>
          {isUser ? (
            <span>{msg.content}</span>
          ) : data?.blocked ? (
            <div className="blocked-msg">
              <AlertCircle size={16} />
              <span>{msg.content}</span>
            </div>
          ) : data?.deferred ? (
            <div className="deferred-msg">
              <Clock size={16} />
              <span>{msg.content}</span>
            </div>
          ) : (
            <div className="answer-text">{msg.content}</div>
          )}
        </div>

        {data && !isUser && (
          <div className="message-meta animate-slide-in">
            <CarbonBadge result={data} />
            {data.pipeline_trace && <PipelineTrace trace={data.pipeline_trace} />}
            {data.context_stats && data.context_stats.reduction_pct > 0 && (
              <div className="context-stats">
                <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                  Context: {data.context_stats.original_chunks} chunks → {data.context_stats.selected_chunks} chunks
                  ({data.context_stats.reduction_pct}% reduction, {data.context_stats.original_tokens} → {data.context_stats.selected_tokens} tokens)
                </span>
              </div>
            )}
            {data.baseline && !data.cache_hit && (
              <div className="savings-row">
                <Leaf size={11} style={{ color: 'var(--green-primary)' }} />
                <span>Saved {(data.carbon_saved_g || 0).toFixed(6)}g CO₂ vs baseline ({data.baseline.model})</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Helpdesk() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: "👋 Welcome to the Amity University AI Helpdesk, powered by CarbonGate! I can answer questions about admissions, fees, examinations, hostels, placements, and university policies. Every response is carbon-optimized — I'll only use as much compute as your question requires!",
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [department, setDepartment] = useState('default');
  const [workloadType, setWorkloadType] = useState('query');
  const [isCritical, setIsCritical] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Test server connection
  useEffect(() => {
    api.health().catch(() => setServerError(true));
  }, []);

  const sendMessage = async (query?: string) => {
    const text = (query || input).trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: Date.now() + '_u',
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const result = await api.query({
        query: text,
        department,
        workload_type: workloadType,
        is_critical: isCritical,
      });

      const assistantMsg: Message = {
        id: Date.now() + '_a',
        role: 'assistant',
        content: result.answer,
        data: result,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      const errMsg: Message = {
        id: Date.now() + '_e',
        role: 'assistant',
        content: '⚠️ Could not reach the CarbonGate server. Please ensure the backend is running on port 8000.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errMsg]);
      setServerError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="helpdesk">
      {/* Header */}
      <div className="helpdesk-header">
        <div>
          <h1 className="helpdesk-title">Amity University <span className="text-gradient">AI Helpdesk</span></h1>
          <p className="helpdesk-subtitle">Powered by CarbonGate · Every query is carbon-optimized</p>
        </div>
        <div className="helpdesk-controls">
          <div className="control-group">
            <label className="control-label">Department</label>
            <select
              className="input"
              value={department}
              onChange={e => setDepartment(e.target.value)}
              style={{ fontSize: '0.82rem', padding: '0.4rem 0.7rem' }}
            >
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="control-group">
            <label className="control-label">Workload Type</label>
            <select
              className="input"
              value={workloadType}
              onChange={e => setWorkloadType(e.target.value)}
              style={{ fontSize: '0.82rem', padding: '0.4rem 0.7rem' }}
            >
              {WORKLOAD_TYPES.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          </div>
          <div className="control-group">
            <label className="control-label">Priority</label>
            <button
              className={`btn ${isCritical ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setIsCritical(!isCritical)}
              style={{ fontSize: '0.78rem', padding: '0.4rem 0.8rem' }}
            >
              {isCritical ? '🔴 Critical' : '⚪ Normal'}
            </button>
          </div>
        </div>
      </div>

      {serverError && (
        <div className="server-error-banner">
          <AlertCircle size={16} />
          <span>Backend server not detected. Start the server: <code>cd server && python main.py</code></span>
        </div>
      )}

      <div className="helpdesk-layout">
        {/* Chat Area */}
        <div className="chat-container card">
          {/* Messages */}
          <div className="messages-area">
            {messages.map(msg => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
            {loading && (
              <div className="loading-indicator animate-fade-in">
                <div className="loading-dots">
                  <span />
                  <span />
                  <span />
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  CarbonGate processing...
                </span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input Area */}
          <div className="input-area">
            <textarea
              className="input chat-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ask about fees, admissions, exams, hostel, placements... (Enter to send)"
              rows={2}
              disabled={loading}
            />
            <button
              className="btn btn-primary send-btn"
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
            >
              <Send size={16} />
            </button>
          </div>
        </div>

        {/* Sidebar: Examples + Info */}
        <div className="helpdesk-sidebar">
          {/* Example Questions */}
          <div className="card">
            <h3 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
              Example Questions
            </h3>
            <div className="examples-list">
              {EXAMPLE_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  className="example-btn"
                  onClick={() => sendMessage(q)}
                  disabled={loading}
                >
                  <ArrowRight size={12} style={{ flexShrink: 0, color: 'var(--green-primary)' }} />
                  <span>{q}</span>
                </button>
              ))}
            </div>
          </div>

          {/* CarbonGate Info */}
          <div className="card" style={{ background: 'linear-gradient(135deg, rgba(0,212,160,0.05), rgba(59,130,246,0.05))' }}>
            <h3 style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>
              <Leaf size={14} style={{ color: 'var(--green-primary)', display: 'inline', marginRight: '0.4rem' }} />
              Carbon Pipeline
            </h3>
            {[
              { icon: '🛡️', step: '1. AVOID', desc: 'Semantic cache lookup' },
              { icon: '🔀', step: '2. OPTIMIZE', desc: 'Model complexity routing' },
              { icon: '✂️', step: '3. COMPRESS', desc: 'Context optimization' },
              { icon: '⏰', step: '4. SHIFT', desc: 'Carbon-aware scheduling' },
              { icon: '📊', step: '5. ENFORCE', desc: 'Budget monitoring' },
              { icon: '📈', step: '6. MEASURE', desc: 'Energy & CO₂ tracking' },
            ].map(({ icon, step, desc }) => (
              <div key={step} style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.5rem', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.85rem' }}>{icon}</span>
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-accent)' }}>{step}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
