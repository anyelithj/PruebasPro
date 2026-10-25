-- AlterTable
ALTER TABLE "contact_submissions" ADD COLUMN     "category" VARCHAR(20),
ADD COLUMN     "priority" VARCHAR(10);

-- CreateIndex
CREATE INDEX "contact_submissions_category_idx" ON "contact_submissions"("category");
