'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { UserMinus, Loader2, ChevronDown } from 'lucide-react';
import {
  listProjectMembers,
  inviteProjectMember,
  updateProjectMember,
  removeProjectMember,
  listAdminUsers,
} from '@/services/apiClient';
import { useAuth } from '@/context/AuthContext';
import type { AdminUser, ApiProjectMember } from '@/types/api';

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
  const [allUsers, setAllUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteUserId, setInviteUserId] = useState('');
  const [inviteRole, setInviteRole] = useState<ApiProjectMember['role']>('viewer');
  const [inviting, setInviting] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, u] = await Promise.all([listProjectMembers(projectId), listAdminUsers()]);
      setMembers(m);
      setAllUsers(u);
    } catch {
      toast.error('Failed to load members');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const nonMembers = allUsers.filter(
    (u) => u.is_active && !members.some((m) => m.user_id === u.id),
  );

  const filteredUsers = query
    ? nonMembers.filter(
        (u) =>
          u.username.toLowerCase().includes(query.toLowerCase()) ||
          (u.email ?? '').toLowerCase().includes(query.toLowerCase()),
      )
    : nonMembers;

  const selectedUser = allUsers.find((u) => u.id === inviteUserId) ?? null;

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
    if (!inviteUserId) return;
    setInviting(true);
    try {
      const member = await inviteProjectMember(projectId, { user_id: inviteUserId, role: inviteRole });
      setMembers((prev) => [...prev, member]);
      setInviteUserId('');
      setQuery('');
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
              <th className="px-4 py-3 text-left font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">User</th>
              <th className="px-4 py-3 text-left font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">Role</th>
              <th className="px-4 py-3 text-left font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">Joined</th>
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
                          {isSelf && <span className="ml-2 font-mono text-[10px] text-ink-400">(you)</span>}
                        </p>
                        {m.email && <p className="font-mono text-[11px] text-ink-400">{m.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {canManage && !isSelf ? (
                      <select
                        value={m.role}
                        onChange={(e) => handleRoleChange(m.user_id, e.target.value as ApiProjectMember['role'])}
                        className="rounded-md border border-base-700 bg-base-950 px-2 py-1 text-[12px] text-white outline-none focus:border-amber-500"
                      >
                        {ROLE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${ROLE_BADGE[m.role]}`}>
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
                          {pendingRemove === m.user_id
                            ? <Loader2 size={13} className="animate-spin" />
                            : <UserMinus size={13} />}
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
          <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-400">Add member</h3>
          <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-3">

            {/* User picker */}
            <div className="relative flex-1 min-w-[200px]">
              <div
                className={`flex cursor-pointer items-center justify-between gap-2 rounded-md border bg-base-950 px-3 py-2 text-[13px] transition-colors ${
                  dropdownOpen ? 'border-amber-500' : 'border-base-700'
                }`}
                onClick={() => { setDropdownOpen((v) => !v); setQuery(''); }}
              >
                <span className={selectedUser ? 'text-white' : 'text-ink-500'}>
                  {selectedUser ? `${selectedUser.username}${selectedUser.email ? ` · ${selectedUser.email}` : ''}` : 'Select user…'}
                </span>
                <ChevronDown size={13} className="shrink-0 text-ink-500" />
              </div>

              {dropdownOpen && (
                <div className="absolute left-0 top-full z-20 mt-1 w-full rounded-md border border-base-700 bg-base-900 shadow-xl">
                  <div className="border-b border-base-800 p-2">
                    <input
                      autoFocus
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search by name or email…"
                      className="w-full rounded bg-base-950 px-2.5 py-1.5 text-[12px] text-white outline-none placeholder:text-ink-500"
                    />
                  </div>
                  <ul className="max-h-52 overflow-y-auto py-1">
                    {filteredUsers.length === 0 ? (
                      <li className="px-3 py-2 text-[12px] text-ink-500">
                        {nonMembers.length === 0 ? 'All users are already members.' : 'No matches.'}
                      </li>
                    ) : (
                      filteredUsers.map((u) => (
                        <li key={u.id}>
                          <button
                            type="button"
                            onMouseDown={() => {
                              setInviteUserId(u.id);
                              setDropdownOpen(false);
                              setQuery('');
                            }}
                            className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-base-800"
                          >
                            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-base-700 font-mono text-[9px] font-semibold text-ink-200">
                              {initial(u.username)}
                            </span>
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium text-white">{u.username}</p>
                              {u.email && <p className="truncate font-mono text-[10px] text-ink-400">{u.email}</p>}
                            </div>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )}
            </div>

            {/* Role */}
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as ApiProjectMember['role'])}
              className="rounded-md border border-base-700 bg-base-950 px-3 py-2 text-[13px] text-white outline-none focus:border-amber-500"
            >
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            <button
              type="submit"
              disabled={inviting || !inviteUserId}
              className="rounded-md bg-amber-500 px-4 py-2 text-[13px] font-semibold text-base-950 transition-colors hover:bg-amber-400 disabled:opacity-40"
            >
              {inviting ? 'Adding…' : 'Add'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
