'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { listRooms, createRoom, deleteRoom } from '@/services/apiClient';
import type { ApiRoom } from '@/types/api';

export function RoomManager({
  projectId,
  onRoomsChanged,
}: {
  projectId: string;
  onRoomsChanged?: (rooms: ApiRoom[]) => void;
}) {
  const [rooms, setRooms] = useState<ApiRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  // Keep a stable ref to the callback so load() doesn't re-create on every
  // parent render (which would loop: callback → parent re-render → new ref →
  // new load → effect fires → callback again…)
  const onRoomsChangedRef = useRef(onRoomsChanged);
  useEffect(() => { onRoomsChangedRef.current = onRoomsChanged; });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await listRooms();
      const filtered = all.filter((r) => r.project_id === projectId);
      setRooms(filtered);
      onRoomsChangedRef.current?.(filtered);
    } catch {
      toast.error('Failed to load rooms');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    try {
      const room = await createRoom(projectId, { name: name.trim() });
      const next = [...rooms, room];
      setRooms(next);
      onRoomsChanged?.(next);
      setName('');
      toast.success(`Room "${room.name}" created`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (roomId: string, roomName: string) => {
    // Optimistically remove the room immediately.
    const prev = rooms;
    const next = rooms.filter((r) => r.id !== roomId);
    setRooms(next);
    onRoomsChanged?.(next);
    setPendingDelete(roomId);
    try {
      await deleteRoom(projectId, roomId);
      toast.success(`Room "${roomName}" deleted`);
    } catch (err) {
      // Rollback on failure.
      setRooms(prev);
      onRoomsChanged?.(prev);
      toast.error(err instanceof Error ? err.message : 'Failed to delete room');
    } finally {
      setPendingDelete(null);
    }
  };

  const inputCls =
    'w-full rounded-md border border-base-700 bg-base-950 px-3 py-2 text-[13px] text-white outline-none placeholder:text-ink-500 focus:border-amber-500 transition-colors';

  if (loading) {
    return (
      <ul className="animate-pulse divide-y divide-base-800/60 overflow-hidden rounded-lg border border-base-800">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="flex items-center justify-between gap-4 bg-base-900/20 px-4 py-3">
            <div className="space-y-1.5">
              <div className="h-3.5 w-32 rounded bg-base-800" />
              <div className="h-2.5 w-20 rounded bg-base-800/60" />
            </div>
            <div className="h-7 w-7 rounded bg-base-800/50" />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-5">
      {rooms.length === 0 ? (
        <p className="rounded-md border border-dashed border-base-700 bg-base-900/20 px-4 py-6 text-center text-[13px] text-ink-400">
          No rooms yet, add the first one below.
        </p>
      ) : (
        <ul className="divide-y divide-base-800/60 overflow-hidden rounded-lg border border-base-800">
          {rooms.map((room) => (
            <li
              key={room.id}
              className="flex items-center justify-between gap-4 bg-base-900/20 px-4 py-3"
            >
              <div>
                <p className="text-[13px] font-medium text-white">{room.name}</p>
                <p className="font-mono text-[11px] text-ink-400">{room.slug}</p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(room.id, room.name)}
                disabled={pendingDelete === room.id}
                aria-label={`Delete ${room.name}`}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-ink-400 transition-colors hover:bg-base-800 hover:text-red-400 disabled:opacity-40"
              >
                {pendingDelete === room.id ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Trash2 size={13} />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="space-y-3">
        <h4 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-400">
          Add room
        </h4>
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Room name"
            required
            className={`${inputCls} flex-1 min-w-[140px]`}
          />
          <button
            type="submit"
            disabled={adding || !name.trim()}
            className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-3 py-2 text-[13px] font-semibold text-base-950 hover:bg-amber-400 transition-colors disabled:opacity-40"
          >
            {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Add
          </button>
        </div>
      </form>
    </div>
  );
}
