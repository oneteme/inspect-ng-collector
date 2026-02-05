import { EventTrace, Level, LogEntry } from "./trace.model";

export const WIN: any = window;

export const DISPATCH = 'dispatch', PRE_DISPATCH = 'pre-dispatch', BEFOREUNLOAD = 'beforeunload';

export enum RequestMask { LOCAL = 1, REST = 4 }

export function dateNow() {
  return Date.now() / 1_000;
}

export function emitReport(message: string, error?: any) : void {
  emitLog("REPORT", `${message} ${error ? JSON.stringify(error) : ''}` , undefined)
}

export function emitLog(level: Level, message: string, sessionId: string | undefined) {
  emitTrace({
    "@type": "00",
    level: level,
    message: message,
    instant: dateNow(),
    sessionId: sessionId
  } as LogEntry);
}

export function emitTrace(...traces: EventTrace[]): void {
  window.dispatchEvent(new CustomEvent(DISPATCH, { detail: { traces } }));
}
