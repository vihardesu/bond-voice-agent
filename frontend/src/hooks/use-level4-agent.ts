"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  composeLevel4DefaultsMutation,
  createLevel4AgentMutation,
  deleteLevel4AgentMutation,
  deleteLevel4SessionMutation,
  getLevel4AgentOptions,
  listLevel4AgentsOptions,
  listLevel4AgentsQueryKey,
  listLevel4SessionsOptions,
  listLevel4SessionsQueryKey,
  mockLevel4PharmacyRequestMutation,
  mockLevel4ScheduleFollowUpMutation,
  startLevel4SessionMutation,
  updateLevel4AgentMutation,
  updateLevel4SessionMutation,
} from "@/client/@tanstack/react-query.gen";

export function useLevel4Agents() {
  return useQuery(listLevel4AgentsOptions());
}

export function useLevel4Agent(id: number | null) {
  return useQuery({
    ...getLevel4AgentOptions({ path: { id: String(id ?? 0) } }),
    enabled: id !== null,
  });
}

export function useLevel4Sessions() {
  return useQuery(listLevel4SessionsOptions());
}

export function useComposeLevel4Defaults() {
  return useMutation({
    ...composeLevel4DefaultsMutation(),
  });
}

export function useCreateLevel4Agent() {
  const queryClient = useQueryClient();
  return useMutation({
    ...createLevel4AgentMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: listLevel4AgentsQueryKey() });
    },
  });
}

export function useUpdateLevel4Agent() {
  const queryClient = useQueryClient();
  return useMutation({
    ...updateLevel4AgentMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: listLevel4AgentsQueryKey() });
    },
  });
}

export function useDeleteLevel4Agent() {
  const queryClient = useQueryClient();
  return useMutation({
    ...deleteLevel4AgentMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: listLevel4AgentsQueryKey(),
      });
      await queryClient.invalidateQueries({
        queryKey: listLevel4SessionsQueryKey(),
      });
    },
  });
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
