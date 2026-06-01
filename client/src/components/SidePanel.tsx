import { PropsWithChildren } from 'react';

type Props = PropsWithChildren<{ title: string; open: boolean; onClose: () => void }>;

export default function SidePanel({ title, open, onClose, children }: Props) {
  return (
    <div className={`side-panel ${open ? 'open' : ''}`}>
      <header>
        <strong>{title}</strong>
        <button className="btn ghost" onClick={onClose}>Close</button>
      </header>
      <div className="body">{children}</div>
    </div>
  );
}
