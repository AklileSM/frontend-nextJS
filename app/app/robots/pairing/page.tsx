'use client';

import { RobotPairingManager } from '@/components/robots/RobotPairingManager';

export const dynamic = 'force-dynamic';

export default function RobotPairingPage() {
  return (
    <RobotPairingManager
      headingPrefix="Operations · Robot pairing"
      heading="Pair a robot"
      intro="Project owners can create and revoke pairing tokens only for projects they own."
    />
  );
}
