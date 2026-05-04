import { ViewerStub } from '@/components/explorer/ViewerStub';

export default function PointCloudViewerPage() {
  return (
    <ViewerStub
      kind="Point cloud"
      phase="Phase 7"
      description="Embedded Potree iframe with the report-builder overlay; conversion status polled until the cloud is ready."
    />
  );
}
