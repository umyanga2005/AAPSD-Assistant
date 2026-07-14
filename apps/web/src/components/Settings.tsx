import { useState, useEffect } from 'react';
import { auth } from '../firebase.js';
import { signOut } from 'firebase/auth';
import { fetchWithAuth } from '../api.js';

interface Integration {
  provider: string;
  connected: boolean;
  username?: string;
}

export default function Settings() {
  const [integrations, setIntegrations] = useState<Integration[]>([
    { provider: 'GitHub', connected: false },
    { provider: 'Kubernetes', connected: true, username: 'local-cluster' },
    { provider: 'Prometheus', connected: true, username: 'local-prometheus' },
  ]);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Listen for the OAuth success message from the popup window
    const handleMessage = async (event: MessageEvent) => {
      // In production, you should verify event.origin here
      if (event.data?.type === 'GITHUB_OAUTH_SUCCESS' && event.data?.token) {
        try {
          const response = await fetchWithAuth('http://localhost:3000/api/auth/github/save', {
            method: 'POST',
            body: JSON.stringify({ token: event.data.token }),
          });
          
          if (response.ok) {
            setIntegrations(prev => 
              prev.map(i => i.provider === 'GitHub' ? { ...i, connected: true } : i)
            );
          } else {
            console.error('Failed to save GitHub token');
          }
        } catch (err) {
          console.error('Error saving GitHub token:', err);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleConnectGitHub = () => {
    // Open a popup window for GitHub OAuth
    window.open('http://localhost:3000/api/auth/github', 'GitHub OAuth', 'width=600,height=600');
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <div className="animate-fade-in max-w-4xl mx-auto mt-8 space-y-6">
      <div className="glass-panel rounded-xl p-8 border-brand-primary/20">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
            <p className="text-brand-muted text-lg">Manage your profile and integrations.</p>
          </div>
          <button 
            onClick={handleLogout}
            className="px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-colors font-medium"
          >
            Sign Out
          </button>
        </div>

        <div className="mt-8 space-y-6">
          <h2 className="text-xl font-semibold text-white">Connected Services</h2>
          
          <div className="space-y-4">
            {integrations.map((integration) => (
              <div key={integration.provider} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${integration.connected ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-gray-500'}`} />
                  <div>
                    <h3 className="text-white font-medium">{integration.provider}</h3>
                    <p className="text-brand-muted text-sm">
                      {integration.connected ? `Connected as ${integration.username || 'user'}` : 'Not connected'}
                    </p>
                  </div>
                </div>
                
                {integration.provider === 'GitHub' && !integration.connected ? (
                  <button 
                    onClick={handleConnectGitHub}
                    className="px-4 py-2 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    Connect
                  </button>
                ) : (
                  <button 
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-lg transition-colors text-sm font-medium"
                  >
                    {integration.connected ? 'Manage' : 'Connect'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
