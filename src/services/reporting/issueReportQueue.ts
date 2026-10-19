import AsyncStorage from '@react-native-async-storage/async-storage';

export type IssueReportType = 'bible' | 'hymn' | 'crash';

export type IssueReport = {
  id: string;
  createdAt: string;
  type: IssueReportType;
  reference: string;
  text: string;
  comment: string;
};

const STORAGE_KEY = 'issueReportsQueueV1';

const readQueue = async (): Promise<IssueReport[]> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// Every write is a read-modify-write run one at a time, so a report enqueued
// while a flush is posting (or while another enqueue is mid-way, e.g. the
// crash drain and a scheduling failure at launch) is never overwritten.
let queueWrites: Promise<unknown> = Promise.resolve();

const updateQueue = (change: (queue: IssueReport[]) => IssueReport[]): Promise<void> => {
  const run = queueWrites.then(async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(change(await readQueue())));
  });
  queueWrites = run.catch(() => {});
  return run;
};

// Removes the reports a flush is done with, leaving any enqueued meanwhile.
const removeReports = (done: IssueReport[]) => {
  const ids = new Set(done.map(r => r.id));
  return updateQueue(queue => queue.filter(r => !ids.has(r.id)));
};

export const enqueueIssueReport = (report: IssueReport) => updateQueue(queue => [...queue, report]);

// Outcome of POSTing one batch of reports.
//   - 'sent':      accepted + acknowledged; remove from queue.
//   - 'permanent': the server refused this batch and always will (4xx with a
//                  validation verdict, e.g. invalid_report / report_too_large).
//                  Retrying the identical bytes can never succeed, so keep
//                  retrying is pointless — these must be dropped, not requeued.
//   - 'transient': anything that might succeed later (network error, timeout,
//                  429 rate-limit, 5xx, auth HTML page, missing ack). Keep the
//                  queue and try again next flush.
type BatchOutcome = 'sent' | 'permanent' | 'transient';

const POST_TIMEOUT_MS = 15000;

// Send exactly the given reports as one batch and classify the result. Never
// throws — a transient failure is a return value, not an exception, so a single
// bad report can't abort the whole flush.
const postBatch = async (
  targetUrl: string,
  reports: IssueReport[]
): Promise<BatchOutcome> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), POST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reports }),
      signal: controller.signal,
    });
  } catch {
    // Network error / abort / timeout — retry later.
    return 'transient';
  } finally {
    clearTimeout(timeoutId);
  }

  const contentType = res.headers.get('content-type') ?? '';
  let rawBody: string;
  try {
    rawBody = await res.text();
  } catch {
    // Connection dropped while reading the body — retry later.
    return 'transient';
  }

  if (__DEV__) {
    console.log(
      '[issue-report] postBatch: response',
      JSON.stringify(
        {
          batchSize: reports.length,
          status: res.status,
          ok: res.ok,
          contentType,
          bodySnippet: rawBody.slice(0, 400),
        },
        null,
        2
      )
    );
  }

  // Apps Script sometimes returns a 200 HTML page (auth/permissions) instead of
  // JSON. That's a server-side misconfiguration we expect to be fixed, not a
  // bad report — keep the queue and retry.
  const looksLikeHtml =
    contentType.toLowerCase().includes('text/html') ||
    /<\s*!doctype\s+html|<\s*html\b/i.test(rawBody);
  if (looksLikeHtml) {
    return 'transient';
  }

  let parsed: any = null;
  try {
    parsed = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    parsed = null;
  }

  if (res.ok) {
    // Require a JSON acknowledgement so we don't drop reports the sheet never
    // actually stored. No ack → treat as transient and retry.
    const acknowledged =
      parsed &&
      (parsed.ok === true ||
        parsed.success === true ||
        parsed.status === 'ok' ||
        parsed.result === 'ok');
    return acknowledged ? 'sent' : 'transient';
  }

  // 4xx (except 429) is the server telling us this payload is structurally
  // unacceptable — invalid_report, report_too_large, missing_reports, etc.
  // Re-sending the same bytes will always fail, so this is permanent. 408/429
  // are the retryable exceptions; everything 5xx is transient.
  if (res.status >= 400 && res.status < 500 && res.status !== 429 && res.status !== 408) {
    return 'permanent';
  }

  return 'transient';
};

// A flush already posting is shared, so a reconnect and a return to the
// foreground at the same moment don't send the same reports twice.
let flushing: Promise<{sent: number; dropped: number}> | null = null;

export const flushIssueReports = (endpointUrl: string) => {
  flushing ??= flushOnce(endpointUrl).finally(() => {
    flushing = null;
  });
  return flushing;
};

const flushOnce = async (endpointUrl: string) => {
  const queue = await readQueue();
  if (queue.length === 0) {
    if (__DEV__) {
      console.log('[issue-report] flushIssueReports: queue is empty');
    }
    return { sent: 0, dropped: 0 };
  }

  if (__DEV__) {
    console.log(
      '[issue-report] flushIssueReports: sending',
      JSON.stringify({ queueLength: queue.length, targetUrl: endpointUrl }, null, 2)
    );
  }

  const outcome = await postBatch(endpointUrl, queue);

  // Whole batch accepted — remove it and we're done.
  if (outcome === 'sent') {
    await removeReports(queue);
    return { sent: queue.length, dropped: 0 };
  }

  // Transient failure — keep the entire queue untouched and retry next flush.
  // Surface it so the caller's existing catch logs it (and so a single flush
  // doesn't silently look successful).
  if (outcome === 'transient') {
    throw new Error('Issue report flush failed transiently; queue kept for retry.');
  }

  // Permanent rejection of the *batch*. The culprit is at least one poison-pill
  // report, but the batch is all-or-nothing on the server, so a single bad
  // report would otherwise block every good one forever. Isolate: re-send each
  // report on its own. Keep the ones that send or fail transiently; drop only
  // the reports the server permanently refuses. A lone batch of 1 short-circuits
  // straight to the drop, so we never loop.
  if (queue.length === 1) {
    if (__DEV__) {
      console.warn(
        '[issue-report] dropping 1 permanently-rejected report:',
        queue[0]?.id
      );
    }
    await removeReports(queue);
    return { sent: 0, dropped: 1 };
  }

  let sent = 0;
  let dropped = 0;
  // Sent or permanently refused; a transient failure stays queued for next time.
  const done: IssueReport[] = [];
  for (const report of queue) {
    const single = await postBatch(endpointUrl, [report]);
    if (single === 'sent') {
      sent += 1;
      done.push(report);
    } else if (single === 'permanent') {
      dropped += 1;
      done.push(report);
      if (__DEV__) {
        console.warn(
          '[issue-report] dropping permanently-rejected report:',
          report.id
        );
      }
    }
  }

  await removeReports(done);
  return { sent, dropped };
};
