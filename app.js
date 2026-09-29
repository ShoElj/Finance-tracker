const STORAGE_KEY = "expense-overview-items";
const PENDING_KEY = "expense-overview-pending";
const SEEN_ALERTS_KEY = "expense-overview-seen-alerts";
const SETTINGS_KEY = "expense-overview-settings";
const CATEGORY_MEMORY_KEY = "expense-overview-category-memory";
const DEMO_REMOVED_KEY = "expense-overview-demo-removed";
const CATEGORIES = ["Food", "Rent", "Transport", "Utilities", "Health", "Shopping", "Entertainment", "Transfers", "Bank charges", "Other"];
const RECATEGORIZED_KEY = "expense-overview-recategorized-v1";
const DESCRIPTIONS_CLEANED_KEY = "expense-overview-descriptions-v2";

const currency = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" });
const compactCurrency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  notation: "compact",
  maximumFractionDigits: 1,
});

// Present only inside the Android app, where the BankAlerts plugin captures SMS and notifications.
const native = window.Capacitor?.isNativePlatform?.() ? window.Capacitor : null;

const state = {
  expenses: loadExpenses(),
  pending: loadJson(PENDING_KEY, []),
  seenAlerts: new Set(loadJson(SEEN_ALERTS_KEY, [])),
  settings: { autoAdd: false, setupDismissed: false, ownNames: "", ...loadJson(SETTINGS_KEY, {}) },
  categoryMemory: loadJson(CATEGORY_MEMORY_KEY, {}),
  importStatus: { sms: false, notifications: false },
  draft: null,
  month: toMonthValue(new Date()),
  editingId: null,
  selectedDay: null,
  lastDeleted: null,
};

let chartLayout = null;
let toastTimer;

const $ = (selector) => document.querySelector(selector);
const elements = {
  monthLabel: $("#monthLabel"),
  monthInput: $("#monthInput"),
  prevMonth: $("#prevMonth"),
  nextMonth: $("#nextMonth"),
  totalSpent: $("#totalSpent"),
  heroLabel: $("#heroLabel"),
  monthDelta: $("#monthDelta"),
  dailyAverage: $("#dailyAverage"),
  largestExpense: $("#largestExpense"),
  entryCount: $("#entryCount"),
  chartWrap: $("#chartWrap"),
  chart: $("#expenseChart"),
  chartTooltip: $("#chartTooltip"),
  categoryList: $("#categoryList"),
  groups: $("#expenseGroups"),
  emptyState: $("#emptyState"),
  clearMonthButton: $("#clearMonthButton"),
  addButton: $("#addButton"),
  sheet: $("#expenseSheet"),
  sheetTitle: $("#sheetTitle"),
  closeSheet: $("#closeSheet"),
  form: $("#expenseForm"),
  amountInput: $("#amountInput"),
  amountError: $("#amountError"),
  descriptionInput: $("#descriptionInput"),
  descriptionError: $("#descriptionError"),
  categoryChips: $("#categoryChips"),
  dateInput: $("#dateInput"),
  deleteButton: $("#deleteButton"),
  saveButton: $("#saveButton"),
  toast: $("#toast"),
  toastText: $("#toastText"),
  toastUndo: $("#toastUndo"),
  importButton: $("#importButton"),
  importBadge: $("#importBadge"),
  setupCard: $("#setupCard"),
  setupButton: $("#setupButton"),
  setupDismiss: $("#setupDismiss"),
  pendingCard: $("#pendingCard"),
  pendingList: $("#pendingList"),
  addAllPending: $("#addAllPending"),
  importSheet: $("#importSheet"),
  closeImport: $("#closeImport"),
  nativeImport: $("#nativeImport"),
  webImportNote: $("#webImportNote"),
  smsStatus: $("#smsStatus"),
  smsButton: $("#smsButton"),
  notificationStatus: $("#notificationStatus"),
  notificationButton: $("#notificationButton"),
  scanButton: $("#scanButton"),
  autoAddToggle: $("#autoAddToggle"),
  appInfoButton: $("#appInfoButton"),
  pasteInput: $("#pasteInput"),
  pasteError: $("#pasteError"),
  pasteButton: $("#pasteButton"),
  ownNamesInput: $("#ownNamesInput"),
  ownTransferInput: $("#ownTransferInput"),
};

const categoryOptions = CATEGORIES.map((category) => `<option value="${category}">${category}</option>`).join("");

