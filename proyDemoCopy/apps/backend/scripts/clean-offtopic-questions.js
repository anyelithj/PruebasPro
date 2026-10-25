// [Limpieza one-off]: borra preguntas off-topic generadas por el bug de anchoring
// del prompt IA (ejemplos "capital de Francia" / fotosíntesis copiados por el modelo).
// Uso:  node scripts/clean-offtopic-questions.js          → dry-run (solo lista)
//       node scripts/clean-offtopic-questions.js --apply  → borra y re-numera positions
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

for (const line of fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

// [Criterios por quiz]: patrón de texto que identifica la pregunta off-topic.
// "Fundamentos de Matemáticas": las 10 son geografía → patrón amplio.
const RULES = [
  {
    quizTitle: 'Fundamentos de Matemáticas',
    pattern: /capital de|montaña más alta|río más largo|sistema solar/i,
  },
  {
    quizTitle: 'Fundamentos de Seguridad Informática',
    pattern: /capital de|fotosíntesis/i,
  },
  {
    quizTitle: 'Introducción a la Historia Universal',
    pattern: /fotosíntesis/i,
  },
  {
    quizTitle: 'Conceptos Básicos de Biología',
    pattern: /capital de|unión científica/i,
  },
];

const apply = process.argv.includes('--apply');

const c = new Client({
  host: process.env.DATABASE_HOST,
  port: +process.env.DATABASE_PORT,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
});

(async () => {
  await c.connect();
  let totalDeleted = 0;

  for (const rule of RULES) {
    const { rows } = await c.query(
      'SELECT qq.id, qq.position, qq.text FROM questions qq ' +
        'JOIN quizzes q ON q.id = qq.quiz_id WHERE q.title = $1 ORDER BY qq.position',
      [rule.quizTitle],
    );
    const doomed = rows.filter((r) => rule.pattern.test(r.text));
    if (doomed.length === 0) continue;

    console.log(`\n=== ${rule.quizTitle} — ${doomed.length}/${rows.length} preguntas off-topic ===`);
    for (const d of doomed) console.log(`  [${d.position}] ${d.text.slice(0, 80)}`);

    if (apply) {
      await c.query('DELETE FROM questions WHERE id = ANY($1::uuid[])', [
        doomed.map((d) => d.id),
      ]);
      // [Re-numerar positions]: deja 0..n-1 contiguo en las preguntas restantes
      const { rows: remaining } = await c.query(
        'SELECT qq.id FROM questions qq JOIN quizzes q ON q.id = qq.quiz_id ' +
          'WHERE q.title = $1 ORDER BY qq.position',
        [rule.quizTitle],
      );
      for (let i = 0; i < remaining.length; i++) {
        await c.query('UPDATE questions SET position = $1 WHERE id = $2', [i, remaining[i].id]);
      }
      totalDeleted += doomed.length;
      console.log(`  → borradas ${doomed.length}, quedan ${remaining.length}`);
    }
  }

  console.log(
    apply
      ? `\nTotal borradas: ${totalDeleted}`
      : '\n[DRY-RUN] Nada borrado. Ejecuta con --apply para aplicar.',
  );
  await c.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
