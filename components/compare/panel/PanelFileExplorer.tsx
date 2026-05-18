'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Loader2 } from 'lucide-react';
import { MediaTabs, type MediaTab } from '@/components/explorer/MediaTabs';
import { getExplorerByDateForProject } from '@/services/apiClient';
import type { ApiMediaFile, ApiRoomMediaGroup } from '@/types/api';
import { PickerThumbnail } from './PickerThumbnail';
import { isPCDUrl } from './helpers';
import type { FileSelection } from './types';

export function PanelFileExplorer({
  projectId,
  selectedDate,
  disabledFileUrl,
  onFileSelect,
  onBackToCalendar,
  tabRailId,
}: {
  projectId: string;
  selectedDate: string;
  disabledFileUrl: string | null;
  onFileSelect: (sel: FileSelection) => void;
  onBackToCalendar: () => void;
  tabRailId: string;
}) {
  const [activeTab, setActiveTab] = useState<MediaTab>('images');
  const [roomsForDate, setRoomsForDate] = useState<Record<string, ApiRoomMediaGroup>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab('images');
  }, [selectedDate]);

  useEffect(() => {
    if (!selectedDate || !projectId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getExplorerByDateForProject(projectId, selectedDate)
      .then((res) => { if (!cancelled) setRoomsForDate(res.rooms || {}); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load files.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selectedDate, projectId]);

  const roomSlugs = Object.keys(roomsForDate);

  const tabCounts = useMemo((): Record<MediaTab, number> => {
    const result = { images: 0, videos: 0, pointclouds: 0, pdfs: 0 };
    for (const m of Object.values(roomsForDate)) {
      result.images      += m.images?.length ?? 0;
      result.videos      += m.videos?.length ?? 0;
      result.pointclouds += m.pointclouds?.length ?? 0;
      result.pdfs        += m.pdfs?.length ?? 0;
    }
    return result;
  }, [roomsForDate]);

  const displayedFiles = useMemo((): ApiMediaFile[] =>
    roomSlugs.flatMap((slug) => roomsForDate[slug]?.[activeTab] ?? []),
  [roomsForDate, roomSlugs, activeTab]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-base-800 px-4 py-3">
        <span className="font-mono text-[13px] font-medium text-white">{selectedDate}</span>
        <button
          type="button"
          onClick={onBackToCalendar}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-ink-400 transition-colors hover:bg-base-800 hover:text-white"
        >
          <CalendarDays size={11} />
          Calendar
        </button>
      </div>

      {/* Media tabs */}
      <div className="border-b border-base-800 px-3 py-3">
        <MediaTabs
          active={activeTab}
          counts={tabCounts}
          onChange={setActiveTab}
          railId={tabRailId}
        />
      </div>

      {/* File grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={18} className="animate-spin text-ink-500" />
          </div>
        ) : error ? (
          <p className="py-4 text-center text-[12px] text-red-400">{error}</p>
        ) : displayedFiles.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <p className="text-[12px] font-medium text-ink-400">No {activeTab} here</p>
            <p className="text-[11px] text-ink-600">
              {roomSlugs.length === 0 ? 'No files for this date.' : 'Try a different room or media type.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {displayedFiles.map((file, i) => {
              const url = file.full_src || file.src;
              const isDisabled = url === disabledFileUrl;
              const isPcd = file.type === 'pointcloud' || isPCDUrl(url);
              const roomSlug = roomSlugs.find(
                (s) => roomsForDate[s]?.[activeTab]?.some((f) => f.id === file.id)
              ) ?? '';
              return (
                <PickerThumbnail
                  key={file.id}
                  file={file}
                  disabled={isDisabled}
                  index={i}
                  onPick={() => {
                    if (file.type === 'pdf') {
                      window.open(url, '_blank', 'noopener,noreferrer');
                      return;
                    }
                    onFileSelect({
                      fileUrl: url,
                      fileId: file.id,
                      displayFileName: file.file_name,
                      roomSlug,
                      roomLabel: roomSlug,
                      captureDate: file.capture_date,
                      mediaType: file.type,
                      isPCD: isPcd,
                    });
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
