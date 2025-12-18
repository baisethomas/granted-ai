import "../server/config";
import { processDocumentJobs } from "../server/workers/documentProcessor.js";

async function main() {
  const batchSize = Number(process.env.DOCUMENT_WORKER_BATCH_SIZE || "5");
  const summary = await processDocumentJobs({ batchSize });
  console.log(
    `[worker] Completed run: requested=${summary.requested}, processed=${summary.processed}, succeeded=${summary.succeeded}, failed=${summary.failed}, skipped=${summary.skipped}`
  );
  if (summary.details.length) {
    console.table(summary.details);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error("[worker] Unhandled error:", error);
  process.exit(1);
});
