'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Loader2, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  createRobotMissionSchedule,
  deleteRobotMissionSchedule,
  listRobotMissionSchedules,
  runRobotMissionSchedule,
  updateRobotMissionSchedule,
} from '@/services/apiClient';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import type {
  ApiRobotCapturePoint,
  ApiRobotMissionSchedule,
} from '@/types/api';
import type {
  ApiRobotMissionScheduleRequest,
  ApiRobotMissionScheduleUpdateRequest,
} from '@/services/api/robots';
import type { CaptureOutput } from '../_lib/missions';

const DAYS = [
  { value: 0, short: 'M', label: 'Monday' },
  { value: 1, short: 'T', label: 'Tuesday' },
  { value: 2, short: 'W', label: 'Wednesday' },
  { value: 3, short: 'T', label: 'Thursday' },
  { value: 4, short: 'F', label: 'Friday' },
  { value: 5, short: 'S', label: 'Saturday' },
  { value: 6, short: 'S', label: 'Sunday' },
] as const;

type FormState = {
  name: string;
  capturePointIds: string[];
  localTime: string;
  timezone: string;
  weekdays: number[];
  captureOutputs: CaptureOutput[];
  continueOnFailure: boolean;
  busyPolicy: 'skip' | 'queue';
  autoConnect: boolean;
  maxLatenessMinutes: number;
};

type Props = {
  projectSlug: string;
  robotId: string;
  capturePoints: ApiRobotCapturePoint[];
  onMissionQueued: () => void;
};

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Dubai';
  } catch {
    return 'Asia/Dubai';
  }
}

function emptyForm(): FormState {
  return {
    name: '',
    capturePointIds: [],
    localTime: '17:00',
    timezone: browserTimezone(),
    weekdays: DAYS.map((day) => day.value),
    captureOutputs: ['image'],
    continueOnFailure: true,
    busyPolicy: 'skip',
    autoConnect: true,
    maxLatenessMinutes: 30,
  };
}

function scheduleOutputs(schedule: ApiRobotMissionSchedule): CaptureOutput[] {
  const configured = schedule.robot_meta.capture_outputs;
  if (Array.isArray(configured)) {
    const outputs = configured.filter(
      (item): item is CaptureOutput => item === 'image' || item === 'pointcloud',
    );
    if (outputs.length) return outputs;
  }
  return schedule.capture_mode === 'pointcloud' ? ['pointcloud'] : ['image'];
}

function formFromSchedule(schedule: ApiRobotMissionSchedule): FormState {
  return {
    name: schedule.name,
    capturePointIds: schedule.capture_point_ids,
    localTime: schedule.local_time,
    timezone: schedule.timezone,
    weekdays: schedule.weekdays,
    captureOutputs: scheduleOutputs(schedule),
    continueOnFailure: Boolean(schedule.retry_policy.continue_on_failure),
    busyPolicy: schedule.busy_policy,
    autoConnect: schedule.auto_connect,
    maxLatenessMinutes: schedule.max_lateness_minutes,
  };
}

function recurrenceLabel(weekdays: number[]): string {
  if (weekdays.length === 7) return 'Every day';
  if (
    weekdays.length === 5
    && [0, 1, 2, 3, 4].every((day) => weekdays.includes(day))
  ) return 'Weekdays';
  return DAYS.filter((day) => weekdays.includes(day.value))
    .map((day) => day.label.slice(0, 3))
    .join(', ');
}

function utcDate(value: string): Date {
  return new Date(/[zZ]$|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);
}

function nextRunLabel(schedule: ApiRobotMissionSchedule): string {
  if (!schedule.enabled) return 'Paused';
  if (!schedule.next_run_at) return 'No upcoming run';
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: schedule.timezone,
    timeZoneName: 'short',
  }).format(utcDate(schedule.next_run_at));
}

