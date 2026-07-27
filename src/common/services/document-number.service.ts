import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

/**
 * Which tables may be numbered. Table and column names are interpolated into
 * SQL, so they must never come from a request — only from this list.
 */
export const NUMBERED_DOCUMENTS = {
  salaryReceipt: { table: 'cjobs_salary_receipts', column: 'receipt_number', scope: 'employer_id', pad: 4 },
  clientInvoice: { table: 'cjobs_client_invoices', column: 'invoice_number', scope: 'employer_id', pad: 4 },
  autofactura: { table: 'cjobs_autofacturas', column: 'autofactura_number', scope: 'partner_id', pad: 2 },
} as const;

export type NumberedDocument = keyof typeof NUMBERED_DOCUMENTS;

/**
 * Sequential document numbers, per scope and year.
 *
 * Spanish law requires an unbroken sequence within a series, so this is MAX+1
 * rather than COUNT+1 — counting reuses a number after any delete, and two
 * concurrent issues get the same one.
 */
@Injectable()
export class DocumentNumberService {
  /**
   * Next number for a bucket, e.g. RS-2026-0007.
   *
   * Must run inside a transaction. Takes a transaction-scoped advisory lock on
   * the bucket rather than relying on SELECT ... FOR UPDATE, which locks
   * nothing when the bucket is still empty — the case where two concurrent
   * callers would otherwise both produce 0001.
   */
  async next(
    manager: EntityManager,
    doc: NumberedDocument,
    prefix: string,
    scopeValue: number,
    year: number,
  ): Promise<string> {
    const { table, column, scope, pad } = NUMBERED_DOCUMENTS[doc];
    const bucket = `${table}:${scope}:${scopeValue}:${prefix}`;
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [bucket]);

    const like = `${prefix}%`;
    const rows = await manager.query(
      `SELECT ${column} AS number FROM ${table}
        WHERE ${scope} = $1 AND ${column} LIKE $2 AND length(${column}) = $3
        ORDER BY ${column} DESC
        LIMIT 1`,
      [scopeValue, like, prefix.length + pad],
    );

    let next = 1;
    if (rows.length > 0) {
      const tail = parseInt(String(rows[0].number).slice(prefix.length), 10);
      if (Number.isFinite(tail)) next = tail + 1;
    }
    return `${prefix}${String(next).padStart(pad, '0')}`;
  }

  /**
   * Whether this is the highest number in its bucket. Only the last document
   * may be deleted, so the sequence keeps no holes.
   */
  async isLast(
    manager: EntityManager,
    doc: NumberedDocument,
    number: string | null,
    scopeValue: number,
  ): Promise<boolean> {
    if (!number) return false;
    const { table, column, scope, pad } = NUMBERED_DOCUMENTS[doc];
    if (number.length <= pad) return false;
    const prefix = number.slice(0, number.length - pad);
    const rows = await manager.query(
      `SELECT MAX(${column}) AS max FROM ${table}
        WHERE ${scope} = $1 AND ${column} LIKE $2 AND length(${column}) = $3`,
      [scopeValue, `${prefix}%`, number.length],
    );
    return rows[0]?.max === number;
  }
}
