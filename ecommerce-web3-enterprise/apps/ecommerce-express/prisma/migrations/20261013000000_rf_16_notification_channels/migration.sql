-- AlterTable
ALTER TABLE "notification_preferences" ADD COLUMN     "sms" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsapp" BOOLEAN NOT NULL DEFAULT false;

