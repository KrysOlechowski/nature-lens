import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runner } from "node-pg-migrate";
import { Client, Pool } from "pg";
import {
  GenericContainer,
  Wait,
  type StartedTestContainer,
} from "testcontainers";

const databaseName = "nature_lens_test";
const databasePassword = "nature_lens_test";
const databaseUser = "nature_lens_test";
const postgresPort = 5432;

export interface TestDatabase {
  pool: Pool;
  stop(): Promise<void>;
}

function configureDockerDesktopSocket(): void {
  if (process.env.DOCKER_HOST) {
    return;
  }

  const dockerDesktopSocket = join(homedir(), ".docker", "run", "docker.sock");

  if (existsSync(dockerDesktopSocket)) {
    process.env.DOCKER_HOST = `unix://${dockerDesktopSocket}`;
  }
}

function createDatabaseUrl(
  container: StartedTestContainer,
  targetDatabase: string,
): string {
  const databaseUrl = new URL("postgresql://localhost");

  databaseUrl.hostname = container.getHost();
  databaseUrl.port = container.getMappedPort(postgresPort).toString();
  databaseUrl.username = databaseUser;
  databaseUrl.password = databasePassword;
  databaseUrl.pathname = targetDatabase;

  return databaseUrl.toString();
}

export async function startTestDatabase(): Promise<TestDatabase> {
  configureDockerDesktopSocket();

  const container = await new GenericContainer("postgis/postgis:17-3.5-alpine")
    .withPlatform("linux/amd64")
    .withEnvironment({
      POSTGRES_DB: "postgres",
      POSTGRES_PASSWORD: databasePassword,
      POSTGRES_USER: databaseUser,
    })
    .withExposedPorts(postgresPort)
    .withWaitStrategy(
      Wait.forLogMessage(/database system is ready to accept connections/, 2),
    )
    .withStartupTimeout(120_000)
    .start();

  try {
    const adminClient = new Client({
      connectionString: createDatabaseUrl(container, "postgres"),
    });

    await adminClient.connect();

    try {
      await adminClient.query(`CREATE DATABASE ${databaseName}`);
    } finally {
      await adminClient.end();
    }

    const databaseUrl = createDatabaseUrl(container, databaseName);

    await runner({
      databaseUrl,
      dir: fileURLToPath(new URL("../migrations", import.meta.url)),
      direction: "up",
      migrationsTable: "pgmigrations",
      log: () => undefined,
    });

    const pool = new Pool({
      connectionString: databaseUrl,
      max: 2,
    });

    await pool.query("SELECT 1");

    return {
      pool,
      async stop() {
        await pool.end();
        await container.stop();
      },
    };
  } catch (error) {
    await container.stop();
    throw error;
  }
}
