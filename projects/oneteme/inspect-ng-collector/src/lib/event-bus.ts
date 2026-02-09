import { dateNow, EventTrace, LogLevel, LogEntry } from "./trace.model";

const eventTarget = new EventTarget();
const TRACE = 'trace', EXPORT = 'export', SHUTDOW = 'shutdow';

export const WIN: any = window;

export function dispatchReport(message: string, error?: any) : void {
  dispatchLog("REPORT", `${message} ${error && JSON.stringify(error)}`, undefined)
}

export function dispatchLog(level: LogLevel, message: string, sessionId?: string) {
  dispatchTraces({
    "@type": "00",
    level: level,
    message: message,
    instant: dateNow(),
    sessionId: sessionId
  } as LogEntry);
}

export function dispatchTraces(...traces: EventTrace[]): void {
  eventTarget.dispatchEvent(new CustomEvent(TRACE, { detail: { traces } }));
}

export function dispatchExport(): void {
  eventTarget.dispatchEvent(new CustomEvent(EXPORT));
}

export function dispatchShutown(): void {
  eventTarget.dispatchEvent(new CustomEvent(SHUTDOW));
}

export function addTraceListener(fn : EventListener): void {
  eventTarget.addEventListener(TRACE, fn);
}

export function addExportListener(fn : EventListener): void {
  eventTarget.addEventListener(EXPORT, fn);
}

export function addShutdowListener(fn : EventListener): void {
  eventTarget.addEventListener(SHUTDOW, fn);
}