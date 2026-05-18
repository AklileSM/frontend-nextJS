/**
 * Re-export shim.
 *
 * The API client used to be a single 1300-line file. It was split into
 * domain-specific modules under `services/api/*`. This file stays as a
 * stable import point so existing call sites (`@/services/apiClient`)
 * keep working without changes.
 *
 * New code should import directly from the domain module:
 *   import { listProjects } from '@/services/api/projects';
 *
 * Old code remains valid:
 *   import { listProjects } from '@/services/apiClient';
 */
export * from './api/core';
export * from './api/auth';
export * from './api/admin';
export * from './api/rooms';
export * from './api/projects';
export * from './api/files';
export * from './api/upload';
export * from './api/ai';
export * from './api/annotations';
export * from './api/reports';
