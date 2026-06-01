import type { Storyboard, StoryboardDetail, Shot, AudioMarker } from './types';

const req = (input: string, init?: RequestInit) =>
  fetch(input, { credentials: 'include', ...init });

async function j<T>(p: Promise<Response>): Promise<T> {
  const r = await p;
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    const err = Object.assign(new Error((body as any).error ?? `${r.status} ${r.statusText}`), { status: r.status });
    throw err;
  }
  return r.json();
}

const post = (url: string, body: unknown) =>
  req(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

export const api = {
  // ── Auth ──
  auth: {
    register: (email: string, password: string) =>
      j<{ id: string; email: string }>(post('/api/auth/register', { email, password })),
    login: (email: string, password: string) =>
      j<{ id: string; email: string }>(post('/api/auth/login', { email, password })),
    logout: () => j<{ ok: true }>(req('/api/auth/logout', { method: 'POST' })),
    me: () => j<{ id: string; email: string }>(req('/api/auth/me')),
  },

  // ── Storyboards ──
  listStoryboards: () => j<Storyboard[]>(req('/api/storyboards')),

  createStoryboard: (name: string) =>
    j<Storyboard>(post('/api/storyboards', { name })),

  getStoryboard: (id: string) => j<StoryboardDetail>(req(`/api/storyboards/${id}`)),

  updateStoryboard: (id: string, patch: Partial<Storyboard>) =>
    j<Storyboard>(req(`/api/storyboards/${id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    })),

  deleteStoryboard: (id: string) =>
    j<{ ok: true }>(req(`/api/storyboards/${id}`, { method: 'DELETE' })),

  addShot: (sbId: string, body: Partial<Shot>) =>
    j<Shot>(post(`/api/storyboards/${sbId}/shots`, body)),

  updateShot: (id: string, patch: Partial<Shot>) =>
    j<Shot>(req(`/api/shots/${id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    })),

  deleteShot: (id: string) =>
    j<{ ok: true }>(req(`/api/shots/${id}`, { method: 'DELETE' })),

  reorderShots: (sbId: string, ids: string[]) =>
    j<{ ok: true }>(req(`/api/storyboards/${sbId}/shot-order`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids }),
    })),

  addAudio: (sbId: string, body: Partial<AudioMarker>) =>
    j<AudioMarker>(post(`/api/storyboards/${sbId}/audio`, body)),

  updateAudio: (id: string, patch: Partial<AudioMarker>) =>
    j<AudioMarker>(req(`/api/audio/${id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    })),

  deleteAudio: (id: string) =>
    j<{ ok: true }>(req(`/api/audio/${id}`, { method: 'DELETE' })),

  upload: async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append('file', file);
    const r = await req('/api/upload', { method: 'POST', body: fd });
    if (!r.ok) throw new Error('upload failed');
    const data = await r.json();
    return data.url as string;
  },
};
