'use client';

import { useMemo } from 'react';
import { GitCompareArrows, Loader2, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import type { ApiComparisonDraft } from '@/types/api';
import { draftSavedDayKeyLocal, formatLocalDayMedium } from './helpers';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  drafts: ApiComparisonDraft[];
  selectedIds: string[];
  setSelectedIds: (next: string[] | ((prev: string[]) => string[])) => void;
  filterDateKeys: string[];
  setFilterDateKeys: (next: string[] | ((prev: string[]) => string[])) => void;
  isBusy: boolean;
  onPublishConfirm: () => void;
  onDeleteDraft: (id: string) => Promise<void> | void;
};

export function PublishModal({
  isOpen,
  onClose,
  drafts,
  selectedIds,
  setSelectedIds,
  filterDateKeys,
  setFilterDateKeys,
  isBusy,
  onPublishConfirm,
  onDeleteDraft,
}: Props) {
  const availableDateKeys = useMemo(() => {
    const set = new Set<string>();
    for (const d of drafts) {
      const k = draftSavedDayKeyLocal(d.created_at);
      if (k) set.add(k);
    }
    return [...set].sort();
  }, [drafts]);

  const visibleDrafts = useMemo(() => {
    if (!filterDateKeys.length) return [];
    const allow = new Set(filterDateKeys);
    return drafts.filter((d) => allow.has(draftSavedDayKeyLocal(d.created_at)));
  }, [drafts, filterDateKeys]);

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Publish consolidated report"
      subtitle="Merge selected drafts into one PDF. Published drafts are removed from your list."
      size="lg"
      busy={isBusy}
      busyMessage="Building your report"
      busySubMessage="Merging PDFs and uploading…"
      footer={
        <>
          <button
            type="button"
            disabled={isBusy}
            onClick={onClose}
            className="flex-1 rounded-lg border border-base-700 px-3 py-2 text-[13px] font-medium text-white transition-colors hover:bg-base-800 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={selectedIds.length === 0 || isBusy}
            onClick={onPublishConfirm}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-[13px] font-semibold text-base-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isBusy ? <Loader2 size={13} className="animate-spin" /> : null}
            {isBusy
              ? 'Publishing…'
              : `Publish${selectedIds.length > 0 ? ` ${selectedIds.length}` : ''} PDF`}
          </button>
        </>
      }
    >
      {drafts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-base-700 py-12 text-center">
          <GitCompareArrows size={32} className="mb-3 text-ink-600" />
          <p className="text-[13px] font-medium text-ink-400">No comparison drafts</p>
          <p className="mt-1 text-[11px] text-ink-600">Save a comparison first, then return here to publish.</p>
        </div>
      ) : (
        <>
          {/* Date filter chips */}
          <div className="mb-4 rounded-xl border border-base-800 bg-base-800/40 px-3 py-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">Draft saved on</p>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => setFilterDateKeys([...availableDateKeys])}
                  className="rounded-full border border-base-700 bg-base-900 px-2 py-0.5 text-[10px] text-ink-300 transition-colors hover:text-white disabled:opacity-40"
                >
                  All dates
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => setFilterDateKeys([])}
                  className="rounded-full border border-base-700 bg-base-900 px-2 py-0.5 text-[10px] text-ink-300 transition-colors hover:text-white disabled:opacity-40"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {availableDateKeys.map((key) => {
                const checked = filterDateKeys.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={isBusy}
                    onClick={() =>
                      setFilterDateKeys((prev) =>
                        prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key].sort(),
                      )
                    }
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      checked
                        ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                        : 'border-base-700 text-ink-400 hover:border-base-600 hover:text-white'
                    } disabled:opacity-40`}
                  >
                    {formatLocalDayMedium(key)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Select / clear all */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isBusy || visibleDrafts.length === 0}
              onClick={() => setSelectedIds(visibleDrafts.map((d) => d.id))}
              className="rounded-full border border-base-700 px-3 py-1 text-[11px] text-ink-400 transition-colors hover:text-white disabled:opacity-40"
            >
              Select all
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => setSelectedIds([])}
              className="rounded-full border border-base-700 px-3 py-1 text-[11px] text-ink-400 transition-colors hover:text-white disabled:opacity-40"
            >
              Clear
            </button>
            {visibleDrafts.length > 0 && (
              <span className="text-[11px] text-ink-600">
                {selectedIds.length} of {visibleDrafts.length} selected
              </span>
            )}
          </div>

          {visibleDrafts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-amber-800/40 bg-amber-900/10 py-8 text-center">
              <p className="text-[13px] font-medium text-amber-400">No drafts match the selected dates</p>
              <p className="mt-1 text-[11px] text-amber-500/80">Select at least one date to see drafts.</p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {visibleDrafts.map((d) => (
                <li
                  key={d.id}
                  className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                    selectedIds.includes(d.id) ? 'border-amber-500/30 bg-amber-500/5' : 'border-base-800'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(d.id)}
                    disabled={isBusy}
                    onChange={() =>
                      setSelectedIds((prev) =>
                        prev.includes(d.id) ? prev.filter((x) => x !== d.id) : [...prev, d.id],
                      )
                    }
                    className="accent-amber-500"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] text-white">{d.label ?? 'Untitled draft'}</p>
                    <p className="text-[11px] text-ink-500">{formatLocalDayMedium(draftSavedDayKeyLocal(d.created_at))}</p>
                  </div>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void onDeleteDraft(d.id)}
                    className="rounded p-1 text-ink-600 transition-colors hover:text-red-400 disabled:opacity-40"
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Modal>
  );
}
