import { Hono, type MiddlewareHandler } from 'hono';
import { cors } from 'hono/cors';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import {
  db, UPLOAD_DIR, toStoryboard, toShot, toAudio, touchStoryboard,
  StoryboardRow, ShotRow, AudioRow,
} from './db.js';
import { hashPassword, verifyPassword, createSession, getUserBySession, deleteSession } from './auth.js';

type Env = { Variables: { userId: string } };
const app = new Hono<Env>();

app.use('*', cors({
  origin: (origin) => origin ?? 'http://localhost:5173',
  credentials: true,
}));

app.use('/uploads/*', serveStatic({ root: './data' }));

// ── Auth middleware ──────────────────────────────────────
const requireAuth: MiddlewareHandler<Env> = async (c, next) => {
  const token = getCookie(c, 'session');
  if (!token) return c.json({ error: 'unauthorized' }, 401);
  const user = getUserBySession(token);
  if (!user) return c.json({ error: 'unauthorized' }, 401);
  c.set('userId', user.id);
  await next();
};

// ── Auth routes ──────────────────────────────────────────
app.post('/api/auth/register', async (c) => {
  const { email, password } = await c.req.json().catch(() => ({} as Record<string, string>));
  if (!email || !password || password.length < 8) {
    return c.json({ error: 'Email and password (min 8 chars) required' }, 400);
  }
  const existing = db.prepare('SELECT id FROM users WHERE email=?').get(email.toLowerCase());
  if (existing) return c.json({ error: 'Email already registered' }, 409);

  const id = randomUUID();
  const hash = await hashPassword(password);
  db.prepare('INSERT INTO users (id,email,password_hash,created_at) VALUES (?,?,?,?)')
    .run(id, email.toLowerCase(), hash, Date.now());

  const token = createSession(id);
  setCookie(c, 'session', token, {
    httpOnly: true, sameSite: 'Lax', path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });
  return c.json({ id, email: email.toLowerCase() });
});

app.post('/api/auth/login', async (c) => {
  const { email, password } = await c.req.json().catch(() => ({} as Record<string, string>));
  if (!email || !password) return c.json({ error: 'Email and password required' }, 400);

  const user = db.prepare('SELECT * FROM users WHERE email=?').get(email.toLowerCase()) as
    { id: string; email: string; password_hash: string } | undefined;
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  const token = createSession(user.id);
  setCookie(c, 'session', token, {
    httpOnly: true, sameSite: 'Lax', path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });
  return c.json({ id: user.id, email: user.email });
});

app.post('/api/auth/logout', (c) => {
  const token = getCookie(c, 'session');
  if (token) deleteSession(token);
  deleteCookie(c, 'session', { path: '/' });
  return c.json({ ok: true });
});

app.get('/api/auth/me', (c) => {
  const token = getCookie(c, 'session');
  if (!token) return c.json({ error: 'unauthorized' }, 401);
  const user = getUserBySession(token);
  if (!user) return c.json({ error: 'unauthorized' }, 401);
  return c.json(user);
});

// ── Storyboards (auth-gated) ─────────────────────────────
app.get('/api/storyboards', requireAuth, (c) => {
  const userId = c.get('userId');
  const rows = db.prepare('SELECT * FROM storyboards WHERE user_id=? ORDER BY updated_at DESC').all(userId) as StoryboardRow[];
  return c.json(rows.map(toStoryboard));
});

app.post('/api/storyboards', requireAuth, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => ({} as any));
  const id = randomUUID();
  const now = Date.now();
  db.prepare(
    'INSERT INTO storyboards (id,name,px_per_second,row_width_px,lane_count,created_at,updated_at,user_id) VALUES (?,?,?,?,?,?,?,?)'
  ).run(id, body.name || 'Untitled storyboard', 40, 1100, 3, now, now, userId);
  return c.json(toStoryboard(db.prepare('SELECT * FROM storyboards WHERE id=?').get(id) as StoryboardRow));
});

