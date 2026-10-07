import { NavLink, useLocation } from 'react-router-dom';
import {
  Leaf, LayoutDashboard, MessageSquare, BookOpen,
  Sliders, Zap, ChevronRight
} from 'lucide-react';
import './Layout.css';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/helpdesk', icon: MessageSquare, label: 'AI Helpdesk' },
  { to: '/ledger', icon: BookOpen, label: 'Carbon Ledger' },
  { to: '/budget', icon: Sliders, label: 'Budget Manager' },
  { to: '/scheduler', icon: Zap, label: 'Scheduler' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  const currentPage = navItems.find(n =>
    n.exact ? location.pathname === n.to : location.pathname.startsWith(n.to)
  );

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="logo-icon">
            <Leaf size={20} />
          </div>
          <div>
            <div className="logo-title">CarbonGate</div>
            <div className="logo-sub">Net-Zero AI Gateway</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          <div className="nav-section-label">Navigation</div>
          {navItems.map(({ to, icon: Icon, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={17} />
              <span>{label}</span>
              <ChevronRight size={13} className="nav-arrow" />
            </NavLink>
          ))}
        </nav>

        {/* Bottom status */}
        <div className="sidebar-footer">
          <div className="footer-badge">
            <span className="footer-dot" />
            <span>Live Monitoring</span>
          </div>
          <div className="footer-version">v1.0.0 · Hackathon Build</div>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        {/* Top bar */}
        <header className="topbar">
          <div className="topbar-breadcrumb">
            <span className="breadcrumb-root">CarbonGate</span>
            {currentPage && (
              <>
                <ChevronRight size={13} className="breadcrumb-sep" />
                <span className="breadcrumb-current">{currentPage.label}</span>
              </>
            )}
          </div>
          <div className="topbar-right">
            <div className="live-indicator">
              <span className="live-dot animate-pulse-green" />
              <span>Live</span>
            </div>
          </div>
        </header>

        {/* Page */}
        <div className="page-content">
          {children}
        </div>
      </main>
    </div>
  );
}
