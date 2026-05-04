import { ViewerStub } from '@/components/explorer/ViewerStub';

export default function PotreeViewerPage() {
  return (
    <ViewerStub
      kind="Potree"
      phase="Phase 7"
      description="Native Potree iframe (no overlay). Used when the user wants the raw renderer."
    />
  );
}