app.get('/api/storyboards/:id', requireAuth, (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const sb = db.prepare('SELECT * FROM storyboards WHERE id=? AND user_id=?').get(id, userId) as StoryboardRow | undefined;
  if (!sb) return c.json({ error: 'not found' }, 404);
  const shots = db.prepare('SELECT * FROM shots WHERE storyboard_id=? ORDER BY "order"').all(id) as ShotRow[];
  const audio = db.prepare('SELECT * FROM audio_markers WHERE storyboard_id=?').all(id) as AudioRow[];
  return c.json({ ...toStoryboard(sb), shots: shots.map(toShot), audioMarkers: audio.map(toAudio) });
});

app.patch('/api/storyboards/:id', requireAuth, async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  if (!db.prepare('SELECT id FROM storyboards WHERE id=? AND user_id=?').get(id, userId)) {
    return c.json({ error: 'not found' }, 404);
  }
  const body = await c.req.json();
  const map: Record<string, string> = {
    name: 'name', pxPerSecond: 'px_per_second', rowWidthPx: 'row_width_px', laneCount: 'lane_count',
  };
  const sets: string[] = []; const vals: unknown[] = [];
  for (const [k, col] of Object.entries(map)) {
    if (body[k] !== undefined) { sets.push(`${col}=?`); vals.push(body[k]); }
  }
  if (!sets.length) return c.json({ ok: true });
  sets.push('updated_at=?'); vals.push(Date.now()); vals.push(id);
  db.prepare(`UPDATE storyboards SET ${sets.join(',')} WHERE id=?`).run(...vals as never[]);
  return c.json(toStoryboard(db.prepare('SELECT * FROM storyboards WHERE id=?').get(id) as StoryboardRow));
});

app.delete('/api/storyboards/:id', requireAuth, (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  db.prepare('DELETE FROM storyboards WHERE id=? AND user_id=?').run(id, userId);
  return c.json({ ok: true });
});

// ── Shots ────────────────────────────────────────────────
app.post('/api/storyboards/:id/shots', requireAuth, async (c) => {
  const userId = c.get('userId');
  const sbId = c.req.param('id');
  if (!db.prepare('SELECT id FROM storyboards WHERE id=? AND user_id=?').get(sbId, userId)) {
    return c.json({ error: 'not found' }, 404);
  }
  const body = await c.req.json().catch(() => ({} as any));
  const id = randomUUID();
  const maxOrder = db.prepare('SELECT COALESCE(MAX("order"), -1) AS m FROM shots WHERE storyboard_id=?').get(sbId) as { m: number };
  db.prepare(
    'INSERT INTO shots (id,storyboard_id,"order",title,description,duration_sec,image_url) VALUES (?,?,?,?,?,?,?)'
  ).run(id, sbId, maxOrder.m + 1, body.title || '', body.description || '', body.durationSec ?? 3, body.imageUrl || null);
  touchStoryboard(sbId);
  return c.json(toShot(db.prepare('SELECT * FROM shots WHERE id=?').get(id) as ShotRow));
});

app.patch('/api/shots/:id', requireAuth, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const map: Record<string, string> = {
    title: 'title', description: 'description', durationSec: 'duration_sec', imageUrl: 'image_url',
  };
  const sets: string[] = []; const vals: unknown[] = [];
  for (const [k, col] of Object.entries(map)) {
    if (body[k] !== undefined) { sets.push(`${col}=?`); vals.push(body[k]); }
  }
  if (!sets.length) return c.json({ ok: true });
  vals.push(id);
  db.prepare(`UPDATE shots SET ${sets.join(',')} WHERE id=?`).run(...vals as never[]);
  const shot = db.prepare('SELECT * FROM shots WHERE id=?').get(id) as ShotRow;
  touchStoryboard(shot.storyboard_id);
  return c.json(toShot(shot));
});

