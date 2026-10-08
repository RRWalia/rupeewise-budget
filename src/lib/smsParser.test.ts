import { describe, expect, it } from 'vitest';
import { isBankSmsLike, parseBankSmsTransaction, composeForwardedSmsText } from '../../supabase/functions/_shared/sms-parser.ts';

describe('bank SMS parser', () => {
  const now = new Date('2026-10-07T08:00:00.000Z');

  it('parses a UPI debit with a sender ID, merchant and Indian date', () => {
    const parsed = parseBankSmsTransaction(
      'HDFCBK-S: Rs. 1,250.00 debited from A/c XX1234 on 06/10/2026 at SWIGGY via UPI. Avl Bal Rs. 8,000.00',
      now,
    );

    expect(parsed).toMatchObject({
      amount: 1250,
      type: 'expense',
      merchant: 'SWIGGY',
      date: '2026-10-06',
      paymentMode: 'UPI',
      sender: 'HDFCBK-S',
    });
  });

  it('parses a credit as income and uses the first currency amount, not the balance', () => {
    const parsed = parseBankSmsTransaction(
      'SBIINB: INR 25,000.00 credited to your A/c XX7890 from ACME PAYROLL on 07 Oct 2026. Avl Bal INR 30,500.00',
      now,
    );

    expect(parsed).toMatchObject({
      amount: 25000,
      type: 'income',
      merchant: 'ACME PAYROLL',
      date: '2026-10-07',
      sender: 'SBIINB',
    });
  });

  it('parses UPI payment alerts that use payment wording instead of debited', () => {
    expect(parseBankSmsTransaction('UPI payment of INR 180 to BIGBASKET on 06/10/2026', now)).toMatchObject({
      amount: 180,
      type: 'expense',
      merchant: 'BIGBASKET',
      paymentMode: 'UPI',
      date: '2026-10-06',
    });
  });

  it('supports card purchases and defaults safely when the merchant is missing', () => {
    const card = parseBankSmsTransaction(
      'AXISBK: Your credit card XX1234 transaction of Rs 599.00 at AMAZON on 06-10-26 was approved.',
      now,
    );
    const noMerchant = parseBankSmsTransaction(
      'SBIINB: Rs 300 debited from A/c XX1234 on 06/10/2026. Avl Bal Rs 900.',
      now,
    );

    expect(card).toMatchObject({ amount: 599, type: 'expense', merchant: 'AMAZON', date: '2026-10-06', paymentMode: 'Card' });
    expect(noMerchant?.merchant).toBe('Bank transaction');
  });

  it('does not confuse normal chat entries with bank SMS', () => {
    expect(isBankSmsLike('Coffee 150')).toBe(false);
    expect(parseBankSmsTransaction('Received 5000 from freelance', now)).toBeNull();
  });

  it('holds bank-sender alerts with unusual wording instead of auto-logging them', () => {
    const noCurrency = 'HDFCBK-S: A/c XX1234 debited 500 on 06/10/2026';
    const noDirection = 'AXISBK: Card transaction of Rs 500 at SHOP on 06/10/2026';

    expect(isBankSmsLike(noCurrency)).toBe(true);
    expect(parseBankSmsTransaction(noCurrency, now)).toBeNull();
    expect(isBankSmsLike(noDirection)).toBe(true);
    expect(parseBankSmsTransaction(noDirection, now)).toMatchObject({ amount: 500, type: 'expense', merchant: 'SHOP' });
  });

  it('ignores OTP, declined and marketing messages instead of creating candidates', () => {
    const otp = 'HDFCBK: OTP 987654 for transaction of Rs 500 on your card. Do not share this code.';
    const realDebitWithOtpFooter = 'HDFCBK: Rs 500 debited from A/c XX1234 at SHOP on 06/10/2026. Do not share OTP.';
    const declined = 'AXISBK: Rs 500 transaction declined on your card at SHOP on 06/10/2026.';
    const offer = 'HDFCBK: Rs 500 credited as an offer. Limited time offer, claim your reward.';

    expect(isBankSmsLike(otp)).toBe(true);
    expect(parseBankSmsTransaction(otp, now)).toBeNull();
    expect(parseBankSmsTransaction(realDebitWithOtpFooter, now)).toMatchObject({ amount: 500, type: 'expense' });
    expect(parseBankSmsTransaction(declined, now)).toBeNull();
    expect(parseBankSmsTransaction(offer, now)).toBeNull();
  });

  it('accepts an explicit /sms wrapper when a bank sender ID is not available', () => {
    expect(parseBankSmsTransaction('/sms INR 750 debited from account at UBER on 06/10/2026', now)).toMatchObject({
      amount: 750,
      type: 'expense',
      merchant: 'UBER',
      date: '2026-10-06',
    });
  });

  it('rejects ambiguous, zero, and out-of-range values', () => {
    expect(parseBankSmsTransaction('HDFCBK: Rs 500 debited and credited to A/c on 06/10/2026', now)).toBeNull();
    expect(parseBankSmsTransaction('HDFCBK: Rs 0 debited from A/c on 06/10/2026', now)).toBeNull();
    expect(parseBankSmsTransaction('HDFCBK: Rs 100000001 debited from A/c on 06/10/2026', now)).toBeNull();
  });
});

describe('composeForwardedSmsText (HTTP ingest)', () => {
  const now = new Date('2026-10-07T08:00:00.000Z');

  it('prefixes the cleaned sender ID', () => {
    expect(composeForwardedSmsText('HDFCBK', 'Rs.150 debited from A/c XX1234 on 06/10/2026 at SWIGGY via UPI.'))
      .toBe('HDFCBK: Rs.150 debited from A/c XX1234 on 06/10/2026 at SWIGGY via UPI.');
  });

  it('strips weird characters from the sender and caps length', () => {
    expect(composeForwardedSmsText('  VM-HDFCBK  ', 'Rs 100 debited'))
      .toBe('VM-HDFCBK: Rs 100 debited');
    expect(composeForwardedSmsText('A'.repeat(40), 'x')).toMatch(/^A{20}: x$/);
  });

  it('adds an explicit [sms] marker when no sender is supplied so bare messages still parse as SMS', () => {
    expect(composeForwardedSmsText(null, 'Rs 100 debited from A/c')).toBe('[sms] Rs 100 debited from A/c');
    expect(composeForwardedSmsText(undefined, '  ')).toBe('[sms]');
    expect(composeForwardedSmsText('', 'Rs 200 credited')).toBe('[sms] Rs 200 credited');
  });

  it('normalises internal whitespace', () => {
    expect(composeForwardedSmsText('SBIINB', 'Rs.250   debited   from  A/c  XX9999'))
      .toBe('SBIINB: Rs.250 debited from A/c XX9999');
  });

  it('round-trips through parseBankSmsTransaction for typical forwarder payloads', () => {
    const composed = composeForwardedSmsText('HDFCBK', 'Rs. 1,250.00 debited from A/c XX1234 on 06/10/2026 at SWIGGY via UPI. Avl Bal Rs. 8,000.00');
    expect(parseBankSmsTransaction(composed, now)).toMatchObject({
      amount: 1250,
      type: 'expense',
      merchant: 'SWIGGY',
      sender: 'HDFCBK',
    });
  });
});
