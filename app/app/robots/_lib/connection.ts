import type { ApiRobotCommand, ApiRobotConnection } from '@/types/api';
import { parseUtcTimestamp } from './robotMap';

/* The button and chip both read off the robot's latest lifecycle command. "busy" means a
 * connect/disconnect is still in flight, so the control locks and the tree polls quickly. */
export type ConnectionView = {
  connection: ApiRobotConnection;
  busy: boolean;
  label: string;
  tone: string;
  dot: string;
};

const ACTIVE_STATUSES = ['queued', 'dispatched', 'running'];

const NEUTRAL = 'border-base-800 bg-base-950 text-ink-400';
const AMBER = 'border-amber-500/30 bg-amber-500/10 text-amber-200';
const EMERALD = 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
const RED = 'border-red-500/30 bg-red-500/10 text-red-200';

export function isCommandActive(command: ApiRobotCommand | null): boolean {
  return command ? ACTIVE_STATUSES.includes(command.status) : false;
}

export function deriveConnection(command: ApiRobotCommand | null): ConnectionView {
  if (!command) {
    return { connection: 'disconnected', busy: false, label: 'Not connected', tone: NEUTRAL, dot: 'bg-ink-500' };
  }

  if (isCommandActive(command)) {
    const connecting = command.kind === 'connect';
    return {
      connection: connecting ? 'connecting' : 'disconnecting',
      busy: true,
      label: connecting ? 'Connecting…' : 'Disconnecting…',
      tone: AMBER,
      dot: 'bg-amber-400',
    };
  }

  if (command.status === 'succeeded') {
    if (command.kind === 'connect') {
      return { connection: 'connected', busy: false, label: 'Connected', tone: EMERALD, dot: 'bg-emerald-400' };
    }
    return { connection: 'disconnected', busy: false, label: 'Not connected', tone: NEUTRAL, dot: 'bg-ink-500' };
  }

  // Cancelled is a clean "not connected", not a failure.
  if (command.status === 'cancelled') {
    return { connection: 'disconnected', busy: false, label: 'Not connected', tone: NEUTRAL, dot: 'bg-ink-500' };
  }

  // Failed: the stack is not usable.
  return {
    connection: 'disconnected',
    busy: false,
    label: command.kind === 'connect' ? 'Connection failed' : 'Not connected',
    tone: command.kind === 'connect' ? RED : NEUTRAL,
    dot: command.kind === 'connect' ? 'bg-red-400' : 'bg-ink-500',
  };
}

/**
 * Resolve current physical state from two independent timelines:
 *
 * - lifecycle commands describe requested work and may be cancelled while the panel continues;
 * - heartbeats report what the local control panel says is physically true.
 *
 * Whichever observation is newer wins. This preserves immediate command feedback while ensuring
 * the next heartbeat repairs cancellation races instead of leaving the UI permanently stale.
 */
export function deriveCurrentConnection(
  command: ApiRobotCommand | null,
  heartbeatConnection: ApiRobotConnection | null | undefined,
  heartbeatAt: string | null | undefined,
  robotOnline: boolean,
): ApiRobotConnection {
  if (!robotOnline) return 'disconnected';

  const commandView = deriveConnection(command);
  if (!heartbeatConnection) return commandView.connection;
  if (!command) return heartbeatConnection;

  const commandAt = parseUtcTimestamp(command.completed_at ?? command.created_at);
  const reportedAt = parseUtcTimestamp(heartbeatAt);
  if (commandAt !== null && (reportedAt === null || commandAt > reportedAt)) {
    return commandView.connection;
  }
  return heartbeatConnection;
}
