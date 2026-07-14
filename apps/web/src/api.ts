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
