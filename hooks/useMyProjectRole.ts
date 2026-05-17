'use client';

import { useEffect, useState } from 'react';
import { listProjectMembers } from '@/services/apiClient';
import { useAuth } from '@/context/AuthContext';
import type { ApiProjectMember } from '@/types/api';

export function useMyProjectRole(projectId: string | null | undefined) {
  const { user } = useAuth();
  const [role, setRole] = useState<ApiProjectMember['role'] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!projectId || !user) { setRole(null); return; }
    let cancelled = false;
    setLoading(true);
    listProjectMembers(projectId)
      .then((members) => {
        if (cancelled) return;
        const me = members.find((m) => m.user_id === user.id);
        setRole(me?.role ?? null);
      })
      .catch(() => { if (!cancelled) setRole(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId, user]);

  const canUpload =
    user?.is_admin || role === 'owner' || role === 'editor';

  // Match the backend's _can_delete_file (admin or owner/editor). Editors
  // upload files so they should be able to clean up their own mess too.
  const canDelete =
    user?.is_admin || role === 'owner' || role === 'editor';

  const canManageSettings =
    user?.is_admin || role === 'owner';

  return { role, loading, canUpload, canDelete, canManageSettings };
}
