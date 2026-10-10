import { z } from "zod";

const defaultMapStyleUrl = "https://tiles.openfreemap.org/styles/liberty";

const environmentSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.url({ protocol: /^https?$/ }),
  NEXT_PUBLIC_MAP_STYLE_URL: z
    .url({ protocol: /^https?$/ })
    .optional()
    .default(defaultMapStyleUrl),
});

const parsedEnvironment = environmentSchema.safeParse({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_MAP_STYLE_URL: process.env.NEXT_PUBLIC_MAP_STYLE_URL,
});

if (!parsedEnvironment.success) {
  const details = parsedEnvironment.error.issues
    .map((issue) => `- ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  throw new Error(`Invalid web environment configuration:\n${details}`);
}

export const environment = parsedEnvironment.data;
