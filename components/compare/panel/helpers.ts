/** Pure helpers used by the Compare panel and its sub-components. */

/** YYYY-MM-DD key for an ISO timestamp, in the user's local timezone.
 *  Used to group comparison drafts by the calendar day they were saved on. */
export function draftSavedDayKeyLocal(iso: string): string {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return '';
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, '0');
  const d = String(t.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** "Apr 1, 2026" formatting of a YYYY-MM-DD key, in the user's locale. */
export function formatLocalDayMedium(dateKey: string): string {
  const [y, mo, day] = dateKey.split('-').map(Number);
  if (!y || !mo || !day) return dateKey;
  return new Date(y, mo - 1, day).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

/** Best-effort sniff for point-cloud-shaped URLs. Used as a fallback when the
 *  API response does not set `media_type: pointcloud`. */
export function isPCDUrl(url: string): boolean {
  return /\.(glb|obj|e57|las|laz|ply)(\?|$)/i.test(url.split('?')[0]);
}
