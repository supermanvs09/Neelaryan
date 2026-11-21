/**
 * The name as the logo writes it: "NEELARYAN Café" → "Neelaryan Café".
 * Shouted all-caps words (from a business name typed in capitals) read as harsh next to the
 * serif headline, so they're set in title case; mixed-case words are left exactly as entered.
 */
export const brandName = (name: string) => name.replace(/\b([A-Z])([A-Z]{3,})\b/g, (_, a: string, b: string) => a + b.toLowerCase());
