import { MigrationInterface, QueryRunner } from "typeorm";
// [Migración · 2026-10-28 · Sin duplicados]: red de seguridad en BD para la regla anti-duplicados por título (shared/application/unique-title) ante carreras (dos altas simultáneas)
// 1) `aula_title_key(text)`: función SQL IMMUTABLE (requisito de un índice de expresión) = minúsculas + vocales/ñ/ç sin tilde + puntuación/espacios → un espacio
//    [Contrato]: IGUAL o MENOS agresiva que `titleKey` de JS (no toca escrituras no latinas ni marcas sueltas) → la BD nunca rechaza lo que la regla de la app permite
// 2) Un índice ÚNICO PARCIAL por tabla (solo filas vigentes: sin archivar/retirar) con el mismo ámbito que el caso de uso (idioma + nivel + tipo)
// [Seguridad de datos]: si una tabla YA tiene duplicados, su índice NO se crea (RAISE NOTICE con la tabla) → la migración nunca falla; la regla de la app sigue activa y el índice se crea al re-ejecutar tras limpiar
// `to_regclass` (PostgreSQL): null si la tabla no existe (BD parcial) → se omite | `IF NOT EXISTS`: idempotente | [Patrón]: Migration (up/down reversible) + Guard (DO $$ … $$)
// [Nota]: con DATABASE_SYNCHRONIZE=true TypeORM puede borrar índices que no declaran las entidades → en ese modo solo queda la regla de la app (producción usa migraciones)

// [TitleIndex]: ámbito de cada tabla | `cols`: expresiones SQL del ámbito (sin el título) | `where`: filas vigentes
interface TitleIndex {
    name: string;
    table: string;
    cols: string[];
    where?: string;
}

const KEY = `aula_title_key("title")`;
// [Ámbitos]: espejo de los casos de uso (create/update) de cada módulo | `COALESCE`: NULL ≠ NULL en un índice único → se compara como ''
const INDEXES: readonly TitleIndex[] = [
    { name: "UQ_title_songs", table: "songs", cols: [`"language"`, `"level"`], where: `"withdrawn_at" IS NULL` },
    { name: "UQ_title_dialogues", table: "dialogues", cols: [`"language"`], where: `"withdrawn_at" IS NULL` },
    { name: "UQ_title_practice_activities", table: "practice_activities", cols: [`"language"`, `"level"`, `"skill"`], where: `"archived_at" IS NULL` },
    { name: "UQ_title_reading_texts", table: "reading_texts", cols: [`"language"`, `"level"`], where: `"withdrawn_at" IS NULL` },
    { name: "UQ_title_game_decks", table: "game_decks", cols: [`"game_type"`, `"language"`, `COALESCE("level", '')`], where: `"archived_at" IS NULL` },
    { name: "UQ_title_grammar_topics", table: "grammar_topics", cols: [`COALESCE("language", '')`], where: `"archived_at" IS NULL` },
    { name: "UQ_title_polyglot_topics", table: "polyglot_topics", cols: [`COALESCE("language", '')`], where: `"archived_at" IS NULL` },
    { name: "UQ_title_quizzes", table: "quizzes", cols: [`"language"`, `"difficulty"`, `"category"`], where: `"source" = 'custom'` }, // Solo exámenes creados por docentes (los importados/IA tienen su propio flujo)
    { name: "UQ_title_courses", table: "courses", cols: [`"category_group"`, `"category"`] },
];

export class TitleDedup1791993650000 implements MigrationInterface {
    name = 'TitleDedup1791993650000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // `translate` (PostgreSQL): carácter a carácter (misma longitud en ambas listas) · `[[:punct:][:space:]]+` → un espacio · `btrim`: sin espacios en los extremos
        await queryRunner.query(`CREATE OR REPLACE FUNCTION aula_title_key(t text) RETURNS text
            LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $fn$
            SELECT btrim(regexp_replace(lower(translate(t,
                'áàâäãåéèêëíìîïóòôöõúùûüñçýÿÁÀÂÄÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÑÇÝ',
                'aaaaaaeeeeiiiiooooouuuuncyyAAAAAAEEEEIIIIOOOOOUUUUNCY')), '[[:punct:][:space:]]+', ' ', 'g'))
            $fn$`);
        for (const ix of INDEXES) {
            const scope = [...ix.cols, KEY].join(", ");
            const where = ix.where ? ` WHERE ${ix.where}` : "";
            // `format('%L')` no hace falta: nombres y expresiones son constantes de este archivo (nunca datos de usuario) | `$$` anidado con etiqueta propia ($do$)
            await queryRunner.query(`DO $do$
            BEGIN
                IF to_regclass('public.${ix.table}') IS NULL THEN
                    RAISE NOTICE 'TitleDedup: tabla ${ix.table} inexistente, se omite ${ix.name}';
                ELSIF EXISTS (SELECT 1 FROM "${ix.table}"${where} GROUP BY ${scope} HAVING count(*) > 1) THEN
                    RAISE NOTICE 'TitleDedup: ${ix.table} tiene títulos duplicados; no se crea ${ix.name} (la regla de la app sigue activa)';
                ELSE
                    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS "${ix.name}" ON "${ix.table}" (${scope.replace(/'/g, "''")})${where.replace(/'/g, "''")}';
                END IF;
            END
            $do$`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const ix of INDEXES) await queryRunner.query(`DROP INDEX IF EXISTS "${ix.name}"`);
        await queryRunner.query(`DROP FUNCTION IF EXISTS aula_title_key(text)`);
    }
}
