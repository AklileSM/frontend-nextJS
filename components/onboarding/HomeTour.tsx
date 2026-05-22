'use client';

import { CoachmarkTour, type CoachmarkStep } from './CoachmarkTour';

const STEPS: CoachmarkStep[] = [
  {
    title: 'Welcome to your project',
    body: "Quick tour of what's on this page and how to get to your files. Use Next / Prev to step through. Pick \"Don't show again\" to skip this tour for good.",
  },
  {
    targetSelector: '[data-tour="home-floorplan"]',
    title: 'Floorplan & hotspots',
    body: 'Each room is a clickable hotspot on the floorplan. Click one to jump straight into that room’s files.',
    placement: 'right',
  },
  {
    targetSelector: '[data-tour="home-charts"]',
    title: 'Charts & calendar',
    body: 'Capture activity per room and over time. Hover a chart bar to highlight the room on the floorplan. The Calendar tab here shows when files were captured.',
    placement: 'left',
  },
  {
    targetSelector: '[data-tour="home-settings"]',
    title: 'Project settings',
    body: 'Rename rooms, upload a floorplan, draw room hotspots, manage members — everything project-level lives in Settings.',
    placement: 'bottom',
  },
  {
    targetSelector: '[data-tour="sidebar-nav"]',
    title: 'Sidebar navigation',
    body: 'Use the sidebar to jump between Home, the full projects list, and (for admins) the platform admin panel.',
    placement: 'right',
  },
  {
    targetSelector: '[data-tour="sidebar-project-accordion"]',
    title: 'Project & rooms',
    body: 'Expand a project in the sidebar to jump straight into a specific room without going through the home page.',
    placement: 'right',
  },
  {
    targetSelector: '[data-tour="sidebar-calendar"]',
    title: 'Pick a date to upload',
    body: 'Files live inside a room on a specific date. Click any day on this calendar to open the file explorer for that day. Try it now to continue.',
    placement: 'right',
    waitForClick: true,
  },
];

export function HomeTour() {
  return <CoachmarkTour id="home-tour" steps={STEPS} lockBackground />;
}
