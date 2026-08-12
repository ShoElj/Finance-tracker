const STORAGE_KEY = "expense-overview-items";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const categoryColors = {
  Food: "#0f8b6d",
  Rent: "#3d74c5",
  Transport: "#d69b2d",
  Utilities: "#7c5cc4",
  Health: "#d85c5c",
  Shopping: "#c55b93",
  Entertainment: "#2297a8",
  Other: "#657282",
};

const state = {
  expenses: loadExpenses(),
  month: toMonthValue(new Date()),
  chartMode: "daily",
};

const elements = {
  monthInput: document.querySelector("#monthInput"),
  form: document.querySelector("#expenseForm"),
  descriptionInput: document.querySelector("#descriptionInput"),
  amountInput: document.querySelector("#amountInput"),
  dateInput: document.querySelector("#dateInput"),
  categoryInput: document.querySelector("#categoryInput"),
  totalSpent: document.querySelector("#totalSpent"),
  dailyAverage: document.querySelector("#dailyAverage"),
  largestExpense: document.querySelector("#largestExpense"),
  entryCount: document.querySelector("#entryCount"),
  rows: document.querySelector("#expenseRows"),
  emptyState: document.querySelector("#emptyState"),
  chart: document.querySelector("#expenseChart"),
  chartMode: document.querySelector("#chartMode"),
  chartSubtitle: document.querySelector("#chartSubtitle"),
  listSubtitle: document.querySelector("#listSubtitle"),
  clearMonthButton: document.querySelector("#clearMonthButton"),
};

elements.monthInput.value = state.month;
elements.dateInput.value = toDateValue(new Date());

elements.monthInput.addEventListener("change", (event) => {
  state.month = event.target.value || toMonthValue(new Date());
  syncDateToSelectedMonth();
  render();
});

elements.chartMode.addEventListener("change", (event) => {
  state.chartMode = event.target.value;
  render();
});

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();

  const amount = Number(elements.amountInput.value);
  if (!Number.isFinite(amount) || amount <= 0) return;

  const expense = {
    id: createId(),
    description: elements.descriptionInput.value.trim(),
    amount,
    date: elements.dateInput.value,
    category: elements.categoryInput.value,
    createdAt: new Date().toISOString(),
  };

  state.expenses.unshift(expense);
  saveExpenses();
  elements.form.reset();
  elements.dateInput.value = expense.date;
  elements.categoryInput.value = expense.category;
  render();
});

elements.rows.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-id]");
  if (!button) return;

  state.expenses = state.expenses.filter((expense) => expense.id !== button.dataset.deleteId);
  saveExpenses();
  render();
});

elements.clearMonthButton.addEventListener("click", () => {
  const monthlyExpenses = getMonthlyExpenses();
  if (!monthlyExpenses.length) return;

  const idsToRemove = new Set(monthlyExpenses.map((expense) => expense.id));
  state.expenses = state.expenses.filter((expense) => !idsToRemove.has(expense.id));
  saveExpenses();
  render();
});

window.addEventListener("resize", () => renderChart(getMonthlyExpenses()));

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js");
  });
}

render();

function render() {
  const monthlyExpenses = getMonthlyExpenses();
  const total = monthlyExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const largest = monthlyExpenses.reduce((max, expense) => Math.max(max, expense.amount), 0);
  const daysElapsed = getDaysElapsedInSelectedMonth();

  elements.totalSpent.textContent = currency.format(total);
  elements.dailyAverage.textContent = currency.format(total / daysElapsed);
  elements.largestExpense.textContent = currency.format(largest);
  elements.entryCount.textContent = String(monthlyExpenses.length);
  elements.chartSubtitle.textContent =
    state.chartMode === "daily" ? "Daily spending for this month" : "Spending grouped by category";
  elements.listSubtitle.textContent = `Showing ${formatMonthLabel(state.month)}`;

  renderRows(monthlyExpenses);
  renderChart(monthlyExpenses);
}

