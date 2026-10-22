import {dateNow, Mask, SessionEvent, TRACE_TYPE_SESSION_EVENT} from "./trace.model";
import {SessionManager} from "./session-manager.service";
import {dispatchTraces} from "./event-bus";

type Level = "WARN" | "ERROR";

export function installConsoleCapture(): void {
  const originalWarn = console.warn;
  const originalError = console.error;

  function capture(level: Level, args: unknown[]) {
    try {
      dispatchTraces({
        ...SessionManager.instance.traceSessionMaskUpdate(Mask.EVENT),
        "@type": TRACE_TYPE_SESSION_EVENT,
        type: level,
        instant: dateNow(),
        value: `${args.map(formatArg).join(" ")}`,
      } as SessionEvent);
    } catch (error) {
      // Report capture failures using the saved method, avoiding another capture.
      originalError.call(console, "Failed to capture console message", error);
    }
  }

  console.warn = (...args: Parameters<typeof console.warn>) => {
    originalWarn.apply(console, args);
    capture("WARN", args);
  };

  console.error = (...args: Parameters<typeof console.error>) => {
    originalError.apply(console, args);
    capture("ERROR", args);
  };
}

function formatArg(value: unknown): string {
  if (value instanceof Error) {
    return `${value.name}: ${value.message}${value.stack ? `\n${value.stack}` : ""}`;
  }
  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}
