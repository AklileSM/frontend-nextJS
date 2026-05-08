'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useEffect, useState } from 'react';
import { getExplorerByRoom, listProjects, listRooms } from '@/services/apiClient';

type Row = { room: string; slug: string; total: number };

export function ChartLocation({ hoveredRoom }: { hoveredRoom: string | null }) {
  const [data, setData] = useState<Row[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [projects, rooms] = await Promise.all([listProjects(), listRooms()]);
        const a6ProjectId = projects.find((p) => p.slug === 'a6-stern')?.id;
        const targetRooms = a6ProjectId ? rooms.filter((r) => r.project_id === a6ProjectId) : rooms;
        const result: Row[] = await Promise.all(
          targetRooms.map(async (r) => {
            const res = await getExplorerByRoom(r.slug);
            const total = Object.values(res.dates).reduce(
              (s, g) =>
                s +
                g.images.length +
                g.videos.length +
                g.pointclouds.length +
                g.pdfs.length,
              0,
            );
            return { room: r.name, slug: r.slug, total };
          }),
        );
        if (cancelled) return;
        setData(result);
      } catch {
        if (!cancelled) setData([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) {
    return <div className="h-[260px] animate-pulse rounded bg-base-800/50" />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-300">
          Captures by room
        </p>
        <span className="font-mono text-[11px] text-ink-300">
          {hoveredRoom ? hoveredRoom.replace(/(\d+)/, ' $1') : 'all rooms'}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 4, right: 6, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis
            dataKey="room"
            tick={{ fontSize: 10, fill: '#9BA3AE' }}
            tickLine={false}
            axisLine={{ stroke: '#262C35' }}
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
            formatter={(v: number) => [`${v} captures`, 'Total']}
          />
          <Bar dataKey="total" radius={[4, 4, 0, 0]}>
            {data.map((d) => (
              <Cell
                key={d.slug}
                fill={hoveredRoom === d.slug ? '#F59E0B' : '#3A424E'}
                stroke={hoveredRoom === d.slug ? '#FBBF24' : 'transparent'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