elements.categoryChips.innerHTML = CATEGORIES.map(
  (category, index) => `
    <label class="chip" style="--cat: var(--cat-${catKey(category)})">
      <input type="radio" name="category" value="${category}" ${index === 0 ? "checked" : ""} />
      <span><svg aria-hidden="true"><use href="#i-${catKey(category)}" /></svg>${category}</span>
    </label>`,
).join("");

elements.monthInput.value = state.month;

elements.monthInput.addEventListener("change", (event) => {
  if (event.target.value) setMonth(event.target.value);
});
elements.prevMonth.addEventListener("click", () => setMonth(shiftMonth(state.month, -1)));
elements.nextMonth.addEventListener("click", () => setMonth(shiftMonth(state.month, 1)));

elements.addButton.addEventListener("click", () => openSheet());
elements.closeSheet.addEventListener("click", () => elements.sheet.close());
elements.sheet.addEventListener("click", (event) => {
  // A click on the dialog element itself is a click on the backdrop.
  if (event.target === elements.sheet) elements.sheet.close();
});

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();

  const amount = Number(elements.amountInput.value);
  const description = elements.descriptionInput.value.trim();
  const amountValid = Number.isFinite(amount) && amount > 0;
  setFieldError(elements.amountInput, elements.amountError, !amountValid);
  setFieldError(elements.descriptionInput, elements.descriptionError, !description);
  if (!amountValid) return elements.amountInput.focus();
  if (!description) return elements.descriptionInput.focus();

  const fields = {
    amount: Math.round(amount * 100) / 100,
    description,
    category: elements.form.elements.category.value,
    date: elements.dateInput.value || toDateValue(new Date()),
    ownTransfer: elements.ownTransferInput.checked,
  };

  const existing = state.expenses.find((expense) => expense.id === state.editingId);
  if (existing) {
    Object.assign(existing, fields);
  } else {
    state.expenses.unshift({ id: createId(), ...fields, ...state.draft?.meta, createdAt: new Date().toISOString() });
  }
  rememberCategory(fields.description, fields.category);

  saveExpenses();
  elements.sheet.close();
  if (!fields.date.startsWith(state.month)) setMonth(fields.date.slice(0, 7));
  else render();
  showToast(existing ? "Expense updated" : "Expense added");
});

elements.deleteButton.addEventListener("click", () => {
  const index = state.expenses.findIndex((expense) => expense.id === state.editingId);
  if (index === -1) return;
  const [removed] = state.expenses.splice(index, 1);
  state.lastDeleted = [{ expense: removed, index }];
  saveExpenses();
  elements.sheet.close();
  render();
  showToast("Expense deleted", true);
});

elements.groups.addEventListener("click", (event) => {
  const row = event.target.closest("[data-id]");
  if (row) openSheet(state.expenses.find((expense) => expense.id === row.dataset.id));
});

elements.clearMonthButton.addEventListener("click", () => {
  const monthly = getExpensesForMonth(state.month);
  if (!monthly.length) return;
  if (!window.confirm(`Delete all ${monthly.length} expenses in ${formatMonthLabel(state.month)}?`)) return;

  const ids = new Set(monthly.map((expense) => expense.id));
  state.lastDeleted = state.expenses
    .map((expense, index) => ({ expense, index }))
    .filter(({ expense }) => ids.has(expense.id));
  state.expenses = state.expenses.filter((expense) => !ids.has(expense.id));
  saveExpenses();
  render();
  showToast(`${monthly.length} expenses cleared`, true);
});

elements.toastUndo.addEventListener("click", () => {
  if (!state.lastDeleted) return;
  for (const { expense, index } of state.lastDeleted) state.expenses.splice(index, 0, expense);
  state.lastDeleted = null;
  saveExpenses();
  render();
  hideToast();
});

elements.chartWrap.addEventListener("pointerdown", (event) => selectBarAt(event, event.pointerType !== "mouse"));
elements.chartWrap.addEventListener("pointermove", (event) => {
  if (event.pointerType === "mouse") selectBarAt(event);
});
elements.chartWrap.addEventListener("pointerleave", (event) => {
  if (event.pointerType === "mouse") selectDay(null);
});

/* Bank import */

elements.ownNamesInput.value = state.settings.ownNames;
elements.ownNamesInput.addEventListener("change", () => {
  state.settings.ownNames = elements.ownNamesInput.value.trim();
  saveJson(SETTINGS_KEY, state.settings);
  const marked = markOwnTransfers(state.expenses) + markOwnTransfers(state.pending);
  saveExpenses();
  saveJson(PENDING_KEY, state.pending);
  render();
  if (marked) showToast(`${marked} ${marked === 1 ? "transfer" : "transfers"} to your own accounts found`);
});

