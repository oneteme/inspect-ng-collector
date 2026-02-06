
import { WIN, dateNow, dispatchTraces } from "./util";
import { LocalRequest, LocalRequestCallBack, RequestMask } from "./trace.model";

export function TraceableStage() {

  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    descriptor.value = function (...args: any[]) {
      const start = dateNow();
      let exception;
      try {
        return originalMethod.apply(this, args);
      } catch (e: any) {
        let type = null, message = null;
        if (e) {
          if (typeof e === "string") {
            message = e;
          } else if (e instanceof Error) {
            type = e.name;
            message = e.message;
          } else {
            message = JSON.stringify(e)
          }
        }
        exception = {
          type: type,
          message: message
        }
        throw e;
      } finally { //TODO create Monitor
        const end = dateNow(); 
        const id = crypto.randomUUID();
        dispatchTraces({
          ...WIN["inspect-session-manager"]?.initRestRequest(RequestMask.LOCAL), //TODO DUAL EVENT TRACE !!??
          "@type": "110",
          id: id,
          name: propertyKey,
          location: target.constructor.name,
          user: WIN["inspect-session-manager"]?.currentSession?.user, //bad access
          start: start
        } as LocalRequest);
        dispatchTraces({
          "@type": "111",
          id: id,
          exception: exception,
          end: end
        } as LocalRequestCallBack);
      }
    }
    return descriptor;
  }
}
