// npm run db:seed — sample agencies for local, test and staging servers. Never production.
import { createPrisma } from "../index.js";
import { seedSampleData } from "./index.js";

const url = process.env.DATABASE_OWNER_URL;
if (!url) {
  console.error("DATABASE_OWNER_URL is not set (copy .env.example to .env).");
  process.exit(1);
}
if (process.env.NODE_ENV === "production") {
  console.error("Sample data is never loaded in production.");
  process.exit(1);
}

const prisma = createPrisma(url);
try {
  for (const r of await seedSampleData(prisma)) console.log(`${r.created ? "created      " : "already there"} · ${r.agency}`);
  console.log("Sign in without a password: start the API with TEST_SIGN_IN=true and pick a person (docs/ENGINEERING.md).");
} finally {
  await prisma.$disconnect();
}
