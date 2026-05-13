'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useEffect, useState } from 'react';
import { getExplorerByRoom, listRooms } from '@/services/apiClient';

type Row = { date: string; images: number; videos: number; pointclouds: number; pdfs: number };

const SERIES: Array<{ key: keyof Omit<Row, 'date'>; label: string; fill: string }> = [
  { key: 'images', label: 'Images', fill: '#F59E0B' },
  { key: 'videos', label: 'Videos', fill: '#2DD4BF' },
  { key: 'pointclouds', label: 'Point clouds', fill: '#818CF8' },
  { key: 'pdfs', label: 'PDFs', fill: '#6B7280' },
];

export function ChartAll({ projectId }: { projectId?: string }) {
  const [data, setData] = useState<Row[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rooms = await listRooms();
        const targetRooms = projectId ? rooms.filter((r) => r.project_id === projectId) : rooms;
        const acc = new Map<string, Row>();
        await Promise.all(
          targetRooms.map(async (room) => {
            const res = await getExplorerByRoom(room.slug);
            for (const [date, group] of Object.entries(res.dates)) {
              const cur =
                acc.get(date) ?? { date, images: 0, videos: 0, pointclouds: 0, pdfs: 0 };
              cur.images += group.images.length;
              cur.videos += group.videos.length;
              cur.pointclouds += group.pointclouds.length;
              cur.pdfs += group.pdfs.length;
              acc.set(date, cur);
            }
          }),
        );
        if (cancelled) return;
        setData(Array.from(acc.values()).sort((a, b) => a.date.localeCompare(b.date)));
      } catch {
        if (!cancelled) setData([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return (
    <div className="rounded-lg border border-base-800 bg-base-900/30 p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-amber-500">
            Captures
          </p>
          <h3 className="mt-1 font-display text-[18px] font-semibold tracking-tight text-white">
            Project timeline
          </h3>
        </div>
        <span className="font-mono text-[11px] text-ink-300">
          {data ? `${data.length} day${data.length === 1 ? '' : 's'}` : 'Loading…'}
        </span>
      </div>

      {data ? (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 4, right: 6, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#9BA3AE', fontFamily: 'IBM Plex Mono' }}
              tickLine={false}
              axisLine={{ stroke: '#262C35' }}
              tickFormatter={(d: string) => d.slice(5)}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#9BA3AE' }}
              tickLine={false}
              axisLine={{ stroke: '#262C35' }}
              allowDecimals={false}
              width={28}
            />
            <Tooltip
              cursor={{ fill: 'rgba(245,158,11,0.06)' }}
              contentStyle={{
                background: '#13171D',
                border: '1px solid #262C35',
                borderRadius: 6,
                fontSize: 12,
              }}
              labelStyle={{ color: '#E6EAEF', fontWeight: 600 }}
              itemStyle={{ color: '#9BA3AE' }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ paddingTop: 8, fontSize: 11, color: '#9BA3AE' }}
            />
            {SERIES.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} stackId="captures" fill={s.fill} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[200px] animate-pulse rounded bg-base-800/50" />
      )}
    </div>
  );
}