export function SchedulesTab({
  projectSlug,
  robotId,
  capturePoints,
  onMissionQueued,
}: Props) {
  const [schedules, setSchedules] = useState<ApiRobotMissionSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ApiRobotMissionSchedule | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ApiRobotMissionSchedule | null>(null);

  const pointById = useMemo(
    () => new Map(capturePoints.map((point) => [point.id, point])),
    [capturePoints],
  );

  const load = useCallback(async () => {
    if (!projectSlug || !robotId) {
      setSchedules([]);
      setLoading(false);
      return;
    }
    const data = await listRobotMissionSchedules({ projectSlug, robotId });
    setSchedules(data);
  }, [projectSlug, robotId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load()
      .catch((err) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Could not load schedules');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (schedule: ApiRobotMissionSchedule) => {
    setEditing(schedule);
    setForm(formFromSchedule(schedule));
    setFormOpen(true);
  };

  const togglePoint = (pointId: string) => {
    setForm((current) => ({
      ...current,
      capturePointIds: current.capturePointIds.includes(pointId)
        ? current.capturePointIds.filter((id) => id !== pointId)
        : [...current.capturePointIds, pointId],
    }));
  };

  const toggleDay = (day: number) => {
    setForm((current) => ({
      ...current,
      weekdays: current.weekdays.includes(day)
        ? current.weekdays.filter((value) => value !== day)
        : [...current.weekdays, day].sort(),
    }));
  };

  const toggleOutput = (output: CaptureOutput) => {
    setForm((current) => {
      const selected = current.captureOutputs.includes(output);
      if (selected && current.captureOutputs.length === 1) return current;
      return {
        ...current,
        captureOutputs: selected
          ? current.captureOutputs.filter((item) => item !== output)
          : [...current.captureOutputs, output],
      };
    });
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Name the schedule');
      return;
    }
    if (!form.capturePointIds.length) {
      toast.error('Choose at least one stop');
      return;
    }
    if (!form.weekdays.length) {
      toast.error('Choose at least one day');
      return;
    }

    const body: ApiRobotMissionScheduleRequest = {
      name: form.name.trim(),
      robot_id: robotId,
      project_slug: projectSlug,
      capture_point_ids: form.capturePointIds,
      local_time: form.localTime,
      timezone: form.timezone.trim(),
      weekdays: form.weekdays,
      capture_mode: form.captureOutputs.includes('image') ? 'panorama' : 'pointcloud',
      retry_policy: { continue_on_failure: form.continueOnFailure },
      robot_meta: { capture_outputs: form.captureOutputs },
      busy_policy: form.busyPolicy,
      auto_connect: form.autoConnect,
      max_lateness_minutes: form.maxLatenessMinutes,
    };

    setSaving(true);
    try {
      if (editing) {
        const update: ApiRobotMissionScheduleUpdateRequest = { ...body };
        delete update.robot_id;
        delete update.project_slug;
        await updateRobotMissionSchedule(editing.id, update);
        toast.success('Schedule updated');
      } else {
        await createRobotMissionSchedule(body);
        toast.success('Recurring schedule created');
      }
      setFormOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the schedule');
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (schedule: ApiRobotMissionSchedule) => {
    try {
      await updateRobotMissionSchedule(schedule.id, { enabled: !schedule.enabled });
      toast.success(schedule.enabled ? 'Schedule paused' : 'Schedule resumed');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update the schedule');
    }
  };

  const runNow = async (schedule: ApiRobotMissionSchedule) => {
    setRunningId(schedule.id);
    try {
      await runRobotMissionSchedule(schedule.id);
      toast.success('Scheduled task queued');
      await load();
      onMissionQueued();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not queue the task');
    } finally {
      setRunningId(null);
    }
  };

  const deleteSchedule = async () => {
    if (!deleting) return;
    try {
      await deleteRobotMissionSchedule(deleting.id);
      toast.success('Schedule deleted');
      setDeleting(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete the schedule');
    }
  };

  if (loading) {
    return <div className="h-64 animate-pulse rounded-2xl border border-base-800 bg-base-900/50" />;
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-base-800 bg-base-950/60 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="mt-2 font-display text-[20px] font-semibold text-white">
              Recurring captures
            </h2>
            <p className="mt-1 text-[13px] text-ink-400">
              Queue an ordered route automatically on selected days.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            disabled={!projectSlug || !robotId || !capturePoints.length}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-[13px] font-medium text-base-950 transition hover:bg-amber-400 disabled:opacity-40"
          >
            <Plus size={14} />
            New schedule
          </button>
        </div>

        {!capturePoints.length ? (
          <div className="rounded-2xl border border-dashed border-base-700 px-5 py-12 text-center">
            <CalendarClock size={20} className="mx-auto text-ink-500" />
            <p className="mt-3 text-[14px] text-ink-300">Create capture points before scheduling a route.</p>
          </div>
        ) : schedules.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-base-700 px-5 py-12 text-center">
            <CalendarClock size={20} className="mx-auto text-ink-500" />
            <p className="mt-3 text-[14px] text-ink-300">No recurring schedules yet.</p>
            <p className="mt-1 text-[13px] text-ink-500">For example: every day at 5:00 PM.</p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {schedules.map((schedule) => {
              const route = schedule.capture_point_ids.map(
                (id) => pointById.get(id)?.name ?? 'Missing point',
              );
              return (
                <article
                  key={schedule.id}
                  className="rounded-2xl border border-base-800 bg-base-950/60 p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${schedule.enabled ? 'bg-emerald-400' : 'bg-ink-600'}`} />
                        <h3 className="truncate text-[15px] font-medium text-white">{schedule.name}</h3>
                      </div>
                      <p className="mt-2 text-[13px] text-ink-300">
                        {recurrenceLabel(schedule.weekdays)} at {schedule.local_time}
                      </p>
                      <p className="mt-1 text-[12px] text-ink-500">{nextRunLabel(schedule)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void toggleEnabled(schedule)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                        schedule.enabled
                          ? 'border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10'
                          : 'border-base-700 text-ink-400 hover:border-ink-500'
                      }`}
                    >
                      {schedule.enabled ? 'Active' : 'Paused'}
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-1.5">
                    {route.map((name, index) => (
                      <span key={`${schedule.id}-${index}`} className="inline-flex items-center gap-1.5 text-[12px] text-ink-300">
                        {index > 0 ? <span className="text-ink-600">→</span> : null}
                        {name}
                      </span>
                    ))}
                  </div>

                  {schedule.last_error ? (
                    <p className="mt-3 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-[12px] text-red-300">
                      {schedule.last_error}
                    </p>
                  ) : schedule.last_outcome ? (
                    <p className="mt-3 text-[11px] uppercase tracking-wide text-ink-500">
                      Last result: {schedule.last_outcome.replaceAll('_', ' ')}
                    </p>
                  ) : null}

                  <div className="mt-4 flex items-center gap-2 border-t border-base-800 pt-4">
                    <button
                      type="button"
                      onClick={() => void runNow(schedule)}
                      disabled={runningId === schedule.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-base-700 px-2.5 py-1.5 text-[12px] text-ink-200 transition hover:border-ink-400 disabled:opacity-40"
                    >
                      {runningId === schedule.id
                        ? <Loader2 size={12} className="animate-spin" />
                        : <Play size={12} />}
                      Run now
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(schedule)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-base-700 px-2.5 py-1.5 text-[12px] text-ink-200 transition hover:border-ink-400"
                    >
                      <Pencil size={12} />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(schedule)}
                      title="Delete schedule"
                      className="ml-auto rounded-lg p-2 text-ink-500 transition hover:bg-red-950/40 hover:text-red-300"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit recurring schedule' : 'New recurring schedule'}
        subtitle="The backend will queue this route automatically."
        size="lg"
        busy={saving}
        footer={
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-[13px] font-semibold text-base-950 transition hover:bg-amber-400 disabled:opacity-40"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <CalendarClock size={13} />}
            {editing ? 'Save changes' : 'Create schedule'}
          </button>
        }
      >
        <div className="space-y-5">
          <label className="block">
            <span className="text-[12px] text-ink-300">Schedule name</span>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Daily 5 PM inspection"
              className="mt-1.5 w-full rounded-xl border border-base-700 bg-base-950 px-3 py-2.5 text-[14px] text-white outline-none focus:border-amber-500"
            />
          </label>

          <div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-ink-300">Ordered route</span>
              <span className="text-[11px] text-ink-500">{form.capturePointIds.length} stops</span>
            </div>
            <div className="mt-2 max-h-44 space-y-1 overflow-y-auto rounded-xl border border-base-800 bg-base-950 p-2">
              {capturePoints.map((point) => {
                const stop = form.capturePointIds.indexOf(point.id);
                return (
                  <button
                    key={point.id}
                    type="button"
                    onClick={() => togglePoint(point.id)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition ${
                      stop >= 0 ? 'bg-amber-500/10 text-white' : 'text-ink-300 hover:bg-base-900'
                    }`}
                  >
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                      stop >= 0 ? 'bg-amber-400 text-base-950' : 'border border-base-700 text-ink-500'
                    }`}>
                      {stop >= 0 ? stop + 1 : ''}
                    </span>
                    {point.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="text-[12px] text-ink-300">Time</span>
              <input
                type="time"
                value={form.localTime}
                onChange={(event) => setForm((current) => ({ ...current, localTime: event.target.value }))}
                className="mt-1.5 w-full rounded-xl border border-base-700 bg-base-950 px-3 py-2.5 text-[14px] text-white outline-none focus:border-amber-500"
              />
            </label>
            <label>
              <span className="text-[12px] text-ink-300">Timezone</span>
              <input
                value={form.timezone}
                onChange={(event) => setForm((current) => ({ ...current, timezone: event.target.value }))}
                placeholder="Asia/Dubai"
                className="mt-1.5 w-full rounded-xl border border-base-700 bg-base-950 px-3 py-2.5 text-[14px] text-white outline-none focus:border-amber-500"
              />
            </label>
          </div>

          <div>
            <span className="text-[12px] text-ink-300">Repeat on</span>
            <div className="mt-2 grid grid-cols-7 gap-1.5">
              {DAYS.map((day) => {
                const selected = form.weekdays.includes(day.value);
                return (
                  <button
                    key={day.label}
                    type="button"
                    title={day.label}
                    onClick={() => toggleDay(day.value)}
                    className={`rounded-lg border py-2 text-[12px] transition ${
                      selected
                        ? 'border-amber-500/50 bg-amber-500/10 text-amber-200'
                        : 'border-base-700 text-ink-500 hover:border-ink-500'
                    }`}
                  >
                    {day.short}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className="text-[12px] text-ink-300">Capture</span>
              <div className="mt-2 space-y-2">
                {([
                  ['image', 'Photo'],
                  ['pointcloud', '3D scan'],
                ] as Array<[CaptureOutput, string]>).map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2.5 text-[13px] text-ink-200">
                    <input
                      type="checkbox"
                      checked={form.captureOutputs.includes(value)}
                      disabled={form.captureOutputs.length === 1 && form.captureOutputs.includes(value)}
                      onChange={() => toggleOutput(value)}
                      className="h-4 w-4 rounded border-base-700 bg-base-950 text-amber-500"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <span className="text-[12px] text-ink-300">If robot is busy</span>
              <select
                value={form.busyPolicy}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  busyPolicy: event.target.value as 'skip' | 'queue',
                }))}
                className="mt-2 w-full rounded-xl border border-base-700 bg-base-950 px-3 py-2.5 text-[13px] text-white outline-none focus:border-amber-500"
              >
                <option value="skip">Skip this occurrence</option>
                <option value="queue">Add it to the queue</option>
              </select>
            </div>
          </div>

          <div className="space-y-2.5 rounded-xl border border-base-800 bg-base-950 p-3">
            <label className="flex items-center gap-2.5 text-[13px] text-ink-200">
              <input
                type="checkbox"
                checked={form.autoConnect}
                onChange={(event) => setForm((current) => ({ ...current, autoConnect: event.target.checked }))}
                className="h-4 w-4 rounded border-base-700 bg-base-950 text-amber-500"
              />
              Connect navigation automatically before running
            </label>
            <label className="flex items-center gap-2.5 text-[13px] text-ink-200">
              <input
                type="checkbox"
                checked={form.continueOnFailure}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  continueOnFailure: event.target.checked,
                }))}
                className="h-4 w-4 rounded border-base-700 bg-base-950 text-amber-500"
              />
              Keep going if one stop fails
            </label>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this schedule?"
        body="Future runs will stop. Missions already created from it remain in history."
        confirmLabel="Delete schedule"
        danger
        onConfirm={deleteSchedule}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
