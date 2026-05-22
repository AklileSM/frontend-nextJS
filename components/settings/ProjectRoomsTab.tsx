'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { createRoom, deleteRoom, listRooms, updateRoom } from '@/services/apiClient';
import type { ApiRoom } from '@/types/api';

const inputCls =
  'rounded-md border border-base-700 bg-base-950 px-3 py-2 text-[13px] text-white outline-none placeholder:text-ink-500 focus:border-amber-500 transition-colors';

export function ProjectRoomsTab({
  projectId,
  onRoomsLoaded,
}: {
  projectId: string;
  onRoomsLoaded?: (rooms: ApiRoom[]) => void;
}) {
  const [rooms, setRooms] = useState<ApiRoom[]>([]);
  const [loading, setLoading] = useState(true);

  // Add form
  const [addName, setAddName] = useState('');
  const [adding, setAdding] = useState(false);

  // Per-row state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  const editInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await listRooms();
      const sorted = all
        .filter((r) => r.project_id === projectId)
        .sort((a, b) => a.sort_order - b.sort_order);
      setRooms(sorted);
      onRoomsLoaded?.(sorted);
    } catch {
      toast.error('Failed to load rooms');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  // Focus the rename input when it appears
  useEffect(() => {
    if (editingId) editInputRef.current?.focus();
  }, [editingId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim()) return;
    setAdding(true);
    try {
      const room = await createRoom(projectId, {
        name: addName.trim(),
        sort_order: rooms.length,
      });
      setRooms((prev) => [...prev, room]);
      setAddName('');
      toast.success(`Room "${room.name}" created`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (room: ApiRoom) => {
    setConfirmDeleteId(null);
    setEditingId(room.id);
    setEditName(room.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const commitEdit = async (room: ApiRoom) => {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === room.name) { cancelEdit(); return; }
    setSavingId(room.id);
    try {
      const updated = await updateRoom(projectId, room.id, {
        name: trimmed,
      });
      setRooms((prev) => prev.map((r) => (r.id === room.id ? updated : r)));
      toast.success('Room renamed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to rename room');
    } finally {
      setSavingId(null);
      setEditingId(null);
      setEditName('');
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= rooms.length) return;

    const next = [...rooms];
    [next[index], next[target]] = [next[target], next[index]];
    // Reassign sort_order by position
    const reindexed = next.map((r, i) => ({ ...r, sort_order: i }));
    setRooms(reindexed);

    const a = reindexed[index];
    const b = reindexed[target];
    setReorderingId(b.id);
    try {
      await Promise.all([
        updateRoom(projectId, a.id, { sort_order: a.sort_order }),
        updateRoom(projectId, b.id, { sort_order: b.sort_order }),
      ]);
    } catch {
      toast.error('Failed to reorder rooms');
      load();
    } finally {
      setReorderingId(null);
    }
  };

  const handleDelete = async (room: ApiRoom) => {
    setDeletingId(room.id);
    try {
      await deleteRoom(projectId, room.id);
      setRooms((prev) => prev.filter((r) => r.id !== room.id));
      toast.success(`Room "${room.name}" deleted`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete room');
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-[13px] text-ink-400">
        <Loader2 size={14} className="animate-spin" />
        Loading rooms…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Room list */}
      {rooms.length === 0 ? (
        <div className="rounded-lg border border-dashed border-base-700 bg-base-900/20 px-4 py-10 text-center text-[13px] text-ink-400">
          No rooms yet, add the first one below.
        </div>
      ) : (
        <ul className="divide-y divide-base-800/50 overflow-hidden rounded-lg border border-base-800">
          <AnimatePresence initial={false}>
            {rooms.map((room, i) => {
              const isEditing = editingId === room.id;
              const isSaving = savingId === room.id;
              const isConfirming = confirmDeleteId === room.id;
              const isDeleting = deletingId === room.id;
              const isReordering = reorderingId === room.id;

              return (
                <motion.li
                  key={room.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                  className="bg-base-900/20"
                >
                  {isConfirming ? (
                    /* Delete confirmation row */
                    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <p className="text-[13px] text-white">
                        Delete{' '}
                        <span className="font-semibold text-red-400">{room.name}</span>?
                        <span className="ml-2 text-ink-400">All files in this room will be permanently removed.</span>
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="rounded-md border border-base-700 px-3 py-1.5 text-[12px] text-ink-300 hover:border-base-500 hover:text-white transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(room)}
                          disabled={isDeleting}
                          className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-red-500 transition-colors disabled:opacity-50"
                        >
                          {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                          Delete room
                        </button>
                      </div>
                    </div>
                  ) : isEditing ? (
                    /* Rename row */
                    <div className="flex items-center gap-3 px-4 py-3">
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEdit(room);
                          if (e.key === 'Escape') cancelEdit();
                        }}
                        className={`${inputCls} flex-1`}
                        disabled={isSaving}
                      />
                      <button
                        type="button"
                        onClick={() => commitEdit(room)}
                        disabled={isSaving || !editName.trim()}
                        aria-label="Save"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-amber-500 text-base-950 hover:bg-amber-400 transition-colors disabled:opacity-40"
                      >
                        {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={isSaving}
                        aria-label="Cancel"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-base-700 text-ink-400 hover:border-base-500 hover:text-white transition-colors disabled:opacity-40"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    /* Normal row */
                    <div className="flex items-center gap-2 px-4 py-3">
                      {/* Reorder */}
                      <div className="flex shrink-0 flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => move(i, -1)}
                          disabled={i === 0 || !!reorderingId}
                          aria-label="Move up"
                          className="flex h-5 w-5 items-center justify-center rounded text-ink-600 transition-colors hover:bg-base-800 hover:text-ink-200 disabled:opacity-20"
                        >
                          {isReordering ? <Loader2 size={10} className="animate-spin" /> : <ArrowUp size={10} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => move(i, 1)}
                          disabled={i === rooms.length - 1 || !!reorderingId}
                          aria-label="Move down"
                          className="flex h-5 w-5 items-center justify-center rounded text-ink-600 transition-colors hover:bg-base-800 hover:text-ink-200 disabled:opacity-20"
                        >
                          <ArrowDown size={10} />
                        </button>
                      </div>

                      {/* Name + slug */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-white">{room.name}</p>
                        <p className="font-mono text-[11px] text-ink-500">{room.slug}</p>
                      </div>

                      {/* Actions */}
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(room)}
                          aria-label={`Rename ${room.name}`}
                          className="inline-flex h-7 w-7 items-center justify-center rounded text-ink-500 transition-colors hover:bg-base-800 hover:text-white"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => { setEditingId(null); setConfirmDeleteId(room.id); }}
                          aria-label={`Delete ${room.name}`}
                          className="inline-flex h-7 w-7 items-center justify-center rounded text-ink-500 transition-colors hover:bg-base-800 hover:text-red-400"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      {/* Add room form */}
      <div>
        <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-400">
          Add room
        </h3>
        <form onSubmit={handleAdd} className="flex flex-wrap gap-3">
          <input
            type="text"
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            placeholder="Room name"
            required
            className={`${inputCls} min-w-[160px] flex-1`}
          />
          <button
            type="submit"
            disabled={adding || !addName.trim()}
            className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-[13px] font-semibold text-base-950 hover:bg-amber-400 transition-colors disabled:opacity-40"
          >
            {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Add room
          </button>
        </form>
      </div>
    </div>
  );
}
