'use client';

import { Check, Minus } from 'lucide-react';
import { Section, SectionHeading, Reveal } from './Section';

type Capability = 'browse' | 'upload' | 'manage' | 'reports';

const matrix: Record<'owner' | 'editor' | 'viewer', Record<Capability, boolean>> = {
  owner:  { browse: true, upload: true, manage: true, reports: true },
  editor: { browse: true, upload: true, manage: false, reports: true },
  viewer: { browse: true, upload: false, manage: false, reports: true },
};

const roles: Array<{ key: 'owner' | 'editor' | 'viewer'; name: string; sub: string }> = [
  { key: 'owner', name: 'Owner', sub: 'Full control — uploads, rooms, members, and project settings' },
  { key: 'editor', name: 'Editor', sub: 'Uploads and deletes captures, and manages rooms' },
  { key: 'viewer', name: 'Viewer', sub: 'Read-only access to captures and reports' },
];

const cols: Array<{ key: Capability; label: string; note: string }> = [
  { key: 'browse', label: 'Browse', note: 'Open the timeline and viewers' },
  { key: 'upload', label: 'Upload', note: 'Add captures to the project' },
  { key: 'manage', label: 'Manage team', note: 'Project settings and member invites' },
  { key: 'reports', label: 'Reports', note: 'Create and publish PDFs' },
];

export function Roles() {
  return (
    <Section id="access">
      <SectionHeading
        eyebrow="Access"
        title="Three roles. Read live from the database."
        sub={
          <>
            Permission changes take effect on the next request, no token refresh, no logout. The{' '}
            <code className="rounded bg-base-800 px-1.5 py-0.5 font-mono text-[14px] text-ink-100">
              role
            </code>{' '}
            claim in the JWT is ignored on the server; authorisation always reads the live user
            row.
          </>
        }
      />

      <Reveal className="mt-14">
        <div className="overflow-hidden rounded-lg border border-base-800 bg-base-900/30">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-base-800">
                <th className="w-[26%] px-7 py-5 text-left font-mono text-[11px] uppercase tracking-[0.2em] text-ink-300">
                  Role
                </th>
                {cols.map((c) => (
                  <th key={c.key} className="px-7 py-5 text-left">
                    <div className="text-[14px] font-semibold text-white">{c.label}</div>
                    <div className="mt-1 text-[12px] text-ink-300">{c.note}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr
                  key={r.key}
                  className="border-b border-base-800 transition-colors last:border-b-0 hover:bg-base-900/40"
                >
                  <th scope="row" className="px-7 py-5 text-left">
                    <div className="text-[15px] font-semibold text-white">{r.name}</div>
                    <div className="mt-1 text-[13px] text-ink-300">{r.sub}</div>
                  </th>
                  {cols.map((c) => (
                    <td key={c.key} className="px-7 py-5 align-top">
                      <Mark value={matrix[r.key][c.key]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>
    </Section>
  );
}

function Mark({ value }: { value: boolean }) {
  if (value) {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-amber-500/15 text-amber-500">
        <Check size={16} strokeWidth={2.4} />
      </span>
    );
  }
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-base-800 text-base-600">
      <Minus size={16} strokeWidth={2.4} />
    </span>
  );
}
