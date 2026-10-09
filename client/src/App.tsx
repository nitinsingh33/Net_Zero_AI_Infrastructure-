import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Helpdesk from './pages/Helpdesk';
import CarbonLedger from './pages/CarbonLedger';
import BudgetManager from './pages/BudgetManager';
import Scheduler from './pages/Scheduler';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing page route */}
        <Route path="/" element={<Landing />} />
        
        {/* Dashboard routes with Layout wrapper */}
        <Route path="/dashboard" element={
          <Layout>
            <Dashboard />
          </Layout>
        } />
        
        <Route path="/helpdesk" element={
          <Layout>
            <Helpdesk />
          </Layout>
        } />
        
        <Route path="/ledger" element={
          <Layout>
            <CarbonLedger />
          </Layout>
        } />
        
        <Route path="/carbon-ledger" element={
          <Layout>
            <CarbonLedger />
          </Layout>
        } />
        
        <Route path="/budget" element={
          <Layout>
            <BudgetManager />
          </Layout>
        } />
        
        <Route path="/scheduler" element={
          <Layout>
            <Scheduler />
          </Layout>
        } />
      </Routes>
    </BrowserRouter>
  );
}
