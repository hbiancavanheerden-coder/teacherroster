import { auth } from './firebase.js';

// Calls a Netlify Function with the user's Firebase ID token.
export async function api(name, payload, { method = 'POST', authed = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (authed) {
    const user = auth?.currentUser;
    if (!user) throw new Error('Please sign in again.');
    headers.Authorization = `Bearer ${await user.getIdToken()}`;
  }
  let url = `/api/${name}`;
  const init = { method, headers };
  if (method === 'GET' && payload) url += '?' + new URLSearchParams(payload);
  else if (payload) init.body = JSON.stringify(payload);
  let res;
  try {
    res = await fetch(url, init);
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }
  if (!(res.headers.get('content-type') || '').includes('application/json')) {
    throw new Error('The server functions are not reachable. If you are developing locally, run "netlify dev" instead of "vite".');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}
