import { z } from "zod";
import { environment } from "../env";

const healthResponseSchema = z.object({
  status: z.literal("ok"),
  version: z.literal("1"),
});

type ApiConnection =
  | {
      status: "connected";
      health: z.infer<typeof healthResponseSchema>;
    }
  | {
      status: "unavailable";
    };

export async function getApiConnection(): Promise<ApiConnection> {
  try {
    const response = await fetch(
      new URL("/api/health", environment.NEXT_PUBLIC_API_BASE_URL),
      { cache: "no-store" },
    );

    if (!response.ok) {
      return { status: "unavailable" };
    }

    const health = healthResponseSchema.safeParse(await response.json());

    if (!health.success) {
      return { status: "unavailable" };
    }

    return { status: "connected", health: health.data };
  } catch {
    return { status: "unavailable" };
  }
}
