"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createAgentMutation,
  deleteAgentMutation,
  listAgentsOptions,
  listAgentsQueryKey,
  updateAgentMutation,
} from "@/client/@tanstack/react-query.gen";
import type { CreateAgent, UpdateAgent } from "@/client";

export function useAgents() {
  return useQuery(listAgentsOptions());
}

export function useCreateAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    ...createAgentMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: listAgentsQueryKey() });
    },
  });
}

export function useUpdateAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    ...updateAgentMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: listAgentsQueryKey() });
    },
  });
}

export function useDeleteAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    ...deleteAgentMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: listAgentsQueryKey() });
    },
  });
}

export type { CreateAgent, UpdateAgent };
