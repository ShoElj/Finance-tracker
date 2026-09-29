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
  const IGNORE = /\b(otp|one[- ]time|password|failed|unsuccessful|declined|pending|insufficient|request(?:ed)? (?:for|of))\b/i;
  const BALANCE_BEFORE = /(bal(?:ance)?|avail(?:able)?|ledger|limit)\W*$/i;

  const DESCRIPTION_FIELD =
    /(?:\bdesc(?:ription)?|\bdes|\bnarr(?:ation)?|\bdetails?|\bremarks?)\s*[:\-]\s*([^\n]+?)(?=\s*(?:\b(?:avail(?:able)?\s+bal(?:ance)?|avail(?:able)?|bal(?:ance)?|date|time|dt|acct|a\/c|amt|amount|ref)\b\.?\s*[:\-]|\n|$))/i;
  const COUNTERPARTY =
    /\b(?:to|for|at)\s+([A-Za-z0-9][A-Za-z0-9 &'.\-\/]{1,40}?)(?=\s*(?:[,;]|\.\s|\.$|\bon\b|\bvia\b|\bwith\b|\bref\b|\bat\b|\bfrom\b|\n|$))/i;

  const CATEGORY_RULES = [
    ["Rent", /\brent\b|landlord|\blease\b|service charge|agent fee/i],
    ["Utilities", /airtime|\bdata\b|recharge|\bmtn\b|airtel|\bglo\b|9mobile|dstv|gotv|startimes|showmax|electric|ekedc|ikedc|aedc|phed|kedco|ibedc|prepaid|meter|\bwater\b|\bbills?\b|internet|spectranet|smile/i],
    ["Transport", /\buber\b|\bbolt\b|indrive|rida|\bfuel\b|petrol|filling|\bstation\b|totalenergies|conoil|oando|\bbrt\b|cowry|transport|\bkeke\b|okada|parking|\btoll\b/i],
    ["Health", /pharm|hospital|clinic|medic|health|\blab\b|\bhmo\b|\bdrugs?\b/i],
    ["Entertainment", /netflix|spotify|youtube|apple\.com|cinema|filmhouse|genesis|bet9ja|sportybet|betking|1xbet|nairabet|playstation|steam|\bclub\b|lounge/i],
    ["Food", /restaurant|eatery|kitchen|\bfood|chicken republic|\bkfc\b|domino|pizza|biggs|tantalizers|sweet sensation|chowdeck|glovo|suya|\bcafe|bakery|shawarma|market|grocer|shoprite|\bspar\b|justrite/i],
    ["Shopping", /jumia|konga|\bmall\b|\bstores?\b|\bshop\b|boutique|fashion|\btemu\b|aliexpress|amazon|\bpos\b|\bweb purchase/i],
  ];

  function detectBank(alert) {
    const source = `${alert.sender || ""} ${alert.app || ""} ${alert.packageName || ""}`;
    for (const bank of BANKS) if (bank.pattern.test(source)) return bank.name;
    for (const bank of BANKS) if (bank.pattern.test(alert.body || "")) return bank.name;
    return (alert.app || alert.sender || "Bank").trim();
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

  function findDirection(text) {
    const debit = text.search(DEBIT);
    const credit = text.search(CREDIT);
    if (debit === -1 && credit === -1) return null;
    if (credit === -1) return "debit";
    if (debit === -1) return "credit";
    return debit < credit ? "debit" : "credit";
  }

  function findDescription(text, title) {
    const field = text.match(DESCRIPTION_FIELD);
    if (field) return tidy(field[1]);
    const counterparty = text.match(COUNTERPARTY);
    if (counterparty && !/^(?:NGN|N\d|₦|your|you)/i.test(counterparty[1])) return tidy(counterparty[0]);
    if (title && !MONEY.test(title)) return tidy(title);
    return "";
  }

  function tidy(value) {
    let text = value.replace(/\s+/g, " ").replace(/[\s.,;:\-]+$/, "").trim();
    // Bank narrations are often in CAPS; title-case those words so the list is easier to read.
    text = text.replace(/\b[A-Z][A-Z']+\b/g, (word) => word[0] + word.slice(1).toLowerCase());
    text = text.replace(/\b(Pos|Nip|Trf|Atm|Ussd|Web|Mtn|Dstv|Gotv|Kfc|Uba|Gtb|Fbn)\b/g, (word) => word.toUpperCase());
    text = text.charAt(0).toUpperCase() + text.slice(1);
    return text.length > 60 ? `${text.slice(0, 57).trimEnd()}…` : text;
  }

  function guessCategory(text) {
    for (const [category, pattern] of CATEGORY_RULES) if (pattern.test(text)) return category;
    return "Other";
  }

  /**
   * alert: { body, title?, sender?, app?, packageName?, timestamp? }
   * Returns { amount, direction, description, bank, category, timestamp } or null if it is not a transaction.
   */
  function parseAlert(alert) {
    const title = (alert.title || "").trim();
    const body = (alert.body || "").trim();
    const text = [title, body].filter(Boolean).join("\n");
    if (!text || IGNORE.test(text)) return null;

    const amount = findAmount(text);
    const direction = findDirection(text);
    if (!amount || !direction) return null;

    const bank = detectBank(alert);
    const description = findDescription(body, title) || `${bank} ${direction === "debit" ? "payment" : "credit"}`;
    return {
      amount: Math.round(amount * 100) / 100,
      direction,
      description,
      bank,
      category: guessCategory(`${description} ${body}`),
      timestamp: Number(alert.timestamp) || Date.now(),
    };
  }

  const api = { parseAlert, guessCategory, detectBank };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BankAlertParser = api;
})(typeof window !== "undefined" ? window : globalThis);
