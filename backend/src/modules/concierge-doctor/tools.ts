import type { ElevenLabs } from "@elevenlabs/elevenlabs-js";

type ClientTool = Extract<
  ElevenLabs.PromptAgentApiModelInputToolsItem,
  { type: "client" }
>;

function stringProp(description: string, enumValues?: string[]): ElevenLabs.LiteralJsonSchemaProperty {
  return {
    type: "string",
    description,
    ...(enumValues ? { enum: enumValues } : {}),
  };
}

export const CONCIERGE_CLIENT_TOOLS: ClientTool[] = [
  {
    type: "client",
    name: "update_clinical_context",
    description:
      "Persist structured clinical facts extracted from the conversation so they are queryable. Call whenever symptom, duration, history, or medications change.",
    expectsResponse: true,
    parameters: {
      type: "object",
      properties: {
        symptom: stringProp("Primary symptom or concern in plain language"),
        duration: stringProp("How long the issue has been present"),
        history: stringProp("Relevant medical history mentioned by the caller"),
        currentMedications: stringProp("Current medications mentioned by the caller"),
        unknowns: stringProp("Important facts still unknown or unverified"),
        notes: stringProp("Optional free-text clinical notes"),
      },
      required: ["symptom"],
    },
  },
  {
    type: "client",
    name: "schedule_follow_up",
    description:
      "Mock-schedule a follow-up with a nurse or clinician. Use after the caller agrees to a visit-style next step. Does not create a real appointment.",
    expectsResponse: true,
    parameters: {
      type: "object",
      properties: {
        reason: stringProp("Why the follow-up is needed"),
        urgency: stringProp("How quickly the follow-up should happen", [
          "routine",
          "soon",
          "urgent",
        ]),
        preferredWindow: stringProp("Caller preference such as tomorrow morning"),
      },
      required: ["reason", "urgency"],
    },
  },
  {
    type: "client",
    name: "submit_pharmacy_request",
    description:
      "Submit a mock retail pharmacy portal request (Walgreens/CVS-style). Never invent real prescriptions. Use for refill status checks, pickup readiness, or transfer requests the caller asks about.",
    expectsResponse: true,
    parameters: {
      type: "object",
      properties: {
        pharmacy: stringProp("Retail pharmacy brand", ["walgreens", "cvs", "other"]),
        requestType: stringProp("Type of pharmacy portal mock action", [
          "refill_status",
          "pickup_ready_check",
          "transfer_request",
          "general_question",
        ]),
        medicationName: stringProp("Medication name if known"),
        details: stringProp("Extra details for the mock request"),
      },
      required: ["pharmacy", "requestType"],
    },
  },
  {
    type: "client",
    name: "confirm_next_step",
    description:
      "Confirm the agreed resolution/next step once the caller accepts it. Use this to close the loop with a concrete outcome.",
    expectsResponse: true,
    parameters: {
      type: "object",
      properties: {
        summary: stringProp("Short confirmation of what was agreed"),
        nextStepType: stringProp("Category of the resolved next step", [
          "self_care_watch",
          "scheduled_follow_up",
          "pharmacy_request",
          "human_handoff",
          "emergency_care",
          "other",
        ]),
        reassurance: stringProp(
          "One sentence that reduces uncertainty without overclaiming",
        ),
      },
      required: ["summary", "nextStepType"],
    },
  },
  {
    type: "client",
    name: "request_human_handoff",
    description:
      "Hand off to a human when you cannot act safely, lack information, or the caller asks for a person. Prefer this over guessing.",
    expectsResponse: true,
    parameters: {
      type: "object",
      properties: {
        reason: stringProp("Why the handoff is needed"),
        missingInformation: stringProp("What information was insufficient"),
        urgency: stringProp("Handoff urgency", ["routine", "soon", "urgent"]),
      },
      required: ["reason"],
    },
  },
  {
    type: "client",
    name: "flag_watch_event",
    description:
      "Emit a real-time observability flag for humans watching the conversation (safety stop, uncertainty, tool issue, tone shift).",
    expectsResponse: true,
    parameters: {
      type: "object",
      properties: {
        level: stringProp("Severity of the watch event", ["info", "warning", "critical"]),
        category: stringProp("Category for the watch dashboard", [
          "uncertainty",
          "safety_stop",
          "handoff",
          "tool_issue",
          "tone_shift",
          "other",
        ]),
        message: stringProp("Human-readable observation"),
      },
      required: ["level", "category", "message"],
    },
  },
];