recategorizeImported();
cleanImportedDescriptions();

elements.importButton.addEventListener("click", openImportSheet);
elements.setupButton.addEventListener("click", openImportSheet);
elements.setupDismiss.addEventListener("click", () => {
  state.settings.setupDismissed = true;
  saveJson(SETTINGS_KEY, state.settings);
  renderImportState();
});
elements.closeImport.addEventListener("click", () => elements.importSheet.close());
elements.importSheet.addEventListener("click", (event) => {
  if (event.target === elements.importSheet) elements.importSheet.close();
});

elements.smsButton.addEventListener("click", async () => {
  const status = await callBankAlerts("requestSms");
  if (!status) return;
  state.importStatus = status;
  renderImportState();
  if (status.sms) scanInbox();
  else showToast("SMS permission was not allowed");
});
elements.notificationButton.addEventListener("click", () => callBankAlerts("openNotificationSettings"));
elements.appInfoButton.addEventListener("click", () => callBankAlerts("openAppSettings"));
elements.scanButton.addEventListener("click", scanInbox);
elements.autoAddToggle.addEventListener("change", (event) => {
  state.settings.autoAdd = event.target.checked;
  saveJson(SETTINGS_KEY, state.settings);
});

elements.pasteButton.addEventListener("click", () => {
  const chunks = BankAlertParser.splitAlerts(elements.pasteInput.value);
  const parsedAll = chunks.map((body) => BankAlertParser.parseAlert({ body, timestamp: Date.now() }));
  const debits = parsedAll.filter((parsed) => parsed?.direction === "debit");
  const error = !parsedAll.some(Boolean)
    ? "Couldn't find a transaction amount in that text"
    : !debits.length
      ? "That looks like money coming in, not an expense"
      : "";
  elements.pasteError.textContent = error;
  elements.pasteError.hidden = !error;
  if (error) return;

  elements.pasteInput.value = "";
  elements.importSheet.close();

  // Several alerts at once go to the review list; a single one opens the form to check.
  if (chunks.length > 1) {
    ingestAlerts(
      chunks.map((body) => ({ id: `paste:${hashText(body)}`, source: "paste", body, timestamp: Date.now() })),
      { announceEmpty: true },
    );
    return;
  }

  const parsed = debits[0];
  openSheet(null, {
    amount: parsed.amount,
    description: parsed.description,
    category: rememberedCategory(parsed.description) || parsed.category,
    date: toDateValue(new Date(parsed.timestamp)),
    meta: { bank: parsed.bank, source: "paste" },
  });
});

elements.pendingList.addEventListener("click", (event) => {
  const add = event.target.closest("[data-add]");
  const ignore = event.target.closest("[data-ignore]");
  if (add) resolvePending([add.dataset.add], true);
  if (ignore) resolvePending([ignore.dataset.ignore], false);
});
elements.pendingList.addEventListener("change", (event) => {
  const select = event.target.closest("[data-category-for]");
  const item = select && state.pending.find((candidate) => candidate.id === select.dataset.categoryFor);
  if (!item) return;
  item.category = select.value;
  saveJson(PENDING_KEY, state.pending);
  renderPending();
});
elements.addAllPending.addEventListener("click", () => resolvePending(state.pending.map((item) => item.id), true));

if (native) {
  native.addListener("BankAlerts", "alert", () => syncAlerts());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    syncAlerts();
    refreshImportStatus();
  });
  syncAlerts();
  refreshImportStatus();
}

window.addEventListener("resize", () => renderChart());
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => renderChart());

// The Android app bundles its files, so it skips the service worker to avoid serving stale code after updates.
if ("serviceWorker" in navigator && !window.Capacitor?.isNativePlatform()) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js");
  });
}

render();

function setMonth(month) {
  state.month = month;
  state.selectedDay = null;
  elements.monthInput.value = month;
  render();
}

function render() {
  const monthly = getExpensesForMonth(state.month);
  const counted = spending(monthly);
  const total = sum(counted);
  const largest = counted.reduce((max, expense) => Math.max(max, expense.amount), 0);
  const isCurrentMonth = state.month === toMonthValue(new Date());

  elements.monthLabel.textContent = formatMonthLabel(state.month, "short");
  elements.nextMonth.disabled = isCurrentMonth;
  elements.heroLabel.textContent = isCurrentMonth ? "Spent so far this month" : "Total spent";
  elements.totalSpent.textContent = currency.format(total);
  elements.dailyAverage.textContent = compactCurrency.format(total / getDaysElapsed(state.month));
  elements.largestExpense.textContent = compactCurrency.format(largest);
  elements.entryCount.textContent = String(counted.length);
  elements.clearMonthButton.disabled = monthly.length === 0;

  renderPending();
  renderImportState();
  renderDelta(total);
  renderCategories(counted, total);
  renderGroups(monthly);
  renderChart();
}

