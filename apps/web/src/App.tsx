import { useState, useEffect } from 'react';
import Header from './components/Header.js';
import Sidebar from './components/Sidebar.js';
import AssistantScreen from './components/AssistantScreen.js';
import PipelinesPage from './components/PipelinesPage.js';
import InfrastructurePage from './components/InfrastructurePage.js';
import Dashboard from './components/Dashboard.js';
import AuditLogsPage from './components/AuditLogsPage.js';
import IncidentsPage from './components/IncidentsPage.js';
import './App.css';

const PAGES: Record<string, { title: string; description: string }> = {
  dashboard: {
    title: 'Dashboard',
    description: 'Pipeline status, metrics, and recent activity.',
  },
  assistant: {
    title: 'Assistant',
    description: 'AI-powered diagnosis and recommendations.',
  },
  pipelines: {
    title: 'Pipelines',
    description: 'Pipeline runs, logs, and workflow history.',
  },
  infrastructure: {
    title: 'Infrastructure',
    description: 'Cluster state, pod status, and resource metrics.',
  },
  incidents: {
    title: 'Incidents',
    description: 'Active and resolved incident timeline.',
  },
  audit: {
    title: 'Audit Log',
    description: 'All actions, approvals, and system events.',
  },
};

const getInitialPage = () => {
  const path = window.location.pathname.replace(/^\//, '');
  if (PAGES[path]) return path;
  return 'dashboard';
};

export default function App() {
  const [page, setPage] = useState(getInitialPage());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const current = PAGES[page];

  useEffect(() => {
    const handlePopState = () => {
      setPage(getInitialPage());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <div className="flex h-screen w-full bg-brand-dark overflow-hidden">
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        pages={PAGES}
        active={page}
        onNavigate={(p) => {
          window.history.pushState(null, '', `/${p}`);
          setPage(p);
          setIsSidebarOpen(false);
        }}
        isOpen={isSidebarOpen}
      />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 h-screen overflow-hidden">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {page === 'assistant' ? (
            <AssistantScreen />
          ) : page === 'pipelines' ? (
            <PipelinesPage />
          ) : page === 'infrastructure' ? (
            <InfrastructurePage />
          ) : page === 'dashboard' ? (
            <Dashboard />
          ) : page === 'incidents' ? (
            <IncidentsPage />
          ) : page === 'audit' ? (
            <AuditLogsPage />
          ) : (
            <div className="animate-fade-in glass-panel rounded-xl p-8 max-w-4xl mx-auto mt-8 border-brand-primary/20">
              <h1 className="text-3xl font-bold text-white mb-2">{current.title}</h1>
              <p className="text-brand-muted text-lg">{current.description}</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
