import { v } from "convex/values";
export const voicePeer = v.object({
  clientId: v.string(), seenAt: v.number(), joinedAt: v.number(), muted: v.boolean(),
  description: v.optional(v.object({ targetId: v.string(), sdp: v.string() })),
});
export const nullablePeer = v.union(v.null(), voicePeer);
