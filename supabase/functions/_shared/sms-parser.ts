export type SmsTransactionType = "income" | "expense";
export type SmsPaymentMode = "UPI" | "Card" | "Cash" | "Other";

export interface ParsedBankSms {
  amount: number;
  type: SmsTransactionType;
  merchant: string;
  date: string;
  paymentMode: SmsPaymentMode;
  sender: string | null;
  /** Canonical message content, used only to create a one-way deduplication hash. */
  fingerprintText: string;
}

interface SmsEnvelope {
  body: string;
  sender: string | null;
  explicitlyMarked: boolean;
}

const MAX_AMOUNT = 100_000_000;
const CURRENCY_AMOUNT = /(?:₹\s*|\bINR\s*|\bRs\.?\s*)([\d][\d,]*(?:\.\d{1,2})?)/i;
const DIRECTION_WORDS = /\b(debit(?:ed)?|credit(?:ed)?|withdraw(?:n|al)?|spent|paid|purchase(?:d)?|payment|sent|charged|deposit(?:ed)?|received|refund(?:ed)?|cashback|cash\s*back|salary)\b/i;
const BANKING_CUES = /\b(?:a\s*\/\s*c|account|avl\.?\s*bal(?:ance)?|available\s+bal(?:ance)?|upi|vpa|imps|neft|rtgs|bank|card|atm|transaction|txn|utr|rrn|ref(?:erence)?\s*(?:no\.?|number)?)\b/i;
const OTP_SMS = /\b(?:one[ -]?time password|otp|verification code)\b/i;
const NON_TRANSACTION_SMS = /\b(?:transaction (?:has )?(?:failed|declined|unsuccessful|reversed)|payment (?:has )?(?:failed|declined|unsuccessful)|not completed|valid for \d+ minutes?)\b/i;
const MARKETING_SMS = /\b(?:limited time offer|special offer|pre[ -]?approved|apply now|win a prize|claim your reward|click here to unsubscribe)\b/i;

function extractEnvelope(text: string): SmsEnvelope {
  let body = text.trim();
  let explicitlyMarked = false;

  const commandPrefix = body.match(/^\/sms(?:@\w+)?\s*/i);
  if (commandPrefix) {
    explicitlyMarked = true;
    body = body.slice(commandPrefix[0].length);
  }

  const markerPrefix = body.match(/^(?:\[sms\]|sms\s*[:-]|bank\s+sms\s*[:-])\s*/i);
  if (markerPrefix) {
    explicitlyMarked = true;
    body = body.slice(markerPrefix[0].length);
  }

  const fromPrefix = body.match(/^from\s+([A-Z][A-Z0-9_-]{2,19})\s*[:|-]\s*/);
  if (fromPrefix) {
    body = body.slice(fromPrefix[0].length);
    return { body, sender: fromPrefix[1], explicitlyMarked };
  }

  // Android forwarders commonly prefix the original SMS short code, e.g. HDFCBK-S: ...
  const senderPrefix = body.match(/^\[?([A-Z][A-Z0-9_-]{2,19})\]?(?:\s*[:|]\s*|\s+-\s+)/);
  if (senderPrefix) {
    body = body.slice(senderPrefix[0].length);
    return { body, sender: senderPrefix[1], explicitlyMarked };
  }

  return { body, sender: null, explicitlyMarked };
}

function containsAmount(text: string): boolean {
  return CURRENCY_AMOUNT.test(text);
}

/**
 * Conservative classifier so a forwarded bank alert is never silently auto-logged.
 * Ordinary chat entries such as "Coffee 150" do not match this predicate.
 */
export function isBankSmsLike(text: string): boolean {
  const envelope = extractEnvelope(text);
  const hasDirection = DIRECTION_WORDS.test(envelope.body);
  const isKnownNonTransaction = OTP_SMS.test(envelope.body) || NON_TRANSACTION_SMS.test(envelope.body) || MARKETING_SMS.test(envelope.body);
  const hasMoney = containsAmount(envelope.body);
  const hasBankContext = Boolean(envelope.sender) || BANKING_CUES.test(envelope.body);
  const hasTransactionCue = /\b(?:transaction|txn|purchase|payment|used)\b/i.test(envelope.body);

  // A marked/short-code SMS must never fall through to the auto-logger, even when
  // its currency or debit/credit wording is nonstandard and cannot be parsed.
  if ((envelope.sender || envelope.explicitlyMarked) && /\d/.test(envelope.body)) return true;

  return (hasMoney && hasDirection) ||
    (hasMoney && hasBankContext && hasTransactionCue) ||
    (isKnownNonTransaction && hasBankContext && /\d/.test(envelope.body));
}

export function parseBankSmsTransaction(text: string, now = new Date()): ParsedBankSms | null {
  const envelope = extractEnvelope(text);
  const body = envelope.body.replace(/\s+/g, " ").trim();

  const hasCompletedTransactionAction = /\b(?:debited|credited|withdrawn|spent|paid|charged|deposited|received|refund(?:ed)?|cashback|cash\s*back|transaction (?:completed|approved))\b/i.test(body);
  const isOtpOnly = OTP_SMS.test(body) && !hasCompletedTransactionAction;

  if (!isBankSmsLike(text) || isOtpOnly || NON_TRANSACTION_SMS.test(body) || MARKETING_SMS.test(body)) {
    return null;
  }

  const amountMatch = CURRENCY_AMOUNT.exec(body);
  if (!amountMatch) return null;

  const amount = Number.parseFloat(amountMatch[1].replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) return null;

  const type = detectType(body);
  if (!type) return null;

  return {
    amount,
    type,
    merchant: extractMerchant(body, type),
    date: extractTransactionDate(body, now),
    paymentMode: detectPaymentMode(body),
    sender: envelope.sender,
    fingerprintText: body.toLocaleLowerCase().replace(/\s+/g, " ").trim().slice(0, 2_000),
  };
}

