import { LandingNav } from '@/components/landing/LandingNav';
import { ScrollProgress } from '@/components/landing/ScrollProgress';
import { Hero } from '@/components/landing/Hero';
import { DataModel } from '@/components/landing/DataModel';
import { Viewers } from '@/components/landing/Viewers';
import { ReportLoop } from '@/components/landing/ReportLoop';
import { CompareSection } from '@/components/landing/CompareSection';
import { Roles } from '@/components/landing/Roles';
import { Footer } from '@/components/landing/Footer';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-base-950 text-white">
      <ScrollProgress />
      <LandingNav />
      <main>
        <Hero />
        <DataModel />
        <Viewers />
        <ReportLoop />
        <CompareSection />
        <Roles />
      </main>
      <Footer />
    </div>
  );
}
