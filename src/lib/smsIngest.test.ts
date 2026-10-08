import { describe, expect, it } from 'vitest';
import { composeIngestText } from '../../supabase/functions/_shared/sms-ingest-core.ts';
import { isBankSmsLike, parseBankSmsTransaction } from '../../supabase/functions/_shared/sms-parser.ts';

describe('sms-ingest composition', () => {
  const now = new Date('2026-10-07T08:00:00.000Z');

  it('prefixes a valid sender short code so the parser records it', () => {
    const composed = composeIngestText('hdfcbk', 'Rs. 1,250.00 debited from A/c XX1234 on 06/10/2026 at SWIGGY via UPI.');
    const parsed = parseBankSmsTransaction(composed, now);

    expect(parsed).toMatchObject({
      amount: 1250,
      type: 'expense',
      merchant: 'SWIGGY',
      sender: 'HDFCBK',
      paymentMode: 'UPI',
    });
  });

  it('marks sender-less text as an explicit SMS so alerts are still held for review', () => {
    const composed = composeIngestText(null, 'Rs. 1,250.00 debited from A/c XX1234 on 06/10/2026 at SWIGGY via UPI.');
    expect(composed.startsWith('SMS:')).toBe(true);
    expect(isBankSmsLike(composed)).toBe(true);
    expect(parseBankSmsTransaction(composed, now)).toMatchObject({ amount: 1250, sender: null });
  });

  it('rejects implausible sender strings and falls back to the SMS marker', () => {
    expect(composeIngestText('+911234567890', 'Rs. 100 debited')).toBe('SMS: Rs. 100 debited');
    expect(composeIngestText('   ', 'Rs. 100 debited')).toBe('SMS: Rs. 100 debited');
  });

  it('marks sender-less text as an explicit SMS; unparseable text is held, never auto-logged', () => {
    const composed = composeIngestText(null, 'Coffee 150');
    expect(composed.startsWith('SMS:')).toBe(true);
    // Marked messages with digits are held for review by design…
    expect(isBankSmsLike(composed)).toBe(true);
    // …but the parser finds no completed transaction, so ingest adds nothing.
    expect(parseBankSmsTransaction(composed, now)).toBeNull();
  });
});
