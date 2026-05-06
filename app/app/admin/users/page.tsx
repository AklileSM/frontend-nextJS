'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Shield, ShieldOff, UserCheck, UserX } from 'lucide-react';
import { listAdminUsers, updateAdminUser } from '@/services/apiClient';
import { formatIsoDate } from '@/services/dateFormat';
import type { AdminUser } from '@/types/api';

export const dynamic = 'force-dynamic';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listAdminUsers();
      setUsers(data);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = useCallback(
    async (user: AdminUser, field: 'is_admin' | 'is_active') => {
      const newValue = !user[field];
      try {
        const updated = await updateAdminUser(user.id, { [field]: newValue });
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        toast.success(
          field === 'is_admin'
            ? `${user.username} is now ${newValue ? 'an admin' : 'a regular member'}`
            : `${user.username} ${newValue ? 'activated' : 'deactivated'}`,
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Update failed');
      }
    },
    [],
  );

  return (
    <div className="px-6 py-10 sm:px-10 lg:px-12 xl:px-16">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <p className="font-mono text-[12px] uppercase tracking-[0.22em] text-amber-500">
          Admin · Users
        </p>
        <h1 className="mt-3 font-display text-[36px] font-semibold tracking-tight text-white">
          User management
        </h1>
        <p className="mt-2 text-[14px] text-ink-300">
          {users.length} registered {users.length === 1 ? 'account' : 'accounts'}
        </p>
      </motion.section>

      <div className="mt-8 overflow-x-auto rounded-lg border border-base-800">
        {loading ? (
          <div className="p-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="mb-3 h-10 animate-pulse rounded bg-base-800" />
            ))}
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-base-800 bg-base-900/60">
                <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">
                  Username
                </th>
                <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">
                  Email
                </th>
                <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">
                  Joined
                </th>
                <th className="px-4 py-3 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">
                  Admin
                </th>
                <th className="px-4 py-3 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">
                  Active
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, i) => (
                <tr
                  key={user.id}
                  className={`border-b border-base-800/60 ${
                    i % 2 === 0 ? 'bg-base-900/20' : 'bg-transparent'
                  } hover:bg-base-800/30 transition-colors`}
                >
                  <td className="px-4 py-3 font-medium text-white">{user.username}</td>
                  <td className="px-4 py-3 text-ink-300">{user.email ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-ink-400">
                    {formatIsoDate(user.created_at)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => toggle(user, 'is_admin')}
                      title={user.is_admin ? 'Revoke admin' : 'Grant admin'}
                      className={`inline-flex h-7 w-7 items-center justify-center rounded transition-colors ${
                        user.is_admin
                          ? 'text-amber-500 hover:bg-amber-500/10'
                          : 'text-ink-500 hover:bg-base-800 hover:text-ink-200'
                      }`}
                    >
                      {user.is_admin ? <Shield size={14} /> : <ShieldOff size={14} />}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => toggle(user, 'is_active')}
                      title={user.is_active ? 'Deactivate' : 'Activate'}
                      className={`inline-flex h-7 w-7 items-center justify-center rounded transition-colors ${
                        user.is_active
                          ? 'text-green-500 hover:bg-green-500/10'
                          : 'text-red-500 hover:bg-red-500/10'
                      }`}
                    >
                      {user.is_active ? <UserCheck size={14} /> : <UserX size={14} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