function renderDelta(total) {
  const previousMonth = shiftMonth(state.month, -1);
  const previousTotal = sum(spending(getExpensesForMonth(previousMonth)));
  const label = formatMonthLabel(previousMonth).split(" ")[0];

  // Only compare against a month the records fully cover; a partly imported month gives silly percentages.
  const earliest = state.expenses.reduce((min, expense) => (expense.date < min ? expense.date : min), "9999");
  const previousIsComplete = earliest <= `${previousMonth}-03`;

  if (!previousTotal || !total || !previousIsComplete) {
    elements.monthDelta.innerHTML = "";
    return;
  }

  const change = Math.round(((total - previousTotal) / previousTotal) * 100);
  const icon = change > 0 ? "i-up" : "i-down";
  const text =
    change === 0 ? `Same as ${label}` : `${Math.abs(change)}% ${change > 0 ? "more" : "less"} than ${label}`;
  elements.monthDelta.innerHTML = `${change === 0 ? "" : `<svg aria-hidden="true"><use href="#${icon}" /></svg>`}${text}`;
}

function renderCategories(expenses, total) {
  const totals = new Map();
  for (const expense of expenses) totals.set(expense.category, (totals.get(expense.category) || 0) + expense.amount);

  const rows = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  if (!rows.length) {
    elements.categoryList.innerHTML = `<li class="category-empty">Your spending by category will show here.</li>`;
    return;
  }

  const max = rows[0][1];
  elements.categoryList.innerHTML = rows
    .map(([category, amount]) => {
      const safe = CATEGORIES.includes(category) ? category : "Other";
      const share = Math.round((amount / total) * 100);
      return `
        <li class="category-row" style="--cat: var(--cat-${catKey(safe)})">
          <span class="category-icon"><svg aria-hidden="true"><use href="#i-${catKey(safe)}" /></svg></span>
          <span class="category-name">${escapeHtml(category)}</span>
          <span class="category-amount">${currency.format(amount)}</span>
          <span class="category-meter">
            <span class="meter" aria-hidden="true"><span style="width:${(amount / max) * 100}%"></span></span>
            <span class="category-share">${share}%</span>
          </span>
        </li>`;
    })
    .join("");
}

function renderGroups(expenses) {
  elements.emptyState.hidden = expenses.length > 0;

  const byDate = new Map();
  for (const expense of expenses) {
    if (!byDate.has(expense.date)) byDate.set(expense.date, []);
    byDate.get(expense.date).push(expense);
  }

  elements.groups.innerHTML = [...byDate.entries()]
    .map(
      ([date, items]) => `
        <section>
          <div class="group-head"><span>${formatDayLabel(date)}</span>${items.length > 1 ? `<span>${currency.format(sum(spending(items)))}</span>` : ""}</div>
          <ul class="group-list">
            ${items.map(renderTransaction).join("")}
          </ul>
        </section>`,
    )
    .join("");
}

function renderPending() {
  elements.pendingCard.hidden = state.pending.length === 0;
  elements.importBadge.hidden = state.pending.length === 0;
  elements.importBadge.textContent = String(state.pending.length);
  elements.addAllPending.textContent = state.pending.length > 1 ? `Add all ${state.pending.length}` : "Add";
  elements.pendingList.innerHTML = state.pending
    .map((item) => {
      const safe = CATEGORIES.includes(item.category) ? item.category : "Other";
      const when = `${formatDayLabel(item.date)}, ${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(item.alertAt))}`;
      return `
        <li class="pending-item">
          <span class="category-icon" style="--cat: var(--cat-${catKey(safe)})"><svg aria-hidden="true"><use href="#i-${catKey(safe)}" /></svg></span>
          <span class="txn-main">
            <span class="txn-title">${escapeHtml(item.description)}</span>
            <span class="txn-meta">${item.ownTransfer ? "Own account · " : ""}${item.bank ? `${escapeHtml(item.bank)} · ` : ""}${when}</span>
          </span>
          <span class="txn-amount">${currency.format(item.amount)}</span>
          <span class="pending-actions">
            <select class="pending-category" data-category-for="${item.id}" aria-label="Category for ${escapeHtml(item.description)}">
              ${categoryOptions.replace(`value="${safe}"`, `value="${safe}" selected`)}
            </select>
            <button class="icon-button" type="button" data-ignore="${item.id}" aria-label="Ignore ${escapeHtml(item.description)}"><svg aria-hidden="true"><use href="#i-close" /></svg></button>
            <button class="button primary small" type="button" data-add="${item.id}">Add</button>
          </span>
        </li>`;
    })
    .join("");
}

