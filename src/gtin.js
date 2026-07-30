export function normalizeGtin(value) {
  return String(value ?? "").replaceAll(/[\s-]/g, "");
}

export function calculateGtinCheckDigit(body) {
  if (!/^\d+$/.test(body)) return null;
  let sum = 0;
  let multiplier = 3;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * multiplier;
    multiplier = multiplier === 3 ? 1 : 3;
  }
  return String((10 - (sum % 10)) % 10);
}

export function validateGtin(value) {
  const gtin = normalizeGtin(value);
  if (![8, 12, 13, 14].includes(gtin.length) || !/^\d+$/.test(gtin)) {
    return {
      valid: false,
      normalized: gtin,
      reason: "GTIN must contain 8, 12, 13, or 14 digits",
    };
  }
  const expected = calculateGtinCheckDigit(gtin.slice(0, -1));
  if (expected !== gtin.at(-1)) {
    return {
      valid: false,
      normalized: gtin,
      reason: `GTIN check digit should be ${expected}`,
    };
  }
  return { valid: true, normalized: gtin, reason: null };
}

export function toGtin14(value) {
  const validation = validateGtin(value);
  if (!validation.valid) return null;
  return validation.normalized.padStart(14, "0");
}

export function gs1DigitalLink(value, resolverBase = "https://id.gs1.org") {
  const gtin14 = toGtin14(value);
  if (!gtin14) return null;
  return `${resolverBase.replace(/\/+$/, "")}/01/${gtin14}`;
}
