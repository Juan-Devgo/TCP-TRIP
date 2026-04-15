import { sql } from 'bun';

// Re-export the Bun SQL tagged template for use across domains.
// Usage: await sql`SELECT * FROM protocols WHERE id = ${id}`
// Reads DATABASE_URL from environment (Bun loads .env automatically).
export { sql };
