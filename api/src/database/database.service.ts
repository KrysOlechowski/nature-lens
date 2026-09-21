import {
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from "@nestjs/common";
import { Pool, type QueryResult, type QueryResultRow } from "pg";
import { environment } from "../config/environment.js";

@Injectable()
export class DatabaseService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool = new Pool({
    connectionString: environment.DATABASE_URL,
    max: environment.DATABASE_POOL_MAX,
  });

  async onModuleInit() {
    await this.pool.query("SELECT 1");
    this.logger.log("PostgreSQL connection established");
  }

  async onApplicationShutdown() {
    await this.pool.end();
  }

  query<ResultRow extends QueryResultRow>(
    text: string,
    values: unknown[] = [],
  ): Promise<QueryResult<ResultRow>> {
    return this.pool.query<ResultRow>(text, values);
  }
}
