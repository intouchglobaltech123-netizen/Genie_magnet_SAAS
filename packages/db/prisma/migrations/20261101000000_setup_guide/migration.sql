-- The set-up guide on Home can be hidden for the whole agency (P1-32).

-- AlterTable
ALTER TABLE "agencies" ADD COLUMN     "setup_hidden_at" TIMESTAMP(3);
