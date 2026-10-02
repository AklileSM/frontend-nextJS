import type { Metadata } from 'next';
import { DemoPlayer } from './DemoPlayer';

export const metadata: Metadata = {
  title: 'Demo | SiteScope',
  description: 'See how SiteScope turns construction captures into organised, reviewable site records.',
};

export default function DemoPage() {
  return <DemoPlayer />;
}
