import { useState, useRef, useEffect } from 'react';
import { usePlayerStore } from '../store/playerStore';

interface TrackMenuProps {
  trackId: string;
}

export default function TrackMenu({ trackId }: TrackMenuProps) {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const { downloadTrack } = usePlayerStore();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [open]);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloading(true);
    try {
      await downloadTrack(trackId);
      setDownloaded(true);
    } catch {}
    setDownloading(false);
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)',
          fontSize: '1.25rem', padding: '0.25rem 0.5rem', lineHeight: 1,
        }}
      >
        ⋮
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', zIndex: 100,
          background: 'var(--card)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '0.5rem', padding: '0.375rem 0', minWidth: 140,
          boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
        }}>
          <button
            onClick={handleDownload}
            disabled={downloading || downloaded}
            style={{
              width: '100%', padding: '0.5rem 0.875rem', background: 'none', border: 'none',
              cursor: downloaded ? 'default' : 'pointer', textAlign: 'left', fontSize: '0.8125rem',
              color: downloaded ? '#2d6a4f' : 'var(--text)', display: 'block',
            }}
          >
            {downloading ? 'Скачивание...' : downloaded ? '✓ Скачано' : '↓ Скачать'}
          </button>
        </div>
      )}
    </div>
  );
}
