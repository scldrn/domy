import type {
  BulkConfirmInput,
  BulkConfirmResult,
  BulkPreviewInput,
  BulkPreviewRow,
} from "@domy/domain";
import { api, unwrap } from "@/lib/api-client";

/** Calls of bulk registration (User Story 4). */

export async function previewBulk(input: BulkPreviewInput): Promise<BulkPreviewRow[]> {
  const { rows } = await unwrap(api.api.bulk.preview.$post({ json: input }));
  return rows;
}

export async function confirmBulk(input: BulkConfirmInput): Promise<BulkConfirmResult> {
  return unwrap(api.api.bulk.confirm.$post({ json: input }));
}
