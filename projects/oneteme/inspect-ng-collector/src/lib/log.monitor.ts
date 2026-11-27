import {dateNow, Mask, SessionEvent, TRACE_TYPE_SESSION_EVENT} from "./trace.model";
import {SessionManager} from "./session-manager.service";
import {dispatchTraces} from "./event-bus";

type Level = "WARN" | "ERROR";
type ConsoleTarget = Pick<Console, "warn" | "error">;
const installedTargets = new WeakSet<ConsoleTarget>();

export function installConsoleCapture(target: ConsoleTarget = console): void {
  if (installedTargets.has(target)) return;
  installedTargets.add(target);
  const originalWarn = target.warn;
  const originalError = target.error;

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
      originalError.call(target, "Failed to capture console message", error);
    }
  }

  target.warn = (...args: Parameters<ConsoleTarget["warn"]>) => {
    originalWarn.apply(target, args);
    capture("WARN", args);
  };

  target.error = (...args: Parameters<ConsoleTarget["error"]>) => {
    originalError.apply(target, args);
    capture("ERROR", args);
  };
}

function formatArg(value: unknown): string {
  if (value instanceof Error) {
    const stack = value.stack ? `\n${value.stack}` : "";
    return `${value.name}: ${value.message}${stack}`;
  }
  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}
