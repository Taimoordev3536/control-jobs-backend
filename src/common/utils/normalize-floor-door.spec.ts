import { normalizeFloorDoor, extractFloorDoorFromFormattedAddress } from './normalize-floor-door';

describe('normalizeFloorDoor', () => {
  const cases: Array<[unknown, string, string]> = [
    ['1o D', '1º D', 'lowercase o (Google strips º)'],
    ['1O D', '1º D', 'uppercase O (post-toUpperCase bug)'],
    ['1° D', '1º D', 'degree symbol'],
    ['1.º D', '1º D', 'dot before ordinal'],
    ['1er D', '1º D', 'spanish ordinal abbrev primero'],
    ['2do A', '2º A', 'spanish ordinal abbrev segundo'],
    ['1ª D', '1ª D', 'feminine ordinal preserved'],
    ['1a D', '1ª D', 'feminine ordinal restored from a'],
    ['1 D', '1º D', 'bare digit + letter → infer floor'],
    ['Piso 1 D', '1º D', 'piso prefix stripped'],
    ['Planta 2o B', '2º B', 'planta prefix stripped'],
    ['pl. 3 C', '3º C', 'pl. abbrev stripped'],
    ['bajo', 'BAJO', 'word floor uppercased'],
    ['BJ', 'BJ', 'abbreviation passthrough'],
    ['Ático', 'ÁTICO', 'word floor with accent'],
    ['1º D', '1º D', 'already correct passthrough'],
    ['10 D', '10º D', 'two-digit floor'],
    ['  1o   D ', '1º D', 'whitespace collapsed'],
    ['3er izquierda', '3º IZQUIERDA', 'word door uppercased'],
    ['', '', 'empty string'],
    [null, '', 'null'],
    [undefined, '', 'undefined'],
  ];

  for (const [input, expected, label] of cases) {
    it(`${label}: ${JSON.stringify(input)} → ${JSON.stringify(expected)}`, () => {
      expect(normalizeFloorDoor(input as string | null | undefined)).toBe(expected);
    });
  }

  it('truncates to 50 chars', () => {
    expect(normalizeFloorDoor('a'.repeat(100)).length).toBe(50);
  });
});

describe('extractFloorDoorFromFormattedAddress', () => {
  it('extracts floor/door between street number and postal code (with comma)', () => {
    expect(
      extractFloorDoorFromFormattedAddress(
        'C. Fuente Canónigos, 8, 1o d, 31500 Tudela, Navarra, Spain',
        'C. Fuente Canónigos',
        '8',
        '31500',
      ),
    ).toBe('1º D');
  });

  it('extracts floor/door when no comma sits between floor and postal code', () => {
    expect(
      extractFloorDoorFromFormattedAddress(
        'C. Fuente Canónigos, 8, 1o d 31500 Tudela, Navarra, Spain',
        'C. Fuente Canónigos',
        '8',
        '31500',
      ),
    ).toBe('1º D');
  });

  it('returns empty when there is no floor segment', () => {
    expect(
      extractFloorDoorFromFormattedAddress(
        'Av. Principal, 12, 28001 Madrid, Spain',
        'Av. Principal',
        '12',
        '28001',
      ),
    ).toBe('');
  });

  it('handles street name containing a number (Calle 8)', () => {
    expect(
      extractFloorDoorFromFormattedAddress(
        'Calle 8, 5, 2º A, 28001 Madrid, Spain',
        'Calle 8',
        '5',
        '28001',
      ),
    ).toBe('2º A');
  });

  it('returns empty when streetNumber or postalCode missing', () => {
    expect(extractFloorDoorFromFormattedAddress('foo', 'bar', '', '12345')).toBe('');
    expect(extractFloorDoorFromFormattedAddress('foo', 'bar', '1', '')).toBe('');
    expect(extractFloorDoorFromFormattedAddress(null, 'a', '1', '12345')).toBe('');
  });

  it('returns empty when postal code precedes street number', () => {
    expect(
      extractFloorDoorFromFormattedAddress('31500, 1o d, Calle X 8, Spain', 'Calle X', '8', '31500'),
    ).toBe('');
  });
});
