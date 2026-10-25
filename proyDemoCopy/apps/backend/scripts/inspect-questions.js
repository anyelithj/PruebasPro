// [Diagnóstico one-off]: lista preguntas por quiz para detectar mezcla de temas
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// [Parse .env manual]: dotenv no está como dependencia directa
for (const line of fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const c = new Client({
  host: process.env.DATABASE_HOST,
  port: +process.env.DATABASE_PORT,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
});

(async () => {
  await c.connect();
  const r = await c.query(
    "SELECT q.title, qq.position, left(qq.text, 80) AS question " +
      'FROM quizzes q JOIN questions qq ON qq.quiz_id = q.id ' +
      'ORDER BY q.title, qq.position',
  );
  let last = null;
  for (const row of r.rows) {
    if (row.title !== last) {
      console.log('\n=== ' + row.title + ' ===');
      last = row.title;
    }
    console.log(`  [${row.position}] ${row.question}`);
  }
  await c.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
