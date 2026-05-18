'use client';

/** Toggleable upload panel — room picker (type-to-filter combobox) + capture
 *  date override + the shared UploadZone. Mounted as long as the user has
 *  upload permission so in-flight uploads survive a manual "close uploader". */

import { useEffect, useState } from 'react';
import { UploadZone } from '@/components/explorer/UploadZone';
import type { ApiMediaFile, ApiRoom } from '@/types/api';

type Props = {
  rooms: ApiRoom[];
  captureDate: string;
  onUploaded: (type: ApiMediaFile['type']) => void;
  onClose?: () => void;
  visible?: boolean;
};

export function Uploader({ rooms, captureDate, onUploaded, onClose, visible }: Props) {
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? '');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [uploadDate, setUploadDate] = useState(captureDate);

  useEffect(() => {
    if (!roomId && rooms.length) setRoomId(rooms[0].id);
  }, [roomId, rooms]);

  useEffect(() => { setUploadDate(captureDate); }, [captureDate]);

  const selectedRoom = rooms.find((r) => r.id === roomId);
  const filtered = query
    ? rooms.filter((r) => r.name.toLowerCase().includes(query.toLowerCase()))
    : rooms;

  if (!rooms.length || !roomId || !selectedRoom) return null;

  return (
    <div className="rounded-lg border border-base-800 bg-base-900/30 p-5">
      <div className="mb-4 flex flex-wrap items-center gap-4">
        {/* Room combobox */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-300">Room</span>
          <div className="relative">
            <input
              type="text"
              value={open ? query : selectedRoom.name}
              onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
              onFocus={() => { setQuery(''); setOpen(true); }}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              placeholder="Search rooms…"
              className="w-44 rounded-md border border-base-700 bg-base-950 px-2.5 py-1.5 text-[13px] text-white outline-none focus:border-amber-500"
            />
            {open && filtered.length > 0 && (
              <ul className="absolute left-0 top-full z-20 mt-1 max-h-52 w-44 overflow-y-auto rounded-md border border-base-700 bg-base-900 py-1 shadow-xl">
                {filtered.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onMouseDown={() => { setRoomId(r.id); setQuery(''); setOpen(false); }}
                      className={`w-full px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-base-800 ${r.id === roomId ? 'text-amber-400' : 'text-white'}`}
                    >
                      {r.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Capture date override */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-300">Date</span>
          <input
            type="date"
            value={uploadDate}
            onChange={(e) => setUploadDate(e.target.value)}
            className="rounded-md border border-base-700 bg-base-950 px-2.5 py-1.5 text-[13px] text-white outline-none focus:border-amber-500"
          />
        </div>
      </div>
      <UploadZone roomId={roomId} roomSlug={selectedRoom.slug} captureDate={uploadDate} onUploaded={onUploaded} onClose={onClose} visible={visible} />
    </div>
  );
}
