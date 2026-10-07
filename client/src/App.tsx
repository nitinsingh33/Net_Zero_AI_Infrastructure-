import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import Dashboard from './pages/Dashboard';
import Helpdesk from './pages/Helpdesk';
import CarbonLedger from './pages/CarbonLedger';
import BudgetManager from './pages/BudgetManager';
import Scheduler from './pages/Scheduler';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/helpdesk" element={<Helpdesk />} />
          <Route path="/ledger" element={<CarbonLedger />} />
          <Route path="/budget" element={<BudgetManager />} />
          <Route path="/scheduler" element={<Scheduler />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
