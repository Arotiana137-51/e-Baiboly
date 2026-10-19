/**
 * Only release builds report crashes. The report sheet was full of debug-build
 * crashes (localhost:8081 stacks, mostly Fast Refresh mid-edit), which buried
 * the production ones it exists for.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  drainFatalErrorToQueue,
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
