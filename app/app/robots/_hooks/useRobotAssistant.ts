'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { sendRobotAssistantMessage } from '@/services/api/robotAssistant';
import type {
  RobotAssistantAction,
  RobotAssistantDraft,
  RobotAssistantEvent,
  RobotAssistantState,
} from '@/services/api/robotAssistant';
import type { ApiRobotCommand, ApiRobotMission } from '@/types/api';
import { isActiveMissionStatus } from '../_lib/missions';
import { parseUtcTimestamp } from '../_lib/robotMap';

export type AssistantMessage = {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  error?: boolean;
};

type Options = {
  projectSlug: string;
  robotId: string;
  connected: boolean;
  /** The robot's latest connect/disconnect command, to tell when one the assistant asked for fails. */
  latestCommand: ApiRobotCommand | null;
  missions: ApiRobotMission[];
  onAction: (action: RobotAssistantAction) => void;
  /** The route or schedule being built in the chat, so the page can show it filling in. */
  onDraft: (draft: RobotAssistantDraft | null) => void;
  /** Called with every assistant reply; `voice` says whether the request came by voice. */
  onReply?: (reply: string, voice: boolean) => void;
};

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Holds the assistant conversation for the robots page. It lives on the page rather than in the
 * chat panel so the conversation survives closing the panel, and so it can follow up by itself:
 * when a capture it started finishes, or a connect/disconnect it asked for completes, it says so.
 */
export function useRobotAssistant({
  projectSlug,
  robotId,
  connected,
  latestCommand,
  missions,
  onAction,
  onDraft,
  onReply,
}: Options) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [sending, setSending] = useState(false);
  /* One request at a time; anything sent meanwhile waits its turn instead of being dropped. */
  const busy = useRef(false);
  const queue = useRef<Array<{ text: string; voice: boolean; history: AssistantMessage[] }>>([]);
  const messagesRef = useRef<AssistantMessage[]>([]);
  messagesRef.current = messages;
  const stateRef = useRef<RobotAssistantState | null>(null);
  const nextId = useRef(1);
  const lastVoice = useRef(false);
  /* Things the assistant started and will report on when they finish. */
  const watchedMissions = useRef(new Set<string>());
  const pendingConnection = useRef<'connect' | 'disconnect' | null>(null);
  const connectRequestedAt = useRef(0);
  const callbacks = useRef({ onAction, onDraft, onReply });
  callbacks.current = { onAction, onDraft, onReply };

  const push = useCallback((message: Omit<AssistantMessage, 'id'>) => {
    const id = nextId.current++;
    setMessages((current) => [...current, { ...message, id }]);
  }, []);

  // A new project or robot is a new conversation.
  useEffect(() => {
    stateRef.current = null;
    watchedMissions.current.clear();
    pendingConnection.current = null;
    setMessages([]);
    callbacks.current.onDraft(null);
  }, [projectSlug, robotId]);

  const post = useCallback(
    async (
      message: string,
      voice: boolean,
      extra: { event?: RobotAssistantEvent; missionId?: string; history?: AssistantMessage[] } = {},
    ) => {
      if (!projectSlug || !robotId) {
        push({ role: 'assistant', text: 'Pick a project and a robot first.', error: true });
        return;
      }
      busy.current = true;
      setSending(true);
      try {
        const response = await sendRobotAssistantMessage({
          project_slug: projectSlug,
          robot_id: robotId,
          message,
          state: stateRef.current,
          timezone: browserTimezone(),
          robot_connected: connected,
          voice,
          event: extra.event,
          mission_id: extra.missionId,
          history: (extra.history ?? [])
            .filter((turn) => !turn.error)
            .slice(-8)
            .map(({ role, text }) => ({ role, text })),
        });
        stateRef.current = response.state;
        callbacks.current.onDraft(response.draft);
        if (response.reply) {
          push({ role: 'assistant', text: response.reply });
          callbacks.current.onReply?.(response.reply, voice);
        }
        const action = response.action;
        if (action) {
          if (action.type === 'mission_started' && action.mission_id) watchedMissions.current.add(action.mission_id);
          if (action.type === 'robot_connecting') {
            pendingConnection.current = 'connect';
            connectRequestedAt.current = Date.now();
          }
          if (action.type === 'robot_disconnecting') pendingConnection.current = 'disconnect';
          callbacks.current.onAction(action);
        }
      } catch (err) {
        const text = err instanceof Error ? err.message : 'Could not reach the assistant.';
        push({ role: 'assistant', text, error: true });
        callbacks.current.onReply?.(text, voice);
      } finally {
        busy.current = false;
        setSending(false);
      }
    },
    [connected, projectSlug, push, robotId],
  );

  const drain = useCallback(async () => {
    while (!busy.current && queue.current.length) {
      const next = queue.current.shift()!;
      await post(next.text, next.voice, { history: next.history });
    }
  }, [post]);

  const send = useCallback(
    async (text: string, { voice = false }: { voice?: boolean } = {}) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      lastVoice.current = voice;
      const history = [...messagesRef.current];
      push({ role: 'user', text: trimmed });
      queue.current.push({ text: trimmed, voice, history });
      await drain();
    },
    [drain, push],
  );

  // Messages sent while a reply was on its way go out as soon as it lands.
  useEffect(() => {
    if (!sending && queue.current.length) void drain();
  }, [drain, sending]);

  /* Only a failure of the connect the assistant asked for counts, never an older one. The
   * allowance covers clock skew between this browser and the backend. */
  const connectFailure = (() => {
    if (!latestCommand || latestCommand.kind !== 'connect' || latestCommand.status !== 'failed') return null;
    const created = parseUtcTimestamp(latestCommand.created_at) ?? 0;
    if (created < connectRequestedAt.current - 30000) return null;
    return latestCommand.detail || 'the connection attempt failed';
  })();

  // A connect or disconnect the assistant asked for: report when it lands (or fails). A waiting
  // "connect first, then go" also starts its capture from here.
  useEffect(() => {
    const pending = pendingConnection.current;
    if (!pending || sending) return;
    if (pending === 'connect' && connected) {
      pendingConnection.current = null;
      void post('', lastVoice.current, { event: 'robot_connected' });
    } else if (pending === 'connect' && connectFailure) {
      pendingConnection.current = null;
      void post(connectFailure, lastVoice.current, { event: 'robot_connect_failed' });
    } else if (pending === 'disconnect' && !connected) {
      pendingConnection.current = null;
      void post('', lastVoice.current, { event: 'robot_disconnected' });
    }
  }, [connectFailure, connected, post, sending]);

  // A capture the assistant started: report how it ended.
  useEffect(() => {
    if (sending || watchedMissions.current.size === 0) return;
    const finished = missions.find(
      (mission) => watchedMissions.current.has(mission.id) && !isActiveMissionStatus(mission.status),
    );
    if (!finished) return;
    watchedMissions.current.delete(finished.id);
    void post('', lastVoice.current, { event: 'mission_finished', missionId: finished.id });
  }, [missions, post, sending]);

  const reset = useCallback(() => {
    stateRef.current = null;
    queue.current = [];
    setMessages([]);
    callbacks.current.onDraft(null);
  }, []);

  return { messages, sending, send, reset };
}
