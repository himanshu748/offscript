import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { gameState } from "./validators";
import { serviceStatus, sourceEvidence } from "./servicePolicy";
import { vOutboundId } from "@agentmail/convex";
import { nullablePeer } from "./voiceTypes";
export default defineSchema({
  ...authTables,
  teamMessages: defineTable({
    roomId: v.id("rooms"),
    userId: v.id("users"),
    clientId: v.string(),
    text: v.string(),
    role: v.union(v.literal("archivist"), v.literal("operator")),
  }).index("by_roomId", ["roomId"])
    .index("by_roomId_and_userId_and_clientId", ["roomId", "userId", "clientId"]),
  voiceRooms: defineTable({ roomId: v.id("rooms"), archivist: nullablePeer, operator: nullablePeer })
    .index("by_roomId", ["roomId"]),
  caseServices: defineTable({
    roomId: v.id("rooms"),
    sourceStatus: serviceStatus, sourceAttempts: v.number(), sources: v.array(sourceEvidence), sourceError: v.optional(v.string()),
    aiStatus: serviceStatus, aiAttempts: v.number(), threadId: v.optional(v.string()), aiError: v.optional(v.string()),
    visibleAIIds: v.optional(v.array(v.string())),
  }).index("by_roomId", ["roomId"]),
  caseMail: defineTable({ roomId: v.id("rooms"), userId: v.id("users"), outboundId: vOutboundId, consentAt: v.number() })
    .index("by_roomId_and_userId", ["roomId", "userId"]),
  recovery: defineTable({
    userId: v.id("users"),
    email: v.optional(v.string()),
    pendingEmail: v.optional(v.string()),
    verifyHash: v.optional(v.string()),
    verifyExpires: v.optional(v.number()),
    resetHash: v.optional(v.string()),
    resetExpires: v.optional(v.number()),
    recoveredAt: v.optional(v.number()),
  }).index("by_userId", ["userId"]),
  players: defineTable({
    ownerId: v.id("users"),
    playerId: v.string(),
    name: v.string(),
  }).index("by_ownerId", ["ownerId"]).index("by_playerId", ["playerId"]),
  friendships: defineTable({
    requester: v.id("users"),
    recipient: v.id("users"),
    pair: v.string(),
    status: v.union(v.literal("pending"), v.literal("accepted")),
  }).index("by_requester", ["requester"])
    .index("by_recipient", ["recipient"])
    .index("by_pair", ["pair"]),
  rooms: defineTable({
    hostId: v.id("users"),
    guestId: v.optional(v.id("users")),
    inviteToken: v.string(),
    createKey: v.string(),
    timed: v.optional(v.boolean()),
    invitedGuestId: v.optional(v.id("users")),
    createdAt: v.number(),
    expiresAt: v.number(),
    state: v.union(v.null(), gameState),
  })
    .index("by_host", ["hostId"])
    .index("by_guestId", ["guestId"])
    .index("by_invitedGuestId", ["invitedGuestId"])
    .index("by_invite", ["inviteToken"])
    .index("by_host_create", ["hostId", "createKey"]),
});
