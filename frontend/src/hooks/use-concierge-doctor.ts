"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deleteConciergeDoctorSessionMutation,
  ensureConciergeDoctorAgentMutation,
  getConciergeDoctorSessionOptions,
  listConciergeDoctorSessionsOptions,
  listConciergeDoctorSessionsQueryKey,
  mockConciergePharmacyRequestMutation,
  mockConciergeScheduleFollowUpMutation,
  startConciergeDoctorSessionMutation,
  updateConciergeDoctorSessionMutation,
} from "@/client/@tanstack/react-query.gen";

export function useConciergeDoctorSessions() {
  return useQuery(listConciergeDoctorSessionsOptions());
}

export function useConciergeDoctorSession(id: number | null) {
  return useQuery({
    ...getConciergeDoctorSessionOptions({ path: { id: String(id ?? 0) } }),
    enabled: id !== null,
  });
}

export function useEnsureConciergeDoctorAgent() {
  return useMutation({
    ...ensureConciergeDoctorAgentMutation(),
  });
}

export function useStartConciergeDoctorSession() {
  const queryClient = useQueryClient();

  return useMutation({
    ...startConciergeDoctorSessionMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: listConciergeDoctorSessionsQueryKey(),
      });
    },
  });
}

export function useUpdateConciergeDoctorSession() {
  const queryClient = useQueryClient();

  return useMutation({
    ...updateConciergeDoctorSessionMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: listConciergeDoctorSessionsQueryKey(),
      });
    },
  });
}

export function useDeleteConciergeDoctorSession() {
  const queryClient = useQueryClient();

  return useMutation({
    ...deleteConciergeDoctorSessionMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: listConciergeDoctorSessionsQueryKey(),
      });
    },
  });
}

export function useMockConciergePharmacyRequest() {
  return useMutation({
    ...mockConciergePharmacyRequestMutation(),
  });
}

export function useMockConciergeScheduleFollowUp() {
  return useMutation({
    ...mockConciergeScheduleFollowUpMutation(),
  });
}
