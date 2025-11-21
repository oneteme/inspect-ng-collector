  import {interval, startWith, tap} from "rxjs";
import {EventTrace} from "./trace.model";
import {createReport, DISPATCH, PRE_DISPATCH} from "./util";
import {ContextManager} from "./context-manager";


export function eventTraceScheduledDispatcher() {
  return EventTraceScheduledDispatcherService._instance = new EventTraceScheduledDispatcherService();
}

export class  EventTraceScheduledDispatcherService {
  traceQueue: Set<EventTrace> = new Set();
  sessionSendAttempts: number = 0
  sendSessionfinished: boolean = true;
  instanceSaved: boolean = false;
  static _instance: EventTraceScheduledDispatcherService;

  constructor() {
    interval(ContextManager.instance.techConfig.interval)
      .pipe(startWith(0))
      .pipe(tap(() => {
        if (this.sendSessionfinished) {
          this.sendSessionfinished = false;
          window.dispatchEvent(new CustomEvent(PRE_DISPATCH));
          setTimeout(() =>
            this.Dispatch().finally(() => { this.sendSessionfinished = true }),
            5)
        }
      }))
      .subscribe();
    window.addEventListener( DISPATCH, (e: Event) => {
      (e as CustomEvent).detail.traces &&  this.addtoQueue((e as CustomEvent).detail.traces);
      if((e as CustomEvent).detail.force){
        this.sendSessions(true)
        this.onDestroy();
      }
    });
  }


  Dispatch(): Promise<any> {
    if(this.instanceSaved){
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

  sendSessions(instanceComplete?:boolean) : Promise<number>{
    if (this.traceQueue.size > 0) {
      let uri = ContextManager.instance.techConfig.sessionApi + "?attempts=" + ++this.sessionSendAttempts;
      if(instanceComplete){
        uri += "&end=" + new Date().toISOString();
      }
      let sessions: Set<EventTrace> = this.traceQueue;
      this.traceQueue = new Set();
      return fetch(uri, this.getRequestInit(sessions))
        .then(res => {
          if (res.ok) {
            this.sessionSendAttempts = 0;
            return sessions.size;
          }
          return this.handleEventTraceSavingError(sessions)
        })
        .catch(()=> this.handleEventTraceSavingError(sessions))
    }
    return Promise.resolve(0);
  }

  extractEventTrace(): Set<EventTrace> {
    let trc:Set<EventTrace>= this.traceQueue;
    this.traceQueue = new Set();
    let ses = new Set<EventTrace>();
    trc.forEach(((e)=> {
      if(e.hasOwnProperty("end")){
        const copy:any = {...e}
        if(!copy.end) {
          ses.add(copy);
          this.traceQueue.add(e);
        }
        else{
          ses.add(e);
        }
      }
      else {
        ses.add(e);
      }
    }))
    return ses;
  }


  handleEventTraceSavingError(sessions: Set<EventTrace>){
    this.sessionSendAttempts % 5 == 0 && console.warn(`Error while attempting to send sessions, attempts: ${this.sessionSendAttempts}`)
    this.revertQueueSize(sessions);
    return -1;
  }

  getRequestInit(sessionList: Set<EventTrace>): RequestInit  {
    return {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      mode: 'cors',
      body: JSON.stringify(Array.from(sessionList))
    }
  }

  postInstanceEnv(): Promise<boolean> {
    this.sessionSendAttempts++;
    return fetch(ContextManager.instance.techConfig.instanceApi, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      mode: 'cors',
      body: JSON.stringify(ContextManager.instance.instanceEnv)
    })
      .then(res => res.ok ? res.text().then(id => {
        this.sessionSendAttempts = 0;
        return this.instanceSaved = true;
      }) : false)
      .catch(err => false);
  }

  revertQueueSize(sessions: Set<EventTrace> ){
    sessions.forEach(session => (<any>session).end && this.traceQueue.add(session));
    if (this.traceQueue.size > ContextManager.instance.techConfig.queueCapacity) {
      const items = Array.from(this.traceQueue).slice(0, ContextManager.instance.techConfig.queueCapacity);
      this.traceQueue = new Set(items);
    }
  }

  async addtoQueue(event: EventTrace | null) {
    try{
      if(event){
        this.traceQueue.add(event);
      }
    }catch(e){
      this.addtoQueue(createReport(String(e)))
    }
   }

  onDestroy() {
    this.traceQueue.clear();
    this.sendSessionfinished=true;
    this.instanceSaved =false;
    this.sessionSendAttempts = 0;
  }

}
