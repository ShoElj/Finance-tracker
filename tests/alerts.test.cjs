const test = require("node:test");
const assert = require("node:assert/strict");
const { parseAlert, splitAlerts } = require("../alerts.js");

const debit = (alert, expected) => {
  const result = parseAlert(alert);
  assert.ok(result, `expected a transaction from: ${alert.body}`);
  assert.equal(result.direction, "debit");
  for (const [key, value] of Object.entries(expected)) assert.equal(result[key], value, `${key} for: ${alert.body}`);
};

test("GTBank SMS debit (multi-line)", () =>
  debit(
    {
      sender: "GTBank",
      body: "Acct: 012****345\nAmt: NGN5,000.00 DR\nDesc: POS PURCHASE @ SHOPRITE LEKKI\nAvail Bal: NGN12,345.67\nDate: 2026-09-28 14:22",
    },
    { amount: 5000, bank: "GTBank", description: "POS Purchase @ Shoprite Lekki", category: "Food" },
  ));

test("GTBank SMS debit (single line)", () =>
  debit(
    { sender: "GTBank", body: "Acct: 012****345 Amt: NGN1,500.00 DR Desc: MTN AIRTIME 08031234567 Avail Bal: NGN10,845.67 Date: 28-Sep-2026 14:30" },
    { amount: 1500, description: "MTN Airtime 08031234567", category: "Utilities" },
  ));

test("First Bank SMS debit", () =>
  debit(
    { sender: "FirstBank", body: "Debit: 3012345678 NGN 12,000.00 Desc: NIP TRF TO JOHN DOE Bal: NGN 40,000.00 Date: 28-SEP-2026 09:10" },
    { amount: 12000, bank: "First Bank", description: "NIP TRF To John Doe" },
  ));

test("First Bank SMS debit (Txn: Debit layout)", () =>
  debit(
    { sender: "FirstBank", body: "Txn: Debit\nAcct:30******78\nAmt:NGN2,300.00\nDes:BOLT RIDE LAGOS\nDate:28-Sep-2026\nBal:NGN37,700.00" },
    { amount: 2300, description: "Bolt Ride Lagos", category: "Transport" },
  ));

test("Providus SMS debit", () =>
  debit(
    { sender: "ProvidusBnk", body: "Debit Alert! Acct: 13XXXXX890 Amt: NGN7,500.00 Desc: DSTV SUBSCRIPTION Date: 28/09/2026 14:22 Bal: NGN20,000.00" },
    { amount: 7500, bank: "Providus", description: "DSTV Subscription", category: "Utilities" },
  ));

test("OPay transfer notification", () =>
  debit(
    { app: "OPay", packageName: "team.opay.pay", title: "Transfer Successful", body: "You have successfully transferred ₦5,000.00 to JOHN DOE." },
    { amount: 5000, bank: "OPay", description: "To John Doe" },
  ));

test("OPay payment notification", () =>
  debit(
    { app: "OPay", packageName: "team.opay.pay", title: "Payment Successful", body: "You paid ₦1,000.00 for Airtime on 08031234567" },
    { amount: 1000, category: "Utilities" },
  ));

test("OPay debit alert notification with balance", () =>
  debit(
    { app: "OPay", title: "Debit Alert", body: "₦3,200.00 was debited from your OPay wallet for POS payment at CHICKEN REPUBLIC. Balance: ₦8,450.00" },
    { amount: 3200, category: "Food" },
  ));

test("GTWorld app notification", () =>
  debit(
    { app: "GTWorld", packageName: "com.gtbank.gtworldv1", title: "Debit Alert", body: "NGN 25,000.00 has been debited from your account 012****345. Desc: TRANSFER TO LANDLORD RENT" },
    { amount: 25000, bank: "GTBank", category: "Rent" },
  ));

test("credits are not expenses", () => {
  const credit = parseAlert({ sender: "GTBank", body: "Acct: 012****345\nAmt: NGN50,000.00 CR\nDesc: SALARY SEPT\nAvail Bal: NGN62,345.67" });
  assert.equal(credit.direction, "credit");
  const opay = parseAlert({ app: "OPay", title: "Money Received", body: "You have received ₦10,000.00 from JANE DOE." });
  assert.equal(opay.direction, "credit");
});

