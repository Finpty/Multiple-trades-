/**
 * Seed: system roles, platform owner, platform settings, feature definitions,
 * design families and industries. Idempotent: safe to re-run.
 *
 * Demo businesses (Kabura Tiling + a second trade) are created through the
 * SAME service layer the Super Admin UI uses (src/lib/business/create.ts), so
 * seeding doubles as an end-to-end proof of the data-driven pipeline.
 */
import "dotenv/config";
import { seedPlatform } from "../src/lib/platform/seed";

seedPlatform()
  .then((summary) => {
    console.log("Seed complete:", summary);
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
