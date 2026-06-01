import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import type { Storyboard } from '../types';

export default function StoryboardList() {
  const { user, setUser } = useAuth();
  const [items, setItems]     = useState<Storyboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName]  = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.listStoryboards().then((rows) => {
      setItems(rows);
      setLoading(false);
    });
  }, []);

  const beginCreate = () => {
    setCreating(true);
    setNewName('');
    setTimeout(() => nameRef.current?.focus(), 0);
  };

  const confirmCreate = async () => {
    const name = newName.trim();
    if (!name) { setCreating(false); return; }
    const sb = await api.createStoryboard(name);
    navigate(`/s/${sb.id}`);
  };

  const cancelCreate = () => { setCreating(false); setNewName(''); };

  const remove = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Delete this storyboard?')) return;
    await api.deleteStoryboard(id);
    setItems((cur) => cur.filter((s) => s.id !== id));
  };

  const logout = async () => {
    await api.auth.logout();
    setUser(null);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>overboard</h1>
          <p className="subtitle">Your storyboards</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          {user && (
            <span className="user-badge">{user.email}</span>
          )}
          <Link to="/" className="btn ghost">← Home</Link>
          <button className="btn ghost" onClick={logout}>Sign out</button>
          {!creating && (
            <button className="btn primary" onClick={beginCreate}>+ New storyboard</button>
          )}
        </div>
      </div>

      {creating && (
        <div className="create-form">
          <input
            ref={nameRef}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Storyboard name…"
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmCreate();
              if (e.key === 'Escape') cancelCreate();
            }}
          />
          <button className="btn primary" onClick={confirmCreate} disabled={!newName.trim()}>Create</button>
          <button className="btn ghost" onClick={cancelCreate}>Cancel</button>
        </div>
      )}

      {loading ? (
        <div className="empty">Loading…</div>
      ) : items.length === 0 ? (
        <div className="empty">No storyboards yet — create one to start planning.</div>
      ) : (
        <div className="sb-grid">
          {items.map((s) => (
            <Link key={s.id} to={`/s/${s.id}`} className="sb-card">
              <h3>{s.name}</h3>
              <div className="meta">{new Date(s.updatedAt).toLocaleString()}</div>
              <div style={{ flex: 1 }} />
              <div>
                <button className="btn ghost danger" onClick={(e) => remove(e, s.id)}>Delete</button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