function renderImportState() {
  const { sms, notifications } = state.importStatus;
  elements.nativeImport.hidden = !native;
  elements.webImportNote.hidden = Boolean(native);
  elements.setupCard.hidden = !native || state.settings.setupDismissed || sms || notifications;
  elements.autoAddToggle.checked = state.settings.autoAdd;
  setImportButton(elements.smsButton, sms);
  setImportButton(elements.notificationButton, notifications);
  elements.smsStatus.textContent = sms ? "On · GTBank, First Bank, Providus" : "GTBank, First Bank, Providus";
  elements.notificationStatus.textContent = notifications ? "On · OPay, GTWorld, FirstMobile" : "OPay, GTWorld, FirstMobile";
  elements.scanButton.disabled = !sms;
}

function setImportButton(button, isOn) {
  button.disabled = isOn;
  button.classList.toggle("is-on", isOn);
  button.textContent = isOn ? "On" : "Turn on";
}

function renderTransaction(expense) {
  const safe = CATEGORIES.includes(expense.category) ? expense.category : "Other";
  return `
    <li>
      <button class="txn" type="button" data-id="${expense.id}" aria-label="Edit ${escapeHtml(expense.description)}, ${currency.format(expense.amount)}">
        <span class="category-icon" style="--cat: var(--cat-${catKey(safe)})"><svg aria-hidden="true"><use href="#i-${catKey(safe)}" /></svg></span>
        <span class="txn-main">
          <span class="txn-title">${escapeHtml(expense.description)}</span>
          <span class="txn-meta">${expense.ownTransfer ? "Own account" : escapeHtml(expense.category)}${expense.bank ? ` · ${escapeHtml(expense.bank)}` : ""}</span>
        </span>
        <span class="txn-amount${expense.ownTransfer ? " is-excluded" : ""}">${currency.format(expense.amount)}</span>
      </button>
    </li>`;
}

/* Chart */

function renderChart() {
  const canvas = elements.chart;
  const context = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, rect.width, rect.height);

  const colors = readColors();
  const days = getDaysInMonth(state.month);
  const values = new Array(days).fill(0);
  for (const expense of spending(getExpensesForMonth(state.month))) values[Number(expense.date.slice(-2)) - 1] += expense.amount;

  const max = niceMax(Math.max(...values));
  const padding = { top: 12, right: 4, bottom: 26, left: 44 };
  const width = rect.width - padding.left - padding.right;
  const height = rect.height - padding.top - padding.bottom;
  const slot = width / days;
  const gap = slot > 10 ? 2 : 1;
  const barWidth = Math.max(2, slot - gap);
  const baseline = padding.top + height;

  context.font = "12px system-ui, -apple-system, sans-serif";
  context.textBaseline = "middle";

  // Gridlines with compact labels; the baseline is drawn stronger.
  for (let step = 0; step <= 3; step += 1) {
    const y = Math.round(baseline - (height / 3) * step) + 0.5;
    context.strokeStyle = step === 0 ? colors.axis : colors.grid;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(padding.left, y);
    context.lineTo(padding.left + width, y);
    context.stroke();
    context.fillStyle = colors.muted;
    context.textAlign = "right";
    context.fillText(step === 0 ? "₦0" : compactCurrency.format((max / 3) * step), padding.left - 8, y);
  }

  const today = state.month === toMonthValue(new Date()) ? new Date().getDate() : null;
  // Label weekly ticks plus today, skipping any tick that would crowd today's label.
  const labelDays = new Set([1, 8, 15, 22, days].filter((day) => !today || day === today || Math.abs(day - today) > 2));

  values.forEach((value, index) => {
    const day = index + 1;
    const x = padding.left + index * slot + gap / 2;
    const isSelected = state.selectedDay === day;
    const dimmed = state.selectedDay !== null && !isSelected;

    if (value > 0) {
      const barHeight = Math.max(3, (value / max) * height);
      context.fillStyle = colors.brand;
      context.globalAlpha = dimmed ? 0.35 : 1;
      topRoundedRect(context, x, baseline - barHeight, barWidth, barHeight, Math.min(4, barWidth / 2));
      context.fill();
      context.globalAlpha = 1;
    }

    if (labelDays.has(day) || day === today) {
      context.fillStyle = day === today ? colors.ink : colors.muted;
      context.font = `${day === today ? "700 " : ""}12px system-ui, -apple-system, sans-serif`;
      context.textAlign = "center";
      context.fillText(String(day), x + barWidth / 2, baseline + 14);
    }
  });

  chartLayout = { padding, slot, days, values, max, height, baseline };

  if (values.every((value) => value === 0)) {
    context.fillStyle = colors.muted;
    context.font = "600 14px system-ui, -apple-system, sans-serif";
    context.textAlign = "center";
    context.fillText("No spending recorded yet", padding.left + width / 2, padding.top + height / 2);
  }

  positionTooltip();
}

