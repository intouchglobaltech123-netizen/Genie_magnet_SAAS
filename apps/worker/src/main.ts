import { Worker } from "bullmq";
import { z } from "zod";
import { parseJob, QUEUES, type JobName } from "./jobs.js";
import { handlers, type Handler } from "./processors/index.js";

const env = z
  .object({
    REDIS_URL: z.string().startsWith("redis"),
    WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(5),
  })
  .parse(process.env);

const url = new URL(env.REDIS_URL);
const connection = { host: url.hostname, port: Number(url.port || 6379), password: url.password || undefined };

const workers = Object.values(QUEUES).map(
  (queue) =>
    new Worker(
      queue,
      async (job) => {
        const { name, data } = parseJob(job.name, job.data);
        return (handlers[name] as Handler<JobName>)(data);
      },
      { connection, concurrency: env.WORKER_CONCURRENCY },
    ),
);

for (const w of workers) {
  w.on("failed", (job, err) => console.error(`[${w.name}] ${job?.name} failed: ${err.message}`));
}
console.log(`Worker listening on ${workers.map((w) => w.name).join(", ")}`);

async function shutdown() {
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
