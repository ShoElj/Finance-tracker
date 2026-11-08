// Turns bank SMS alerts and banking-app notifications into expense candidates.
// Loaded by the page as a plain script (window.BankAlertParser) and by Node tests via require().
(function (root) {
  const BANKS = [
    { name: "GTBank", pattern: /gt ?bank|gtworld|\bgtb\b|guaranty/i },
    { name: "First Bank", pattern: /first ?bank|firstmobile|\bfbn\b/i },
    { name: "Providus", pattern: /providus/i },
    { name: "OPay", pattern: /\bopay\b|team\.opay/i },
    { name: "Kuda", pattern: /\bkuda\b/i },
    { name: "Moniepoint", pattern: /moniepoint/i },
    { name: "PalmPay", pattern: /palm ?pay/i },
    { name: "Access Bank", pattern: /access ?bank|\baccess\b/i },
    { name: "Zenith", pattern: /zenith/i },
    { name: "UBA", pattern: /\buba\b/i },
  ];

  const MONEY = /(?:NGN|₦|\bN(?=\s?\d))\s?(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/gi;
  const DEBIT = /\b(DR|debit(?:ed)?|withdrawal|withdrawn|sent|transferred|transfer (?:successful|to)|paid|payment|purchase|spent|charged)\b/i;
  const CREDIT = /\b(CR|credit(?:ed)?|received|deposit(?:ed)?|reversal|reversed|refund(?:ed)?|inflow)\b/i;
  // Labels banks print on the alert itself: "CR"/"DR" after the amount, "Txn: Credit", "Credit Alert",
  // "Debit: 3012…". These are the surest sign of which way the money went.
  // "CR"/"DR" only count in capitals (they're bank codes, not parts of words); the word labels
  // can be any case.
  const CREDIT_LABELS = [/\bCR\b/, /\b(?:txn|transaction|type)\s*[:\-]\s*credit\b|\bcredit\s+alert\b|^\s*credit\b|\bcredit\s*:/im];
  const DEBIT_LABELS = [/\bDR\b/, /\b(?:txn|transaction|type)\s*[:\-]\s*debit\b|\bdebit\s+alert\b|^\s*debit\b|\bdebit\s*:/im];
  // Banking-app wording. Incoming notifications often also say "payment", "paid", "sent" or
  // "transfer successful", so whole phrases decide rather than single words.
  const INBOUND =
    /\b(?:received|sent you|paid you|(?:been|got) paid|inflow|deposit(?:ed)?|refund(?:ed)?|revers(?:al|ed)|credited|money in|(?:in)?to your (?:account|acct|wallet))\b/i;
  const OUTBOUND =
    /\b(?:debited|you (?:just )?(?:sent|paid|transferred|spent|bought|withdrew)|withdrawal|withdrawn|purchase|spent|charged|(?:transfer(?:red)?|sent|paid|payment)\b[^\n]{0,40}?\bto (?!your\b|you\b))/i;
  const IGNORE = /\b(otp|one[- ]time|password|failed|unsuccessful|declined|pending|insufficient|request(?:ed)? (?:for|of))\b/i;
  const BALANCE_BEFORE = /(bal(?:ance)?|avail(?:able)?|ledger|limit)\W*$/i;

  const DESCRIPTION_FIELD =
    /(?:\bdesc(?:ription)?|\bdes|\bnarr(?:ation)?|\bdetails?|\bremarks?)\s*[:\-]\s*([^\n]+?)(?=\s*(?:\b(?:avail(?:able)?\s+bal(?:ance)?|avail(?:able)?|bal(?:ance)?|date|time|dt|acct|a\/c|amt|amount|ref)\b\.?\s*[:\-]|\n|$))/i;
  const COUNTERPARTY =
    /\b(?:to|for|at)\s+([A-Za-z0-9][A-Za-z0-9 &'.\-\/]{1,40}?)(?=\s*(?:[,;]|\.\s|\.$|\bon\b|\bvia\b|\bwith\b|\bref\b|\bat\b|\bfrom\b|\n|$))/i;

  const SENDER =
    /\bfrom\s+([A-Za-z0-9][A-Za-z0-9 &'.\-\/]{1,40}?)(?=\s*(?:[,;]|\.\s|\.$|\bon\b|\bvia\b|\bwith\b|\bref\b|\bto\b|\binto\b|\n|$))/i;

  const PAID_BY = /\bpaid\b[^\n]{0,30}?\bby\s+([A-Za-z][A-Za-z0-9 &'.\-]{1,40}?)(?=\s*(?:[,;]|\.\s|\.$|\bon\b|\bvia\b|\n|$))/i;
  const SENT_YOU = /^\s*([A-Za-z][A-Za-z .'\-]{1,40}?)\s+(?:just\s+)?(?:sent|paid|transferred)\s+you\b/im;

  const DATE_FIELD =
    /\b(?:date|dt)\s*[:\-]\s*(\d{1,4})[-\/ ]([0-9]{1,2}|[A-Za-z]{3,9})[-\/ ](\d{2,4})(?:[ T,]+(\d{1,2}):(\d{2})(?::\d{2})?\s*([AP]M)?)?/i;
  const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

  const CATEGORY_RULES = [
    ["Rent", /\brent\b|landlord|\blease\b|service charge|agent fee/i],
    ["Bank charges", /stamp duty|\bsms\b.{0,12}(?:charge|fee)|\bvat\b|commission|maintenance fee|\bcot\b|\blevy\b|\bfees?\b|\bcharges?\b/i],
    ["Utilities", /airtime|\bdata\b|recharge|\bmtn\b|airtel|\bglo\b|9mobile|dstv|gotv|startimes|showmax|electric|ekedc|ikedc|aedc|phed|kedco|ibedc|prepaid|meter|\bwater\b|\bbills?\b|internet|spectranet|smile/i],
    ["Transport", /\buber\b|\bbolt\b|indrive|rida|\bfuel\b|petrol|filling|\bstation\b|totalenergies|conoil|oando|\bbrt\b|cowry|transport|\bkeke\b|okada|parking|\btoll\b/i],
    ["Health", /pharm|hospital|clinic|medic|health|\blab\b|\bhmo\b|\bdrugs?\b/i],
    ["Entertainment", /netflix|spotify|youtube|apple\.com|cinema|filmhouse|genesis|bet9ja|sportybet|betking|1xbet|nairabet|playstation|steam|\bclub\b|lounge/i],
    ["Subscriptions", /google|anthropic|claude|openai|chatgpt|canva|microsoft|adobe|icloud|\bdomain\b|hosting|namecheap|godaddy|whogohost|qservers|truehost|subscription|\bsub\b/i],
    ["Food", /restaurant|eatery|kitchen|\bfood|chicken republic|\bkfc\b|domino|pizza|biggs|tantalizers|sweet sensation|chowdeck|glovo|suya|\bcafe|bakery|shawarma|market|grocer|shoprite|\bspar\b|justrite/i],
    ["Shopping", /jumia|konga|\bmall\b|\bstores?\b|\bshop\b|boutique|fashion|\btemu\b|aliexpress|amazon|\bpos\b|\bweb purchase/i],
    // Last, so a transfer that names a merchant (e.g. "TRF TO SHOPRITE") keeps the merchant's category.
    ["Transfers", /\bnip\b|\btrf\b|\btrsf\b|\btransfer(?:red)?\b|\bfip\b|\binter ?bank\b|\bsent\b/i],
  ];

  function detectBank(alert) {
    const source = `${alert.sender || ""} ${alert.app || ""} ${alert.packageName || ""}`;
    for (const bank of BANKS) if (bank.pattern.test(source)) return bank.name;
    for (const bank of BANKS) if (bank.pattern.test(alert.body || "")) return bank.name;
    return (alert.app || alert.sender || "").trim();
  }

  // Reads the alert's own "Date:" line (e.g. 2026-09-27 7:10PM or 28-Sep-2026 14:22) as local time.
  function findDate(text) {
    const match = text.match(DATE_FIELD);
    if (!match) return null;
    const [, first, middle, last, hour = "0", minute = "0", meridiem] = match;
    const [year, day] = first.length === 4 ? [Number(first), Number(last)] : [Number(last), Number(first)];
    const month = /\d/.test(middle) ? Number(middle) : MONTHS.indexOf(middle.slice(0, 3).toLowerCase()) + 1;
    let hours = Number(hour);
    if (/pm/i.test(meridiem || "") && hours < 12) hours += 12;
    if (/am/i.test(meridiem || "") && hours === 12) hours = 0;

    const fullYear = year < 100 ? 2000 + year : year;
    if (month < 1 || month > 12 || day < 1 || day > 31 || hours > 23) return null;
    const date = new Date(fullYear, month - 1, day, hours, Number(minute));
    return Number.isNaN(date.getTime()) ? null : date.getTime();
  }

  // Splits text holding several pasted alerts (blank-line separated, or each starting with "Acct:").
  function splitAlerts(text) {
    return text
      .split(/\n\s*\n/)
      .flatMap((chunk) => chunk.split(/(?=^\s*(?:acct|a\/c)\s*[:\-])/im))
      .map((chunk) => chunk.trim())
      .filter(Boolean);
  }

  function findAmount(text) {
    let fallback = null;
    for (const match of text.matchAll(MONEY)) {
      const before = text.slice(Math.max(0, match.index - 24), match.index);
      if (BALANCE_BEFORE.test(before)) continue;
      const amount = Number(match[1].replace(/,/g, ""));
      if (!(amount > 0)) continue;
      if (/(amt|amount)\W*$/i.test(before)) return amount;
      if (fallback === null) fallback = amount;
    }
    return fallback;
  }

  // Which way the money went, and how sure: "label" (the bank said CR/DR), "wording" (a clear
  // phrase like "sent you" or "you paid") or "order" (whichever money word comes first).
  function findDirection(text) {
    const credit = CREDIT_LABELS.some((label) => label.test(text));
    const debit = DEBIT_LABELS.some((label) => label.test(text));
    if (credit !== debit) return { direction: credit ? "credit" : "debit", from: "label" };
    const inbound = INBOUND.test(text);
    const outbound = OUTBOUND.test(text);
    if (inbound !== outbound) return { direction: inbound ? "credit" : "debit", from: "wording" };
    const debitAt = text.search(DEBIT);
    const creditAt = text.search(CREDIT);
    if (debitAt === -1 && creditAt === -1) return null;
    const direction = creditAt === -1 || (debitAt !== -1 && debitAt < creditAt) ? "debit" : "credit";
    return { direction, from: "order" };
  }

  function findDescription(text, title, direction) {
    const field = text.match(DESCRIPTION_FIELD);
    if (field) return tidy(field[1], direction);
    const sender = direction === "credit" && text.match(SENDER);
    if (sender && !/^(?:NGN|N\d|₦|your|you)/i.test(sender[1])) return tidy(sender[0]);
    // "You have been paid ₦5,000 by JOHN DOE", "John Doe just sent you ₦5,000".
    const payer = direction === "credit" && (text.match(PAID_BY) || text.match(SENT_YOU));
    if (payer && !/^(?:NGN|N\d|₦|your|you)$/i.test(payer[1])) return tidy(`From ${payer[1]}`);
    const counterparty = text.match(COUNTERPARTY);
    if (counterparty && !/^(?:NGN|N\d|₦|your|you)/i.test(counterparty[1])) return tidy(counterparty[0]);
    if (title && !MONEY.test(title)) return tidy(title);
    return "";
  }

  function tidy(value, direction = "debit") {
    // Drop a leading reference number or stray dash, e.g. "-Lemfi Transfer-…" or "000123-Lemfi Transfer-…".
    let text = value.replace(/\s+/g, " ").replace(/^\s*\d*\s*[-–:.,;]+\s*/, "").replace(/[\s.,;:\-]+$/, "").trim();
    // First Bank card payments start with the bank's own code, e.g. "FBN/Google Infinity Loop/…".
    text = text.replace(/^(?:FBN|GTB|UBA|ZIB|FCMB)\s*\/\s*/i, "");
    // Bank narrations are often in CAPS; title-case those words so the list is easier to read.
    text = text.replace(/\b[A-Z][A-Z']+\b/g, (word) => word[0] + word.slice(1).toLowerCase());
    text = text.replace(/\b(Pos|Nip|Trf|Atm|Ussd|Web|Mtn|Dstv|Gotv|Kfc|Uba|Gtb|Fbn|Sms|Vat|Ccc|Nibss)\b/g, (word) => word.toUpperCase());
    text = text.charAt(0).toUpperCase() + text.slice(1);
    // "Outward Transfer To Opay - Daniel Ayoola" → "To Daniel Ayoola (Opay)", so the recipient isn't cut off in the list.
    const outward = text.match(/^(?:outward |nip |inter-?bank )?(?:transfer|trf) to ([^-–]{2,25}?)\s*[-–]\s*(.+)$/i);
    if (outward) text = `To ${outward[2].trim()} (${outward[1].trim()})`;
    const inward = text.match(/^(?:inward |nip |inter-?bank )?(?:transfer|trf) from ([^-–]{2,25}?)\s*[-–]\s*(.+)$/i);
    if (inward) text = `From ${inward[2].trim()} (${inward[1].trim()})`;
    // Incoming "Lemfi Transfer-Lemmy Mfb-Jane Doe" → "From Jane Doe (Lemfi)".
    const service = direction === "credit" && text.match(/^([A-Za-z][A-Za-z0-9 ]{1,20}?) (?:transfer|trf)\s*[-–]\s*([^-–]{2,25}?)\s*[-–]\s*(.+)$/i);
    if (service) text = `From ${service[3].trim()} (${service[1].trim()})`;
    return text.length > 60 ? `${text.slice(0, 57).trimEnd()}…` : text;
  }

  function guessCategory(text) {
    for (const [category, pattern] of CATEGORY_RULES) if (pattern.test(text)) return category;
    return "Other";
  }

  /**
   * alert: { body, title?, sender?, app?, packageName?, timestamp? }
   * Returns { amount, direction, directionFrom, description, bank, category, timestamp } or null if it is
   * not a transaction. directionFrom says how sure the direction is: "label", "wording" or "order".
   */
  function parseAlert(alert) {
    const title = (alert.title || "").trim();
    const body = (alert.body || "").trim();
    const text = [title, body].filter(Boolean).join("\n");
    if (!text || IGNORE.test(text)) return null;

    const amount = findAmount(text);
    const found = findDirection(text);
    if (!amount || !found) return null;
    const { direction, from: directionFrom } = found;

    const bank = detectBank(alert);
    const description = findDescription(body, title, direction) || `${bank || "Bank"} ${direction === "debit" ? "payment" : "credit"}`;
    return {
      amount: Math.round(amount * 100) / 100,
      direction,
      directionFrom,
      description,
      bank,
      category: direction === "credit" ? "Income" : guessCategory(`${description} ${body}`),
      timestamp: findDate(text) ?? (Number(alert.timestamp) || Date.now()),
    };
  }

  /* Recorded entries */

  // An entry is money in when it's filed as Income; everything else is money out.
  const FIFTEEN_MINUTES = 15 * 60 * 1000;
  const SURENESS = { label: 3, wording: 2, order: 1 };

  function entryDirection(item) {
    return item.category === "Income" ? "credit" : "debit";
  }

  // How sure the direction of a recorded entry is, re-read from its saved alert text
  // (0 when there is none: typed in by hand, or imported before alert text was kept).
  function entrySureness(item) {
    const parsed = item.raw ? parseAlert({ body: item.raw }) : null;
    return parsed ? SURENESS[parsed.directionFrom] : 0;
  }

  /**
   * The recorded entry for the same bank transaction as `parsed` (seen from `source`), if any: a
   * bank's SMS and its app's notification describe one transaction, and a rescan can meet one
   * already recorded. Same bank and amount within 15 minutes. Opposite directions only match when
   * one of them was a guess, so a genuine reversal (money out, then the same amount back) stays.
   */
  function findSameTransaction(items, parsed, source) {
    return items.find((item) => {
      if (!item.alertAt || item.bank !== parsed.bank || item.amount !== parsed.amount) return false;
      if (Math.abs(item.alertAt - parsed.timestamp) >= FIFTEEN_MINUTES) return false;
      if (item.source === source && item.alertAt !== parsed.timestamp) return false;
      if (entryDirection(item) === parsed.direction) return true;
      return Math.min(entrySureness(item), SURENESS[parsed.directionFrom]) <= SURENESS.order;
    });
  }

  /**
   * Re-reads a recorded entry's saved alert text and, when the text clearly says the money went
   * the other way, turns it round. `categoryFor(parsed)` picks the category for money out.
   * Returns true if the entry changed.
   */
  function fixDirection(item, categoryFor = (parsed) => parsed.category) {
    if (!item.raw) return false;
    const parsed = parseAlert({ body: item.raw });
    if (!parsed || parsed.directionFrom === "order" || parsed.direction === entryDirection(item)) return false;
    item.description = parsed.description;
    item.category = parsed.direction === "credit" ? "Income" : categoryFor(parsed);
    return true;
  }

  /**
   * Removes the second copy of each transaction recorded twice (from the SMS and the app
   * notification). Keeps the copy whose direction is surer, else the earlier one. Returns the
   * entries kept, in their original order.
   */
  // Two recorded entries for one transaction, seen from the SMS and from the app notification.
  function sameEntry(a, b) {
    return (
      Boolean(a.alertAt && b.alertAt) &&
      a.source !== b.source &&
      a.bank === b.bank &&
      a.amount === b.amount &&
      entryDirection(a) === entryDirection(b) &&
      Math.abs(a.alertAt - b.alertAt) < FIFTEEN_MINUTES
    );
  }

  function dropDuplicates(items) {
    const removed = new Set();
    for (let i = 0; i < items.length; i += 1) {
      const a = items[i];
      if (removed.has(a)) continue;
      for (let j = i + 1; j < items.length; j += 1) {
        const b = items[j];
        if (removed.has(b) || !sameEntry(a, b)) continue;
        const keepA = entrySureness(a) > entrySureness(b) || (entrySureness(a) === entrySureness(b) && a.alertAt <= b.alertAt);
        removed.add(keepA ? b : a);
        if (!keepA) break;
      }
    }
    return items.filter((item) => !removed.has(item));
  }

  const api = {
    parseAlert,
    splitAlerts,
    guessCategory,
    detectBank,
    cleanDescription: tidy,
    findSameTransaction,
    fixDirection,
    dropDuplicates,
    sameEntry,
    sureness: (from) => SURENESS[from] ?? 0,
    entrySureness,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BankAlertParser = api;
})(typeof window !== "undefined" ? window : globalThis);
