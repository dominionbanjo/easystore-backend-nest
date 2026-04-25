import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMessagingTables1745582400000 implements MigrationInterface {
  name = 'AddMessagingTables1745582400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    /* ────────────────────────────────────────────────
       CONVERSATIONS
    ──────────────────────────────────────────────── */
    await queryRunner.query(`
      CREATE TABLE "conversations" (
        "id"                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "participant_one_id"      UUID NOT NULL
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "participant_two_id"      UUID NOT NULL
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "participant_one_unread"  INTEGER NOT NULL DEFAULT 0,
        "participant_two_unread"  INTEGER NOT NULL DEFAULT 0,
        "last_message_preview"    TEXT,
        "last_message_at"         TIMESTAMPTZ,
        "created_at"              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "UQ_CONVERSATION_PARTICIPANTS"
          UNIQUE ("participant_one_id", "participant_two_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_CONVERSATION_P1" ON "conversations"("participant_one_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_CONVERSATION_P2" ON "conversations"("participant_two_id")
    `);

    /* ────────────────────────────────────────────────
       MESSAGES
    ──────────────────────────────────────────────── */
    await queryRunner.query(`
      CREATE TABLE "messages" (
        "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "sender_id"        UUID NOT NULL
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "recipient_id"     UUID
          REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
        "conversation_id"  UUID
          REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "is_public"        BOOLEAN NOT NULL DEFAULT FALSE,
        "content"          TEXT NOT NULL,
        "product_id"       UUID,
        "product_name"     VARCHAR(255),
        "product_image"    TEXT,
        "product_slug"     VARCHAR(255),
        "delivered_at"     TIMESTAMPTZ,
        "read_at"          TIMESTAMPTZ,
        "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_MESSAGE_SENDER_ID"       ON "messages"("sender_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_MESSAGE_RECIPIENT_ID"    ON "messages"("recipient_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_MESSAGE_CONVERSATION_ID" ON "messages"("conversation_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_MESSAGE_IS_PUBLIC"       ON "messages"("is_public")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_MESSAGE_CREATED_AT"      ON "messages"("created_at" DESC)
    `);

    /* ────────────────────────────────────────────────
       MESSAGE READS (chatroom only)
    ──────────────────────────────────────────────── */
    await queryRunner.query(`
      CREATE TABLE "message_reads" (
        "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "message_id" UUID NOT NULL
          REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "user_id"    UUID NOT NULL
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "read_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "UQ_MESSAGE_READ" UNIQUE ("message_id", "user_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_MESSAGE_READ_MESSAGE_ID" ON "message_reads"("message_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_MESSAGE_READ_USER_ID"    ON "message_reads"("user_id")
    `);

    /* ────────────────────────────────────────────────
       updated_at TRIGGER (conversations + messages)
       Re-uses the same pattern as other tables in the DB.
    ──────────────────────────────────────────────── */
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    for (const tbl of ['conversations', 'messages']) {
      await queryRunner.query(`
        CREATE TRIGGER "trg_${tbl}_updated_at"
        BEFORE UPDATE ON "${tbl}"
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
      `);
    }
  }

  /* ────────────────────────────────────────────────
     DOWN
  ──────────────────────────────────────────────── */
  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const tbl of ['conversations', 'messages']) {
      await queryRunner.query(
        `DROP TRIGGER IF EXISTS "trg_${tbl}_updated_at" ON "${tbl}"`,
      );
    }

    await queryRunner.query(`DROP TABLE IF EXISTS "message_reads"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "messages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "conversations"`);
  }
}
