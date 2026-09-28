import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSignupBot, prepareSignup } from '../src/server/signup.ts';
import { InvalidSubmission } from '../src/server/submission.ts';

const form = (over: Record<string, string> = {}) => {
  const f = new FormData();
  const base = { name: 'Pat Postie', email: 'Pat@Example.com', people: '3', mode: 'walk', understood: 'yes', message: '' };
  for (const [k, v] of Object.entries({ ...base, ...over })) f.set(k, v);
  return f;
};

test('a launch sign-up is stored with the email lower-cased', () => {
  const s = prepareSignup(form(), 'id-1', new Date('2026-10-01T10:00:00Z'));
  assert.deepEqual(s, {
    id: 'id-1', name: 'Pat Postie', email: 'pat@example.com', people: 3, mode: 'walk', message: null,
    createdAt: '2026-10-01T10:00:00.000Z',
  });
});

test('a launch sign-up needs an email, a mode, a sensible headcount and the tick box', () => {
  const bads: Record<string, string>[] = [{ email: '' }, { mode: 'cycle' }, { people: '0' }, { people: '9' }, { people: '2.5' }, { understood: '' }, { name: '' }];
  for (const bad of bads) {
    assert.throws(() => prepareSignup(form(bad), 'x'), InvalidSubmission, JSON.stringify(bad));
  }
});

test('the launch honeypot is bot-field', () => {
  assert.equal(isSignupBot(form()), false);
  assert.equal(isSignupBot(form({ 'bot-field': 'spam' })), true);
});
