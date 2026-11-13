"use strict";

const items = document.querySelector("#items");
const template = document.querySelector("#item-template");
const total = document.querySelector("#total");
const discountRate = document.querySelector("#discount-rate");
const vatRate = document.querySelector("#vat-rate");
const currency = document.querySelector("#currency");
const moneyFormatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

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
