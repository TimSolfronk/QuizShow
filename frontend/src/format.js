export function formatMoney(value) {
  return `${value < 0 ? '-' : ''}$${Math.abs(value)}`
}
