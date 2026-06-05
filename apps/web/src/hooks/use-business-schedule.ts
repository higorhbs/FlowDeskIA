"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { DEFAULT_LUNCH_MSG } from "@flowdesk/shared";
import type { BusinessSchedule } from "@flowdesk/firebase/client";
import { scheduleApi } from "@/lib/api";
import {
  defaultWorkingHours,
  type LunchBreakValue,
  type SpecialHoursValue,
  type WorkingHoursValue,
} from "@/components/business/WorkingHoursEditor";

function normalizeWorkingHours(raw: unknown): WorkingHoursValue {
  if (!raw || typeof raw !== "object") return defaultWorkingHours();
  const wh = raw as WorkingHoursValue;
  return Object.keys(wh).length > 0 ? wh : defaultWorkingHours();
}

function normalizeSpecialHours(raw: unknown): SpecialHoursValue {
  if (!raw || typeof raw !== "object") return {};
  const input = raw as Record<string, unknown>;
  const out: SpecialHoursValue = {};
  for (const [day, slot] of Object.entries(input)) {
    if (slot === null) {
      out[day] = null;
      continue;
    }
    if (
      Array.isArray(slot) &&
      slot.length === 2 &&
      typeof slot[0] === "string" &&
      typeof slot[1] === "string"
    ) {
      out[day] = [slot[0], slot[1]];
    }
  }
  return out;
}

function normalizeLunchBreak(raw: unknown): LunchBreakValue {
  if (
    Array.isArray(raw) &&
    raw.length === 2 &&
    typeof raw[0] === "string" &&
    typeof raw[1] === "string"
  ) {
    return [raw[0], raw[1]];
  }
  return null;
}

function buildPutPayload(
  schedule: BusinessSchedule | undefined,
  state: {
    workingHours: WorkingHoursValue;
    specialHours: SpecialHoursValue;
    lunchBreak: LunchBreakValue;
    lunchMsg: string;
  },
): Parameters<typeof scheduleApi.put>[1] {
  return {
    timezone: schedule?.timezone ?? "America/Sao_Paulo",
    workingHours: state.workingHours,
    specialHours: state.specialHours,
    lunchBreak: state.lunchBreak,
    lunchMsg: state.lunchBreak ? state.lunchMsg.trim() : undefined,
  };
}

export function useBusinessSchedule(businessId: string) {
  const queryClient = useQueryClient();

  const { data: schedule, isLoading, isError } = useQuery({
    queryKey: ["schedule", businessId],
    queryFn: () => scheduleApi.get(businessId),
    enabled: !!businessId,
  });

  const [workingHours, setWorkingHours] = useState<WorkingHoursValue>(defaultWorkingHours());
  const [specialHours, setSpecialHours] = useState<SpecialHoursValue>({});
  const [lunchBreak, setLunchBreak] = useState<LunchBreakValue>(null);
  const [lunchMsg, setLunchMsg] = useState(DEFAULT_LUNCH_MSG);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!schedule) return;
    setWorkingHours(normalizeWorkingHours(schedule.workingHours));
    setSpecialHours(normalizeSpecialHours(schedule.specialHours));
    setLunchBreak(normalizeLunchBreak(schedule.lunchBreak));
    setLunchMsg(
      typeof schedule.lunchMsg === "string" && schedule.lunchMsg.trim()
        ? schedule.lunchMsg
        : DEFAULT_LUNCH_MSG,
    );
    setDirty(false);
  }, [schedule]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["schedule", businessId] });
    queryClient.invalidateQueries({ queryKey: ["schedules"] });
  };

  type ScheduleOverrides = Partial<{
    specialHours: SpecialHoursValue;
    lunchBreak: LunchBreakValue;
    lunchMsg: string;
  }>;

  const saveSchedule = (overrides?: ScheduleOverrides) => {
    if (overrides?.lunchBreak !== undefined || overrides?.lunchMsg !== undefined) {
      const lb = overrides.lunchBreak ?? lunchBreak;
      const msg = (overrides.lunchMsg ?? lunchMsg).trim();
      if (lb && msg.length < 5) {
        throw new Error("A mensagem de almoço precisa ter pelo menos 5 caracteres.");
      }
    } else if (lunchBreak && lunchMsg.trim().length < 5) {
      throw new Error("A mensagem de almoço precisa ter pelo menos 5 caracteres.");
    }
    return scheduleApi.put(
      businessId,
      buildPutPayload(schedule, {
        workingHours,
        specialHours: overrides?.specialHours ?? specialHours,
        lunchBreak: overrides?.lunchBreak ?? lunchBreak,
        lunchMsg: overrides?.lunchMsg ?? lunchMsg,
      }),
    );
  };

  const putMutation = useMutation({
    mutationFn: saveSchedule,
    onSuccess: (_data, overrides) => {
      if (overrides?.specialHours) setSpecialHours(overrides.specialHours);
      if (overrides?.lunchBreak !== undefined) setLunchBreak(overrides.lunchBreak);
      if (overrides?.lunchMsg !== undefined) setLunchMsg(overrides.lunchMsg);
      setDirty(false);
      invalidate();
    },
  });

  const quickSaveMutation = useMutation({
    mutationFn: saveSchedule,
    onSuccess: () => toast.success("Horários salvos"),
    onError: (err: Error) =>
      toast.error(err.message?.includes("almoço") ? err.message : "Erro ao salvar horários"),
  });

  const markDirty = () => setDirty(true);

  const quickSaveException = async (
    payload: { date: string; slot: [string, string] | null } | { date: string; remove: true },
  ) => {
    const next = { ...specialHours };
    if ("remove" in payload) delete next[payload.date];
    else next[payload.date] = payload.slot;
    setSpecialHours(next);
    await quickSaveMutation.mutateAsync({ specialHours: next });
  };

  const quickSaveWorkingHours = () => quickSaveMutation.mutateAsync(undefined);

  const quickSaveLunch = (data: { lunchBreak: LunchBreakValue; lunchMsg: string }) => {
    setLunchBreak(data.lunchBreak);
    setLunchMsg(data.lunchMsg);
    return quickSaveMutation.mutateAsync({
      lunchBreak: data.lunchBreak,
      lunchMsg: data.lunchMsg,
    });
  };

  return {
    schedule,
    isLoading,
    isError,
    workingHours,
    setWorkingHours: (v: WorkingHoursValue) => {
      setWorkingHours(v);
      markDirty();
    },
    specialHours,
    setSpecialHours: (v: SpecialHoursValue) => {
      setSpecialHours(v);
      markDirty();
    },
    lunchBreak,
    setLunchBreak: (v: LunchBreakValue) => {
      setLunchBreak(v);
      markDirty();
    },
    lunchMsg,
    setLunchMsg: (v: string) => {
      setLunchMsg(v);
      markDirty();
    },
    hoursDirty: dirty,
    clearHoursDirty: () => setDirty(false),
    saveSchedule: () => putMutation.mutateAsync(undefined),
    isSavingSchedule: putMutation.isPending,
    quickSaveException,
    quickSaveWorkingHours,
    quickSaveLunch,
    isQuickSaving: quickSaveMutation.isPending,
    validateLunchMsg: () => {
      if (lunchBreak && lunchMsg.trim().length < 5) {
        throw new Error("A mensagem de almoço precisa ter pelo menos 5 caracteres.");
      }
    },
  };
}