app.delete('/api/shots/:id', requireAuth, (c) => {
  const id = c.req.param('id');
  const shot = db.prepare('SELECT * FROM shots WHERE id=?').get(id) as ShotRow | undefined;
  if (!shot) return c.json({ ok: true });
  db.prepare('DELETE FROM shots WHERE id=?').run(id);
  const rest = db.prepare('SELECT id FROM shots WHERE storyboard_id=? ORDER BY "order"').all(shot.storyboard_id) as { id: string }[];
  const stmt = db.prepare('UPDATE shots SET "order"=? WHERE id=?');
  db.transaction(() => rest.forEach((r, i) => stmt.run(i, r.id)))();
  touchStoryboard(shot.storyboard_id);
  return c.json({ ok: true });
});

app.put('/api/storyboards/:id/shot-order', requireAuth, async (c) => {
  const sbId = c.req.param('id');
  const { ids } = await c.req.json() as { ids: string[] };
  const stmt = db.prepare('UPDATE shots SET "order"=? WHERE id=? AND storyboard_id=?');
  db.transaction(() => ids.forEach((id, i) => stmt.run(i, id, sbId)))();
  touchStoryboard(sbId);
  return c.json({ ok: true });
});

// ── Audio markers ────────────────────────────────────────
app.post('/api/storyboards/:id/audio', requireAuth, async (c) => {
  const userId = c.get('userId');
  const sbId = c.req.param('id');
  if (!db.prepare('SELECT id FROM storyboards WHERE id=? AND user_id=?').get(sbId, userId)) {
    return c.json({ error: 'not found' }, 404);
  }
  const body = await c.req.json();
  const id = randomUUID();
  db.prepare(
    'INSERT INTO audio_markers (id,storyboard_id,lane,start_sec,end_sec,label,color) VALUES (?,?,?,?,?,?,?)'
  ).run(id, sbId, body.lane ?? 0, body.startSec, body.endSec, body.label || '', body.color || '#7c3aed');
  touchStoryboard(sbId);
  return c.json(toAudio(db.prepare('SELECT * FROM audio_markers WHERE id=?').get(id) as AudioRow));
});

app.patch('/api/audio/:id', requireAuth, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const map: Record<string, string> = {
    lane: 'lane', startSec: 'start_sec', endSec: 'end_sec', label: 'label', color: 'color',
  };
  const sets: string[] = []; const vals: unknown[] = [];
  for (const [k, col] of Object.entries(map)) {
    if (body[k] !== undefined) { sets.push(`${col}=?`); vals.push(body[k]); }
  }
  if (!sets.length) return c.json({ ok: true });
  vals.push(id);
  db.prepare(`UPDATE audio_markers SET ${sets.join(',')} WHERE id=?`).run(...vals as never[]);
  const a = db.prepare('SELECT * FROM audio_markers WHERE id=?').get(id) as AudioRow;
  touchStoryboard(a.storyboard_id);
  return c.json(toAudio(a));
});

app.delete('/api/audio/:id', requireAuth, (c) => {
  const id = c.req.param('id');
  const a = db.prepare('SELECT * FROM audio_markers WHERE id=?').get(id) as AudioRow | undefined;
  db.prepare('DELETE FROM audio_markers WHERE id=?').run(id);
  if (a) touchStoryboard(a.storyboard_id);
  return c.json({ ok: true });
});

// ── Upload ───────────────────────────────────────────────
app.post('/api/upload', requireAuth, async (c) => {
  const body = await c.req.parseBody();
  const file = body['file'];
  if (!(file instanceof File)) return c.json({ error: 'no file' }, 400);
  const ext = (path.extname(file.name) || '.png').toLowerCase();
  const filename = `${randomUUID()}${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buf);
  return c.json({ url: `/uploads/${filename}` });
});

const port = Number(process.env.PORT ?? 5174);
serve({ fetch: app.fetch, port });
console.log(`overboard server listening on http://localhost:${port}`);
