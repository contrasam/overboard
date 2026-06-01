import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Storyboard } from '../types';

export default function StoryboardList() {
  const [items, setItems] = useState<Storyboard[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.listStoryboards().then((rows) => {
      setItems(rows);
      setLoading(false);
    });
  }, []);

  const create = async () => {
    const name = prompt('Storyboard name?', 'New storyboard')?.trim();
    if (!name) return;
    const sb = await api.createStoryboard(name);
    navigate(`/s/${sb.id}`);
  };

  const remove = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Delete this storyboard?')) return;
    await api.deleteStoryboard(id);
    setItems((cur) => cur.filter((s) => s.id !== id));
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>overboard</h1>
        <button className="btn primary" onClick={create}>+ New storyboard</button>
      </div>

      {loading ? (
        <div className="empty">Loading…</div>
      ) : items.length === 0 ? (
        <div className="empty">No storyboards yet. Create one to start planning shots.</div>
      ) : (
        <div className="sb-grid">
          {items.map((s) => (
            <Link key={s.id} to={`/s/${s.id}`} className="sb-card" style={{ textDecoration: 'none', color: 'inherit' }}>
              <h3>{s.name}</h3>
              <div className="meta">Updated {new Date(s.updatedAt).toLocaleString()}</div>
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
