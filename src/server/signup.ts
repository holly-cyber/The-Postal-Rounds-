/** Launch day sign-up: validation (shared by the function and the tests). */
import { LIMITS } from '../lib/config.ts';
import { InvalidSubmission } from './submission.ts';

export type SignupMode = 'walk' | 'run' | 'both';

/** One launch day sign-up, stored in the `signups` store. Private: only /admin sees it. */
export interface Signup {
  id: string;
  name: string;
  email: string;
  /** How many are coming, including the person signing up (8 means "8 or more"). */
  people: number;
  mode: SignupMode;
  message: string | null;
  createdAt: string;
}

export const SIGNUP_LIMITS = { nameMax: 80, messageMax: 1000, peopleMax: 8 };

const fail = (msg: string): never => {
  throw new InvalidSubmission(msg);
};
const clean = (v: FormDataEntryValue | null) =>
  typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim() : '';

/** The launch form's honeypot (Netlify's `bot-field`) is filled in. */
export const isSignupBot = (form: FormData) => clean(form.get('bot-field')) !== '';

export function prepareSignup(form: FormData, id: string, now = new Date()): Signup {
  const name = clean(form.get('name'));
  if (name.length < 1 || name.length > SIGNUP_LIMITS.nameMax) fail(`Name must be 1–${SIGNUP_LIMITS.nameMax} characters.`);

  const email = clean(form.get('email')).toLowerCase();
  if (!email || email.length > LIMITS.emailMax || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fail('Add an email address so we can let you know if plans change.');
  }

  const people = Number(clean(form.get('people')) || '1');
  if (!Number.isInteger(people) || people < 1 || people > SIGNUP_LIMITS.peopleMax) fail('Choose how many of you are coming.');

  const mode = clean(form.get('mode'));
  if (mode !== 'walk' && mode !== 'run' && mode !== 'both') fail('Choose walk, run or a mix.');

  if (clean(form.get('understood')) !== 'yes') fail('Please tick the box to confirm you’ll come prepared to navigate.');

  const messageRaw = clean(form.get('message'));
  if (messageRaw.length > SIGNUP_LIMITS.messageMax) fail(`Keep your message under ${SIGNUP_LIMITS.messageMax} characters.`);

  return {
    id,
    name,
    email,
    people,
    mode: mode as SignupMode,
    message: messageRaw || null,
    createdAt: now.toISOString(),
  };
}
