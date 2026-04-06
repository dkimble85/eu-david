import { supabase } from '@/lib/supabase';

export type ProductReportIssueType = 'missing_ingredients' | 'misinformation';

type SubmitProductReportInput = {
  userId: string | null;
  barcode: string | null;
  productName: string;
  issueType: ProductReportIssueType;
  details: string;
  sourceScreen: 'search' | 'product';
};

function normalizeReportBarcode(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Keep OFF-style numeric barcodes only; avoid failing inserts on numeric DB columns.
  if (/^\d{8,14}$/.test(trimmed)) return trimmed;
  return null;
}

async function tryInsert(payload: Record<string, unknown>) {
  return supabase.from('product_reports').insert(payload);
}

export async function submitProductReport(input: SubmitProductReportInput): Promise<{
  ok: boolean;
  errorMessage?: string;
}> {
  const rawBarcode = input.barcode?.trim() || null;
  const safeBarcode = normalizeReportBarcode(rawBarcode);
  const detailsWithContext = input.details.trim()
    ? input.details.trim()
    : rawBarcode && !safeBarcode
      ? `Source product id: ${rawBarcode}`
      : '';

  const fullRawPayload = {
    user_id: input.userId,
    barcode: rawBarcode,
    product_name: input.productName,
    issue_type: input.issueType,
    details: detailsWithContext || null,
    source_screen: input.sourceScreen,
  };
  const fullNormalizedPayload = {
    ...fullRawPayload,
    barcode: safeBarcode,
  };

  // Attempt 1: full payload, raw barcode
  const first = await tryInsert(fullRawPayload);
  if (!first.error) return { ok: true };

  // Attempt 2: drop source_screen for older schemas.
  const secondPayload = {
    user_id: fullRawPayload.user_id,
    barcode: fullRawPayload.barcode,
    product_name: fullRawPayload.product_name,
    issue_type: fullRawPayload.issue_type,
    details: fullRawPayload.details,
  };
  const second = await tryInsert(secondPayload);
  if (!second.error) return { ok: true };

  // Attempt 3: full payload, normalized barcode.
  const third = await tryInsert(fullNormalizedPayload);
  if (!third.error) return { ok: true };

  // Attempt 4: normalized payload without source_screen.
  const fourthPayload = {
    user_id: fullNormalizedPayload.user_id,
    barcode: fullNormalizedPayload.barcode,
    product_name: fullNormalizedPayload.product_name,
    issue_type: fullNormalizedPayload.issue_type,
    details: fullNormalizedPayload.details,
  };
  const fourth = await tryInsert(fourthPayload);
  if (!fourth.error) return { ok: true };

  // Attempt 5: minimal payload with raw barcode.
  const fifthPayload = {
    user_id: fullRawPayload.user_id,
    barcode: fullRawPayload.barcode,
    product_name: fullRawPayload.product_name,
    issue_type: fullRawPayload.issue_type,
  };
  const fifth = await tryInsert(fifthPayload);
  if (!fifth.error) return { ok: true };

  // Attempt 6: minimal payload with normalized barcode.
  const sixthPayload = {
    user_id: fullNormalizedPayload.user_id,
    barcode: fullNormalizedPayload.barcode,
    product_name: fullNormalizedPayload.product_name,
    issue_type: fullNormalizedPayload.issue_type,
  };
  const sixth = await tryInsert(sixthPayload);
  if (!sixth.error) return { ok: true };

  // Attempt 7: no barcode column.
  const seventhPayload = {
    user_id: input.userId,
    product_name: input.productName,
    issue_type: input.issueType,
    details: detailsWithContext || null,
  };
  const seventh = await tryInsert(seventhPayload);
  if (!seventh.error) return { ok: true };

  // Attempt 8: absolute minimum.
  const eighthPayload = {
    product_name: input.productName,
    issue_type: input.issueType,
  };
  const eighth = await tryInsert(eighthPayload);
  if (!eighth.error) return { ok: true };

  const message =
    eighth.error?.message ||
    seventh.error?.message ||
    sixth.error?.message ||
    fifth.error?.message ||
    fourth.error?.message ||
    third.error?.message ||
    second.error?.message ||
    first.error.message;
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes('row-level security')) {
    return {
      ok: false,
      errorMessage: 'Reporting is blocked by Supabase RLS policy for this table.',
    };
  }

  if (normalizedMessage.includes('relation') && normalizedMessage.includes('does not exist')) {
    return {
      ok: false,
      errorMessage: 'Supabase table "product_reports" does not exist.',
    };
  }

  if (normalizedMessage.includes('column') && normalizedMessage.includes('does not exist')) {
    return {
      ok: false,
      errorMessage: 'Supabase table schema is missing one or more expected columns.',
    };
  }

  if (normalizedMessage.includes('not-null')) {
    return {
      ok: false,
      errorMessage: 'Supabase table has required columns missing from the report payload.',
    };
  }

  if (normalizedMessage.includes('invalid input syntax')) {
    return {
      ok: false,
      errorMessage: 'Supabase rejected the barcode format for this report.',
    };
  }

  return { ok: false, errorMessage: message };
}
