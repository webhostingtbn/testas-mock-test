import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { en } from '../messages/en';
import { de } from '../messages/de';

function collectLeafKeys(obj: object, prefix = ''): Map<string, string> {
  const map = new Map<string, string>();
  for (const [key, value] of Object.entries(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      map.set(fullPath, value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const sub = collectLeafKeys(value, fullPath);
      for (const [subKey, subVal] of sub) {
        map.set(subKey, subVal);
      }
    }
  }
  return map;
}

describe('i18n Message Parity & CompletingPatterns Localization', () => {
  const enKeys = collectLeafKeys(en);
  const deKeys = collectLeafKeys(de);

  it('has matching keys between en and de dictionaries', () => {
    const missingInDe: string[] = [];
    for (const key of enKeys.keys()) {
      if (!deKeys.has(key)) {
        missingInDe.push(key);
      }
    }
    assert.deepStrictEqual(missingInDe, [], `Keys in en missing from de: ${missingInDe.join(', ')}`);

    const missingInEn: string[] = [];
    for (const key of deKeys.keys()) {
      if (!enKeys.has(key)) {
        missingInEn.push(key);
      }
    }
    assert.deepStrictEqual(missingInEn, [], `Keys in de missing from en: ${missingInEn.join(', ')}`);
  });

  it('contains non-empty translations for all completing_patterns keys', () => {
    const patternKeys = [
      'exam.completePattern',
      'exam.selectAnswerOption',
      'exam.clickLetterBox',
      'exam.loadingImages',
      'exam.optionsAtoF',
      'exam.optionsAtoH',
      'exam.patternGridAlt',
      'exam.optionLabel',
    ];

    for (const key of patternKeys) {
      const enVal = enKeys.get(key);
      const deVal = deKeys.get(key);
      assert.ok(enVal && enVal.trim() !== '', `EN missing non-empty value for ${key}`);
      assert.ok(deVal && deVal.trim() !== '', `DE missing non-empty value for ${key}`);
    }

    assert.strictEqual(enKeys.get('exam.completePattern'), 'Complete the pattern');
    assert.strictEqual(deKeys.get('exam.completePattern'), 'Muster ergänzen');
    assert.strictEqual(enKeys.get('exam.selectAnswerOption'), 'Select Answer Option');
    assert.strictEqual(deKeys.get('exam.selectAnswerOption'), 'Antwortoption wählen');
    assert.strictEqual(enKeys.get('exam.clickLetterBox'), 'Click directly on the letter box');
    assert.strictEqual(deKeys.get('exam.clickLetterBox'), 'Klicken Sie direkt auf das Buchstabenfeld');
  });
});
