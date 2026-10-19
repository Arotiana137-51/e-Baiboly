/**
 * Only release builds report crashes. The report sheet was full of debug-build
 * crashes (localhost:8081 stacks, mostly Fast Refresh mid-edit), which buried
 * the production ones it exists for.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  drainFatalErrorToQueue,
  installGlobalErrorHandler,
  recordFatalError,
} from '../src/services/reporting/crashReporter';
import { reportSchedulingFailure } from '../src/services/reminders/readingReminder';

const queued = async (): Promise<Array<{ type: string; reference: string }>> =>
  JSON.parse((await AsyncStorage.getItem('issueReportsQueueV1')) ?? '[]');
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

const g = global as unknown as { __DEV__: boolean };
const realDev = g.__DEV__;

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(async () => {
  g.__DEV__ = realDev;
  jest.restoreAllMocks();
  await AsyncStorage.clear();
});

describe.each([
  ['release', false, 1],
  ['debug', true, 0],
])('a %s build', (_name, dev, expected) => {
  test(`queues ${expected} report for a fatal error caught on the previous run`, async () => {
    g.__DEV__ = dev;
    await recordFatalError(new TypeError('boom'), 'render');
    await drainFatalErrorToQueue();
    expect(await queued()).toHaveLength(expected);
  });

  test(`queues ${expected} report for a scheduling failure`, async () => {
    g.__DEV__ = dev;
    reportSchedulingFailure('widgetSync', new Error('ENOENT'));
    await settle();
    expect(await queued()).toHaveLength(expected);
  });
});

describe('what a release build sends', () => {
  type Queued = {
    id: string;
    type: string;
    reference: string;
    text: string;
    comment: string;
    createdAt: string;
  };
  const sent = async () => (await queued()) as unknown as Queued[];

  beforeEach(() => {
    g.__DEV__ = false;
  });

  test('a fatal error: its name, message, stack and component stack, once', async () => {
    const error = new TypeError('boom');
    await recordFatalError(error, 'render', '\n    in Reader', true);
    expect(await drainFatalErrorToQueue()).toBe(true);
    // Cleared once queued: the next launch sends nothing more.
    expect(await drainFatalErrorToQueue()).toBe(false);
    const [report] = await sent();
    expect(report).toMatchObject({
      type: 'crash',
      reference: 'TypeError (render)',
      text: 'boom',
    });
    expect(report.id).toMatch(/^crash-\d+-[a-z0-9]+$/);
    expect(report.comment).toContain('source: render');
    expect(report.comment).toContain('isFatal: true');
    expect(report.comment).toContain(`stack:\n${error.stack}`);
    expect(report.comment).toContain('componentStack:\n\n    in Reader');
    expect(report.comment).toContain(`occurredAt: ${report.createdAt}`);
  });

  test('a thrown string is kept as the message', async () => {
    await recordFatalError('plain text', 'global');
    await drainFatalErrorToQueue();
    expect((await sent())[0]).toMatchObject({
      reference: 'Error (global)',
      text: 'plain text',
    });
  });

  test('a runaway stack is cut under the endpoint limit, never rejected', async () => {
    const error = new Error('deep');
    error.stack = 'x'.repeat(20000);
    await recordFatalError(error, 'render');
    await drainFatalErrorToQueue();
    const { comment } = (await sent())[0];
    expect(comment.length).toBeLessThanOrEqual(8000);
    expect(comment.endsWith('…[truncated]')).toBe(true);
  });

  test('a short stack is sent whole', async () => {
    const error = new Error('short');
    error.stack = 'Error: short\n    at here';
    await recordFatalError(error, 'render');
    await drainFatalErrorToQueue();
    expect((await sent())[0].comment).not.toContain('[truncated]');
  });

  test('a scheduling failure: where, message and stack', async () => {
    const error = new Error('ENOENT');
    reportSchedulingFailure('widgetSync', error);
    await settle();
    const [report] = await sent();
    expect(report).toMatchObject({
      type: 'crash',
      reference: 'readingReminder.widgetSync',
      text: 'ENOENT',
      comment: error.stack,
    });
    expect(report.id).toMatch(/^crash-\d+-[a-z0-9]+$/);
  });

  test('a scheduling failure that is not an Error still reports its text', async () => {
    reportSchedulingFailure('setWidgetText', 'quota');
    await settle();
    expect((await sent())[0]).toMatchObject({
      text: 'quota',
      reference: 'readingReminder.setWidgetText',
    });
  });
});

test('the global handler records the error, then hands it to React Native', async () => {
  g.__DEV__ = false;
  const previous = jest.fn();
  const errorUtils = {
    handler: previous as (e: unknown, fatal?: boolean) => void,
    getGlobalHandler() {
      return this.handler;
    },
    setGlobalHandler(h: (e: unknown, fatal?: boolean) => void) {
      this.handler = h;
    },
  };
  const realErrorUtils = (global as { ErrorUtils?: unknown }).ErrorUtils;
  (global as { ErrorUtils?: unknown }).ErrorUtils = errorUtils;
  try {
    installGlobalErrorHandler();
    const error = new RangeError('late');
    errorUtils.handler(error, true);
    expect(previous).toHaveBeenCalledWith(error, true);
    await settle();
    await drainFatalErrorToQueue();
    expect((await queued())[0]).toMatchObject({
      reference: 'RangeError (global)',
    });
  } finally {
    (global as { ErrorUtils?: unknown }).ErrorUtils = realErrorUtils;
  }
});
