import { query } from "./_generated/server";

export const ping = query({
  args: {},
  handler: async (_ctx) => {
    return { status: "ok" as const };
  },
});
