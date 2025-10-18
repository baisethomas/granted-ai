import "../server/config";
import { processDocumentJobs } from "../server/workers/documentProcessor.js";

async function main() {
  const batchSize = Number(process.env.DOCUMENT_WORKER_BATCH_SIZE || "5");
  await processDocumentJobs({ batchSize });
  process.exit(0);
}

main().catch((error) => {
  console.error("[worker] Unhandled error:", error);
  process.exit(1);
});
