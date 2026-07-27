import { DocumentNumberService, NUMBERED_DOCUMENTS } from './document-number.service';

/**
 * Sequence rules. Concurrency itself is covered by an advisory lock, verified
 * against the real database; these cover the arithmetic and the guard.
 */
describe('DocumentNumberService', () => {
  const svc = new DocumentNumberService();

  const manager = (rows: any[]) => ({
    query: jest.fn(async (sql: string) => (sql.includes('pg_advisory_xact_lock') ? [] : rows)),
  }) as any;

  describe('next', () => {
    it('starts at 0001 for an empty bucket', async () => {
      expect(await svc.next(manager([]), 'salaryReceipt', 'RS-2026-', 5, 2026)).toBe('RS-2026-0001');
    });

    it('continues from the highest number', async () => {
      expect(await svc.next(manager([{ number: 'RS-2026-0007' }]), 'salaryReceipt', 'RS-2026-', 5, 2026))
        .toBe('RS-2026-0008');
    });

    it('carries past a power of ten', async () => {
      expect(await svc.next(manager([{ number: 'RS-2026-0099' }]), 'salaryReceipt', 'RS-2026-', 5, 2026))
        .toBe('RS-2026-0100');
    });

    it('takes the bucket lock before reading', async () => {
      const m = manager([]);
      await svc.next(m, 'clientInvoice', 'F-2026-', 5, 2026);
      // The lock must be first: reading the max without it is what let two
      // callers both produce 0001 on an empty bucket.
      expect(m.query.mock.calls[0][0]).toContain('pg_advisory_xact_lock');
    });

    it('scopes the lock by document, owner and prefix', async () => {
      const m = manager([]);
      await svc.next(m, 'salaryReceipt', 'RS-2026-', 42, 2026);
      const key = m.query.mock.calls[0][1][0];
      expect(key).toContain('cjobs_salary_receipts');
      expect(key).toContain('42');
      expect(key).toContain('RS-2026-');
    });

    it('filters by owner and exact length', async () => {
      const m = manager([]);
      await svc.next(m, 'salaryReceipt', 'RS-2026-', 7, 2026);
      const [sql, params] = m.query.mock.calls[1];
      expect(sql).toContain('employer_id = $1');
      expect(sql).toContain('length(receipt_number) = $3');
      expect(params).toEqual([7, 'RS-2026-%', 'RS-2026-'.length + 4]);
    });
  });

  describe('isLast', () => {
    it('is true for the highest number', async () => {
      const m = manager([{ max: 'RS-2026-0009' }]);
      expect(await svc.isLast(m, 'salaryReceipt', 'RS-2026-0009', 5)).toBe(true);
    });

    it('is false for anything else', async () => {
      const m = manager([{ max: 'RS-2026-0009' }]);
      expect(await svc.isLast(m, 'salaryReceipt', 'RS-2026-0008', 5)).toBe(false);
    });

    it('is false with no number', async () => {
      expect(await svc.isLast(manager([]), 'salaryReceipt', null, 5)).toBe(false);
    });

    it('is false for a number too short to hold a counter', async () => {
      expect(await svc.isLast(manager([]), 'salaryReceipt', '0001', 5)).toBe(false);
    });
  });

  it('pads every document type to a fixed width', () => {
    // Mixed widths inside one bucket would break the lexicographic ORDER BY
    // that `next` relies on.
    for (const cfg of Object.values(NUMBERED_DOCUMENTS)) {
      expect(cfg.pad).toBeGreaterThan(0);
    }
  });
});
