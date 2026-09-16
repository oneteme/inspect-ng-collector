import {
  dateNow,
  EventTrace,
  LogEntry,
  TRACE_TYPE_LOG,
  SessionEvent,
  TRACE_TYPE_SESSION_EVENT
} from "./trace.model";
import {parseStackTrace} from "./configuration";

const eventTarget = new EventTarget();
const TRACE = 'trace', EXPORT = 'export', SHUTDOWN = 'shutdown', RELOAD = 'reload';

export const WIN: any = globalThis;
WIN["event-bus"] = eventTarget;

export function dispatchReport(message: string, error?: any) : void {
  dispatchTraces({
    "@type": TRACE_TYPE_LOG,
    instant: dateNow(),
    message : `${message} ${error && JSON.stringify(error)}`,
    stackTraceRows: parseStackTrace(error.stack? error.stack : undefined),
  } as LogEntry);
}


export function dispatchLog(type: string, value: string, sessionId?: string) {
  dispatchTraces({
    "@type": TRACE_TYPE_SESSION_EVENT,
    type: type,
    value: value,
    instant: dateNow(),
    //location: null,
    sessionId: sessionId
  } as SessionEvent);
}

export function dispatchTraces(...traces: EventTrace[]): void {
  eventTarget.dispatchEvent(new CustomEvent(TRACE, { detail: { traces } }));
}

export function dispatchExport(): void {
  eventTarget.dispatchEvent(new CustomEvent(EXPORT));
}

export function dispatchReload(): void {
  eventTarget.dispatchEvent(new CustomEvent(RELOAD));
}

export function dispatchShutown(): void {
  eventTarget.dispatchEvent(new CustomEvent(SHUTDOWN));
}

export function addTraceListener(fn : EventListener): void {
  eventTarget.addEventListener(TRACE, fn);
}

export function addExportListener(fn : EventListener): void {
  eventTarget.addEventListener(EXPORT, fn);
}

export function addReloadListener(fn : EventListener): void {
  eventTarget.addEventListener(RELOAD, fn);
}

export function addShutdownListener(fn : EventListener): void {
  eventTarget.addEventListener(SHUTDOWN, fn);
}
