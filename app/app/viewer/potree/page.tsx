import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function PotreeViewerPage() {
  redirect('/app/viewer/point-cloud');
}
