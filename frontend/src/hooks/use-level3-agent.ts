"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createLevel3AgentMutation,
  deleteLevel3AgentMutation,
  deleteLevel3SessionMutation,
  getLevel3AgentOptions,
  listLevel3AgentsOptions,
  listLevel3AgentsQueryKey,
  listLevel3SessionsOptions,
  listLevel3SessionsQueryKey,
  mockLevel3PharmacyRequestMutation,
  mockLevel3ScheduleFollowUpMutation,
  startLevel3SessionMutation,
  updateLevel3AgentMutation,
  updateLevel3SessionMutation,
} from "@/client/@tanstack/react-query.gen";

export function useLevel3Agents() {
  return useQuery(listLevel3AgentsOptions());
}

export function useLevel3Agent(id: number | null) {
  return useQuery({
    ...getLevel3AgentOptions({ path: { id: String(id ?? 0) } }),
    enabled: id !== null,
  });
}

export function useLevel3Sessions() {
  return useQuery(listLevel3SessionsOptions());
}

export function useCreateLevel3Agent() {
  const queryClient = useQueryClient();
  return useMutation({
    ...createLevel3AgentMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: listLevel3AgentsQueryKey() });
    },
  });
}

export function useUpdateLevel3Agent() {
  const queryClient = useQueryClient();
  return useMutation({
    ...updateLevel3AgentMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: listLevel3AgentsQueryKey() });
    },
  });
}

export function useDeleteLevel3Agent() {
  const queryClient = useQueryClient();
  return useMutation({
    ...deleteLevel3AgentMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: listLevel3AgentsQueryKey(),
      });
      await queryClient.invalidateQueries({
        queryKey: listLevel3SessionsQueryKey(),
      });
    },
  });
}

export function useStartLevel3Session() {
  const queryClient = useQueryClient();
  return useMutation({
    ...startLevel3SessionMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: listLevel3SessionsQueryKey(),
      });
    },
  });
}

export function useUpdateLevel3Session() {
  const queryClient = useQueryClient();
  return useMutation({
    ...updateLevel3SessionMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: listLevel3SessionsQueryKey(),
      });
    },
  });
}

export function useDeleteLevel3Session() {
  const queryClient = useQueryClient();
  return useMutation({
    ...deleteLevel3SessionMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: listLevel3SessionsQueryKey(),
      });
    },
  });
}

export function useMockLevel3PharmacyRequest() {
  return useMutation({
    ...mockLevel3PharmacyRequestMutation(),
  });
}

export function useMockLevel3ScheduleFollowUp() {
  return useMutation({
    ...mockLevel3ScheduleFollowUpMutation(),
  });
}
