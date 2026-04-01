import { interval, startWith, tap, Subscription } from "rxjs";
import { EventTrace } from "./trace.model";
import { dispatchExport, addTraceListener, addShutdownListener } from "./event-bus";
import { ContextManager } from "./context-manager";

export function eventTraceScheduledDispatcher() {
  return EventTraceScheduledDispatcherService._instance = new EventTraceScheduledDispatcherService();
}

export class EventTraceScheduledDispatcherService {

  static _instance: EventTraceScheduledDispatcherService;

  traceQueue: Set<EventTrace> = new Set();
  sessionSendAttempts: number = 0
  sendSessionfinished: boolean = true;
  instanceSaved: boolean = false;
  readonly interval: Subscription

  constructor() {
    this.interval = interval(ContextManager.instance.techConfig.interval)
      .pipe(startWith(0))
      .pipe(tap(() => {
        if (this.sendSessionfinished) {
          this.sendSessionfinished = false;
          dispatchExport();
          this.dispatch()
            .then(arr => this.revertQueueSize(arr))
            .catch(err => { }) //log error !?
            .finally(() => { this.sendSessionfinished = true })
        }
      }))
      .subscribe();
    addTraceListener(e => {
      this.addtoQueue((e as CustomEvent).detail.traces)
    });
    addShutdownListener(e => this.destroy());
  }

  dispatch(): Promise<any> {
    if (this.instanceSaved) {
      return this.sendSessions();
    }
    return this.postInstanceEnv().then((ok: boolean) => {
      if (ok) {
        return this.sendSessions();
      }
      this.sessionSendAttempts % 5 == 0 && console.warn(`Error while attempting to send Environement instance, attempts ${this.sessionSendAttempts}`);
      return Promise.reject(new Error('No instance id'));
    });
  }

  sendSessions(instanceComplete?: boolean): Promise<Set<EventTrace>> {
    if (this.traceQueue.size === 0) {
      return Promise.resolve(new Set<EventTrace>());
    }

    let uri = ContextManager.instance.techConfig.sessionApi + "?attempts=" + ++this.sessionSendAttempts;
    if (instanceComplete) {
      uri += "&end=" + new Date().toISOString();
    }

    const sessions = this.traceQueue;
    this.traceQueue = new Set();

    return fetch(uri, this.getRequestInit(sessions))
      .then(res => {
        if (res.ok) {
          this.sessionSendAttempts = 0;
          return new Set<EventTrace>();

        }
        if (res.status >= 400 && res.status < 500) {
          return this.handleEventTraceSavingError(sessions)
        }
        return res.json()
          .then(body => body?.retry ? this.handleEventTraceSavingError(sessions) : new Set<EventTrace>())
          .catch(() => new Set<EventTrace>());
      })
      .catch(() => this.handleEventTraceSavingError(sessions));
  }

  handleEventTraceSavingError(sessions: Set<EventTrace>) {
    this.sessionSendAttempts % 5 == 0 && console.warn(`Error while attempting to send sessions, attempts: ${this.sessionSendAttempts}`)
    return sessions;
  }

  getRequestInit(sessionList: Set<EventTrace>): RequestInit {
    return {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      mode: 'cors',
      keepalive: true,
      body: JSON.stringify(Array.from(sessionList))
    }
  }

  postInstanceEnv(): Promise<boolean> {
    this.sessionSendAttempts++;
    return fetch(ContextManager.instance.techConfig.instanceApi, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      mode: 'cors',
      keepalive: true,
      body: JSON.stringify(ContextManager.instance.instanceEnv)
    })
      .then(res => res.ok ? res.text().then(id => {
        this.sessionSendAttempts = 0;
        return this.instanceSaved = true;
      }) : false)
      .catch(err => false);
  }

  revertQueueSize(sessions: Set<EventTrace>) {
    sessions.forEach(session => this.traceQueue.add(session));
    if (this.traceQueue.size > ContextManager.instance.techConfig.queueCapacity) {
      const items = Array.from(this.traceQueue).slice(0, ContextManager.instance.techConfig.queueCapacity);
      this.traceQueue = new Set(items);
    }
  }

  async addtoQueue(events: EventTrace[]) { //TODO why event can be null
    try {
      if (events) {
        events.forEach(event => {this.traceQueue.add(event)});
      }
    } catch (e) {
      console.log('addtoQueue', events, e);
    }
  }

  destroy() {
    if (this.interval) {
      this.interval.unsubscribe();
    }
    this.sendSessions(true);
  }
}
