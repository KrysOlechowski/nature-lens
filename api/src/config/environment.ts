import { config } from "dotenv";
import { z } from "zod";

config({ quiet: true });

const environmentSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65_535),
});

const parsedEnvironment = environmentSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  const details = parsedEnvironment.error.issues
    .map((issue) => `- ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  throw new Error(`Invalid API environment configuration:\n${details}`);
}

export const environment = parsedEnvironment.data;
