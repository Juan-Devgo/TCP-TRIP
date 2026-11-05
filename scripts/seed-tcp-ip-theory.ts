import { parseArgs } from "node:util";

import { seedTcpIpTheory } from "@/db/seeds/tcp-ip-theory";

/**
 * Publishes the base TCP/IP theory (the model and its four layers) into the
 * database `DATABASE_PATH` points at, as a teacher's presentations approved by
 * an administrator into the Theory menu. Safe to re-run: a deck the teacher
 * already has is skipped.
 *
 *   bun run seed:theory --teacher user_… --admin user_… --author "Nombre Apellido"
 *
 * Both ids are Clerk user ids; the teacher must be the account that will own
 * (and be able to edit) the decks in `Mis Presentaciones`.
 */

const { values } = parseArgs({
  options: {
    teacher: { type: "string" },
    admin: { type: "string" },
    author: { type: "string" },
  },
});

const teacherId = values.teacher ?? process.env.SEED_TEACHER_ID;
const adminId = values.admin ?? process.env.SEED_ADMIN_ID;
const authorName = values.author ?? process.env.SEED_AUTHOR_NAME;

if (!teacherId || !adminId || !authorName) {
  console.error(
    'usage: bun run seed:theory --teacher <clerk user id> --admin <clerk user id> --author "<byline>"',
  );
  process.exit(1);
}

const report = seedTcpIpTheory({ teacherId, adminId, authorName });

for (const title of report.created) console.log(`published  ${title}`);
for (const title of report.skipped) console.log(`skipped    ${title} (the teacher already has it)`);
console.log(`section    ${report.sectionId ?? "—"}`);
