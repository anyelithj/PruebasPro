import * as bcrypt from 'bcrypt';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — no @types/pg in deps; runtime ok via ts-node -T
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// [Mini .env loader]: evita dependencia adicional a dotenv
function loadEnv(file: string): void {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const key = m[1];
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnv(path.resolve(__dirname, '..', '.env'));

const PASSWORD = 'StrongP@ss123';
const ROUNDS = 12;

const USERS = [
  { email: 'estudiante@neuroedu.ia', first: 'Juan', last: 'Estudiante', role: 'USER' },
  { email: 'docente@neuroedu.ia', first: 'Maria', last: 'Docente', role: 'TEACHER' },
  { email: 'admin@neuroedu.ia', first: 'Carlos', last: 'Admin', role: 'ADMIN' },
];

async function main(): Promise<void> {
  const client = new Client({
    host: process.env.DATABASE_HOST ?? '127.0.0.1',
    port: Number(process.env.DATABASE_PORT ?? 5432),
    user: process.env.DATABASE_USER ?? 'postgres',
    password: process.env.DATABASE_PASSWORD ?? '',
    database: process.env.DATABASE_NAME ?? 'languageproject',
  });
  await client.connect();

  console.log(
    `[seed] DB: ${client.host}:${client.port}/${client.database} user=${client.user}`,
  );

  const hash = await bcrypt.hash(PASSWORD, ROUNDS);
  console.log(`[seed] bcrypt hash generated (rounds=${ROUNDS})`);

  for (const u of USERS) {
    const email = u.email.toLowerCase().trim();
    const sql = `
      INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, is_email_verified)
      VALUES ($1, $2, $3, $4, $5, true, true)
      ON CONFLICT (email)
      DO UPDATE SET password_hash = EXCLUDED.password_hash,
                    is_active = true,
                    role = EXCLUDED.role,
                    updated_at = NOW()
      RETURNING id, email, role, is_active;
    `;
    const res = await client.query(sql, [email, hash, u.first, u.last, u.role]);
    const row = res.rows[0];
    console.log(`[seed] ✓ ${row.email} role=${row.role} active=${row.is_active} id=${row.id}`);
  }

  // [Verify]: confirm bcrypt can match what we just wrote
  const verify = await client.query(
    `SELECT email, password_hash FROM users WHERE email = $1`,
    ['estudiante@neuroedu.ia'],
  );
  const ok = await bcrypt.compare(PASSWORD, verify.rows[0].password_hash);
  console.log(`[seed] verify bcrypt.compare → ${ok ? '✓ OK' : '✗ FAIL'}`);

  await client.end();
  console.log(`[seed] done. Login with any of: ${USERS.map((u) => u.email).join(', ')} / ${PASSWORD}`);
}

main().catch((err) => {
  console.error('[seed] ERROR:', err);
  process.exit(1);
});
