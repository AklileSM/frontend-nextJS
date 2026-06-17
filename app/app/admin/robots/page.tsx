'use client';

import { RobotPairingManager } from '@/components/robots/RobotPairingManager';

export const dynamic = 'force-dynamic';

export default function AdminRobotPairingsPage() {
  return (
    <RobotPairingManager
      headingPrefix="Admin · Robot pairing"
      heading="Pairing tokens"
      intro="Create one-time bootstrap tokens for Jetson agents. Admins can manage all tokens platform-wide."
    />
  );
}
