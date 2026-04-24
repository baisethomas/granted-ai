/**
 * shared/schema.ts
 *
 * Thin re-export of the canonical schema defined in `shared/schema-simple.ts`.
 *
 * Why this file exists:
 *   - `drizzle.config.ts` points at `shared/schema-simple.ts` for migrations.
 *   - The runtime Drizzle client (`server/db.ts`) imports from
 *     `shared/schema-simple.ts`.
 *   - Server modules historically imported their types from this file
 *     (`shared/schema.ts`). Keeping this file as a re-export avoids a
 *     mass import refactor while eliminating the type-vs-runtime drift that
 *     was causing `tsc --noEmit` errors (e.g. missing `DocumentExtraction`
 *     and `DocumentProcessingJob`, stale `documents` columns, etc.).
 *
 * If you need to add a new table or column, add it in `schema-simple.ts` and
 * generate a migration from there. This file should stay a pass-through plus
 * the two `Insert*` type aliases that intentionally differ from the
 * auto-generated insert schemas.
 */

export * from "./schema-simple.js";

import { users, documents } from "./schema-simple.js";
import { createInsertSchema } from "drizzle-zod";
import type { z } from "zod";

// Server-side insert types for users/documents.
//
// The auto-derived `createInsertSchema(users)` / `createInsertSchema(documents)`
// would mark `userId` and `organizationId` as required on Document inserts
// (they are notNull in the table). Our server passes those separately to
// `storage.createUser` / `storage.createDocument`, so the insert payload
// does not carry them. We preserve the historical `.pick()` subsets here so
// call sites in `server/storage.ts` keep working unchanged.

const _insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  organizationName: true,
  organizationType: true,
  ein: true,
  foundedYear: true,
  primaryContact: true,
  email: true,
  mission: true,
  focusAreas: true,
});
export type InsertUser = z.infer<typeof _insertUserSchema>;

const _insertDocumentSchema = createInsertSchema(documents).pick({
  filename: true,
  originalName: true,
  fileType: true,
  fileSize: true,
  category: true,
  summary: true,
  processed: true,
  embeddingStatus: true,
  chunkCount: true,
  embeddingModel: true,
  // `organizationId` is not implicit from the server-provided `userId`;
  // routes and storage both read `insertDocument.organizationId`, so it has
  // to be part of the insert payload type.
  organizationId: true,
  // Storage fields that live on the simple schema but were missing from the
  // old shared/schema.ts definition of documents.
  storageBucket: true,
  storagePath: true,
  storageUrl: true,
  processingStatus: true,
  processingError: true,
  processedAt: true,
  summaryExtractedAt: true,
  embeddingGeneratedAt: true,
});
export type InsertDocument = z.infer<typeof _insertDocumentSchema>;
