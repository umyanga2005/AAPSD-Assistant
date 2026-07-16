import { auth } from './firebase.js';

export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  let token = '';
  if (auth.currentUser) {
    token = await auth.currentUser.getIdToken();
  }

  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Ensure content-type is json if body is stringified json
  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

export async function getDeploymentProfile(): Promise<string> {
  try {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/v1/config`);
    if (!res.ok) return 'local-lite';
    const data = await res.json();
    return data.deploymentProfile || 'local-lite';
  } catch (err) {
    return 'local-lite';
  }
}
