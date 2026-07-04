import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Ambassadors from './pages/Ambassadors';
import Attendance from './pages/Attendance';
import Branches from './pages/Branches';
import Dashboard from './pages/Dashboard';
import Players from './pages/Players';
import Staff from './pages/Staff';
import Leads from './pages/Leads';
import Games from './pages/Games';
import Settings from './pages/Settings';
import Subscriptions from './pages/Subscriptions';
import Finance from './pages/Finance';
import StoreSynced from './pages/StoreSynced';
import Users from './pages/Users';

function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 bg-body-bg p-6 pr-20">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/players" element={<Players />} />
            <Route path="/staff" element={<Staff />} />
            <Route path="/branches" element={<Branches />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/ambassadors" element={<Ambassadors />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/games" element={<Games />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
            <Route path="/financ" element={<Finance />} />
            <Route path="/store-synced" element={<StoreSynced />} />
            <Route path="/users" element={<Users />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
export default App;