import { useState, useEffect } from 'react';

type HealthState = 'loading' | 'ok' | 'error';

export default function HealthStatus() {
  const [state, setState] = useState<HealthState>('loading');

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
    const controller = new AbortController();

    fetch(`${apiUrl}/health`, { signal: controller.signal })
      .then((res) => {
        if (res.ok) setState('ok');
        else setState('error');
      })
      .catch(() => setState('error'));

    return () => controller.abort();
  }, []);

  return (
    <div className="health-status">
      <span className={`health-status__dot health-status__dot--${state}`} />
      <span>
        {state === 'loading' ? 'Connecting…' : state === 'ok' ? 'Connected' : 'Disconnected'}
      </span>
    </div>
  );
}
