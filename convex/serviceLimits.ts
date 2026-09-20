import { DAY, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";

// One deployment-wide budget shared by live case help and case-pack generation.
// New features must consume these existing buckets rather than creating a
// separate allowance that could silently increase provider spend.
export const serviceLimits = new RateLimiter(components.rateLimiter, {
  sourceDay: { kind: "fixed window", rate: 10, period: DAY },
  aiDay: { kind: "fixed window", rate: 40, period: DAY },
  caseMailDay: { kind: "fixed window", rate: 10, period: DAY },
  recipientAttempt: { kind: "fixed window", rate: 10, period: DAY },
});
