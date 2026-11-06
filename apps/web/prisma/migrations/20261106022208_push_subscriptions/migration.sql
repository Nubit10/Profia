-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_installationId_key" ON "push_subscriptions"("installationId");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_userId_idx" ON "push_subscriptions"("userId");

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- SPEC-0013 / ADR-0012: solo endpoints HTTPS y valores de tamaño acotado.
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_values_chk" CHECK (
  "endpoint" LIKE 'https://%'
  AND length("endpoint") <= 1024
  AND length("p256dh") BETWEEN 20 AND 200
  AND length("auth") BETWEEN 8 AND 100
  AND length("installationId") BETWEEN 16 AND 64
);
