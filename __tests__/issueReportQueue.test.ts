import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  enqueueIssueReport,
  flushIssueReports,
  type IssueReport,
} from '../src/services/reporting/issueReportQueue';

const QUEUE_KEY = 'issueReportsQueueV1';

const report = (id: string): IssueReport => ({
  id,
  createdAt: '2026-10-19T00:00:00.000Z',
  type: 'crash',
  reference: 'ref',
  text: 'text',
  comment: '',
});

const queuedIds = async () =>
  (JSON.parse((await AsyncStorage.getItem(QUEUE_KEY)) ?? '[]') as IssueReport[]).map(r => r.id);

const okResponse = {
  ok: true,
  status: 200,
  headers: {get: () => 'application/json'},
  text: async () => JSON.stringify({ok: true}),
};

beforeEach(async () => {
  await AsyncStorage.clear();
});

test('a report enqueued while a flush is posting survives the flush', async () => {
  await enqueueIssueReport(report('a'));

  let answer: (value: unknown) => void = () => {};
  const fetchMock = jest.fn(() => new Promise(resolve => (answer = resolve)));
  (globalThis as {fetch: unknown}).fetch = fetchMock;

  const flush = flushIssueReports('https://example.test/report');
  await new Promise(resolve => setTimeout(resolve, 0));
  await enqueueIssueReport(report('b'));
  // A second flush while the first is posting joins it instead of resending "a".
  const again = flushIssueReports('https://example.test/report');
  answer(okResponse);

  expect(await flush).toEqual({sent: 1, dropped: 0});
  expect(await again).toEqual({sent: 1, dropped: 0});
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(await queuedIds()).toEqual(['b']);
});

test('reports enqueued at the same time are all kept', async () => {
  await Promise.all([enqueueIssueReport(report('a')), enqueueIssueReport(report('b'))]);
  expect(await queuedIds()).toEqual(['a', 'b']);
});