function selectBarAt(event, toggle = false) {
  if (!chartLayout) return;
  const rect = elements.chart.getBoundingClientRect();
  const x = event.clientX - rect.left - chartLayout.padding.left;
  const day = Math.floor(x / chartLayout.slot) + 1;
  selectDay(day >= 1 && day <= chartLayout.days ? day : null, toggle);
}

function selectDay(day, toggle = false) {
  // Tapping the selected bar again closes its tooltip.
  if (toggle && state.selectedDay === day) day = null;
  if (state.selectedDay === day) return;
  state.selectedDay = day;
  renderChart();
}

function positionTooltip() {
  const tooltip = elements.chartTooltip;
  const day = state.selectedDay;
  if (!day || !chartLayout) {
    tooltip.hidden = true;
    return;
  }

  const { padding, slot, values, max, height, baseline } = chartLayout;
  const value = values[day - 1];
  const date = `${state.month}-${String(day).padStart(2, "0")}`;
  tooltip.innerHTML = `${formatDayLabel(date)}<strong>${currency.format(value)}</strong>`;
  tooltip.hidden = false;

  const wrapWidth = elements.chartWrap.clientWidth;
  const half = tooltip.offsetWidth / 2;
  const center = padding.left + (day - 0.5) * slot;
  const barTop = baseline - (value / max) * height;
  tooltip.style.left = `${Math.min(wrapWidth - half, Math.max(half, center))}px`;
  tooltip.style.top = `${Math.max(0, barTop - tooltip.offsetHeight - 8)}px`;
}

function readColors() {
  const styles = getComputedStyle(document.documentElement);
  const read = (name) => styles.getPropertyValue(name).trim();
  return {
    brand: read("--brand"),
    grid: read("--grid"),
    axis: read("--axis"),
    muted: read("--ink-3"),
    ink: read("--ink"),
  };
}

function niceMax(value) {
  if (value <= 0) return 3000;
  // Round up to a value whose thirds are round numbers, so gridline labels stay clean.
  const unit = 10 ** Math.floor(Math.log10(value / 3));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((candidate) => candidate * unit * 3 >= value) * unit;
  return step * 3;
}

function topRoundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, height);
  context.beginPath();
  context.moveTo(x, y + height);
  context.lineTo(x, y + r);
  context.arcTo(x, y, x + r, y, r);
  context.lineTo(x + width - r, y);
  context.arcTo(x + width, y, x + width, y + r, r);
  context.lineTo(x + width, y + height);
  context.closePath();
}

/* Bank alerts */

async function callBankAlerts(method, options = {}) {
  if (!native) return null;
  try {
    return await native.nativePromise("BankAlerts", method, options);
  } catch (error) {
    console.warn(`BankAlerts.${method} failed`, error);
    return null;
  }
}

async function refreshImportStatus() {
  const status = await callBankAlerts("getStatus");
  if (!status) return;
  state.importStatus = status;
  renderImportState();
}

async function syncAlerts() {
  const result = await callBankAlerts("takePending");
  if (result?.alerts?.length) ingestAlerts(result.alerts);
}

async function scanInbox() {
  elements.scanButton.disabled = true;
  elements.scanButton.textContent = "Scanning…";
  const result = await callBankAlerts("readInbox", { days: 30 });
  elements.scanButton.textContent = "Scan SMS from the last 30 days";
  renderImportState();
  if (result) ingestAlerts(result.alerts, { announceEmpty: true });
}

function openImportSheet() {
  renderImportState();
  refreshImportStatus();
  elements.pasteError.hidden = true;
  elements.importSheet.showModal();
}

