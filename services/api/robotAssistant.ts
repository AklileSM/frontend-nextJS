import { apiFetch, getJson } from './core';

/** Opaque conversation state: returned with each reply and sent back unchanged with the next message. */
export type RobotAssistantState = Record<string, unknown> & { awaiting?: string | null };

export type RobotAssistantTab = 'route' | 'schedules' | 'progress' | 'live' | 'history';

export type RobotAssistantAction = {
  type:
    | 'mission_started'
    | 'mission_cancelled'
    | 'mission_stopped'
    | 'robot_connecting'
    | 'robot_disconnecting'
    | 'schedule_created'
    | 'schedule_enabled'
    | 'schedule_updated'
    | 'schedule_deleted'
    | 'open_tab';
  mission_id?: string;
  schedule_id?: string;
  /** For open_tab: which robots-page tab to show. */
  tab?: RobotAssistantTab;
};

/** What the conversation is building, so the page can show it filling in. */
export type RobotAssistantDraft =
  | { kind: 'route'; point_ids: string[]; capture: Array<'image' | 'pointcloud'>; focus: string | null }
  | {
      kind: 'schedule';
      name: string;
      point_ids: string[];
      time: string | null;
      weekdays: number[];
      capture: Array<'image' | 'pointcloud'>;
      /** The field being asked about right now. */
      focus: string | null;
    };

/** Things that happened outside the chat that the assistant reports on. */
export type RobotAssistantEvent = 'robot_connected' | 'robot_disconnected' | 'robot_connect_failed' | 'mission_finished';

export type RobotAssistantMessageRequest = {
  project_slug: string;
  robot_id: string;
  message: string;
  state: RobotAssistantState | null;
  timezone: string;
  robot_connected: boolean;
  voice: boolean;
  event?: RobotAssistantEvent;
  mission_id?: string;
  /** Recent turns, oldest first, so conversational replies can follow the chat. */
  history: { role: 'user' | 'assistant'; text: string }[];
};

export type RobotAssistantMessageResponse = {
  reply: string;
  state: RobotAssistantState | null;
  action: RobotAssistantAction | null;
  draft: RobotAssistantDraft | null;
};

export function sendRobotAssistantMessage(body: RobotAssistantMessageRequest): Promise<RobotAssistantMessageResponse> {
  return getJson<RobotAssistantMessageResponse>('/robot/assistant/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** A reply spoken by the server's voice (Kokoro), as MP3. Throws when that voice isn't available. */
export async function fetchRobotAssistantSpeech(text: string, signal?: AbortSignal): Promise<Blob> {
  const response = await apiFetch('/robot/assistant/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal,
  });
  if (!response.ok) throw new Error(`Assistant voice unavailable (${response.status})`);
  return response.blob();
}
