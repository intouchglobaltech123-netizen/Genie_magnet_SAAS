import "reflect-metadata";
import { ConsoleLogger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

/**
 * The background worker (ADR 0010): the same code as the API, without the web server, always running jobs. Use it when
 * the API runs with RUN_JOBS off; a single server can instead run the API with RUN_JOBS on.
 */
async function main() {
  process.env.RUN_JOBS = "true";
  const logger = new ConsoleLogger({ json: process.env.NODE_ENV === "production" });
  const app = await NestFactory.createApplicationContext(AppModule, { logger });
  app.enableShutdownHooks();
  console.log("Worker running background jobs");
}

void main();
