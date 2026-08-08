"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deleteLevel4SessionMutation,
  getLevel4AgentOptions,
  listLevel4SessionsOptions,
  listLevel4SessionsQueryKey,
  mockLevel4PharmacyRequestMutation,
  mockLevel4ScheduleFollowUpMutation,
  startLevel4SessionMutation,
  updateLevel4SessionMutation,
} from "@/client/@tanstack/react-query.gen";

export function useLevel4Agent(forceSync = false) {
  return useQuery(
    getLevel4AgentOptions({
      query: { forceSync: forceSync ? "true" : "false" },
    }),
  );
}

export function useLevel4Sessions() {
  return useQuery(listLevel4SessionsOptions());
}

export function useStartLevel4Session() {
  const queryClient = useQueryClient();
  return useMutation({
    ...startLevel4SessionMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: listLevel4SessionsQueryKey(),
      });
    },
  });
}

export function useUpdateLevel4Session() {
  const queryClient = useQueryClient();
  return useMutation({
    ...updateLevel4SessionMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: listLevel4SessionsQueryKey(),
      });
    },
  });
}

export function useDeleteLevel4Session() {
  const queryClient = useQueryClient();
  return useMutation({
    ...deleteLevel4SessionMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: listLevel4SessionsQueryKey(),
      });
    },
  });
}

export function useMockLevel4PharmacyRequest() {
  return useMutation({
    ...mockLevel4PharmacyRequestMutation(),
  });
}

export function useMockLevel4ScheduleFollowUp() {
  return useMutation({
    ...mockLevel4ScheduleFollowUpMutation(),
  });
}
