import type { Storyboard, StoryboardDetail, Shot, AudioMarker } from './types';

async function j<T>(p: Promise<Response>): Promise<T> {
  const r = await p;
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

export const api = {
  listStoryboards: () => j<Storyboard[]>(fetch('/api/storyboards')),

  createStoryboard: (name: string) =>
    j<Storyboard>(fetch('/api/storyboards', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    })),

  getStoryboard: (id: string) => j<StoryboardDetail>(fetch(`/api/storyboards/${id}`)),

  updateStoryboard: (id: string, patch: Partial<Storyboard>) =>
    j<Storyboard>(fetch(`/api/storyboards/${id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    })),

  deleteStoryboard: (id: string) =>
    j<{ ok: true }>(fetch(`/api/storyboards/${id}`, { method: 'DELETE' })),

  addShot: (sbId: string, body: Partial<Shot>) =>
    j<Shot>(fetch(`/api/storyboards/${sbId}/shots`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })),

  updateShot: (id: string, patch: Partial<Shot>) =>
    j<Shot>(fetch(`/api/shots/${id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    })),

  deleteShot: (id: string) =>
    j<{ ok: true }>(fetch(`/api/shots/${id}`, { method: 'DELETE' })),

  reorderShots: (sbId: string, ids: string[]) =>
    j<{ ok: true }>(fetch(`/api/storyboards/${sbId}/shot-order`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids }),
    })),

  addAudio: (sbId: string, body: Partial<AudioMarker>) =>
    j<AudioMarker>(fetch(`/api/storyboards/${sbId}/audio`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })),

  updateAudio: (id: string, patch: Partial<AudioMarker>) =>
    j<AudioMarker>(fetch(`/api/audio/${id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    })),

  deleteAudio: (id: string) =>
    j<{ ok: true }>(fetch(`/api/audio/${id}`, { method: 'DELETE' })),

  upload: async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetch('/api/upload', { method: 'POST', body: fd });
    if (!r.ok) throw new Error('upload failed');
    const data = await r.json();
    return data.url as string;
  },
};
