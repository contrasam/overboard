import type { Shot } from '../types';

type Props = {
  shot: Shot;
  widthPx: number;
  active?: boolean;
  dragging?: boolean;
  onClick: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
};

export default function ShotCard({ shot, widthPx, active, dragging, onClick, onDragStart, onDragEnd }: Props) {
  return (
    <div
      className={`shot ${active ? 'active' : ''} ${dragging ? 'dragging' : ''}`}
      style={{ width: widthPx }}
      draggable
      onClick={onClick}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/shot-id', shot.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
    >
      <div className="img" style={shot.imageUrl ? { backgroundImage: `url(${shot.imageUrl})` } : undefined}>
        {!shot.imageUrl && <div className="img-empty">No image</div>}
        <div className="duration">{shot.durationSec.toFixed(1)}s</div>
      </div>
      <div className="body">
        <div className="title">{shot.title || 'Untitled shot'}</div>
        <div className="desc">{shot.description}</div>
      </div>
    </div>
  );
}
