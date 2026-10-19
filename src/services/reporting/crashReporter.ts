import AsyncStorage from '@react-native-async-storage/async-storage';
import {enqueueIssueReport} from './issueReportQueue';

// We are blind to production JS crashes today: Crashlytics groups every
// uncaught error under one generic JavascriptException with no message or
// stack. This module captures the real error — its message, stack and the
// React component stack — so the next launch can surface what actually threw.

const STORAGE_KEY = 'lastFatalErrorV1';

export type FatalErrorSource = 'render' | 'global';

export type FatalErrorRecord = {
  source: FatalErrorSource;
  name: string;
  message: string;
  stack?: string;
  componentStack?: string;
  isFatal?: boolean;
  occurredAt: string;
};

// RN exposes the low-level error handler as a global, with no typed export.
type ErrorUtilsLike = {
  getGlobalHandler: () => ((error: unknown, isFatal?: boolean) => void) | undefined;
  setGlobalHandler: (handler: (error: unknown, isFatal?: boolean) => void) => void;
};

const getErrorUtils = (): ErrorUtilsLike | undefined => {
  const candidate = (globalThis as { ErrorUtils?: unknown }).ErrorUtils;
  if (
    candidate &&
    typeof (candidate as ErrorUtilsLike).setGlobalHandler === 'function' &&
    typeof (candidate as ErrorUtilsLike).getGlobalHandler === 'function'
  ) {
    return candidate as ErrorUtilsLike;
  }
  return undefined;
};

const toError = (value: unknown): Error => {
  if (value instanceof Error) {
    return value;
  }
  return new Error(typeof value === 'string' ? value : JSON.stringify(value));
};

/**
 * Persist a fatal error (best-effort) and log it. Never throws — a failure in
 * the reporter must not become a second crash.
 */
export const recordFatalError = async (
  error: unknown,
  source: FatalErrorSource,
  componentStack?: string,
  isFatal?: boolean
): Promise<void> => {
  try {
    const err = toError(error);
    const record: FatalErrorRecord = {
      source,
      name: err.name,
      message: err.message,
      stack: err.stack,
      componentStack,
      isFatal,
      // Date.now()/new Date() are fine in app runtime; only workflow scripts ban them.
      occurredAt: new Date().toISOString(),
    };

    console.error(`[crash:${source}] ${err.name}: ${err.message}`, err.stack ?? '');
    if (componentStack) {
      console.error('[crash:componentStack]', componentStack);
    }

    // Only release builds report: a debug build's crashes (Fast Refresh
    // mid-edit, mostly) buried the production ones in the report sheet.
    if (__DEV__) return;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch (reporterError) {
    // Last resort: log and move on. Do not rethrow.
    console.error('[crash] failed to record fatal error', reporterError);
  }
};

/** Read back the most recent persisted fatal error, if any. */
export const peekLastFatalError = async (): Promise<FatalErrorRecord | null> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as FatalErrorRecord;
    return parsed && typeof parsed.message === 'string' ? parsed : null;
  } catch {
    return null;
  }
};

/** Clear the persisted fatal error (e.g. after it has been reported). */
export const clearLastFatalError = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};

// Keep the uploaded crash body within the reporting endpoint's crash ceiling
// (8000 chars). A runaway stack must never make the report permanently
// rejected — a truncated stack is still diagnostic; a rejected one is useless.
const MAX_CRASH_COMMENT = 7500;

// Build the human-readable body uploaded with a crash report. The reporting
// endpoint stores `reference`/`text`/`comment`, so we pack the diagnostic
// detail (stack + component stack) into `comment` and keep a one-line summary
// in `text`.
const formatCrashBody = (record: FatalErrorRecord): string => {
  const parts = [
    `source: ${record.source}`,
    record.isFatal != null ? `isFatal: ${record.isFatal}` : null,
    `occurredAt: ${record.occurredAt}`,
    '',
    record.stack ? `stack:\n${record.stack}` : null,
    record.componentStack ? `componentStack:\n${record.componentStack}` : null,
  ].filter(Boolean);
  const body = parts.join('\n');
  return body.length > MAX_CRASH_COMMENT
    ? `${body.slice(0, MAX_CRASH_COMMENT)}\n…[truncated]`
    : body;
};

/**
 * Move a persisted fatal error into the issue-report queue so it uploads via
 * the existing flush path (NetInfo reconnect / app foreground in MainScreen).
 *
 * This closes the diagnostic loop: until now the real error was written to
 * AsyncStorage and never read back, leaving production crashes invisible
 * behind the generic JavascriptException. Call once on launch.
 *
 * Best-effort and never throws. The record is only cleared after it has been
 * enqueued, so a failure here means we simply retry next launch.
 */
export const drainFatalErrorToQueue = async (): Promise<boolean> => {
  try {
    const record = await peekLastFatalError();
    if (!record) {
      return false;
    }

    await enqueueIssueReport({
      // Date.now()/Math.random() are fine in app runtime; only workflow scripts ban them.
      id: `crash-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: record.occurredAt,
      type: 'crash',
      reference: `${record.name} (${record.source})`,
      text: record.message,
      comment: formatCrashBody(record),
    });

    // Enqueued successfully — safe to clear so we don't double-report it.
    await clearLastFatalError();
    return true;
  } catch (error) {
    console.error('[crash] failed to drain fatal error to queue', error);
    return false;
  }
};

let globalHandlerInstalled = false;

/**
 * Route uncaught JS errors (async, event handlers, timers — everything outside
 * React render) through the reporter before handing back to RN's default
 * handler, so the red box / crash still happens but we keep the details.
 */
export const installGlobalErrorHandler = (): void => {
  if (globalHandlerInstalled) {
    return;
  }
  const errorUtils = getErrorUtils();
  if (!errorUtils) {
    return;
  }

  const previousHandler = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    // Fire-and-forget persistence; we must not delay handing back to RN.
    recordFatalError(error, 'global', undefined, isFatal);
    if (previousHandler) {
      previousHandler(error, isFatal);
    }
  });
  globalHandlerInstalled = true;
};
