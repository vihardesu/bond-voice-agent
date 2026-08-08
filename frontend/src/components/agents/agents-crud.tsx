"use client";

import { useState } from "react";
import { Edit05, Plus, Trash01 } from "@untitledui/icons";

import type { Agent } from "@/client";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { TextArea } from "@/components/base/textarea/textarea";
import {
  useCreateAgent,
  useDeleteAgent,
  useAgents,
  useUpdateAgent,
} from "@/hooks/use-agents";

type FormState = {
  name: string;
  description: string;
};

function getErrorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof globalThis.Error) return error.message;
  if (
    typeof error === "object" &&
    "error" in error &&
    typeof (error as { error: unknown }).error === "string"
  ) {
    return (error as { error: string }).error;
  }
  return "Something went wrong";
}

const emptyForm: FormState = {
  name: "",
  description: "",
};

export function AgentsCrud() {
  const { data: agents, isLoading, isError, error } = useAgents();
  const createAgent = useCreateAgent();
  const updateAgent = useUpdateAgent();
  const deleteAgent = useDeleteAgent();

  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);

  const isSaving = createAgent.isPending || updateAgent.isPending;
  const mutationError = getErrorMessage(
    createAgent.error || updateAgent.error || deleteAgent.error,
  );

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const startEdit = (agent: Agent) => {
    setEditingId(agent.id);
    setForm({
      name: agent.name,
      description: agent.description,
    });
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return;

    if (editingId !== null) {
      await updateAgent.mutateAsync({
        path: { id: String(editingId) },
        body: {
          name: form.name.trim(),
          description: form.description.trim(),
        },
      });
    } else {
      await createAgent.mutateAsync({
        body: {
          name: form.name.trim(),
          description: form.description.trim(),
        },
      });
    }

    resetForm();
  };

  return (
    <main className="flex min-h-dvh flex-1 justify-center bg-primary px-4 py-12">
      <section className="flex w-full max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <Badge color="brand" size="sm" type="pill-color">
            Agents
          </Badge>
          <div className="flex flex-col gap-1">
            <h1 className="text-display-xs font-semibold text-primary">Manage agents</h1>
            <p className="text-md text-tertiary">
              Create, update, and delete voice agents backed by the Hono OpenAPI API.
            </p>
          </div>
        </header>

        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-4 rounded-2xl p-6 shadow-lg ring-1 ring-secondary"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-primary">
              {editingId !== null ? "Edit agent" : "Create agent"}
            </h2>
            {editingId !== null ? (
              <Button color="secondary" size="sm" type="button" onClick={resetForm}>
                Cancel edit
              </Button>
            ) : null}
          </div>

          <Input
            label="Name"
            placeholder="Support Agent"
            value={form.name}
            onChange={(value) => setForm((prev) => ({ ...prev, name: value }))}
            isRequired
            size="md"
          />

          <TextArea
            label="Description"
            placeholder="What this agent does…"
            value={form.description}
            onChange={(value) => setForm((prev) => ({ ...prev, description: value }))}
            rows={3}
          />

          {(mutationError || isError) && (
            <p className="text-sm text-error-primary">
              {mutationError || getErrorMessage(error) || "Something went wrong"}
            </p>
          )}

          <div className="flex justify-end">
            <Button
              type="submit"
              size="md"
              iconLeading={editingId !== null ? Edit05 : Plus}
              isDisabled={isSaving || !form.name.trim()}
              isLoading={isSaving}
            >
              {editingId !== null ? "Save changes" : "Create agent"}
            </Button>
          </div>
        </form>

        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-primary">All agents</h2>

          {isLoading ? (
            <p className="text-md text-tertiary">Loading agents…</p>
          ) : !agents?.length ? (
            <p className="text-md text-tertiary">No agents yet. Create one above.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {agents.map((agent) => (
                <li
                  key={agent.id}
                  className="flex flex-col gap-3 rounded-xl p-4 ring-1 ring-secondary sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-md font-semibold text-primary">{agent.name}</p>
                      <Badge color="gray" size="sm" type="pill-color">
                        #{agent.id}
                      </Badge>
                    </div>
                    <p className="text-sm text-tertiary">
                      {agent.description || "No description"}
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <Button
                      color="secondary"
                      size="sm"
                      iconLeading={Edit05}
                      onClick={() => startEdit(agent)}
                    >
                      Edit
                    </Button>
                    <Button
                      color="secondary-destructive"
                      size="sm"
                      iconLeading={Trash01}
                      isDisabled={deleteAgent.isPending}
                      onClick={() =>
                        deleteAgent.mutate({
                          path: { id: String(agent.id) },
                        })
                      }
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
