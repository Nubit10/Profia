-- SPEC-0017 RN-04: el docente independiente no confirma la autorización; consentAt queda null.
ALTER TABLE "piars" ALTER COLUMN "consentAt" DROP NOT NULL;
