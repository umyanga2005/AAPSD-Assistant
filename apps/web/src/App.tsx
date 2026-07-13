import Header from './components/Header.js';
import Sidebar from './components/Sidebar.js';
import AssistantScreen from './components/AssistantScreen.js';
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

const DEFAULT_PAGE = 'dashboard';

export default function App() {
  const page: string = DEFAULT_PAGE;
  const current = PAGES[page];

  return (
    <div className="app-layout">
      <Header />
      <Sidebar pages={PAGES} active={page} />
      <main className="main-content">
        {page === 'assistant' ? (
          <AssistantScreen />
        ) : (
          <>
            <h1>{current.title}</h1>
            <p>{current.description}</p>
          </>
        )}
      </main>
    </div>
  );
}
