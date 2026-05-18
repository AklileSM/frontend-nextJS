'use client';

/** Project members tab: list, role change, remove, plus the add-member form
 *  (typeahead user search + role picker).
 *
 *  Was ~433 lines. Two things came out:
 *    - `members/RoleDropdown.tsx` — the three-option role popover.
 *    - The inline ConfirmModal — replaced with the shared `<ConfirmDialog>`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { Loader2, UserMinus } from 'lucide-react';
import {
  inviteProjectMember,
  listProjectMembers,
  removeProjectMember,
  searchUsers,
  updateProjectMember,
} from '@/services/apiClient';
import { useAuth } from '@/context/AuthContext';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { AdminUser, ApiProjectMember } from '@/types/api';
import { RoleDropdown } from './members/RoleDropdown';

const ROLE_BADGE: Record<ApiProjectMember['role'], string> = {
  owner:  'bg-amber-500/15 text-amber-400',
  editor: 'bg-steel-500/15 text-steel-400',
  viewer: 'bg-base-800 text-ink-400',
};

function initial(username: string) {
  return username.slice(0, 2).toUpperCase();
}

type ConfirmAction =
  | { type: 'remove'; member: ApiProjectMember }
  | { type: 'role'; member: ApiProjectMember; newRole: ApiProjectMember['role'] };

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

  // Search
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AdminUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [inviteRole, setInviteRole] = useState<ApiProjectMember['role']>('viewer');
  const [inviting, setInviting] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Confirm dialog
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);

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

  // Debounced search
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (!query.trim()) { setResults([]); setDropdownOpen(false); return; }
    searchDebounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const found = await searchUsers(query.trim());
        // Filter out existing members
        setResults(found.filter((u) => !members.some((m) => m.user_id === u.id)));
        setDropdownOpen(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [query, members]);

  const handlePickUser = (u: AdminUser) => {
    setSelectedUser(u);
    setQuery(u.username);
    setDropdownOpen(false);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setInviting(true);
    try {
      const member = await inviteProjectMember(projectId, { user_id: selectedUser.id, role: inviteRole });
      setMembers((prev) => [...prev, member]);
      setSelectedUser(null);
      setQuery('');
      toast.success(`${member.username} added as ${member.role}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invite failed');
    } finally {
      setInviting(false);
    }
  };

  const handleConfirm = async () => {
    if (!confirm) return;
    try {
      if (confirm.type === 'remove') {
        await removeProjectMember(projectId, confirm.member.user_id);
        setMembers((prev) => prev.filter((m) => m.user_id !== confirm.member.user_id));
        toast.success(`${confirm.member.username} removed`);
      } else {
        const updated = await updateProjectMember(projectId, confirm.member.user_id, { role: confirm.newRole });
        setMembers((prev) => prev.map((m) => m.user_id === confirm.member.user_id ? { ...m, role: updated.role } : m));
        toast.success(`${confirm.member.username} is now ${updated.role}`);
      }
      setConfirm(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    }
  };

  const confirmTitle = confirm
    ? confirm.type === 'remove'
      ? `Remove ${confirm.member.username}?`
      : `Change role to ${confirm.newRole}?`
    : '';

  const confirmBody = confirm
    ? confirm.type === 'remove'
      ? `${confirm.member.username} will lose all access to this project.`
      : `${confirm.member.username} will be ${confirm.newRole === 'owner' ? 'promoted to owner' : confirm.newRole === 'editor' ? 'promoted to editor' : 'demoted to viewer'}.`
    : '';

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

      {/* Members table */}
      <div className="overflow-hidden rounded-lg border border-base-800">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-base-800 bg-base-900/60">
              <th className="px-4 py-3 text-left font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">User</th>
              <th className="px-4 py-3 text-left font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">Role</th>
              <th className="px-4 py-3 text-left font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">Joined</th>
              {canManage && <th className="w-24 px-4 py-3" />}
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
                      <RoleDropdown
                        value={m.role}
                        onChange={(newRole) => {
                          if (newRole !== m.role) setConfirm({ type: 'role', member: m, newRole });
                        }}
                      />
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
                          onClick={() => setConfirm({ type: 'remove', member: m })}
                          title={`Remove ${m.username}`}
                          className="inline-flex h-7 w-7 items-center justify-center rounded text-ink-400 transition-colors hover:bg-base-800 hover:text-red-400"
                        >
                          <UserMinus size={13} />
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

      {/* Invite form */}
      {canManage && (
        <div>
          <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-400">Add member</h3>
          <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-3">

            {/* Search input */}
            <div className="relative flex-1 min-w-[220px]">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setSelectedUser(null); }}
                  onFocus={() => { if (results.length) setDropdownOpen(true); }}
                  onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
                  placeholder="Search by username or email…"
                  className="w-full rounded-md border border-base-700 bg-base-950 px-3 py-2 text-[13px] text-white outline-none placeholder:text-ink-500 focus:border-amber-500"
                />
                {searching && (
                  <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-ink-500" />
                )}
              </div>

              <AnimatePresence>
                {dropdownOpen && (
                  <motion.ul
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.12 }}
                    className="absolute left-0 top-full z-20 mt-1 w-full rounded-md border border-base-700 bg-base-900 py-1 shadow-xl"
                  >
                    {results.length === 0 ? (
                      <li className="px-3 py-2 text-[12px] text-ink-500">No users found</li>
                    ) : (
                      results.map((u) => (
                        <li key={u.id}>
                          <button
                            type="button"
                            onMouseDown={() => handlePickUser(u)}
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
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>

            {/* Role */}
            <RoleDropdown value={inviteRole} onChange={setInviteRole} />

            <button
              type="submit"
              disabled={inviting || !selectedUser}
              className="rounded-md bg-amber-500 px-4 py-2 text-[13px] font-semibold text-base-950 transition-colors hover:bg-amber-400 disabled:opacity-40"
            >
              {inviting ? 'Adding…' : 'Add'}
            </button>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        title={confirmTitle}
        body={confirmBody}
        confirmLabel={confirm?.type === 'remove' ? 'Remove' : 'Confirm'}
        danger={confirm?.type === 'remove'}
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
