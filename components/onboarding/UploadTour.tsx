'use client';

import { useEffect } from 'react';
import { CoachmarkTour, type CoachmarkStep } from './CoachmarkTour';

type Props = {
  /** Whether the parent Uploader panel is open. The tour calls onOpenUploader
   *  defensively if it advances past step 2 while the panel is still closed. */
  uploaderOpen: boolean;
  onOpenUploader: () => void;
  /** Called by the tour at step 5 (staging). Parent should set demoMode on
   *  UploadZone to true. */
  onActivateDemo: () => void;
  /** Called by the tour at any step other than 5, or when it closes. */
  onDeactivateDemo: () => void;
};

const STAGING_STEP_INDEX = 4;

const STEPS: CoachmarkStep[] = [
  {
    title: 'Upload your first files',
    body: "We'll walk through staging files for upload. A demo image will be injected at the staging step so you can see the UI without sending anything to the server.",
  },
  {
    targetSelector: '[data-tour="upload-button"]',
    title: 'Open the uploader',
    body: 'Tap Upload to reveal the uploader panel for this day.',
    placement: 'bottom',
    waitForClick: true,
  },
  {
    targetSelector: '[data-tour="upload-room-picker"]',
    title: 'Pick a room',
    body: 'Choose which room these files belong to. You can type to filter the list.',
    placement: 'bottom',
  },
  {
    targetSelector: '[data-tour="upload-zone"]',
    title: 'Drop or browse',
    body: 'Drag files onto this zone, or click "choose files". Photos, videos, PDFs, and 3D point clouds are all supported.',
    placement: 'top',
  },
  {
    targetSelector: '[data-tour="upload-staging"]',
    title: 'Review and confirm',
    body: 'This is the staging view. Review files, remove anything you don\'t want, then click "Upload" at the bottom. Click "Got it" to end the tour — the demo file will be discarded.',
    placement: 'auto',
  },
];

export function UploadTour({ uploaderOpen, onOpenUploader, onActivateDemo, onDeactivateDemo }: Props) {
  // Defensive: when tour goes past step 2 without the panel opening, open it.
  // (e.g. user clicked Prev from step 3 back to step 2 then Next again without
  // re-clicking the Upload button.)
  useEffect(() => {
    return () => { onDeactivateDemo(); };
  }, [onDeactivateDemo]);

  return (
    <CoachmarkTour
      id="upload-flow"
      steps={STEPS}
      onStepChange={(i) => {
        if (i === STAGING_STEP_INDEX) {
          onActivateDemo();
        } else {
          onDeactivateDemo();
        }
        if (i >= 2 && !uploaderOpen) onOpenUploader();
      }}
      onClose={() => onDeactivateDemo()}
    />
  );
}
