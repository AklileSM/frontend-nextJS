'use client';

import { Check, Minus } from 'lucide-react';
import { Section, SectionHeading, Reveal } from './Section';

type Capability = 'browse' | 'upload' | 'delete' | 'reports';

const matrix: Record<'admin' | 'manager' | 'viewer', Record<Capability, boolean | 'self'>> = {
  admin: { browse: true, upload: true, delete: true, reports: true },
  manager: { browse: true, upload: false, delete: true, reports: 'self' },
  viewer: { browse: true, upload: false, delete: false, reports: 'self' },
};

const roles: Array<{ key: 'admin' | 'manager' | 'viewer'; name: string; sub: string }> = [
  { key: 'admin', name: 'Admin', sub: 'First user on a project becomes admin' },
  { key: 'manager', name: 'Manager', sub: 'Reviews captures, deletes incorrect uploads' },
  { key: 'viewer', name: 'Viewer', sub: 'Read-only field access' },
];

const cols: Array<{ key: Capability; label: string; note: string }> = [
  { key: 'browse', label: 'Browse', note: 'Open the timeline and viewers' },
  { key: 'upload', label: 'Upload', note: 'Add captures to the project' },
  { key: 'delete', label: 'Delete', note: 'Remove file assets' },
  { key: 'reports', label: 'Reports', note: 'Publish & download PDFs' },
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

function Mark({ value }: { value: boolean | 'self' }) {
  if (value === true) {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-amber-500/15 text-amber-500">
        <Check size={16} strokeWidth={2.4} />
      </span>
    );
  }
  if (value === 'self') {
    return (
      <span className="inline-flex h-8 items-center rounded-md bg-base-800 px-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-200">
        Own only
      </span>
    );
  }
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-base-800 text-base-600">
      <Minus size={16} strokeWidth={2.4} />
    </span>
  );
}
