import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseEnvBoolean, isFeatureEnabled, FEATURE_FLAGS } from '../features';

describe('features - parseEnvBoolean', () => {
  it('returns default value when input is undefined or empty', () => {
    assert.equal(parseEnvBoolean(undefined, true), true);
    assert.equal(parseEnvBoolean(undefined, false), false);
    assert.equal(parseEnvBoolean('', true), true);
    assert.equal(parseEnvBoolean('   ', false), false);
  });

  it('correctly parses falsy values', () => {
    assert.equal(parseEnvBoolean('false', true), false);
    assert.equal(parseEnvBoolean('FALSE', true), false);
    assert.equal(parseEnvBoolean('0', true), false);
    assert.equal(parseEnvBoolean('off', true), false);
    assert.equal(parseEnvBoolean('disabled', true), false);
  });

  it('correctly parses truthy values', () => {
    assert.equal(parseEnvBoolean('true', false), true);
    assert.equal(parseEnvBoolean('TRUE', false), true);
    assert.equal(parseEnvBoolean('1', false), true);
    assert.equal(parseEnvBoolean('on', false), true);
    assert.equal(parseEnvBoolean('enabled', false), true);
  });

  it('falls back to default for unrecognized strings', () => {
    assert.equal(parseEnvBoolean('invalid_value', true), true);
    assert.equal(parseEnvBoolean('invalid_value', false), false);
  });
});

describe('features - isFeatureEnabled', () => {
  it('returns boolean value matching FEATURE_FLAGS', () => {
    const isDrillsEnabled = isFeatureEnabled('ENABLE_SUBTEST_DRILLS');
    assert.equal(typeof isDrillsEnabled, 'boolean');
    assert.equal(isDrillsEnabled, FEATURE_FLAGS.ENABLE_SUBTEST_DRILLS);
  });
});
