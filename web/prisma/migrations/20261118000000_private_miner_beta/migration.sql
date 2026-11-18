ALTER TABLE "users" ADD COLUMN "minerBetaAccess" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "beta_applications" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "beta_applications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "beta_applications_contact_check" CHECK (
        ("userId" IS NOT NULL AND "email" IS NULL AND "phone" IS NULL)
        OR ("userId" IS NULL AND "email" IS NOT NULL AND "phone" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "beta_applications_userId_key" ON "beta_applications"("userId");
CREATE UNIQUE INDEX "beta_applications_email_key" ON "beta_applications"("email");
CREATE INDEX "beta_applications_createdAt_id_idx" ON "beta_applications"("createdAt", "id");
ALTER TABLE "beta_applications" ADD CONSTRAINT "beta_applications_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
