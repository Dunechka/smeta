"use strict";

const items = document.querySelector("#items");
const template = document.querySelector("#item-template");
const total = document.querySelector("#total");
const discountRate = document.querySelector("#discount-rate");
const vatRate = document.querySelector("#vat-rate");
const currency = document.querySelector("#currency");
const exchangeRate = document.querySelector("#exchange-rate");
const exchangeRates = { USD: "500", EUR: "550", CNY: "70" };
const currencySymbols = { KZT: "₸", USD: "$", EUR: "€", CNY: "¥" };
const convertedFormatter = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  return `${moneyFormatter.format(Number.isFinite(value) ? value : 0).replace(/[\u00a0\u202f]/g, " ")} ₸`;
}

function amountInWords(amount) {
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 999999999) return "";
  const units = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
  const teens = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
  const tens = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
  const hundreds = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];
  const words = amount < 0 ? ["минус"] : [];
  const groups = [
    [Math.floor(Math.abs(amount) / 1000000), ["миллион", "миллиона", "миллионов"], false],
    [Math.floor(Math.abs(amount) / 1000) % 1000, ["тысяча", "тысячи", "тысяч"], true],
    [Math.abs(amount) % 1000, null, false]
  ];
  for (const [value, forms, feminine] of groups) {
    if (!value) continue;
    words.push(hundreds[Math.floor(value / 100)]);
    const remainder = value % 100;
    const unit = value % 10;
    if (remainder >= 10 && remainder <= 19) words.push(teens[remainder - 10]);
    else {
      words.push(tens[Math.floor(remainder / 10)]);
      words.push(feminine && unit === 1 ? "одна" : feminine && unit === 2 ? "две" : units[unit]);
    }
    if (forms) words.push(forms[remainder >= 11 && remainder <= 14 ? 2 : unit === 1 ? 0 : unit >= 2 && unit <= 4 ? 1 : 2]);
  }
  words.push("тенге");
  const result = words.filter(Boolean).join(" ");
  return result[0].toUpperCase() + result.slice(1);
}

function updateConvertedTotal(amount) {
  const code = currency.value;
  const converting = code !== "KZT";
  const words = converting ? "" : amountInWords(amount);
  const wordsLine = document.querySelector("#amount-in-words");
  wordsLine.hidden = !words;
  wordsLine.textContent = words ? `Сумма прописью: ${words}` : "";
  const rate = parseNumber(exchangeRates[code] || "");
  const valid = rate > 0 && Number.isFinite(amount / rate);
  document.querySelector("#exchange-controls").hidden = !converting;
  document.querySelector("#exchange-label").textContent = `Курс в тенге за 1 ${code}`;
  exchangeRate.value = exchangeRates[code] || "";
  exchangeRate.setAttribute("aria-invalid", String(converting && !valid));
  document.querySelector("#exchange-error").textContent = converting && !valid ? "Укажите положительный курс. Пока итог показан как 0." : "";
  total.textContent = converting
    ? `${convertedFormatter.format(valid ? amount / rate : 0).replace(/[\u00a0\u202f]/g, " ")} ${currencySymbols[code]}`
    : formatMoney(amount);
  const note = document.querySelector("#conversion-note");
  note.hidden = !converting;
  note.textContent = converting ? `Итог в тенге: ${formatMoney(amount)}. ${valid ? `Курс: 1 ${code} = ${exchangeRates[code]} ₸ (указан вручную).` : "Курс не задан — пересчёт недоступен."}` : "";
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
  updateConvertedTotal(roundAmount(discounted + vat));
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
exchangeRate.addEventListener("input", () => {
  if (currency.value !== "KZT") exchangeRates[currency.value] = exchangeRate.value;
  recalculate();
});

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
    localStorage.setItem(draftKey, JSON.stringify({ fields, positions, exchangeRates }));
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
        if (id === "currency") {
          const code = ({ "₸": "KZT", "$": "USD", "€": "EUR" })[draft.fields[id]] || draft.fields[id];
          currency.value = Object.hasOwn(currencySymbols, code) ? code : "KZT";
          continue;
        }
        document.getElementById(id).value = draft.fields[id];
      }
    }
    for (const code of Object.keys(exchangeRates)) {
      if (typeof draft.exchangeRates?.[code] === "string") exchangeRates[code] = draft.exchangeRates[code];
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
  currency.value = "KZT";
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
  if (!document.querySelector("#amount-in-words").hidden) lines.push(document.querySelector("#amount-in-words").textContent);
  if (!document.querySelector("#conversion-note").hidden) lines.push(document.querySelector("#conversion-note").textContent);
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
