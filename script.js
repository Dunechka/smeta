"use strict";

const items = document.querySelector("#items");
const template = document.querySelector("#item-template");
const total = document.querySelector("#total");
const discountRate = document.querySelector("#discount-rate");
const vatRate = document.querySelector("#vat-rate");
const currency = document.querySelector("#currency");
const moneyFormatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const draftKey = "smeta-draft-v1";
const fieldIds = ["sender", "recipient", "estimate-number", "estimate-date", "discount-rate", "vat-rate", "currency", "comment"];
let restoringDraft = true;
let copyTimer;

function parseNumber(value) {
  const normalized = value.trim().replace(/[\s\u00a0\u202f]/g, "").replace(",", ".");
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return 0;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function formatMoney(value) {
  return `${moneyFormatter.format(Number.isFinite(value) ? value : 0).replace(/[\u00a0\u202f]/g, " ")} ${currency.value}`;
}

function roundAmount(value) {
  return Number.isFinite(value) ? Math.round(value) || 0 : 0;
}

function updateSummary(outputId, rowId, amount) {
  document.querySelector(outputId).textContent = formatMoney(amount);
  if (rowId) document.querySelector(rowId).hidden = amount === 0;
}

function recalculate() {
  let sum = 0;
  for (const row of items.rows) {
    const product = parseNumber(row.querySelector(".quantity").value) * parseNumber(row.querySelector(".price").value);
    const safeAmount = roundAmount(product);
    row.querySelector(".line-total").textContent = formatMoney(safeAmount);
    sum += safeAmount;
  }
  sum = roundAmount(sum);
  const discount = roundAmount(sum * (parseNumber(discountRate.value) / 100));
  const discounted = roundAmount(sum - discount);
  const vat = roundAmount(discounted * (parseNumber(vatRate.value) / 100));
  updateSummary("#subtotal", null, sum);
  updateSummary("#discount-amount", "#discount-row", discount);
  updateSummary("#discounted-amount", "#discounted-row", discounted);
  updateSummary("#vat-amount", "#vat-row", vat);
  total.textContent = formatMoney(roundAmount(discounted + vat));
  if (!restoringDraft) saveDraft();
}

function addItem(focus = true) {
  const row = template.content.firstElementChild.cloneNode(true);
  items.append(row);
  if (focus) row.querySelector(".item-name").focus();
  recalculate();
}

items.addEventListener("input", recalculate);
items.addEventListener("click", (event) => {
  const button = event.target.closest(".remove-button");
  if (!button) return;
  const row = button.closest("tr");
  const nextRow = row.nextElementSibling || row.previousElementSibling;
  row.remove();
  recalculate();
  if (nextRow) nextRow.querySelector(".item-name").focus();
  else document.querySelector("#add-item").focus();
});
items.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.isComposing && event.target.matches("input") && event.target.closest("tr") === items.lastElementChild) {
    event.preventDefault();
    addItem();
  }
});
document.querySelector("#add-item").addEventListener("click", () => addItem());
discountRate.addEventListener("input", recalculate);
vatRate.addEventListener("input", recalculate);
currency.addEventListener("change", recalculate);

const today = new Date();
document.querySelector("#estimate-date").value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
addItem(false);
restoreDraft();
restoringDraft = false;

function saveDraft() {
  const fields = Object.fromEntries(fieldIds.map((id) => [id, document.getElementById(id).value]));
  const positions = Array.from(items.rows, (row) => ({
    name: row.querySelector(".item-name").value,
    quantity: row.querySelector(".quantity").value,
    unit: row.querySelector("select").value,
    price: row.querySelector(".price").value
  }));
  try {
    localStorage.setItem(draftKey, JSON.stringify({ fields, positions }));
    document.querySelector("#storage-status").textContent = "";
  } catch {
    document.querySelector("#storage-status").textContent = "Не удалось сохранить черновик в браузере. Не закрывайте страницу, пока не сохраните PDF или текст.";
  }
}

function restoreDraft() {
  try {
    const stored = localStorage.getItem(draftKey);
    if (!stored) return;
    const draft = JSON.parse(stored);
    if (!draft || !draft.fields || !Array.isArray(draft.positions) ||
        !draft.positions.every((position) => position && ["name", "quantity", "unit", "price"].every((key) => typeof position[key] === "string"))) {
      throw new Error("Invalid draft");
    }
    for (const id of fieldIds) {
      if (typeof draft.fields[id] === "string") {
        if (id === "currency" && !["₸", "₽", "$", "€"].includes(draft.fields[id])) continue;
        document.getElementById(id).value = draft.fields[id];
      }
    }
    items.replaceChildren();
    for (const position of draft.positions) {
      addItem(false);
      const row = items.lastElementChild;
      row.querySelector(".item-name").value = position.name;
      row.querySelector(".quantity").value = position.quantity;
      row.querySelector(".price").value = position.price;
      row.querySelector("select").value = ["шт", "час", "услуга"].includes(position.unit) ? position.unit : "шт";
    }
    recalculate();
  } catch {
    document.querySelector("#storage-status").textContent = "Не удалось восстановить черновик. Можно продолжить работу с новой сметой.";
  }
}

document.querySelector("main").addEventListener("input", (event) => {
  if (event.target.matches("input, select, #comment")) saveDraft();
});
document.querySelector("main").addEventListener("change", (event) => {
  if (event.target.matches("input, select, #comment")) saveDraft();
});