function renderRows(expenses) {
  elements.rows.innerHTML = "";
  elements.emptyState.classList.toggle("is-visible", expenses.length === 0);

  for (const expense of expenses) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(expense.description)}</td>
      <td><span class="category-pill">${escapeHtml(expense.category)}</span></td>
      <td>${formatDate(expense.date)}</td>
      <td class="amount-col">${currency.format(expense.amount)}</td>
      <td class="amount-col">
        <button class="delete-button" type="button" data-delete-id="${expense.id}" aria-label="Delete ${escapeHtml(
          expense.description,
        )}">x</button>
      </td>
    `;
    elements.rows.appendChild(row);
  }
}

function renderChart(expenses) {
  const canvas = elements.chart;
  const context = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, rect.width, rect.height);

  if (state.chartMode === "category") {
    drawCategoryChart(context, rect.width, rect.height, expenses);
    return;
  }

  drawDailyChart(context, rect.width, rect.height, expenses);
}

function drawDailyChart(context, width, height, expenses) {
  const daysInMonth = getDaysInMonth(state.month);
  const values = Array.from({ length: daysInMonth }, (_, index) => ({
    label: String(index + 1),
    value: 0,
  }));

  for (const expense of expenses) {
    const day = Number(expense.date.slice(-2));
    values[day - 1].value += expense.amount;
  }

  drawBarChart(context, width, height, values, "#0f8b6d", true);
}

function drawCategoryChart(context, width, height, expenses) {
  const totals = expenses.reduce((map, expense) => {
    map.set(expense.category, (map.get(expense.category) || 0) + expense.amount);
    return map;
  }, new Map());

  const values = [...totals.entries()]
    .map(([label, value]) => ({ label, value, color: categoryColors[label] || categoryColors.Other }))
    .sort((a, b) => b.value - a.value);

  drawBarChart(context, width, height, values, "#3d74c5", false);
}

function drawBarChart(context, width, height, values, fallbackColor, compactLabels) {
  const padding = { top: 28, right: 26, bottom: 54, left: 68 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(...values.map((item) => item.value), 1);
  const barGap = compactLabels ? 4 : 12;
  const barWidth = Math.max(8, (chartWidth - barGap * (values.length - 1)) / Math.max(values.length, 1));

  drawAxis(context, padding, chartWidth, chartHeight, maxValue);

  values.forEach((item, index) => {
    const barHeight = (item.value / maxValue) * chartHeight;
    const x = padding.left + index * (barWidth + barGap);
    const y = padding.top + chartHeight - barHeight;
    const color = item.color || fallbackColor;

    context.fillStyle = color;
    roundRect(context, x, y, barWidth, barHeight, 5);
    context.fill();

    const shouldShowLabel = !compactLabels || values.length <= 16 || index % 3 === 0;
    if (shouldShowLabel) {
      context.save();
      context.fillStyle = "#657282";
      context.font = "12px Inter, system-ui, sans-serif";
      context.textAlign = "center";
      context.fillText(item.label, x + barWidth / 2, height - 24);
      context.restore();
    }
  });

  if (!values.length || values.every((item) => item.value === 0)) {
    context.fillStyle = "#657282";
    context.font = "700 16px Inter, system-ui, sans-serif";
    context.textAlign = "center";
    context.fillText("Add expenses to see your graph", width / 2, height / 2);
  }
}

function drawAxis(context, padding, chartWidth, chartHeight, maxValue) {
  context.strokeStyle = "#d5dee8";
  context.lineWidth = 1;
  context.fillStyle = "#657282";
  context.font = "12px Inter, system-ui, sans-serif";
  context.textAlign = "right";

  for (let index = 0; index <= 4; index += 1) {
    const value = (maxValue / 4) * index;
    const y = padding.top + chartHeight - (chartHeight / 4) * index;
    context.beginPath();
    context.moveTo(padding.left, y);
    context.lineTo(padding.left + chartWidth, y);
    context.stroke();
    context.fillText(currency.format(value), padding.left - 10, y + 4);
  }
}

function roundRect(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

function getMonthlyExpenses() {
  return state.expenses
    .filter((expense) => expense.date.startsWith(state.month))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
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
    ["Groceries", 82.45, "Food", "03"],
    ["Train pass", 48, "Transport", "05"],
    ["Electric bill", 96.2, "Utilities", "09"],
    ["Dinner", 34.5, "Food", "12"],
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

function syncDateToSelectedMonth() {
  if (!elements.dateInput.value.startsWith(state.month)) {
    elements.dateInput.value = `${state.month}-01`;
  }
}

function getDaysInMonth(monthValue) {
  const [year, month] = monthValue.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

function getDaysElapsedInSelectedMonth() {
  const now = new Date();
  const currentMonth = toMonthValue(now);
  if (state.month === currentMonth) return now.getDate();
  return getDaysInMonth(state.month);
}

function toMonthValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function toDateValue(date) {
  return `${toMonthValue(date)}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatMonthLabel(monthValue) {
  const [year, month] = monthValue.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(
    new Date(year, month - 1, 1),
  );
}

function formatDate(dateValue) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${dateValue}T00:00:00`));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[char];
  });
}
