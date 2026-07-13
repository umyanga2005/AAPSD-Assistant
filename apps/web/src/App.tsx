import { useState } from 'react';
import Header from './components/Header.js';
import Sidebar from './components/Sidebar.js';
import AssistantScreen from './components/AssistantScreen.js';
import PipelinesPage from './components/PipelinesPage.js';
import InfrastructurePage from './components/InfrastructurePage.js';
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

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const current = PAGES[page];

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
          ) : (
            <div className="animate-fade-in glass-panel rounded-xl p-8 max-w-4xl mx-auto mt-8 border-brand-primary/20">
              <h1 className="text-3xl font-bold text-white mb-2">{current.title}</h1>
              <p className="text-brand-muted text-lg">{current.description}</p>

              {page === 'dashboard' && (
                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="glass-panel p-6 rounded-lg border-brand-primary/30 text-center hover:border-brand-primary transition-colors">
                    <h3 className="text-brand-muted text-sm font-semibold uppercase tracking-wider mb-2">
                      System Health
                    </h3>
                    <p className="text-brand-success text-2xl font-bold flex items-center justify-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-brand-success animate-pulse"></span>
                      All Systems Operational
                    </p>
                  </div>
                  <div className="glass-panel p-6 rounded-lg border-brand-primary/30 text-center hover:border-brand-primary transition-colors">
                    <h3 className="text-brand-muted text-sm font-semibold uppercase tracking-wider mb-2">
                      Active Pipelines
                    </h3>
                    <p className="text-white text-4xl font-bold">12</p>
                  </div>
                  <div className="glass-panel p-6 rounded-lg border-brand-primary/30 text-center hover:border-brand-primary transition-colors">
                    <h3 className="text-brand-muted text-sm font-semibold uppercase tracking-wider mb-2">
                      Open Incidents
                    </h3>
                    <p className="text-brand-danger text-4xl font-bold">0</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