function detectType(body: string): SmsTransactionType | null {
  const normalized = body.toLowerCase();
  const clearlyIncome = /\b(?:credited|deposited|received|refund(?:ed)?|cashback|cash\s*back|salary)\b|\bcredit\s+(?:to|into|in|of)\b/.test(normalized);
  const clearlyExpense = /\b(?:debit(?:ed)?|withdraw(?:n|al)?|spent|paid|purchase(?:d)?|charged|sent\s+to)\b|\bpayment\s+(?:of|to|made|at)\b|\b(?:credit|debit)?\s*card\b.{0,80}\btransaction\b|\btransaction\b.{0,80}\bcard\b/.test(normalized);

  // A message saying both is ambiguous (often a transfer containing both accounts); don't guess.
  if (clearlyIncome === clearlyExpense) return null;
  return clearlyIncome ? "income" : "expense";
}

function extractMerchant(body: string, type: SmsTransactionType): string {
  const patterns = type === "expense"
    ? [
        /\b(?:at|merchant(?:\s+name)?|towards)\s+["“']?(.+?)["”']?(?=\s+(?:on|via|using|from|ref(?:erence)?|txn|transaction|a\s*\/\s*c|account|card|avail|avl\.?\s*bal)\b|[,;.!]|$)/i,
        /\bpaid\s+to\s+["“']?(.+?)["”']?(?=\s+(?:on|via|using|ref(?:erence)?|txn|transaction|upi|vpa)\b|[,;.!]|$)/i,
        /\bto\s+["“']?(.+?)["”']?(?=\s+(?:on|via|using|ref(?:erence)?|txn|transaction|upi|vpa|a\s*\/\s*c|account|avl\.?\s*bal)\b|[,;.!]|$)/i,
      ]
    : [
        /\b(?:from|by)\s+["“']?(.+?)["”']?(?=\s+(?:on|via|using|ref(?:erence)?|txn|transaction|a\s*\/\s*c|account|avl\.?\s*bal)\b|[,;.!]|$)/i,
        /\b(?:salary|refund|cashback)\s+(?:from|by)\s+["“']?(.+?)["”']?(?=\s+(?:on|via|ref(?:erence)?|txn|transaction)\b|[,;.!]|$)/i,
      ];

  for (const pattern of patterns) {
    const match = body.match(pattern);
    const cleaned = match?.[1] ? cleanMerchant(match[1]) : "";
    if (cleaned) return cleaned;
  }

  return "Bank transaction";
}

function cleanMerchant(value: string): string {
  const cleaned = value
    .replace(/\b(?:your|my)\s+(?:account|a\s*\/\s*c|card)\b.*$/i, "")
    .replace(/\b(?:a\s*\/\s*c|account|card|upi|vpa)\b.*$/i, "")
    .replace(/\b\d{6,}\b/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s:;,'"“”‘’#-]+|[\s:;,'"“”‘’#-]+$/g, "")
    .trim()
    .slice(0, 60);

  if (!cleaned || /^(?:your account|account|a\/c|card|upi|vpa|bank)$/i.test(cleaned)) return "";
  return cleaned;
}

function detectPaymentMode(body: string): SmsPaymentMode {
  if (/\b(?:credit|debit|prepaid)?\s*card\b|\bvisa\b|\bmastercard\b|\brupay\b|\bpos\b/i.test(body)) return "Card";
  if (/\b(?:atm|cash withdrawal|withdrawn as cash)\b/i.test(body)) return "Cash";
  if (/\b(?:upi|vpa|imps|neft|rtgs)\b/i.test(body)) return "UPI";
  return "Other";
}

function extractTransactionDate(body: string, now: Date): string {
  const isoMatch = body.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (isoMatch) {
    const parsed = validDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
    if (parsed) return parsed;
  }

  // Indian bank SMS typically use DD/MM/YYYY or DD-MM-YYYY.
  const numericMatch = body.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (numericMatch) {
    const year = Number(numericMatch[3]) + (numericMatch[3].length === 2 ? 2_000 : 0);
    const parsed = validDate(year, Number(numericMatch[2]), Number(numericMatch[1]));
    if (parsed) return parsed;
  }

  const monthMatch = body.match(/\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(20\d{2}|\d{2})\b/i);
  if (monthMatch) {
    const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
      .indexOf(monthMatch[2].slice(0, 3).toLowerCase()) + 1;
    const rawYear = monthMatch[3];
    const year = Number(rawYear) + (rawYear.length === 2 ? 2_000 : 0);
    const parsed = validDate(year, month, Number(monthMatch[1]));
    if (parsed) return parsed;
  }

  // Store the current Indian calendar date when the source SMS has no date.
  return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

function validDate(year: number, month: number, day: number): string | null {
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Compose a forwarder payload (sender + raw body) into a canonical SMS text
 *  our parser understands. Used by the sms-ingest edge function. Pure — no
 *  Deno/network dependencies so it can be unit tested from Node/Vitest. */
export function composeForwardedSmsText(sender: string | null | undefined, text: string): string {
  const trimmed = (text ?? "").replace(/\s+/g, " ").trim();
  const cleanSender = (sender ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 20);
  if (cleanSender) {
    return trimmed ? `${cleanSender}: ${trimmed}` : cleanSender;
  }
  // Prefix so the parser still treats a bare message as an explicit forwarded SMS
  // even when the forwarder omits the sender ID.
  return trimmed ? `[sms] ${trimmed}` : "[sms]";
}