function ingestAlerts(alerts, { announceEmpty = false } = {}) {
  let added = 0;
  let queued = 0;

  for (const alert of alerts) {
    if (!alert?.id || state.seenAlerts.has(alert.id)) continue;
    state.seenAlerts.add(alert.id);

    const parsed = BankAlertParser.parseAlert(alert);
    if (!parsed || parsed.direction !== "debit" || isDuplicateAlert(parsed, alert.source)) continue;

    const candidate = {
      id: createId(),
      amount: parsed.amount,
      description: parsed.description,
      category: rememberedCategory(parsed.description) || parsed.category,
      date: toDateValue(new Date(parsed.timestamp)),
      bank: parsed.bank,
      source: alert.source,
      alertAt: parsed.timestamp,
    };
    markOwnTransfers([candidate]);

    if (state.settings.autoAdd) {
      state.expenses.unshift(toExpense(candidate));
      added += 1;
    } else {
      state.pending.push(candidate);
      queued += 1;
    }
  }

  state.pending.sort((a, b) => b.alertAt - a.alertAt);
  saveJson(SEEN_ALERTS_KEY, [...state.seenAlerts].slice(-3000));
  saveJson(PENDING_KEY, state.pending);
  saveExpenses();
  render();

  if (added) showToast(`${added} bank ${added === 1 ? "expense" : "expenses"} added`);
  else if (queued) showToast(`${queued} new from your banks to review`);
  else if (announceEmpty) showToast("No new bank debits found");
}

// A bank's SMS and its app notification describe the same debit; keep only the first one seen.
function isDuplicateAlert(parsed, source) {
  const fifteenMinutes = 15 * 60 * 1000;
  return [...state.pending, ...state.expenses].some(
    (item) =>
      item.alertAt &&
      item.source !== source &&
      item.bank === parsed.bank &&
      item.amount === parsed.amount &&
      Math.abs(item.alertAt - parsed.timestamp) < fifteenMinutes,
  );
}

function resolvePending(ids, add) {
  const chosen = new Set(ids);
  const items = state.pending.filter((item) => chosen.has(item.id));
  state.pending = state.pending.filter((item) => !chosen.has(item.id));
  if (add) {
    for (const item of items) {
      state.expenses.unshift(toExpense(item));
      rememberCategory(item.description, item.category);
    }
  }
  saveJson(PENDING_KEY, state.pending);
  saveExpenses();
  render();
  if (add) showToast(items.length === 1 ? "Expense added" : `${items.length} expenses added`);
}

function toExpense(candidate) {
  const { id, amount, description, category, date, bank, source, alertAt, ownTransfer = false } = candidate;
  return { id, amount, description, category, date, bank, source, alertAt, ownTransfer, createdAt: new Date(alertAt).toISOString() };
}

// Remembers the category you pick for a merchant so the next alert from it is filed the same way.
function merchantKey(description) {
  const noise = new Set(["pos", "purchase", "nip", "trf", "transfer", "payment", "web", "the", "for", "from", "and", "via", "ref"]);
  return description
    .toLowerCase()
    .replace(/[^a-z ]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !noise.has(word))
    .slice(0, 3)
    .join(" ");
}

function rememberCategory(description, category) {
  const key = merchantKey(description);
  if (!key) return;
  state.categoryMemory[key] = category;
  saveJson(CATEGORY_MEMORY_KEY, state.categoryMemory);
}

function rememberedCategory(description) {
  return state.categoryMemory[merchantKey(description)] || null;
}

/* Categories & own transfers */

function catKey(category) {
  return category.replace(/\s+/g, "-");
}

// Money moved between your own accounts is listed but not counted as spending.
function spending(expenses) {
  return expenses.filter((expense) => !expense.ownTransfer);
}

function isToOwnName(description) {
  const text = description.toLowerCase();
  return state.settings.ownNames
    .split(",")
    .map((name) => name.toLowerCase().split(/\s+/).filter((word) => word.length > 1))
    .some((words) => words.length >= 2 && words.every((word) => new RegExp(`\\b${escapeRegExp(word)}\\b`).test(text)));
}

function markOwnTransfers(items) {
  let marked = 0;
  for (const item of items) {
    if (item.ownTransfer || !isToOwnName(item.description)) continue;
    item.ownTransfer = true;
    item.category = "Transfers";
    marked += 1;
  }
  return marked;
}

