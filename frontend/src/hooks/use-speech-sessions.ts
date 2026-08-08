"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createSpeechClientSecretMutation,
  createSpeechSessionMutation,
  deleteSpeechSessionMutation,
  getSpeechSessionOptions,
  listSpeechSessionsOptions,
  listSpeechSessionsQueryKey,
  updateSpeechSessionMutation,
} from "@/client/@tanstack/react-query.gen";

export function useSpeechSessions() {
  return useQuery(listSpeechSessionsOptions());
}

export function useSpeechSession(id: number | null) {
  return useQuery({
    ...getSpeechSessionOptions({ path: { id: String(id ?? 0) } }),
    enabled: id !== null,
  });
}

export function useCreateSpeechSession() {
  const queryClient = useQueryClient();

  return useMutation({
    ...createSpeechSessionMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: listSpeechSessionsQueryKey() });
    },
  });
}

export function useUpdateSpeechSession() {
  const queryClient = useQueryClient();

  return useMutation({
    ...updateSpeechSessionMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: listSpeechSessionsQueryKey() });
    },
  });
}

export function useDeleteSpeechSession() {
  const queryClient = useQueryClient();

  return useMutation({
    ...deleteSpeechSessionMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: listSpeechSessionsQueryKey() });
    },
  });
}

export function useCreateSpeechClientSecret() {
  return useMutation({
    ...createSpeechClientSecretMutation(),
  });
}
