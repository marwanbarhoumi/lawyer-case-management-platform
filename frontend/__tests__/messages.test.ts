import ar from '@/messages/ar.json';
import fr from '@/messages/fr.json';

type Messages = { [key: string]: string | Messages };

function flatten(messages: Messages, prefix = ''): Record<string, string> {
  return Object.entries(messages).reduce<Record<string, string>>((result, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') result[path] = value;
    else Object.assign(result, flatten(value, path));
    return result;
  }, {});
}

/** Top-level ICU arguments, e.g. "{count, plural, ...}" → "count". */
function placeholders(message: string): string[] {
  const names = new Set<string>();
  let depth = 0;
  for (let index = 0; index < message.length; index += 1) {
    const char = message[index];
    if (char === '{') {
      if (depth === 0) {
        const match = /^\{\s*([A-Za-z_][\w]*)/.exec(message.slice(index));
        if (match) names.add(match[1]);
      }
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
    }
  }
  return [...names].sort();
}

describe('translations', () => {
  const frKeys = flatten(fr as Messages);
  const arKeys = flatten(ar as Messages);

  it('defines exactly the same keys in French and Arabic', () => {
    expect(Object.keys(arKeys).sort()).toEqual(Object.keys(frKeys).sort());
  });

  it('uses the same ICU arguments in both languages', () => {
    for (const [key, message] of Object.entries(frKeys)) {
      expect({ key, args: placeholders(arKeys[key] ?? '') }).toEqual({
        key,
        args: placeholders(message),
      });
    }
  });

  it('has no empty messages', () => {
    for (const [key, message] of [...Object.entries(frKeys), ...Object.entries(arKeys)]) {
      expect({ key, empty: message.trim() === '' }).toEqual({ key, empty: false });
    }
  });
});
