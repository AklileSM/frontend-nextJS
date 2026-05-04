import { ViewerStub } from '@/components/explorer/ViewerStub';

export const dynamic = 'force-dynamic';

export default function StaticViewerPage() {
  return (
    <ViewerStub
      kind="Static"
      phase="Phase 6"
      description="Pan/zoom on the image, place annotation pins, run AI analysis, build a draft, publish a PDF report."
    />
  );
}
