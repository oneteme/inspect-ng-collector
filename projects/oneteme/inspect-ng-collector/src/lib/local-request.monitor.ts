import {
  dateNow,
  LocalRequest, LocalRequestCallBack,
  RequestMask,
  TRACE_TYPE_LOCAL_REQUEST,
  TRACE_TYPE_LOCAL_REQUEST_CALLBACK,
  UUID
} from "./trace.model";
import {dispatchTraces, WIN} from "./event-bus";

export class LocalRequestMonitor{

  readonly id: UUID;
  readonly start: number;

  constructor() {
    this.start = dateNow();
    this.id = crypto.randomUUID();
  }

  preProcess(propertyKey: string, target: any){
    dispatchTraces({
      ...WIN["inspect-session-manager"]?.initRestRequest(RequestMask.LOCAL), //TODO DUAL EVENT TRACE !!??
      "@type": TRACE_TYPE_LOCAL_REQUEST,
      id: this.id,
      name: propertyKey,
      location: target.constructor.name,
      user: WIN["inspect-session-manager"]?.currentSession?.user, //bad access
      start: this.start
    } as LocalRequest);
  }

  postProcess(exception?: any){
    console.log(exception)
    dispatchTraces({
      "@type": TRACE_TYPE_LOCAL_REQUEST_CALLBACK,
      id: this.id,
      exception: exception,
      end: dateNow()
    } as LocalRequestCallBack);
  }
}
