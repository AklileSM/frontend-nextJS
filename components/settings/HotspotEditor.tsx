'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { toast } from 'sonner';
import { X, Check, Pencil } from 'lucide-react';
import { updateRoom } from '@/services/apiClient';
import type { ApiRoom, FloorPlanCoordinates } from '@/types/api';

type Draft = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Anchor = { x: number; y: number };

function pct(px: number, total: number) {
  return (px / total) * 100;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function rectFromAnchors(start: Anchor, end: Anchor): Draft {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  return { x, y, width, height };
}

// Zone overlay: shows a placed hotspot with room name, edit (redraw), and delete buttons.
function Zone({
  room,
  coords,
  canEdit,
  onClear,
  onRedraw,
}: {
  room: ApiRoom;
  coords: FloorPlanCoordinates;
  canEdit: boolean;
  onClear: () => void;
  onRedraw: () => void;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: `${coords.x}%`,
        top: `${coords.y}%`,
        width: `${coords.width}%`,
        height: `${coords.height}%`,
      }}
      className="group pointer-events-auto"
    >
      <div className="relative h-full w-full rounded border-2 border-amber-500/70 bg-amber-500/10 transition-colors group-hover:bg-amber-500/20">
        <span className="absolute left-1 top-1 max-w-[calc(100%-4px)] truncate rounded bg-base-950/80 px-1.5 py-0.5 font-mono text-[10px] font-medium text-amber-300">
          {room.name}
        </span>
        {canEdit && (
          <div className="absolute right-1 top-1 flex items-center gap-0.5">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRedraw(); }}
              aria-label={`Redraw hotspot for ${room.name}`}
              title="Redraw"
              className="flex h-5 w-5 items-center justify-center rounded bg-base-950/70 text-ink-400 transition-colors hover:bg-base-950 hover:text-amber-400"
            >
              <Pencil size={9} />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              aria-label={`Remove hotspot for ${room.name}`}
              title="Delete"
              className="flex h-5 w-5 items-center justify-center rounded bg-base-950/70 text-ink-400 transition-colors hover:bg-base-950 hover:text-red-400"
            >
              <X size={9} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Room picker popover shown after drawing a rect.
function RoomPicker({
  rooms,
  defaultRoomId,
  draft,
  onAssign,
  onDiscard,
}: {
  rooms: ApiRoom[];
  defaultRoomId?: string;
  draft: Draft;
  onAssign: (roomId: string) => void;
  onDiscard: () => void;
}) {
  const [selected, setSelected] = useState(defaultRoomId ?? rooms[0]?.id ?? '');

  return (
    <div
      style={{
        position: 'absolute',
        left: `${clamp(draft.x + draft.width / 2, 5, 75)}%`,
        top: `${clamp(draft.y + draft.height + 1, 2, 85)}%`,
        zIndex: 20,
      }}
      className="w-52 rounded-lg border border-base-700 bg-base-900 p-3 shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">
        Assign room
      </p>
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="w-full rounded-md border border-base-700 bg-base-950 px-2 py-1.5 text-[13px] text-white outline-none focus:border-amber-500"
      >
        {rooms.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => onAssign(selected)}
          disabled={!selected}
          className="flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-[12px] font-semibold text-base-950 hover:bg-amber-400 disabled:opacity-40"
        >
          <Check size={12} />
          Assign
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="rounded-md border border-base-700 px-3 py-1.5 text-[12px] text-white hover:border-ink-300"
        >
          Discard
        </button>
      </div>
    </div>
  );
}

export function HotspotEditor({
  projectId,
  floorplanUrl,
  rooms,
  onRoomUpdated,
}: {
  projectId: string;
  floorplanUrl: string;
  rooms: ApiRoom[];
  onRoomUpdated: (room: ApiRoom) => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pendingDraft, setPendingDraft] = useState<Draft | null>(null);
  const [redrawingRoomId, setRedrawingRoomId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Rooms without a hotspot yet (or the one currently being redrawn).
  const unassigned = rooms.filter((r) => !r.floor_plan_coordinates || r.id === redrawingRoomId);
  const assigned = rooms.filter((r) => r.floor_plan_coordinates && r.id !== redrawingRoomId);

  const getRelativePos = useCallback((e: { clientX: number; clientY: number }): Anchor | null => {
    const el = overlayRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      x: clamp(pct(e.clientX - rect.left, rect.width), 0, 100),
      y: clamp(pct(e.clientY - rect.top, rect.height), 0, 100),
    };
  }, []);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (pendingDraft) return;
      if ((e.target as HTMLElement).closest('button, select')) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      const pos = getRelativePos(e);
      if (!pos) return;
      setAnchor(pos);
      setDraft({ x: pos.x, y: pos.y, width: 0, height: 0 });
      setDrawing(true);
    },
    [pendingDraft, getRelativePos],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!drawing || !anchor) return;
      const pos = getRelativePos(e);
      if (!pos) return;
      setDraft(rectFromAnchors(anchor, pos));
    },
    [drawing, anchor, getRelativePos],
  );

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!drawing || !draft) return;
      setDrawing(false);
      setAnchor(null);
      // Discard tiny accidental clicks (less than 3% in either dimension).
      if (draft.width < 3 || draft.height < 3) {
        setDraft(null);
        return;
      }
      setPendingDraft(draft);
      setDraft(null);
    },
    [drawing, draft],
  );

  const handleAssign = async (roomId: string) => {
    if (!pendingDraft) return;
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return;
    setSaving(true);
    try {
      const updated = await updateRoom(projectId, roomId, {
        floor_plan_coordinates: pendingDraft,
      });
      onRoomUpdated(updated);
      setPendingDraft(null);
      setRedrawingRoomId(null);
      toast.success(`Hotspot set for "${room.name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save hotspot');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setPendingDraft(null);
    setRedrawingRoomId(null);
  };

  const handleClear = async (room: ApiRoom) => {
    try {
      const updated = await updateRoom(projectId, room.id, {
        floor_plan_coordinates: null,
      });
      onRoomUpdated(updated);
      toast.success(`Hotspot removed for "${room.name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to clear hotspot');
    }
  };

  const handleRedraw = (room: ApiRoom) => {
    // Optimistically remove the zone so the user can draw a new one.
    // The actual API clear happens only if they confirm (Assign).
    setRedrawingRoomId(room.id);
  };

  const hasPendingOrDrawing = drawing || !!pendingDraft;

  return (
    <div className="space-y-3">
      {redrawingRoomId ? (
        <p className="text-[13px] text-amber-400">
          Draw a new rectangle for{' '}
          <span className="font-semibold">
            {rooms.find((r) => r.id === redrawingRoomId)?.name}
          </span>
          {' '}— or{' '}
          <button
            type="button"
            onClick={() => setRedrawingRoomId(null)}
            className="underline hover:text-white"
          >
            cancel
          </button>
        </p>
      ) : (
        <p className="text-[13px] text-ink-300">
          Draw a rectangle on the floorplan to place a hotspot, then assign it to a room.
          Hover an existing zone to edit or delete it.
        </p>
      )}

      {!redrawingRoomId && unassigned.length > 0 && (
        <p className="font-mono text-[11px] text-ink-400">
          Rooms without a hotspot:{' '}
          {unassigned.map((r) => r.name).join(', ')}
        </p>
      )}

      {/* Outer wrapper is relative but NOT overflow-hidden so the RoomPicker
          popover can escape the image bounds. The image itself gets its own
          rounded clip via the inner div. */}
      <div className="relative select-none">
        <div className="overflow-hidden rounded-lg border border-base-800 bg-base-950">
          <img
            src={floorplanUrl}
            alt="Floorplan"
            draggable={false}
            className="block h-auto w-full"
          />
        </div>

        {/* Interaction overlay — covers the image exactly, but no overflow-hidden
            so the RoomPicker popover can render outside the image boundary. */}
        <div
          ref={overlayRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className={`absolute inset-0 ${hasPendingOrDrawing ? 'cursor-default' : 'cursor-crosshair'}`}
          style={{ touchAction: 'none' }}
        >
          {/* Placed zones */}
          {assigned.map((room) => (
            <Zone
              key={room.id}
              room={room}
              coords={room.floor_plan_coordinates!}
              canEdit={!hasPendingOrDrawing}
              onClear={() => handleClear(room)}
              onRedraw={() => handleRedraw(room)}
            />
          ))}

          {/* Active drawing rect */}
          {draft && draft.width > 0 && draft.height > 0 && (
            <div
              style={{
                position: 'absolute',
                left: `${draft.x}%`,
                top: `${draft.y}%`,
                width: `${draft.width}%`,
                height: `${draft.height}%`,
                pointerEvents: 'none',
              }}
              className="rounded border-2 border-dashed border-amber-400 bg-amber-400/10"
            />
          )}

          {/* Pending rect + RoomPicker popover */}
          {pendingDraft && (
            <>
              <div
                style={{
                  position: 'absolute',
                  left: `${pendingDraft.x}%`,
                  top: `${pendingDraft.y}%`,
                  width: `${pendingDraft.width}%`,
                  height: `${pendingDraft.height}%`,
                  pointerEvents: 'none',
                }}
                className="rounded border-2 border-amber-500 bg-amber-500/15"
              />
              <RoomPicker
                rooms={unassigned.length > 0 ? unassigned : rooms}
                defaultRoomId={redrawingRoomId ?? undefined}
                draft={pendingDraft}
                onAssign={handleAssign}
                onDiscard={handleDiscard}
              />
            </>
          )}

          {saving && (
            <div className="absolute inset-0 flex items-center justify-center bg-base-950/50">
              <div className="rounded-lg bg-base-900 px-4 py-2 text-[13px] text-ink-200">
                Saving…
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
