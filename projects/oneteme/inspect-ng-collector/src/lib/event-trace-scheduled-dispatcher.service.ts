import { interval, startWith, tap, Subscription } from "rxjs";
import { EventTrace, InstanceEnvironment } from "./trace.model";
import { dispatchExport, addTraceListener, addShutdownListener, dispatchReport } from "./event-bus";
import {TechnicalConf} from "./configuration";

const EMPTY_ARRAY : EventTrace[] = <[]>Object.freeze([]);

class EventTraceScheduledDispatcherService {

  static _instance: EventTraceScheduledDispatcherService;

  readonly subscription: Subscription
  private readonly removeTraceListener: () => void;
  private readonly removeShutdownListener: () => void;
  readonly traceQueue: EventTrace[] = [];
  lastPacket: { readonly body: string; readonly sequence: number; readonly size: number } | null = null;
  dispatchAttempts: number = 0
  dispatchSequence: number = 0
  dispatching: boolean = false;
  private inFlightDispatch?: Promise<EventTrace[]>;
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
            .catch(() => {})
            .finally(() => { this.dispatching = false })
        }
      }))
      .subscribe();
    this.removeTraceListener = addTraceListener(e => this.appendTrace((e as CustomEvent).detail.traces));
    this.removeShutdownListener = addShutdownListener(() => this.destroy());
  }

  appendTrace(events: EventTrace[]) {
    if(!this.wasDestroyed){
      events?.forEach(event => this.traceQueue.push(event));
    }
  }

  trace(instance: InstanceEnvironment) {
    this.instance = { ...instance };
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
          dispatchReport(`Error while attempting to send Environement instance, attempts ${this.dispatchAttempts}`);
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

  dispatchTraces(destroy = false): Promise<EventTrace[]> {
    if (this.wasDestroyed && !destroy) {
      return Promise.resolve(EMPTY_ARRAY);
    }
    if (!this.inFlightDispatch) {
      const request = this.lastPacket !== null
        ? this.dispatchPrevious(destroy && this.traceQueue.length === 0).then(() => EMPTY_ARRAY)
        : this.dispatchQueuedTraces(destroy);
      this.inFlightDispatch = request.finally(() => { this.inFlightDispatch = undefined; });
    }
    if (destroy && this.traceQueue.length > 0) {
      // L'envoi keepalive en cours garde son paquet ; seules les nouvelles traces partent ici.
      return Promise.all([this.inFlightDispatch, this.dispatchQueuedTraces(true)]).then(() => EMPTY_ARRAY);
    }
    return this.inFlightDispatch;
  }

  private async dispatchQueuedTraces(destroy: boolean): Promise<EventTrace[]> {
    if (this.traceQueue.length === 0) {
      return EMPTY_ARRAY;
    }
    const packet = {
      body: JSON.stringify(this.traceQueue),
      sequence: ++this.dispatchSequence,
      size: this.traceQueue.length
    };
    let uri = this._techConfig.sessionApi + "?atm=" + ++this.dispatchAttempts+"&seq="+ packet.sequence;
    if (destroy) {
      uri += "&end=" + new Date().toISOString();
    }
    this.traceQueue.length = 0;
    return fetch(uri, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': this._techConfig.namespaceHeader },
        mode: 'cors',
        keepalive: true,
        body: packet.body
      })
      .then(res=> {
        if (res.ok || res.status === 409) {
          this.dispatchAttempts = 0;
          return EMPTY_ARRAY;
        }
        dispatchReport(`Error while attempting to send sessions, attempts: ${this.dispatchAttempts}`, res);
        if(res.status === 429 || (res.status >= 500 && res.headers?.get('Inspect-Trace-Retry') === '1')) {
          dispatchReport(`Dispatch failed with status ${res.status}, retrying...`, res);
          this.lastPacket = packet;
        }
        return EMPTY_ARRAY // retry on 3XX
      })
      .catch(error => {
        dispatchReport(`Error while attempting to send sessions, attempts: ${this.dispatchAttempts}`, error); //no cnx !
        this.lastPacket = packet;
        return EMPTY_ARRAY;
      });
  }

  private async dispatchPrevious(destroy = false): Promise<void> {
    const packet = this.lastPacket;
    if (!packet) return;
    let uri = this._techConfig.sessionApi + "?atm=" + ++this.dispatchAttempts+"&seq="+ packet.sequence;
    if (destroy) {
      uri += "&end=" + new Date().toISOString();
    }
    return fetch(uri, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': this._techConfig.namespaceHeader },
      mode: 'cors',
      keepalive: true,
      body: packet.body
    }).then(res => {
      if(res.ok || res.status === 409) {
        if (this.lastPacket === packet) this.lastPacket = null;
        this.dispatchAttempts = 0;
        return;
      }
      dispatchReport(`Error while attempting to send sessions, attempts: ${this.dispatchAttempts}`, res);
      if (res.status >= 500) {
        dispatchReport('EventTraceScheduledDispatcher.dispatchPrevious', res);
      }

    }).catch(error => {
      dispatchReport(`Error while attempting to send sessions, attempts: ${this.dispatchAttempts}`, error);
      if (this.lastPacket === packet) this.discardLastPacketIfQueueCapacityExceeded();
    })
  }

  private discardLastPacketIfQueueCapacityExceeded() {
    if ((this.lastPacket?.size ?? 0) + this.traceQueue.length > this._techConfig.queueCapacity) {
      dispatchReport(`Error while attempting to send ${this.lastPacket?.size} traces, giving up`);
      this.lastPacket = null;
      this.dispatchAttempts = 0;
    }
  }


  dispatchInstance(): Promise<boolean> {
    const uri = this._techConfig.instanceApi + "?atm=" + ++this.dispatchAttempts;
    return fetch(uri, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': this._techConfig.namespaceHeader },
      mode: 'cors',
      keepalive: true,
      body: JSON.stringify(this.instance)
    })
      .then(res => {
        if (res.ok || res.status === 409) {
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
    if (this.wasDestroyed) {
      return;
    }
    this.subscription?.unsubscribe();
    this.removeTraceListener();
    this.removeShutdownListener();
    this.instanceDispatched && this.dispatchTraces(true); // make sure instance is dispatched before sending the end signal
  }
}

export function eventTraceScheduledDispatcher(tech: TechnicalConf): EventTraceScheduledDispatcherService {
  EventTraceScheduledDispatcherService._instance?.destroy();
  return EventTraceScheduledDispatcherService._instance = new EventTraceScheduledDispatcherService({ ...tech });
}
