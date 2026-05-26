/**
 * Normalizes Spanish-style floor/door values (Piso/Puerta) into a canonical
 * "<number>º <letter>" shape, restoring the masculine ordinal "º" that Google
 * Places strips from subpremise components.
 *
 * Mirror of control-jobs-frontend/lib/utils/normalize-floor-door.ts — keep both
 * in sync. See spec/test file for the input/output matrix.
 */
const WORD_FLOORS = new Set([
  'BAJO', 'BJ',
  'ENTRESUELO', 'ENT', 'ETLO',
  'PRINCIPAL', 'PR', 'PPAL',
  'ATICO', 'ÁTICO', 'AT',
  'SOTANO', 'SÓTANO', 'SOT',
]);

export function normalizeFloorDoor(raw: string | null | undefined): string {
  if (!raw) return '';

  let s = String(raw).trim().replace(/\s+/g, ' ');
  if (!s) return '';

  s = s.replace(/^(?:piso|planta|pl\.?)\s+/i, '');

  const upperFirstToken = s.split(' ')[0].toUpperCase();
  if (WORD_FLOORS.has(upperFirstToken)) {
    return s.toUpperCase().slice(0, 50);
  }

  s = s.replace(/^(\d{1,2})\s*(?:er|do|ro|to)(?=\s|$)/i, '$1º');
  s = s.replace(/^(\d{1,2})\s*\.?\s*[oº°O](?=\s|$)/, '$1º');
  s = s.replace(/^(\d{1,2})\s*[aª](?=\s|$)/, '$1ª');
  s = s.replace(/^(\d{1,2})(?=\s+[A-Za-zÑñ](?:\s|$))/, '$1º');

  s = s.toUpperCase().replace(/\s+/g, ' ').trim();
  return s.slice(0, 50);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Fallback: pull a floor/door out of Google's `formatted_address` when Google
 * did not return a structured `subpremise` component. See frontend mirror.
 */
export function extractFloorDoorFromFormattedAddress(
  formattedAddress: string | null | undefined,
  street: string | null | undefined,
  streetNumber: string | null | undefined,
  postalCode: string | null | undefined,
): string {
  if (!formattedAddress || !streetNumber || !postalCode) return '';

  const fa = formattedAddress;
  const pcIdx = fa.indexOf(postalCode);
  if (pcIdx <= 0) return '';

  let searchFrom = 0;
  if (street) {
    const sIdx = fa.indexOf(street);
    if (sIdx >= 0) searchFrom = sIdx + street.length;
  }

  const numRe = new RegExp(`\\b${escapeRegex(streetNumber)}\\b`);
  const numMatch = fa.slice(searchFrom, pcIdx).match(numRe);
  if (!numMatch || numMatch.index === undefined) return '';

  const numEnd = searchFrom + numMatch.index + numMatch[0].length;
  if (numEnd >= pcIdx) return '';

  const between = fa.slice(numEnd, pcIdx).replace(/^[,\s]+|[,\s]+$/g, '');
  if (!between) return '';

  return normalizeFloorDoor(between);
}
