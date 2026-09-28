const STORAGE_KEY = "expense-overview-items";
const CATEGORIES = ["Food", "Rent", "Transport", "Utilities", "Health", "Shopping", "Entertainment", "Other"];

const currency = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" });
const compactCurrency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  notation: "compact",
  maximumFractionDigits: 1,
});

const state = {
  expenses: loadExpenses(),
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
};

elements.categoryChips.innerHTML = CATEGORIES.map(
  (category, index) => `
    <label class="chip" style="--cat: var(--cat-${category})">
      <input type="radio" name="category" value="${category}" ${index === 0 ? "checked" : ""} />
      <span><svg aria-hidden="true"><use href="#i-${category}" /></svg>${category}</span>
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
  };

  const existing = state.expenses.find((expense) => expense.id === state.editingId);
  if (existing) {
    Object.assign(existing, fields);
  } else {
    state.expenses.unshift({ id: createId(), ...fields, createdAt: new Date().toISOString() });
  }

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

elements.chartWrap.addEventListener("pointerdown", (event) => selectBarAt(event));
elements.chartWrap.addEventListener("pointermove", (event) => {
  if (event.pointerType === "mouse") selectBarAt(event);
});
elements.chartWrap.addEventListener("pointerleave", (event) => {
  if (event.pointerType === "mouse") selectDay(null);
});

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
  const total = sum(monthly);
  const largest = monthly.reduce((max, expense) => Math.max(max, expense.amount), 0);
  const isCurrentMonth = state.month === toMonthValue(new Date());

  elements.monthLabel.textContent = formatMonthLabel(state.month);
  elements.nextMonth.disabled = isCurrentMonth;
  elements.heroLabel.textContent = isCurrentMonth ? "Spent so far this month" : "Total spent";
  elements.totalSpent.textContent = currency.format(total);
  elements.dailyAverage.textContent = compactCurrency.format(total / getDaysElapsed(state.month));
  elements.largestExpense.textContent = compactCurrency.format(largest);
  elements.entryCount.textContent = String(monthly.length);
  elements.clearMonthButton.disabled = monthly.length === 0;

  renderDelta(total);
  renderCategories(monthly, total);
  renderGroups(monthly);
  renderChart();
}

function renderDelta(total) {
  const previousMonth = shiftMonth(state.month, -1);
  const previousTotal = sum(getExpensesForMonth(previousMonth));
  const label = formatMonthLabel(previousMonth).split(" ")[0];

  if (!previousTotal || !total) {
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
        <li class="category-row" style="--cat: var(--cat-${safe})">
          <span class="category-icon"><svg aria-hidden="true"><use href="#i-${safe}" /></svg></span>
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
          <div class="group-head"><span>${formatDayLabel(date)}</span>${items.length > 1 ? `<span>${currency.format(sum(items))}</span>` : ""}</div>
          <ul class="group-list">
            ${items.map(renderTransaction).join("")}
          </ul>
        </section>`,
    )
    .join("");
}

function renderTransaction(expense) {
  const safe = CATEGORIES.includes(expense.category) ? expense.category : "Other";
  return `
    <li>
      <button class="txn" type="button" data-id="${expense.id}" aria-label="Edit ${escapeHtml(expense.description)}, ${currency.format(expense.amount)}">
        <span class="category-icon" style="--cat: var(--cat-${safe})"><svg aria-hidden="true"><use href="#i-${safe}" /></svg></span>
        <span class="txn-main">
          <span class="txn-title">${escapeHtml(expense.description)}</span>
          <span class="txn-meta">${escapeHtml(expense.category)}</span>
        </span>
        <span class="txn-amount">${currency.format(expense.amount)}</span>
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
  for (const expense of getExpensesForMonth(state.month)) values[Number(expense.date.slice(-2)) - 1] += expense.amount;

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

function selectBarAt(event) {
  if (!chartLayout) return;
  const rect = elements.chart.getBoundingClientRect();
  const x = event.clientX - rect.left - chartLayout.padding.left;
  const day = Math.floor(x / chartLayout.slot) + 1;
  selectDay(day >= 1 && day <= chartLayout.days ? day : null);
}

function selectDay(day) {
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

/* Sheet & toast */

function openSheet(expense) {
  state.editingId = expense?.id ?? null;
  elements.sheetTitle.textContent = expense ? "Edit expense" : "Add expense";
  elements.saveButton.textContent = expense ? "Save changes" : "Save expense";
  elements.deleteButton.hidden = !expense;

  elements.amountInput.value = expense ? expense.amount : "";
  elements.descriptionInput.value = expense?.description ?? "";
  elements.form.elements.category.value = expense?.category ?? "Food";
  elements.dateInput.value = expense?.date ?? defaultDateForMonth();
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
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || seedExpenses();
  } catch {
    return seedExpenses();
  }
}

function saveExpenses() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.expenses));
}

function seedExpenses() {
  const today = new Date();
  const month = toMonthValue(today);
  const samples = [
    ["Groceries", 18500, "Food", "03"],
    ["Bus fare", 4800, "Transport", "05"],
    ["Electricity token", 15000, "Utilities", "09"],
    ["Dinner", 9500, "Food", "12"],
  ];

  return samples.map(([description, amount, category, day], index) => ({
    id: createId(),
    description,
    amount,
    category,
    date: `${month}-${day}`,
    createdAt: new Date(today.getTime() - index * 86400000).toISOString(),
  }));
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

function formatMonthLabel(monthValue) {
  const [year, month] = monthValue.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
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
