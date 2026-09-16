import {
  dateNow, ExceptionTrace,
  LocalRequest, LocalRequestCallBack,
  Mask,
  TRACE_TYPE_LOCAL_REQUEST,
  TRACE_TYPE_LOCAL_REQUEST_CALLBACK,
  UUID
} from "./trace.model";
import {WIN} from "./event-bus";

export class LocalRequestMonitor {

  readonly id: UUID;
  readonly start: number;

  constructor() {
    this.start = dateNow();
    this.id = crypto.randomUUID();
  }

  preProcess(propertyKey: string, target: any) {
    const sessionManager = WIN["inspect-session-manager"];

    const trace: LocalRequest = {
      ...sessionManager?.traceSessionMaskUpdate(Mask.LOCAL),
      "@type": TRACE_TYPE_LOCAL_REQUEST,
      id: this.id,
      name: propertyKey,
      location: target.constructor.name,
      user: sessionManager?.currentSession?.user,
      start: this.start
    };

    WIN["event-bus"].dispatchEvent(
      new CustomEvent('trace', { detail: { traces: [trace] } })
    );
  }

  postProcess(exception?: ExceptionTrace) {
    const traces: (LocalRequestCallBack | ExceptionTrace)[] = [{
      "@type": TRACE_TYPE_LOCAL_REQUEST_CALLBACK,
      id: this.id,
      end: dateNow(),
      status: exception ? 500 : 200
    }];

    if (exception) {
      exception.traceId = this.id;
      traces.push(exception);
    }

    WIN["event-bus"].dispatchEvent(
      new CustomEvent('trace', { detail: { traces } })
    );
  }
}
