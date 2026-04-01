import { interval, startWith, tap, Subscription } from "rxjs";
import { EventTrace } from "./trace.model";
import { dispatchExport, addTraceListener, addShutdownListener } from "./event-bus";
import { ContextManager } from "./context-manager";

const EMPTY_ARRAY : EventTrace[] = <[]>Object.freeze([]);

class EventTraceScheduledDispatcherService {

  static _instance: EventTraceScheduledDispatcherService;

  readonly subscription: Subscription
  readonly traceQueue: EventTrace[] = [];

  dispatchAttempts: number = 0
  dispatching: boolean = false;
  instanceDispatched: boolean = false;
  wasDestroyed : boolean = false

  constructor() {
    this.subscription = interval(ContextManager.instance.techConfig.interval)
      .pipe(startWith(0))
      .pipe(tap(() => {
        if (!this.dispatching && !this.wasDestroyed) {
          this.dispatching = true;
          dispatchExport();
          this.dispatch()
            .then(arr => this.revertQueueSize(arr))
            .catch(err => console.log('TODO'))
            .finally(() => { this.dispatching = false })
        }
      }))
      .subscribe();
    addTraceListener(e => this.appendTrace((e as CustomEvent).detail.traces));
    addShutdownListener(e => this.destroy());
  }

  appendTrace(events: EventTrace[]) {
    if(!this.wasDestroyed){
      events?.forEach(event => this.traceQueue.push(event));
    }
  }

  dispatch(): Promise<any> {
    if (this.instanceDispatched) {
      return this.dispatchTraces();
    }
    return this.dispatchInstance().then(ok => {
      if (ok) {
        this.instanceDispatched = true;
        return this.dispatchTraces();
      }
      console.warn(`Error while attempting to send Environement instance, attempts ${this.dispatchAttempts}`);
      return Promise.reject(new Error('No instance id'));
    });
  }

  dispatchTraces(destroy?: boolean): Promise<EventTrace[]> {
    if (this.traceQueue.length === 0) {
      return Promise.resolve(EMPTY_ARRAY);
    }
    let uri = ContextManager.instance.techConfig.sessionApi + "?attempts=" + ++this.dispatchAttempts;
    if (destroy) {
      uri += "&end=" + new Date().toISOString();
    }
    const traces = [...this.traceQueue];
    this.traceQueue.length = 0;
    return fetch(uri, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors',
        keepalive: true,
        body: JSON.stringify(traces)
      })
      .then(res=> {
        if (res.ok) {
          this.dispatchAttempts = 0;
          return EMPTY_ARRAY;
        }
        console.warn(`Error while attempting to send sessions, attempts: ${this.dispatchAttempts}`);
        if (res.status >= 400 && res.status < 500) {
          return traces; //retry on bad request !?
        }
        return res.json()
          .then(body => body?.retry ? traces : EMPTY_ARRAY)
          .catch(() => EMPTY_ARRAY);
      })
      .catch(() => {
        console.warn(`Error while attempting to send sessions, attempts: ${this.dispatchAttempts}`); //no cnx !
        return traces;
      });
  }

  dispatchInstance(): Promise<boolean> {
    this.dispatchAttempts++;
    return fetch(ContextManager.instance.techConfig.instanceApi, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      mode: 'cors',
      keepalive: true,
      body: JSON.stringify(ContextManager.instance.instanceEnv)
    })
      .then(res => res.ok ? res.text().then(id => {
        this.dispatchAttempts = 0;
        return true;
      }) : false)
      .catch(err => false);
  }

  revertQueueSize(traces: EventTrace[]) {
    if(!this.wasDestroyed){
      this.traceQueue.unshift(...traces);
      if (this.traceQueue.length > ContextManager.instance.techConfig.queueCapacity) {
        this.traceQueue.splice(ContextManager.instance.techConfig.queueCapacity);
      }
    }
  }

  destroy() {
    this.subscription?.unsubscribe();
    this.wasDestroyed = true;
    dispatchExport(); //last metric ??
    this.dispatchTraces(true);
  }
}

export function eventTraceScheduledDispatcher() {
  return EventTraceScheduledDispatcherService._instance = new EventTraceScheduledDispatcherService();
}