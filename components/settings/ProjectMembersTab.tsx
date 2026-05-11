'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { UserMinus, Loader2 } from 'lucide-react';
import {
  listProjectMembers,
  inviteProjectMember,
  updateProjectMember,
  removeProjectMember,
} from '@/services/apiClient';
import { useAuth } from '@/context/AuthContext';
import type { ApiProjectMember } from '@/types/api';

const ROLE_OPTIONS: { value: ApiProjectMember['role']; label: string }[] = [
  { value: 'owner', label: 'Owner' },
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' },
];

const ROLE_BADGE: Record<ApiProjectMember['role'], string> = {
  owner: 'bg-amber-500/15 text-amber-400',
  editor: 'bg-steel-500/15 text-steel-400',
  viewer: 'bg-base-800 text-ink-400',
};

function initial(username: string) {
  return username.slice(0, 2).toUpperCase();
}

export function ProjectMembersTab({
  projectId,
  canManage,
}: {
  projectId: string;
  canManage: boolean;
}) {
  const { user } = useAuth();
  const [members, setMembers] = useState<ApiProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteRole, setInviteRole] = useState<ApiProjectMember['role']>('viewer');
  const [inviting, setInviting] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setMembers(await listProjectMembers(projectId));
    } catch {
      toast.error('Failed to load members');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleRoleChange = async (userId: string, role: ApiProjectMember['role']) => {
    try {
      const updated = await updateProjectMember(projectId, userId, { role });
      setMembers((prev) => prev.map((m) => (m.user_id === userId ? { ...m, role: updated.role } : m)));
      toast.success('Role updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update role');
    }
  };

  const handleRemove = async (userId: string) => {
    setPendingRemove(userId);
    try {
      await removeProjectMember(projectId, userId);
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
      toast.success('Member removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setPendingRemove(null);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteUsername.trim()) return;
    setInviting(true);
    try {
      const member = await inviteProjectMember(projectId, {
        username: inviteUsername.trim(),
        role: inviteRole,
      });
      setMembers((prev) => [...prev, member]);
      setInviteUsername('');
      toast.success(`${member.username} added as ${member.role}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invite failed');
    } finally {
      setInviting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-[13px] text-ink-400">
        <Loader2 size={14} className="animate-spin" />
        Loading members…
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div className="overflow-hidden rounded-lg border border-base-800">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-base-800 bg-base-900/60">
              <th className="px-4 py-3 text-left font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">
                User
              </th>
              <th className="px-4 py-3 text-left font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">
                Role
              </th>
              <th className="px-4 py-3 text-left font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">
                Joined
              </th>
              {canManage && <th className="w-10 px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-base-800/60">
            {members.map((m) => {
              const isSelf = m.user_id === user?.id;
              return (
                <tr key={m.user_id} className="bg-base-900/20">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-base-800 font-mono text-[10px] font-semibold text-ink-200">
                        {initial(m.username)}
                      </span>
                      <div>
                        <p className="font-medium text-white">
                          {m.username}
                          {isSelf && (
                            <span className="ml-2 font-mono text-[10px] text-ink-400">(you)</span>
                          )}
                        </p>
                        {m.email && (
                          <p className="font-mono text-[11px] text-ink-400">{m.email}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {canManage && !isSelf ? (
                      <select
                        value={m.role}
                        onChange={(e) =>
                          handleRoleChange(m.user_id, e.target.value as ApiProjectMember['role'])
                        }
                        className="rounded-md border border-base-700 bg-base-950 px-2 py-1 text-[12px] text-white outline-none focus:border-amber-500"
                      >
                        {ROLE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${ROLE_BADGE[m.role]}`}
                      >
                        {m.role}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-ink-400">
                    {new Date(m.joined_at).toLocaleDateString()}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      {!isSelf && (
                        <button
                          type="button"
                          onClick={() => handleRemove(m.user_id)}
                          disabled={pendingRemove === m.user_id}
                          aria-label={`Remove ${m.username}`}
                          className="inline-flex h-7 w-7 items-center justify-center rounded text-ink-400 transition-colors hover:bg-base-800 hover:text-red-400 disabled:opacity-40"
                        >
                          {pendingRemove === m.user_id ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <UserMinus size={13} />
                          )}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {canManage && (
        <div>
          <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-400">
            Invite member
          </h3>
          <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[180px]">
              <input
                type="text"
                value={inviteUsername}
                onChange={(e) => setInviteUsername(e.target.value)}
                placeholder="Username"
                required
                className="w-full rounded-md border border-base-700 bg-base-950 px-3 py-2 text-[13px] text-white outline-none placeholder:text-ink-500 focus:border-amber-500"
              />
            </div>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as ApiProjectMember['role'])}
              className="rounded-md border border-base-700 bg-base-950 px-3 py-2 text-[13px] text-white outline-none focus:border-amber-500"
            >
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={inviting || !inviteUsername.trim()}
              className="rounded-md bg-amber-500 px-4 py-2 text-[13px] font-semibold text-base-950 hover:bg-amber-400 transition-colors disabled:opacity-40"
            >
              {inviting ? 'Inviting…' : 'Invite'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
