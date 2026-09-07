import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  isDigitalModuleSection,
  resolveModuleTitle,
} from '../../constants';

// ---- isDigitalModuleSection (shared by exam filterSections + practice) ----

describe('isDigitalModuleSection', () => {
  it('matches exact title with a module_mcq type', () => {
    assert.strictEqual(
      isDigitalModuleSection(
        { question_type: 'module_mcq', title: 'Natural Science and Computer Science' },
        'natural_computer_science',
      ),
      true,
    );
  });

  it('matches case-variant titles with legacy module types', () => {
    assert.strictEqual(
      isDigitalModuleSection(
        { question_type: 'interpreting_texts', title: 'Natural Science And Computer Science' },
        'natural_computer_science',
      ),
      true,
    );
  });

  it('rejects sections from other modules (no cross-module leak)', () => {
    assert.strictEqual(
      isDigitalModuleSection(
        { question_type: 'module_mcq', title: 'Economics' },
        'natural_computer_science',
      ),
      false,
    );
  });

  it('rejects a bare module_mcq match without title scoping', () => {
    assert.strictEqual(
      isDigitalModuleSection(
        { question_type: 'module_mcq', title: 'Engineering' },
        'economics',
      ),
      false,
    );
  });

  it('rejects non-module question types even with a matching title', () => {
    assert.strictEqual(
      isDigitalModuleSection(
        { question_type: 'figure_sequence', title: 'Economics' },
        'economics',
      ),
      false,
    );
  });

  it('returns false without an active module', () => {
    assert.strictEqual(
      isDigitalModuleSection(
        { question_type: 'module_mcq', title: 'Economics' },
        null,
      ),
      false,
    );
  });
});

// ---- resolveModuleTitle ----

describe('resolveModuleTitle', () => {
  it('resolves known labels and shorthand values', () => {
    assert.strictEqual(resolveModuleTitle('CS'), 'Natural Science and Computer Science');
    assert.strictEqual(
      resolveModuleTitle('natural_computer_science'),
      'Natural Science and Computer Science',
    );
    assert.strictEqual(resolveModuleTitle('Economics'), 'Economics');
  });

  it('falls back to substring matching for unknown values', () => {
    assert.strictEqual(resolveModuleTitle('ECONOMICS'), 'Economics');
  });

  it('returns empty string when nothing matches', () => {
    assert.strictEqual(resolveModuleTitle(null), '');
    assert.strictEqual(resolveModuleTitle('unknown-module'), '');
  });
});
