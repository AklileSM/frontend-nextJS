'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { KeyRound, Loader2, ShieldAlert } from 'lucide-react';
import {
  createRobotAccount,
  createRobotPairingToken,
  listPairableProjects,
  listRobotPairingTokens,
  listRobots,
  revokeRobotPairingToken,
} from '@/services/apiClient';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/context/AuthContext';
import type { ApiProject, ApiRobotPairingToken, ApiRobotSummary } from '@/types/api';

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

type Props = {
  headingPrefix: string;
  heading: string;
  intro: string;
};

export function RobotPairingManager({ headingPrefix, heading, intro }: Props) {
  const { user } = useAuth();
  const isAdmin = user?.is_admin ?? false;
  const [robots, setRobots] = useState<ApiRobotSummary[]>([]);
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [tokens, setTokens] = useState<ApiRobotPairingToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingRobot, setCreatingRobot] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingRevoke, setPendingRevoke] = useState<ApiRobotPairingToken | null>(null);

  const [newRobotId, setNewRobotId] = useState('');
  const [newRobotPassword, setNewRobotPassword] = useState('');
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
        listPairableProjects(),
        listRobotPairingTokens(),
      ]);
      setRobots(robotsData);
      setProjects(projectsData);
      setTokens(tokensData);
      setRobotId((current) => current || robotsData[0]?.username || '');
      setDefaultProjectSlug((current) => current || projectsData[0]?.slug || '');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load robot pairing data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreateRobot = useCallback(async () => {
    const username = newRobotId.trim();
    if (!username || !newRobotPassword) {
      toast.error('Robot username and password are required');
      return;
    }

    setCreatingRobot(true);
    try {
      const created = await createRobotAccount({
        username,
        password: newRobotPassword,
      });
      setNewRobotId('');
      setRobotPassword(newRobotPassword);
      setNewRobotPassword('');
      setRobotId(created.username);
      toast.success(`Created robot account ${created.username}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create robot account');
    } finally {
      setCreatingRobot(false);
    }
  }, [load, newRobotId, newRobotPassword]);

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
          {headingPrefix}
        </p>
        <h1 className="mt-3 font-display text-[36px] font-semibold tracking-tight text-white">
          {heading}
        </h1>
        <p className="mt-2 max-w-3xl text-[14px] text-ink-300">
          {intro}
        </p>
      </motion.section>

      <section className="mt-6 rounded-2xl border border-base-800 bg-base-900/55 p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400">Setup flow</p>
        <ol className="mt-3 grid gap-2 text-[13px] text-ink-300">
          {isAdmin ? (
            <li><span className="text-white">1.</span> Create the robot account with a strong password.</li>
          ) : null}
          <li><span className="text-white">{isAdmin ? '2' : '1'}.</span> Create a pairing token for the robot and choose its default project.</li>
          <li><span className="text-white">{isAdmin ? '3' : '2'}.</span> Copy the active token, then claim it once from the robot terminal.</li>
          <li><span className="text-white">{isAdmin ? '4' : '3'}.</span> Restart the robot agent and confirm the robot appears online in Mission control.</li>
        </ol>
        <pre className="mt-4 overflow-x-auto rounded-xl border border-base-800 bg-base-950 p-3 font-mono text-[11px] leading-relaxed text-ink-300">
{`cd /home/unitree/SiteScope/robot
python3 robot_agent.py \\
  --claim-pairing-token '<PAIRING_TOKEN>' \\
  --pairing-base-url 'http://<sitescope-host>:3004' \\
  --config /home/unitree/SiteScope/robot/robot_agent_config.json
sudo systemctl restart sitescope-agent.service`}
        </pre>
      </section>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(320px,430px)_1fr]">
        <section className="rounded-3xl border border-base-800 bg-base-900/60 p-6">
          {isAdmin ? (
            <div>
              <div className="flex items-center gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-300">
                  <KeyRound size={18} />
                </div>
                <div>
                  <h2 className="font-display text-[24px] text-white">Add a robot</h2>
                  <p className="text-[13px] text-ink-300">Create the robot service account first, then issue a pairing token for it.</p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <label className="block">
                  <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400">Robot username</span>
                  <input
                    type="text"
                    value={newRobotId}
                    onChange={(event) => setNewRobotId(event.target.value)}
                    placeholder="go2w-002"
                    className="w-full rounded-xl border border-base-700 bg-base-950 px-3 py-2.5 text-[14px] text-white outline-none transition focus:border-amber-500"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400">Robot password</span>
                  <input
                    type="password"
                    value={newRobotPassword}
                    onChange={(event) => setNewRobotPassword(event.target.value)}
                    className="w-full rounded-xl border border-base-700 bg-base-950 px-3 py-2.5 text-[14px] text-white outline-none transition focus:border-amber-500"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => void handleCreateRobot()}
                  disabled={creatingRobot}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-500/40 px-4 py-3 text-[14px] font-medium text-amber-200 transition hover:bg-amber-500/10 disabled:opacity-60"
                >
                  {creatingRobot ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
                  Create robot account
                </button>
              </div>

              <div className="my-6 border-t border-base-800" />
            </div>
          ) : null}

          <div className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-300">
              <KeyRound size={18} />
            </div>
            <div>
              <h2 className="font-display text-[24px] text-white">Create pairing token</h2>
              <p className="text-[13px] text-ink-300">Use this once on the robot to write its local agent config.</p>
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
              <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400">Project</span>
              <select
                value={defaultProjectSlug}
                onChange={(event) => setDefaultProjectSlug(event.target.value)}
                className="w-full rounded-xl border border-base-700 bg-base-950 px-3 py-2.5 text-[14px] text-white outline-none transition focus:border-amber-500"
              >
                <option value="">Select owned project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.slug}>
                    {project.name}
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
            </div>

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

          {projects.length === 0 && (
            <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-[12px] text-amber-100">
              You do not currently own any projects that can be used for robot pairing.
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-base-800 bg-base-900/45 p-6">
          <div className="flex items-start gap-3">
            <ShieldAlert size={18} className="mt-1 text-amber-400" />
            <div>
              <h2 className="font-display text-[24px] text-white">Issued tokens</h2>
              <p className="mt-1 text-[13px] text-ink-300">
                You can see and revoke tokens tied to projects you own. Admins still see the full platform list.
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
