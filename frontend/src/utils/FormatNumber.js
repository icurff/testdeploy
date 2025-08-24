export function FormatNumber(value) {
  const numberValue = Number(value);
  if (isNaN(numberValue)) return "0";
  return numberValue.toLocaleString("it-IT", {
    style: "currency",
    currency: "VND",
  });
}
