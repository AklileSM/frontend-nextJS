import { ViewerStub } from '@/components/explorer/ViewerStub';

export default function PdfViewerPage() {
  return (
    <ViewerStub
      kind="PDF"
      phase="Phase 7"
      description="In-browser PDF viewer that streams private files with the auth header, so MinIO links never need to be public."
    />
  );
}
