import { ViewerStub } from '@/components/explorer/ViewerStub';

export const dynamic = 'force-dynamic';

export default function PanoramaViewerPage() {
  return (
    <ViewerStub
      kind="Panorama"
      phase="Phase 6"
      description="Three.js sphere with orbit controls plus the same annotation, AI, draft, and report-publish panel."
    />
  );
}
