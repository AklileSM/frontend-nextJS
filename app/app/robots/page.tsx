'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { KeyRound, Loader2, ShieldAlert } from 'lucide-react';
import {
  createRobotPairingToken,
  listProjects,
  listRobotPairingTokens,
  listRobots,
  revokeRobotPairingToken,
} from '@/services/apiClient';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { ApiProject, ApiRobotPairingToken, ApiRobotSummary } from '@/types/api';

export const dynamic = 'force-dynamic';

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function tokenState(token: ApiRobotPairingToken): 'active' | 'claimed' | 'revoked' | 'expired' {
  if (token.revoked_at) return 'revoked';
  if (token.claimed_at) return 'claimed';
  if (token.expires_at && new Date(token.expires_at).getTime() < Date.now()) return 'expired';
  return 'active';
}

const STATE_STYLES: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-300',
  claimed: 'bg-blue-500/10 text-blue-300',
  revoked: 'bg-red-500/10 text-red-300',
  expired: 'bg-base-700 text-ink-300',
};

export default function AdminRobotPairingsPage() {
  const [robots, setRobots] = useState<ApiRobotSummary[]>([]);
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [tokens, setTokens] = useState<ApiRobotPairingToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pendingRevoke, setPendingRevoke] = useState<ApiRobotPairingToken | null>(null);

  const [robotId, setRobotId] = useState('');
  const [robotPassword, setRobotPassword] = useState('');
  const [defaultProjectSlug, setDefaultProjectSlug] = useState('');
  const [expiresInHours, setExpiresInHours] = useState('24');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [robotsData, projectsData, tokensData] = await Promise.all([
        listRobots(),
        listProjects(),
        listRobotPairingTokens(),
      ]);
      setRobots(robotsData);
      setProjects(projectsData);
      setTokens(tokensData);
      setRobotId((current) => current || robotsData[0]?.username || '');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load robot pairing data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = useCallback(async () => {
    if (!robotId || !robotPassword) {
      toast.error('Robot and robot password are required');
      return;
    }

    setSubmitting(true);
    try {
      const created = await createRobotPairingToken({
        robot_id: robotId,
        robot_password: robotPassword,
        default_project_slug: defaultProjectSlug || null,
        note: note || null,
        expires_in_hours: Number.parseInt(expiresInHours, 10) || 24,
      });
      setRobotPassword('');
      setNote('');
      toast.success(`Created pairing token ${created.token}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create pairing token');
    } finally {
      setSubmitting(false);
    }
  }, [defaultProjectSlug, expiresInHours, load, note, robotId, robotPassword]);

  const handleRevoke = useCallback(async () => {
    if (!pendingRevoke) return;
    try {
      await revokeRobotPairingToken(pendingRevoke.id);
      toast.success(`Revoked token ${pendingRevoke.token}`);
      setPendingRevoke(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke pairing token');
    }
  }, [load, pendingRevoke]);

  return (
    <div className="px-6 py-10 sm:px-10 lg:px-12 xl:px-16">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <p className="font-mono text-[12px] uppercase tracking-[0.22em] text-amber-500">
          Admin · Robot pairing
        </p>
        <h1 className="mt-3 font-display text-[36px] font-semibold tracking-tight text-white">
          Pairing tokens
        </h1>
        <p className="mt-2 max-w-3xl text-[14px] text-ink-300">
          Create one-time bootstrap tokens for Jetson agents. The token lets a robot claim its first
          `robot_agent_config.json` without SSH-based credential editing.
        </p>
      </motion.section>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(320px,430px)_1fr]">
        <section className="rounded-3xl border border-base-800 bg-base-900/60 p-6">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-300">
              <KeyRound size={18} />
            </div>
            <div>
              <h2 className="font-display text-[24px] text-white">Create pairing token</h2>
              <p className="text-[13px] text-ink-300">Use the robot service-account password the agent should bootstrap with.</p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400">Robot</span>
              <select
                value={robotId}
                onChange={(event) => setRobotId(event.target.value)}
                className="w-full rounded-xl border border-base-700 bg-base-950 px-3 py-2.5 text-[14px] text-white outline-none transition focus:border-amber-500"
              >
                <option value="">Select robot</option>
                {robots.map((robot) => (
                  <option key={robot.robot_id} value={robot.username}>
                    {robot.username}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400">Robot password</span>
              <input
                type="password"
                value={robotPassword}
                onChange={(event) => setRobotPassword(event.target.value)}
                className="w-full rounded-xl border border-base-700 bg-base-950 px-3 py-2.5 text-[14px] text-white outline-none transition focus:border-amber-500"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400">Default project</span>
                <select
                  value={defaultProjectSlug}
                  onChange={(event) => setDefaultProjectSlug(event.target.value)}
                  className="w-full rounded-xl border border-base-700 bg-base-950 px-3 py-2.5 text-[14px] text-white outline-none transition focus:border-amber-500"
                >
                  <option value="">None</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.slug}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400">Expires in</span>
                <select
                  value={expiresInHours}
                  onChange={(event) => setExpiresInHours(event.target.value)}
                  className="w-full rounded-xl border border-base-700 bg-base-950 px-3 py-2.5 text-[14px] text-white outline-none transition focus:border-amber-500"
                >
                  <option value="1">1 hour</option>
                  <option value="24">24 hours</option>
                  <option value="72">72 hours</option>
                  <option value="168">7 days</option>
                </select>
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400">Note</span>
              <input
                type="text"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="GO2W lab cart, June rollout"
                className="w-full rounded-xl border border-base-700 bg-base-950 px-3 py-2.5 text-[14px] text-white outline-none transition focus:border-amber-500"
              />
            </label>

            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-[14px] font-medium text-base-950 transition hover:bg-amber-400 disabled:opacity-60"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
              Create pairing token
            </button>
          </div>

          {robots.length === 0 && (
            <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-[12px] text-amber-100">
              No robot accounts found yet. Create a robot account first from the backend admin API.
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-base-800 bg-base-900/45 p-6">
          <div className="flex items-start gap-3">
            <ShieldAlert size={18} className="mt-1 text-amber-400" />
            <div>
              <h2 className="font-display text-[24px] text-white">Issued tokens</h2>
              <p className="mt-1 text-[13px] text-ink-300">
                Tokens are one-time bootstrap credentials. Revoke unused ones if they were shared or exposed.
              </p>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto rounded-2xl border border-base-800">
            {loading ? (
              <div className="p-6">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="mb-3 h-10 animate-pulse rounded bg-base-800" />
                ))}
              </div>
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-base-800 bg-base-900/60">
                    <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">Robot</th>
                    <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">Token</th>
                    <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">Project</th>
                    <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">State</th>
                    <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">Claimed</th>
                    <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">Expires</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((token, index) => {
                    const state = tokenState(token);
                    return (
                      <tr
                        key={token.id}
                        className={`border-b border-base-800/60 ${
                          index % 2 === 0 ? 'bg-base-900/20' : 'bg-transparent'
                        } hover:bg-base-800/30 transition-colors`}
                      >
                        <td className="px-4 py-3 font-medium text-white">{token.robot_id}</td>
                        <td className="px-4 py-3 font-mono text-[11px] text-ink-300">{token.token}</td>
                        <td className="px-4 py-3 text-ink-300">{token.default_project_slug ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-1 font-mono text-[10px] uppercase ${STATE_STYLES[state]}`}>
                            {state}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-ink-300">
                          {token.claimed_at ? `${formatDateTime(token.claimed_at)}${token.claimed_hostname ? ` · ${token.claimed_hostname}` : ''}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-ink-300">{formatDateTime(token.expires_at)}</td>
                        <td className="px-4 py-3 text-right">
                          {!token.revoked_at && !token.claimed_at && (
                            <button
                              type="button"
                              onClick={() => setPendingRevoke(token)}
                              className="rounded border border-red-700/40 px-3 py-1 text-[12px] text-red-200 transition hover:bg-red-500/10"
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {tokens.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-[13px] text-ink-400">
                        No pairing tokens yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={!!pendingRevoke}
        title="Revoke this pairing token?"
        body={
          <>
            <code className="rounded bg-base-800 px-1.5 py-0.5 font-mono text-[12px] text-ink-100">
              {pendingRevoke?.token}
            </code>{' '}
            will no longer be claimable by a robot agent.
          </>
        }
        confirmLabel="Revoke token"
        danger
        onConfirm={handleRevoke}
        onCancel={() => setPendingRevoke(null)}
      />
    </div>
  );
}