test("ignores OTPs, failed transfers and non-money messages", () => {
  assert.equal(parseAlert({ sender: "GTBank", body: "Your OTP for the transfer of NGN5,000.00 is 123456. Do not share." }), null);
  assert.equal(parseAlert({ app: "OPay", title: "Transfer Failed", body: "Your transfer of ₦5,000.00 to JOHN DOE failed." }), null);
  assert.equal(parseAlert({ sender: "FirstBank", body: "Dear customer, our branches will be closed on Monday." }), null);
});

test("uses the transaction amount, not the balance", () =>
  debit({ sender: "Providus", body: "Avail Bal: NGN90,000.00. Amt: NGN4,000.00 DR Desc: UBER TRIP" }, { amount: 4000, category: "Transport" }));

// Real-world layout shared by a user (amounts, balances and places changed).
const REAL_CREDIT = "Acct:******0000\nAmt:NGN20,000.00 CR\nDesc:ATM TRA SOME STREET LAGOS\nBal:NGN25,000.10\nDate:2026-09-21 12:17PM";
const REAL_DEBIT =
  "Acct:******0000\nAmt:NGN50.00 DR\nDesc:STAMP DUTY CHARGE FOR TRXNS BTW 21-09-2026 TO 25-09-2026\nBal:NGN24,950.10\nDate:2026-09-27 7:10PM";

test("compact Acct/Amt/Desc/Bal/Date layout", () => {
  assert.equal(parseAlert({ body: REAL_CREDIT }).direction, "credit");
  const result = parseAlert({ body: REAL_DEBIT, timestamp: Date.parse("2026-09-29T10:00:00") });
  assert.equal(result.direction, "debit");
  assert.equal(result.amount, 50);
  assert.equal(result.description, "Stamp Duty Charge For Trxns Btw 21-09-2026 To 25-09-2026");
  assert.equal(new Date(result.timestamp).toString(), new Date(2026, 8, 27, 19, 10).toString());
});

test("reads the Date line in other layouts", () => {
  const at = (body) => new Date(parseAlert({ body, timestamp: 0 }).timestamp);
  assert.deepEqual(at("Amt: NGN1,000.00 DR Desc: X Date: 28-Sep-2026 14:22").getHours(), 14);
  assert.deepEqual(at("Amt: NGN1,000.00 DR Desc: X Date: 28/09/2026 09:05").getDate(), 28);
  assert.deepEqual(at("Amt: NGN1,000.00 DR Desc: X Date: 2026-09-01 12:05AM").getHours(), 0);
});

test("splits several pasted alerts", () => {
  assert.equal(splitAlerts(`${REAL_CREDIT}\n${REAL_DEBIT}`).length, 2);
  assert.equal(splitAlerts(`${REAL_CREDIT}\n\n${REAL_DEBIT}`).length, 2);
  assert.equal(splitAlerts("You paid ₦1,000.00 for Airtime").length, 1);
});

test("pasted alerts without a sender have no bank name", () => {
  assert.equal(parseAlert({ body: REAL_DEBIT }).bank, "");
});

test("sorts bank charges and transfers", () => {
  assert.equal(parseAlert({ body: REAL_DEBIT }).category, "Bank charges");
  assert.equal(parseAlert({ sender: "GTBank", body: "Amt: NGN10.75 DR Desc: SMS ALERT CHARGES SEPT" }).category, "Bank charges");
  assert.equal(parseAlert({ sender: "FirstBank", body: "Amt: NGN26.88 DR Desc: NIP CHARGE + VAT" }).category, "Bank charges");
  assert.equal(parseAlert({ sender: "FirstBank", body: "Debit: 3012345678 NGN 12,000.00 Desc: NIP TRF TO JOHN DOE Bal: NGN 40,000.00" }).category, "Transfers");
  assert.equal(parseAlert({ app: "OPay", title: "Transfer Successful", body: "You have successfully transferred ₦5,000.00 to JOHN DOE." }).category, "Transfers");
  assert.equal(parseAlert({ sender: "GTBank", body: "Amt: NGN9,000.00 DR Desc: NIP TRF TO SHOPRITE LEKKI" }).category, "Food");
  assert.equal(parseAlert({ sender: "GTBank", body: "Amt: NGN25,000.00 DR Desc: TRANSFER TO LANDLORD RENT" }).category, "Rent");
  // "charged" on its own is not a bank fee.
  assert.equal(parseAlert({ app: "OPay", title: "Debit", body: "Your wallet was charged ₦4,500.00 for DSTV" }).category, "Utilities");
});
