import { ViewerStub } from '@/components/explorer/ViewerStub';

export const dynamic = 'force-dynamic';

export default function PotreeViewerPage() {
  return (
    <ViewerStub
      kind="Potree"
      phase="Phase 7"
      description="Native Potree iframe (no overlay). Used when the user wants the raw renderer."
    />
  );
}
