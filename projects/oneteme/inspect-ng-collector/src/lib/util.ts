import {Level, LogEntry} from "./trace.model";

export const WIN:any = window;

export function dateNow() {
    return Date.now() / 1_000;
}
export enum RequestMask {
  LOCAL = 1,
  REST = 4
}

export const DISPATCH = 'dispatch';
export const PRE_DISPATCH = 'pre-dispatch';
export const BEFOREUNLOAD ='beforeunload'

export function createLogEntry(level: Level, message: string, sessionId: string | undefined): LogEntry {
  return {
    "@type": "log",
    level: level,
    message: message,
    instant: dateNow(),
    sessionId : sessionId
  }
}

export function createReport(message: string): LogEntry{
  return {
    "@type": "log",
    level: "ERROR",
    message: message,
    instant: dateNow(),
  }
}



