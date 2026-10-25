import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1791980689448 implements MigrationInterface {
  name = 'InitialSchema1791980689448';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('USER', 'TEACHER', 'ADMIN')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(320) NOT NULL, "password_hash" character varying(255) NOT NULL, "first_name" character varying(80) NOT NULL, "last_name" character varying(80) NOT NULL, "role" "public"."users_role_enum" NOT NULL DEFAULT 'USER', "section" character varying(40), "is_active" boolean NOT NULL DEFAULT true, "is_email_verified" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_697b4077747937f4ff42b53b75" ON "users" ("section") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `,
    );
    await queryRunner.query(
      `CREATE TABLE "scores" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "quiz_id" uuid NOT NULL, "session_id" uuid NOT NULL, "points" double precision NOT NULL, "correct_count" integer NOT NULL, "total_questions" integer NOT NULL, "accuracy" double precision NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c36917e6f26293b91d04b8fd521" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_521bb772e850656ed16ae34fba" ON "scores" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9d576bdb4d79e4a2a4cd463515" ON "scores" ("quiz_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_683c8208c44184cae37649140c" ON "scores" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."questions_type_enum" AS ENUM('multiple_choice', 'true_false', 'open_answer')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."questions_difficulty_enum" AS ENUM('easy', 'medium', 'hard')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."questions_language_enum" AS ENUM('en', 'es', 'fr', 'de', 'pt', 'zh', 'ru')`,
    );
    await queryRunner.query(
      `CREATE TABLE "questions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "quiz_id" uuid NOT NULL, "text" text NOT NULL, "type" "public"."questions_type_enum" NOT NULL DEFAULT 'multiple_choice', "options" jsonb, "correct_answer" text NOT NULL, "difficulty" "public"."questions_difficulty_enum" NOT NULL DEFAULT 'medium', "language" "public"."questions_language_enum" NOT NULL DEFAULT 'en', "position" integer NOT NULL DEFAULT '0', "time_limit_seconds" integer, "explanation" text, "feedback" text, CONSTRAINT "PK_08a6d4b0f49ff300bf3a0ca60ac" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_46b3c125e02f7242662e4ccb30" ON "questions" ("quiz_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."quizzes_category_enum" AS ENUM('general', 'grammar', 'vocabulary', 'reading', 'listening', 'writing', 'speaking', 'pronunciation', 'custom', 'language', 'math', 'science', 'biology', 'physics', 'chemistry', 'history', 'geography', 'social_sciences', 'english', 'technology', 'art')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."quizzes_difficulty_enum" AS ENUM('easy', 'medium', 'hard')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."quizzes_language_enum" AS ENUM('en', 'es', 'fr', 'de', 'pt', 'zh', 'ru')`,
    );
    await queryRunner.query(
      `CREATE TABLE "quizzes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(160) NOT NULL, "description" text, "category" "public"."quizzes_category_enum" NOT NULL DEFAULT 'general', "difficulty" "public"."quizzes_difficulty_enum" NOT NULL DEFAULT 'medium', "language" "public"."quizzes_language_enum" NOT NULL DEFAULT 'en', "author_id" uuid NOT NULL, "source" character varying(32) NOT NULL DEFAULT 'custom', "time_per_question_seconds" integer NOT NULL DEFAULT '30', "is_published" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b24f0f7662cf6b3a0e7dba0a1b4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fdf2acd75df2194c71bdfb8e44" ON "quizzes" ("language") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_438ce0f24fadc0df69723bffc6" ON "quizzes" ("is_published") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d0c4bfcbcb84081d7ddaa7bbc2" ON "quizzes" ("category") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d00e656ff1e001844e2389ce17" ON "quizzes" ("author_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."achievements_code_enum" AS ENUM('first_quiz', 'perfect_score', 'streak_3', 'streak_10', 'speed_demon', 'points_1000', 'points_5000')`,
    );
    await queryRunner.query(
      `CREATE TABLE "achievements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "code" "public"."achievements_code_enum" NOT NULL, "title" character varying(160) NOT NULL, "description" text, "unlocked_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1bc19c37c6249f70186f318d71d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_b289413e3f31561d269de78ca8" ON "achievements" ("user_id", "code") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cd74882f69ff37d7330e89c63d" ON "achievements" ("code") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0c0cd24bc6e722c12cd4575043" ON "achievements" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."quiz_sessions_status_enum" AS ENUM('in_progress', 'completed', 'abandoned')`,
    );
    await queryRunner.query(
      `CREATE TABLE "quiz_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "quiz_id" uuid NOT NULL, "status" "public"."quiz_sessions_status_enum" NOT NULL DEFAULT 'in_progress', "answers" jsonb NOT NULL DEFAULT '[]'::jsonb, "total_score" double precision NOT NULL DEFAULT '0', "correct_count" integer NOT NULL DEFAULT '0', "started_at" TIMESTAMP NOT NULL DEFAULT now(), "completed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_db4ac35661dd2f29269b272a4c2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2f3005ad9fd7315dc2d515a57c" ON "quiz_sessions" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7d5e2cc965658e66690ca6533c" ON "quiz_sessions" ("quiz_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b800b1dc82988f43429fc276e6" ON "quiz_sessions" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_profiles_education_level_enum" AS ENUM('PRIMARY', 'SECONDARY', 'TECHNICAL', 'UNDERGRADUATE', 'POSTGRADUATE', 'PHD', 'OTHER')`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_profiles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "full_name" character varying(160) NOT NULL, "date_of_birth" date, "education_level" "public"."user_profiles_education_level_enum", "productive_activity" character varying(120), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_6ca9503d77ae39b4b5a6cc3ba88" UNIQUE ("user_id"), CONSTRAINT "REL_6ca9503d77ae39b4b5a6cc3ba8" UNIQUE ("user_id"), CONSTRAINT "PK_1ec6662219f4605723f1e41b6cb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_6ca9503d77ae39b4b5a6cc3ba8" ON "user_profiles" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."feedback_ia_strategy_used_enum" AS ENUM('similarity', 'llm_rubric', 'exact_match')`,
    );
    await queryRunner.query(
      `CREATE TABLE "feedback_ia" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "session_id" uuid NOT NULL, "question_id" uuid NOT NULL, "user_id" uuid NOT NULL, "content" text NOT NULL, "suggestion" text, "score" double precision NOT NULL, "is_correct" boolean NOT NULL, "confidence" double precision, "model" character varying(64) NOT NULL, "strategy_used" "public"."feedback_ia_strategy_used_enum" NOT NULL, "latency_ms" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_573fde3e485a3f7d3950de40a46" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_19f2328a92303c46ed1f334e50" ON "feedback_ia" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_852bdc86b85b93e0df70e41338" ON "feedback_ia" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fc03de9c2a78e0692678322cdb" ON "feedback_ia" ("question_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5e43710f665cc759e3e8c5c1ec" ON "feedback_ia" ("session_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_type_enum" AS ENUM('ACHIEVEMENT', 'SCORE', 'EMAIL_VERIFY', 'PASSWORD_RESET', 'QUIZ_PUBLISHED', 'LOGIN_DEVICE', 'SYSTEM')`,
    );
    await queryRunner.query(
      `CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "type" "public"."notifications_type_enum" NOT NULL, "title" character varying(255) NOT NULL, "body" text NOT NULL, "payload" jsonb, "is_read" boolean NOT NULL DEFAULT false, "read_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_77ee7b06d6f802000c0846f3a5" ON "notifications" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_af08fad7c04bb85403970afdc1" ON "notifications" ("user_id", "is_read") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9a8a82462cab47c73d25f49261" ON "notifications" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."curriculum_topics_language_enum" AS ENUM('en', 'es', 'fr', 'de', 'pt', 'zh', 'ru')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."curriculum_topics_level_enum" AS ENUM('A1', 'A2', 'B1', 'B2', 'C1', 'C2')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."curriculum_topics_skill_enum" AS ENUM('grammar', 'vocabulary', 'reading', 'listening', 'writing', 'speaking', 'pronunciation')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."curriculum_topics_kind_enum" AS ENUM('grammar_rule', 'vocabulary', 'example', 'translation', 'pronunciation', 'common_error', 'exercise', 'rubric')`,
    );
    await queryRunner.query(
      `CREATE TABLE "curriculum_topics" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(160) NOT NULL, "slug" character varying(120) NOT NULL, "language" "public"."curriculum_topics_language_enum" NOT NULL, "level" "public"."curriculum_topics_level_enum" NOT NULL, "skill" "public"."curriculum_topics_skill_enum" NOT NULL, "kind" "public"."curriculum_topics_kind_enum", "parent_id" uuid, "created_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_curriculum_topic" UNIQUE ("language", "level", "skill", "slug"), CONSTRAINT "PK_78aefd012fe028243cd9ffa06f9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_curriculum_topic_combo" ON "curriculum_topics" ("language", "level", "skill") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."curriculum_topic_labels_language_enum" AS ENUM('en', 'es', 'fr', 'de', 'pt', 'zh', 'ru')`,
    );
    await queryRunner.query(
      `CREATE TABLE "curriculum_topic_labels" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "language" "public"."curriculum_topic_labels_language_enum" NOT NULL, "topic_slug" character varying(160) NOT NULL, "label" character varying(160) NOT NULL, "ipa" character varying(200), "ipa_variant" character varying(20), "part_of_speech" character varying(40), "updated_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_curriculum_topic_label" UNIQUE ("language", "topic_slug"), CONSTRAINT "PK_6b8aa7643b038ef874e81f0a604" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "curriculum_sources" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(160) NOT NULL, "slug" character varying(120) NOT NULL, "type" character varying(40), "author" character varying(160), "publisher" character varying(160), "url" character varying(500), "license" character varying(160), "language" character varying(10), "attribution" text NOT NULL, "is_own_content" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_0ad1bcbc3d667df606fb28b8bf4" UNIQUE ("slug"), CONSTRAINT "PK_ad1d3c5b75646b83cd6cf0237c0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."curriculum_items_kind_enum" AS ENUM('grammar_rule', 'vocabulary', 'example', 'translation', 'pronunciation', 'common_error', 'exercise', 'rubric')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."curriculum_items_language_enum" AS ENUM('en', 'es', 'fr', 'de', 'pt', 'zh', 'ru')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."curriculum_items_level_enum" AS ENUM('A1', 'A2', 'B1', 'B2', 'C1', 'C2')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."curriculum_items_skill_enum" AS ENUM('grammar', 'vocabulary', 'reading', 'listening', 'writing', 'speaking', 'pronunciation')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."curriculum_items_provenance_enum" AS ENUM('manual', 'imported', 'generated', 'expert_validated')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."curriculum_items_review_status_enum" AS ENUM('draft', 'in_review', 'approved', 'rejected', 'archived')`,
    );
    await queryRunner.query(
      `CREATE TABLE "curriculum_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "key" character varying(120) NOT NULL, "kind" "public"."curriculum_items_kind_enum" NOT NULL, "language" "public"."curriculum_items_language_enum" NOT NULL, "level" "public"."curriculum_items_level_enum" NOT NULL, "skill" "public"."curriculum_items_skill_enum" NOT NULL, "topic" character varying(160) NOT NULL, "content" jsonb NOT NULL, "provenance" "public"."curriculum_items_provenance_enum" NOT NULL DEFAULT 'manual', "review_status" "public"."curriculum_items_review_status_enum" NOT NULL DEFAULT 'draft', "source" character varying(300), "topic_id" uuid, "source_id" uuid, "review_note" text, "generation_id" uuid, "version" integer NOT NULL, "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "reviewed_by" uuid, "reviewed_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_curriculum_natural_key" UNIQUE ("language", "kind", "key"), CONSTRAINT "PK_901c852f67af6681f15dc8a60c0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_curriculum_status" ON "curriculum_items" ("review_status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_curriculum_lang_level_skill" ON "curriculum_items" ("language", "level", "skill") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."curriculum_item_revisions_change_type_enum" AS ENUM('created', 'updated', 'status_changed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "curriculum_item_revisions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "item_id" uuid NOT NULL, "version" integer NOT NULL, "change_type" "public"."curriculum_item_revisions_change_type_enum" NOT NULL, "snapshot" jsonb NOT NULL, "changed_by" uuid NOT NULL, "note" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_f13de792797e1f82d543497aa2c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_curriculum_revision_item" ON "curriculum_item_revisions" ("item_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."curriculum_generations_kind_enum" AS ENUM('grammar_rule', 'vocabulary', 'example', 'translation', 'pronunciation', 'common_error', 'exercise', 'rubric')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."curriculum_generations_language_enum" AS ENUM('en', 'es', 'fr', 'de', 'pt', 'zh', 'ru')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."curriculum_generations_level_enum" AS ENUM('A1', 'A2', 'B1', 'B2', 'C1', 'C2')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."curriculum_generations_skill_enum" AS ENUM('grammar', 'vocabulary', 'reading', 'listening', 'writing', 'speaking', 'pronunciation')`,
    );
    await queryRunner.query(
      `CREATE TABLE "curriculum_generations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "request_hash" character(64) NOT NULL, "kind" "public"."curriculum_generations_kind_enum" NOT NULL, "language" "public"."curriculum_generations_language_enum" NOT NULL, "level" "public"."curriculum_generations_level_enum" NOT NULL, "skill" "public"."curriculum_generations_skill_enum" NOT NULL, "topic" character varying(160) NOT NULL, "content" jsonb NOT NULL, "model" character varying(120) NOT NULL, "model_digest" character varying(80), "quantization" character varying(40), "parameter_size" character varying(40), "prompt_tokens" integer, "output_tokens" integer, "latency_ms" integer, "load_ms" integer, "ram_bytes" bigint, "vram_bytes" bigint, "prompt_version" character varying(20) NOT NULL, "flags" jsonb NOT NULL, "created_by" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1ac437e515c50290c11f34ccc1c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c3fd85d17e59e27eef7d53d017" ON "curriculum_generations" ("request_hash") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."courses_category_enum" AS ENUM('A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'DIPLOMADO_I', 'DIPLOMADO_II', 'DIPLOMADO_III', 'DIPLOMADO_IV', 'DIPLOMADO_V', 'DIPLOMADO_VI', 'DIPLOMADO_VII', 'DIPLOMADO_VIII', 'DIPLOMADO_IX', 'DIPLOMADO_X', 'DIPLOMADO_XI', 'DIPLOMADO_XII', 'MASTER_CLASS', 'FACULTAD_SUPERIOR', 'FACULTAD_SUBORDINADA', 'COMPETENCIA_GENERAL_HUMANA', 'COMPETENCIA_FUNDAMENTAL', 'COMPETENCIA_PRODUCTIVA', 'DIMENSION_HUMANA', 'PRINCIPIO_CIENTIFICO', 'VALOR_CIENTIFICO', 'STEM_SCIENCE', 'STEM_TECHNOLOGY', 'STEM_ENGINEERING', 'STEM_ARTS', 'STEM_MATHEMATICS')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."courses_category_group_enum" AS ENUM('EN', 'FR', 'DE', 'ES', 'PT', 'ZH', 'RU', 'DIPLOMADO', 'MASTER_CLASS', 'FACULTAD', 'COMPETENCIA', 'DIMENSION', 'PRINCIPIO', 'VALOR', 'STEM')`,
    );
    await queryRunner.query(
      `CREATE TABLE "courses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(200) NOT NULL, "slug" character varying(220) NOT NULL, "shortDescription" text NOT NULL, "description" text, "category" "public"."courses_category_enum" NOT NULL, "category_group" "public"."courses_category_group_enum" NOT NULL, "instructor" character varying(120) NOT NULL, "instructor_title" character varying(160), "color" character varying(9) NOT NULL DEFAULT '#1B7EC8', "icon" character varying(8) NOT NULL DEFAULT '🎓', "tags" text NOT NULL DEFAULT '', "eje" smallint NOT NULL DEFAULT '1', "lab" character varying(60), "price" numeric(10,2) NOT NULL DEFAULT '0', "original_price" numeric(10,2), "currency" character varying(3) NOT NULL DEFAULT 'USD', "duration_hours" smallint NOT NULL DEFAULT '0', "level" character varying(30) NOT NULL DEFAULT 'Intermedio', "rating" numeric(3,2) NOT NULL DEFAULT '0', "students_count" integer NOT NULL DEFAULT '0', "modality" character varying(20) NOT NULL DEFAULT 'Online', "is_pro_bono" boolean NOT NULL DEFAULT false, "is_published" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_a3bb2d01cfa0f95bc5e034e1b7a" UNIQUE ("slug"), CONSTRAINT "PK_3f70a487cc718ad8eda4e6d58c9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ab4e4fa8ff0102b92ef66cbf0c" ON "courses" ("is_pro_bono") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_864bc5a8c788da3e9eed7064f7" ON "courses" ("is_published") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_925700d41dadfbe84486bd1243" ON "courses" ("category_group") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1ac2924c6479e5fa4fc5d1eec9" ON "courses" ("category") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."course_materials_kind_enum" AS ENUM('video', 'pdf', 'image')`,
    );
    await queryRunner.query(
      `CREATE TABLE "course_materials" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "course_id" uuid NOT NULL, "title" character varying(200) NOT NULL, "kind" "public"."course_materials_kind_enum" NOT NULL, "storage_key" character varying(255) NOT NULL, "original_name" character varying(255) NOT NULL, "mime_type" character varying(100) NOT NULL, "size_bytes" bigint NOT NULL, "position" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b8d788301b7ea04c1cefc4bd2ca" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0e78595266f6912e0965334bcd" ON "course_materials" ("course_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "course_enrollments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "course_id" uuid NOT NULL, "progress" smallint NOT NULL DEFAULT '0', "is_favorite" boolean NOT NULL DEFAULT false, "reaction_like" boolean NOT NULL DEFAULT false, "reaction_love" boolean NOT NULL DEFAULT false, "purchased_at" TIMESTAMP WITH TIME ZONE, "completed_material_ids" uuid array NOT NULL DEFAULT '{}', "completed_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_609f6e4f0fc9a6149a35211b380" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ac52967707330a4fedfc361f72" ON "course_enrollments" ("course_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9d12f69999cde26f955139a5fd" ON "course_enrollments" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_1a912a74aa76087c9f9a0cdf97" ON "course_enrollments" ("user_id", "course_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "auth_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "refresh_token_hash" character varying(255) NOT NULL, "user_agent" character varying(255), "ip_address" character varying(64), "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "is_revoked" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_641507381f32580e8479efc36cd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_50ccaa6440288a06f0ba693ccc" ON "auth_sessions" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "password_reset_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "token_hash" character varying(255) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_91185d86d5d7557b19abbb2868b" UNIQUE ("token_hash"), CONSTRAINT "PK_d16bebd73e844c48bca50ff8d3d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7c038e5a589b06cbe4320cc88b" ON "password_reset_tokens" ("expires_at") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_91185d86d5d7557b19abbb2868" ON "password_reset_tokens" ("token_hash") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_52ac39dd8a28730c63aeb428c9" ON "password_reset_tokens" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "email_verification_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "token_hash" character varying(255) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_c20ed35f3d31d486aabcd0564da" UNIQUE ("token_hash"), CONSTRAINT "PK_417a095bbed21c2369a6a01ab9a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b7c64ecae33a54d3a11a4e6b6e" ON "email_verification_tokens" ("expires_at") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_c20ed35f3d31d486aabcd0564d" ON "email_verification_tokens" ("token_hash") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fdcb77f72f529bf65c95d72a14" ON "email_verification_tokens" ("user_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "questions" ADD CONSTRAINT "FK_46b3c125e02f7242662e4ccb307" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_profiles" ADD CONSTRAINT "FK_6ca9503d77ae39b4b5a6cc3ba88" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_enrollments" ADD CONSTRAINT "FK_ac52967707330a4fedfc361f72e" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "course_enrollments" DROP CONSTRAINT "FK_ac52967707330a4fedfc361f72e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_profiles" DROP CONSTRAINT "FK_6ca9503d77ae39b4b5a6cc3ba88"`,
    );
    await queryRunner.query(
      `ALTER TABLE "questions" DROP CONSTRAINT "FK_46b3c125e02f7242662e4ccb307"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fdcb77f72f529bf65c95d72a14"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c20ed35f3d31d486aabcd0564d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b7c64ecae33a54d3a11a4e6b6e"`,
    );
    await queryRunner.query(`DROP TABLE "email_verification_tokens"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_52ac39dd8a28730c63aeb428c9"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_91185d86d5d7557b19abbb2868"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7c038e5a589b06cbe4320cc88b"`,
    );
    await queryRunner.query(`DROP TABLE "password_reset_tokens"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_50ccaa6440288a06f0ba693ccc"`,
    );
    await queryRunner.query(`DROP TABLE "auth_sessions"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1a912a74aa76087c9f9a0cdf97"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9d12f69999cde26f955139a5fd"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ac52967707330a4fedfc361f72"`,
    );
    await queryRunner.query(`DROP TABLE "course_enrollments"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0e78595266f6912e0965334bcd"`,
    );
    await queryRunner.query(`DROP TABLE "course_materials"`);
    await queryRunner.query(`DROP TYPE "public"."course_materials_kind_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1ac2924c6479e5fa4fc5d1eec9"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_925700d41dadfbe84486bd1243"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_864bc5a8c788da3e9eed7064f7"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ab4e4fa8ff0102b92ef66cbf0c"`,
    );
    await queryRunner.query(`DROP TABLE "courses"`);
    await queryRunner.query(`DROP TYPE "public"."courses_category_group_enum"`);
    await queryRunner.query(`DROP TYPE "public"."courses_category_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c3fd85d17e59e27eef7d53d017"`,
    );
    await queryRunner.query(`DROP TABLE "curriculum_generations"`);
    await queryRunner.query(
      `DROP TYPE "public"."curriculum_generations_skill_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."curriculum_generations_level_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."curriculum_generations_language_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."curriculum_generations_kind_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."ix_curriculum_revision_item"`,
    );
    await queryRunner.query(`DROP TABLE "curriculum_item_revisions"`);
    await queryRunner.query(
      `DROP TYPE "public"."curriculum_item_revisions_change_type_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."ix_curriculum_lang_level_skill"`,
    );
    await queryRunner.query(`DROP INDEX "public"."ix_curriculum_status"`);
    await queryRunner.query(`DROP TABLE "curriculum_items"`);
    await queryRunner.query(
      `DROP TYPE "public"."curriculum_items_review_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."curriculum_items_provenance_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."curriculum_items_skill_enum"`);
    await queryRunner.query(`DROP TYPE "public"."curriculum_items_level_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."curriculum_items_language_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."curriculum_items_kind_enum"`);
    await queryRunner.query(`DROP TABLE "curriculum_sources"`);
    await queryRunner.query(`DROP TABLE "curriculum_topic_labels"`);
    await queryRunner.query(
      `DROP TYPE "public"."curriculum_topic_labels_language_enum"`,
    );
    await queryRunner.query(`DROP INDEX "public"."ix_curriculum_topic_combo"`);
    await queryRunner.query(`DROP TABLE "curriculum_topics"`);
    await queryRunner.query(`DROP TYPE "public"."curriculum_topics_kind_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."curriculum_topics_skill_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."curriculum_topics_level_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."curriculum_topics_language_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9a8a82462cab47c73d25f49261"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_af08fad7c04bb85403970afdc1"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_77ee7b06d6f802000c0846f3a5"`,
    );
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5e43710f665cc759e3e8c5c1ec"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fc03de9c2a78e0692678322cdb"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_852bdc86b85b93e0df70e41338"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_19f2328a92303c46ed1f334e50"`,
    );
    await queryRunner.query(`DROP TABLE "feedback_ia"`);
    await queryRunner.query(
      `DROP TYPE "public"."feedback_ia_strategy_used_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6ca9503d77ae39b4b5a6cc3ba8"`,
    );
    await queryRunner.query(`DROP TABLE "user_profiles"`);
    await queryRunner.query(
      `DROP TYPE "public"."user_profiles_education_level_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b800b1dc82988f43429fc276e6"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7d5e2cc965658e66690ca6533c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2f3005ad9fd7315dc2d515a57c"`,
    );
    await queryRunner.query(`DROP TABLE "quiz_sessions"`);
    await queryRunner.query(`DROP TYPE "public"."quiz_sessions_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0c0cd24bc6e722c12cd4575043"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_cd74882f69ff37d7330e89c63d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b289413e3f31561d269de78ca8"`,
    );
    await queryRunner.query(`DROP TABLE "achievements"`);
    await queryRunner.query(`DROP TYPE "public"."achievements_code_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d00e656ff1e001844e2389ce17"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d0c4bfcbcb84081d7ddaa7bbc2"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_438ce0f24fadc0df69723bffc6"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fdf2acd75df2194c71bdfb8e44"`,
    );
    await queryRunner.query(`DROP TABLE "quizzes"`);
    await queryRunner.query(`DROP TYPE "public"."quizzes_language_enum"`);
    await queryRunner.query(`DROP TYPE "public"."quizzes_difficulty_enum"`);
    await queryRunner.query(`DROP TYPE "public"."quizzes_category_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_46b3c125e02f7242662e4ccb30"`,
    );
    await queryRunner.query(`DROP TABLE "questions"`);
    await queryRunner.query(`DROP TYPE "public"."questions_language_enum"`);
    await queryRunner.query(`DROP TYPE "public"."questions_difficulty_enum"`);
    await queryRunner.query(`DROP TYPE "public"."questions_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_683c8208c44184cae37649140c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9d576bdb4d79e4a2a4cd463515"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_521bb772e850656ed16ae34fba"`,
    );
    await queryRunner.query(`DROP TABLE "scores"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_697b4077747937f4ff42b53b75"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
  }
}
