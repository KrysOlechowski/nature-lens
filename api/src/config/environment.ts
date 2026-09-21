import { config } from "dotenv";
import { z } from "zod";

config({ quiet: true });

const environmentSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65_535),
  DATABASE_URL: z
    .url()
    .refine(
      (url) => ["postgres:", "postgresql:"].includes(new URL(url).protocol),
      "DATABASE_URL must use the postgres:// or postgresql:// protocol",
    ),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(20).default(5),
});

const parsedEnvironment = environmentSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  const details = parsedEnvironment.error.issues
    .map((issue) => `- ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  throw new Error(`Invalid API environment configuration:\n${details}`);
}

export const environment = parsedEnvironment.data;
