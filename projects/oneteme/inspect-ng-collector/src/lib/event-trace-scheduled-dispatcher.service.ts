import { interval, startWith, tap, Subscription } from "rxjs";
import {EventTrace, InstanceEnvironment} from "./trace.model";
import { dispatchExport, addTraceListener, addShutdownListener, dispatchReport } from "./event-bus";
import {TechnicalConf} from "./configuration";

const EMPTY_ARRAY : EventTrace[] = <[]>Object.freeze([]);

class EventTraceScheduledDispatcherService {

  static _instance: EventTraceScheduledDispatcherService;

  readonly subscription: Subscription
  readonly traceQueue: EventTrace[] = [];

  dispatchAttempts: number = 0
  dispatching: boolean = false;
  instanceDispatched: boolean = false;
  instanceDispatching: boolean = false; // guard contre les appels concurrents
  wasDestroyed : boolean = false;

  instance?: InstanceEnvironment ;
  constructor(private readonly _techConfig: TechnicalConf) {
    this.subscription = interval(_techConfig.interval)
      .pipe(startWith(0))
      .pipe(tap(() => {
        if (!this.dispatching && !this.wasDestroyed && this.instance) {
          this.dispatching = true;
          dispatchExport();
          this.dispatch()
            .then(arr => this.revertQueueSize(arr))
            .catch(err => {})
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

  trace(instance: InstanceEnvironment) {
    this.instance = instance;
    this.updateInstance(); // Dispatch immédiatement au lieu d'attendre l'intervalle
  }

  private updateInstance(): Promise<void> {
    if (this.instanceDispatched || this.instanceDispatching || this.wasDestroyed || !this.instance) {
      return Promise.resolve(); // Déjà dispatché, en cours, ou pas prêt
    }
    this.instanceDispatching = true;
    return this.dispatchInstance()
      .then(success => {
        if (success) {
          this.instanceDispatched = true;
        }else {
          console.warn(`Error while attempting to send Environement instance, attempts ${this.dispatchAttempts}`);
        }
      })
      .finally(() => { this.instanceDispatching = false; });
  }

  dispatch(): Promise<any> {
    if (this.instanceDispatched) {
      return this.dispatchTraces();
    }
    if (this.instanceDispatching) return Promise.resolve(EMPTY_ARRAY); // attendre
    return this.updateInstance().then(() => {
      if (this.instanceDispatched) return this.dispatchTraces(); // seulement si confirmé
      return Promise.reject(new Error('Instance not dispatched yet'));// instance pas encore dispatchée, traces non envoyées
    });
  }

  dispatchTraces(destroy?: boolean): Promise<EventTrace[]> {
    if (this.traceQueue.length === 0) {
      return Promise.resolve(EMPTY_ARRAY);
    }
    let uri = this._techConfig.sessionApi + "?attempts=" + ++this.dispatchAttempts;
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
        if (res.status >= 500) {
          dispatchReport('EventTraceScheduledDispatcher.dispatchTraces', res);
          return traces;
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
    return fetch(this._techConfig.instanceApi, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      mode: 'cors',
      keepalive: true,
      body: JSON.stringify(this.instance)
    })
      .then(res => {
        if (res.ok) {
          this.dispatchAttempts = 0;
          return true;
        }
        if (res.status >= 500) {
          dispatchReport('EventTraceScheduledDispatcher.dispatchInstance', res);
        }
        return false;
      })
      .catch(() => false);
  }

  revertQueueSize(traces: EventTrace[]) {
    if(!this.wasDestroyed){
      this.traceQueue.unshift(...traces);
      if (this.traceQueue.length > this._techConfig.queueCapacity) {
        this.traceQueue.splice(this._techConfig.queueCapacity);
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

export function eventTraceScheduledDispatcher(tech: TechnicalConf): EventTraceScheduledDispatcherService {
  return EventTraceScheduledDispatcherService._instance = new EventTraceScheduledDispatcherService(tech);
}
