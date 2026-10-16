import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatDate, formatNumber } from '../format';

describe('i18n format helpers', () => {
  describe('formatNumber', () => {
    it('formats numbers with en-GB formatting', () => {
      const formatted = formatNumber(1234567.89, 'en');
      assert.strictEqual(formatted, '1,234,567.89');
    });

    it('formats numbers with de-DE formatting', () => {
      const formatted = formatNumber(1234567.89, 'de');
      // German uses period for thousands and comma for decimal
      assert.ok(formatted.includes('1.234.567,89') || formatted.includes('1.234.567'));
    });

    it('handles null, undefined, and NaN gracefully', () => {
      assert.strictEqual(formatNumber(null, 'en'), '');
      assert.strictEqual(formatNumber(undefined, 'en'), '');
      assert.strictEqual(formatNumber(NaN, 'en'), '');
    });

    it('respects optional Intl.NumberFormatOptions', () => {
      const formatted = formatNumber(0.42, 'en', { style: 'percent' });
      assert.strictEqual(formatted, '42%');
    });
  });

  describe('formatDate', () => {
    it('formats a date cleanly', () => {
      const d = new Date('2026-10-15T12:00:00Z');
      const formatted = formatDate(d, 'en', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' });
      assert.strictEqual(formatted, '15/10/2026');
    });

    it('handles null or invalid date gracefully', () => {
      assert.strictEqual(formatDate(null, 'en'), '');
      assert.strictEqual(formatDate('invalid-date', 'en'), '');
    });
  });
});
