import { EventTrace, LogLevel, LogEntry } from "./trace.model";

const eventBus = new EventTarget();
const TRACE = 'trace', EXPORT = 'export', SHUTDOW = 'shutdow';

export const WIN: any = window;

export function dateNow() {
  return Date.now() / 1_000;
}

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
  eventBus.dispatchEvent(new CustomEvent(TRACE, { detail: { traces } }));
}

export function dispatchExport(): void {
  eventBus.dispatchEvent(new CustomEvent(EXPORT));
}

export function dispatchShutown(): void {
  eventBus.dispatchEvent(new CustomEvent(SHUTDOW));
}

export function addTraceListener(fn : EventListener): void {
  eventBus.addEventListener(TRACE, fn);
}

export function addExportListener(fn : EventListener): void {
  eventBus.addEventListener(EXPORT, fn);
}

export function addShutdowListener(fn : EventListener): void {
  eventBus.addEventListener(SHUTDOW, fn);
}