function clearShareFeedback() {
  clearTimeout(copyTimer);
  document.querySelector("#copy-status").textContent = "";
  document.querySelector("#manual-copy").hidden = true;
  document.querySelector("#share-text").value = "";
}

document.querySelector("#new-estimate").addEventListener("click", () => {
  if (!window.confirm("Создать новую смету? Текущий черновик будет очищен.")) return;
  const currentNumber = document.querySelector("#estimate-number").value.trim();
  const numericNumber = /^\d+$/.test(currentNumber) ? Number(currentNumber) : 0;
  const nextNumber = Number.isSafeInteger(numericNumber) && numericNumber < Number.MAX_SAFE_INTEGER ? numericNumber + 1 : 1;
  restoringDraft = true;
  for (const id of fieldIds) document.getElementById(id).value = "";
  discountRate.value = "0";
  vatRate.value = "0";
  currency.value = "₸";
  document.querySelector("#estimate-number").value = String(nextNumber).padStart(/^\d+$/.test(currentNumber) ? currentNumber.length : 1, "0");
  const now = new Date();
  document.querySelector("#estimate-date").value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  items.replaceChildren();
  document.querySelectorAll(".print-value").forEach((value) => value.remove());
  clearShareFeedback();
  addItem(false);
  restoringDraft = false;
  saveDraft();
  document.querySelector("#sender").focus();
});

function buildShareText() {
  recalculate();
  const number = document.querySelector("#estimate-number").value.trim() || "—";
  const date = document.querySelector("#estimate-date").value;
  const lines = [`Смета № ${number} от ${date ? date.split("-").reverse().join(".") : "—"}`];
  for (const [id, label] of [["sender", "От кого"], ["recipient", "Для кого"]]) {
    const value = document.getElementById(id).value.trim();
    if (value) lines.push(`${label}: ${value}`);
  }
  lines.push("");
  for (const row of items.rows) {
    const name = row.querySelector(".item-name").value.trim() || "Без наименования";
    const quantity = parseNumber(row.querySelector(".quantity").value);
    const unit = row.querySelector("select").value;
    const price = formatMoney(parseNumber(row.querySelector(".price").value));
    lines.push(`• ${name} — ${quantity} ${unit} × ${price} = ${row.querySelector(".line-total").textContent}`);
  }
  lines.push("", `Сумма: ${document.querySelector("#subtotal").textContent}`);
  for (const [rowId, outputId, label] of [["discount-row", "discount-amount", "Скидка"], ["discounted-row", "discounted-amount", "Сумма со скидкой"], ["vat-row", "vat-amount", "НДС"]]) {
    if (!document.getElementById(rowId).hidden) lines.push(`${label}: ${document.getElementById(outputId).textContent}`);
  }
  lines.push(`Итого к оплате: ${total.textContent}`);
  const comment = document.querySelector("#comment").value.trim();
  if (comment) lines.push("", comment);
  return lines.join("\n");
}

document.querySelector("#copy-whatsapp").addEventListener("click", async () => {
  clearShareFeedback();
  const text = buildShareText();
  try {
    await navigator.clipboard.writeText(text);
    document.querySelector("#copy-status").textContent = "Скопировано ✓";
    copyTimer = setTimeout(() => { document.querySelector("#copy-status").textContent = ""; }, 2000);
  } catch {
    document.querySelector("#manual-copy").hidden = false;
    const field = document.querySelector("#share-text");
    field.value = text;
    field.focus();
    field.select();
  }
});

function preparePrint() {
  recalculate();
  const number = document.querySelector("#estimate-number").value.trim() || "—";
  const date = document.querySelector("#estimate-date").value;
  const formattedDate = date ? date.split("-").reverse().join(".") : "—";
  document.querySelector("#print-heading").textContent = `Смета № ${number} от ${formattedDate}`;

  // Text copies wrap freely on paper, including long names and comments.
  document.querySelectorAll(".print-value").forEach((value) => value.remove());
  document.querySelectorAll(".details input, #items input, #items select, #comment").forEach((field) => {
    const value = document.createElement("span");
    value.className = "print-only print-value";
    value.textContent = field.value;
    field.after(value);
  });
}

window.addEventListener("beforeprint", preparePrint);
document.querySelector("#save-pdf").addEventListener("click", () => {
  preparePrint();
  window.print();
});
// Эффект волшебной палочки за курсором
document.addEventListener('mousemove', function(e) {
  // Чтобы искры не сыпались слишком часто (снижаем нагрузку)
  if (Math.random() > 0.4) return; 

  const sparkle = document.createElement('div');
  sparkle.classList.add('magic-sparkle');
  
  // Случайный разлет искр в стороны
  const dx = (Math.random() - 0.5) * 50 + 'px';
  const dy = (Math.random() - 0.5) * 50 + 'px';
  sparkle.style.setProperty('--dx', dx);
  sparkle.style.setProperty('--dy', dy);

  // Позиция курсора
  sparkle.style.left = e.clientX + 'px';
  sparkle.style.top = e.clientY + 'px';

  document.body.appendChild(sparkle);

  // Удаляем искорку из DOM после окончания анимации (0.6 секунды)
  setTimeout(() => {
      sparkle.remove();
  }, 600);
});