// Imports made before the Transfers and Bank charges categories existed were mostly filed as Other.
function recategorizeImported() {
  if (localStorage.getItem(RECATEGORIZED_KEY)) return;
  for (const item of [...state.expenses, ...state.pending]) {
    if (!item.source || item.category !== "Other") continue;
    item.category = rememberedCategory(item.description) || BankAlertParser.guessCategory(item.description);
  }
  saveExpenses();
  saveJson(PENDING_KEY, state.pending);
  localStorage.setItem(RECATEGORIZED_KEY, "1");
}

// Rewrites descriptions imported before the recipient-first format (e.g. GTBank outward transfers).
function cleanImportedDescriptions() {
  if (localStorage.getItem(DESCRIPTIONS_CLEANED_KEY)) return;
  for (const item of [...state.expenses, ...state.pending]) {
    if (item.source) item.description = BankAlertParser.cleanDescription(item.description);
  }
  saveExpenses();
  saveJson(PENDING_KEY, state.pending);
  localStorage.setItem(DESCRIPTIONS_CLEANED_KEY, "1");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* Sheet & toast */

function openSheet(expense, draft = null) {
  state.draft = expense ? null : draft;
  state.editingId = expense?.id ?? null;
  elements.sheetTitle.textContent = expense ? "Edit expense" : "Add expense";
  elements.saveButton.textContent = expense ? "Save changes" : "Save expense";
  elements.deleteButton.hidden = !expense;

  const values = expense ?? draft;
  elements.amountInput.value = values?.amount ?? "";
  elements.descriptionInput.value = values?.description ?? "";
  elements.form.elements.category.value = values?.category ?? "Food";
  elements.dateInput.value = values?.date ?? defaultDateForMonth();
  elements.ownTransferInput.checked = Boolean(values?.ownTransfer);
  setFieldError(elements.amountInput, elements.amountError, false);
  setFieldError(elements.descriptionInput, elements.descriptionError, false);

  elements.sheet.showModal();
  if (!expense) elements.amountInput.focus();
}

function setFieldError(input, message, invalid) {
  input.closest("label").classList.toggle("is-invalid", invalid);
  input.setAttribute("aria-invalid", String(invalid));
  message.hidden = !invalid;
}

function showToast(text, withUndo = false) {
  elements.toastText.textContent = text;
  elements.toastUndo.hidden = !withUndo;
  elements.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, withUndo ? 6000 : 2500);
}

function hideToast() {
  elements.toast.hidden = true;
}

/* Data */

function getExpensesForMonth(month) {
  return state.expenses
    .filter((expense) => expense.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

function sum(expenses) {
  return expenses.reduce((total, expense) => total + expense.amount, 0);
}

function loadExpenses() {
  const expenses = loadJson(STORAGE_KEY, []);
  if (localStorage.getItem(DEMO_REMOVED_KEY)) return expenses;

  // Earlier versions filled a new install with sample expenses; clear those out once.
  const demo = new Set([
    "Groceries|82.45|03", "Train pass|48|05", "Electric bill|96.2|09", "Dinner|34.5|12",
    "Groceries|18500|03", "Bus fare|4800|05", "Electricity token|15000|09", "Dinner|9500|12",
  ]);
  const cleaned = expenses.filter((expense) => !demo.has(`${expense.description}|${expense.amount}|${expense.date.slice(-2)}`));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
  localStorage.setItem(DEMO_REMOVED_KEY, "1");
  return cleaned;
}

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function saveExpenses() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.expenses));
}

function hashText(text) {
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) hash = ((hash << 5) + hash + text.charCodeAt(index)) | 0;
  return (hash >>> 0).toString(36);
}

function createId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/* Dates */

function defaultDateForMonth() {
  const today = toDateValue(new Date());
  return today.startsWith(state.month) ? today : `${state.month}-01`;
}

function shiftMonth(monthValue, offset) {
  const [year, month] = monthValue.split("-").map(Number);
  return toMonthValue(new Date(year, month - 1 + offset, 1));
}

function getDaysInMonth(monthValue) {
  const [year, month] = monthValue.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

function getDaysElapsed(monthValue) {
  const now = new Date();
  if (monthValue === toMonthValue(now)) return now.getDate();
  return getDaysInMonth(monthValue);
}

function toMonthValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function toDateValue(date) {
  return `${toMonthValue(date)}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatMonthLabel(monthValue, style = "long") {
  const [year, month] = monthValue.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: style, year: "numeric" }).format(new Date(year, month - 1, 1));
}

function formatDayLabel(dateValue) {
  const date = new Date(`${dateValue}T00:00:00`);
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (dateValue === toDateValue(today)) return "Today";
  if (dateValue === toDateValue(yesterday)) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(date);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[char];
  });
}
