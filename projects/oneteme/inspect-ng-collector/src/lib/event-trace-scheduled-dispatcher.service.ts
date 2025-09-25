import {interval, startWith, Subscription, tap} from "rxjs";
import {EventTrace, InstanceEnvironment, MainSession} from "./trace.model";
import {TechnicalConf} from "./configuration";
import {createReport, DISPATCH, logInspect, PRE_DISPATCH} from "./util";
export class  EventTraceScheduledDispatcherService{

  config: TechnicalConf;
  instanceEnvironment: InstanceEnvironment;
  scheduledSessionSender: Subscription;
  traceQueue: EventTrace[] = []; //
  sessionSendAttempts: number = 0
  sendSessionfinished: boolean = true;
  instanceSaved: boolean = false;
  private static _instance: EventTraceScheduledDispatcherService;

  constructor(config: TechnicalConf,
              instance: InstanceEnvironment) {
    this.config = config;
    this.instanceEnvironment = instance;
    this.scheduledSessionSender = interval(config.interval)
      .pipe(startWith(0))
      .pipe(tap(() => {
        if (this.sendSessionfinished) {
          this.sendSessionfinished = false;
          window.dispatchEvent(new CustomEvent(PRE_DISPATCH));
          this.manageCache().finally(() => { this.sendSessionfinished = true });
        }
      }))
      .subscribe();
    window.addEventListener( DISPATCH, (e: Event) => {
      (e as CustomEvent).detail.traces &&  this.dispatch((e as CustomEvent).detail.traces);
      (e as CustomEvent).detail.force && this.sendSessions(true);
    });

    logInspect('app','Dispatcher initialized');
  }

  static init(techConfig: TechnicalConf, instanceEnv: InstanceEnvironment) {
    return EventTraceScheduledDispatcherService._instance = new EventTraceScheduledDispatcherService(techConfig, instanceEnv);
  }

  manageCache(): Promise<any> {
    if(this.instanceSaved){
      return this.sendSessions();
    }
    return this.postInstanceEnv().then((id: boolean | null) => {
      if (id) {
        return this.sendSessions();
      }
      console.warn(`Error while attempting to send Environement instance, attempts ${this.sessionSendAttempts}`);
      return Promise.reject(new Error('No instance id'));
    });
  }

  sendSessions(instanceComplete?:boolean) : Promise<number>{
    if (this.traceQueue.length > 0) {
      if(instanceComplete){
        if (this.config.sessionApi.includes('end=')) {
          this.config.sessionApi = this.config.sessionApi.replace(/end=[^&]*/g, "end=" + new Date().toISOString());
        } else {
          this.config.sessionApi += "?end=" + new Date().toISOString();
        }
      }
      this.sessionSendAttempts++;
      let sessions: EventTrace[] = [...this.traceQueue];
      this.traceQueue.splice(0, sessions.length); // add rest of sessions
      logInspect('app',`sending sessions, attempts:${this.sessionSendAttempts}, queue size : ${sessions.length}`)
      return this.putSessions(sessions)
        .then(ok => {
          if (ok) {
            logInspect('app',`sessions sent successfully, queue size reset, new size is: ${this.traceQueue.length}`)
            this.sessionSendAttempts = 0;
            return sessions.length;
          } else {
            console.warn(`Error while attempting to send sessions, attempts: ${this.sessionSendAttempts}`)//
            this.revertQueueSize(sessions);
            return -1;
          }
        })
    }
    return Promise.resolve(0);
  }

  putSessions(sessionList: EventTrace[]): Promise<boolean> {
    return fetch(this.config.sessionApi, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      mode: 'cors',
      body: JSON.stringify(sessionList)
    })
      .then(res => res.ok)
      .catch(err => false);
  }

  postInstanceEnv(): Promise<boolean | null> {
    this.sessionSendAttempts++;
    return fetch(this.config.instanceApi, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      mode: 'cors',
      body: JSON.stringify(this.instanceEnvironment)
    })
      .then(res => res.ok ? res.text().then(id => {
        this.config.sessionApi = this.config.sessionApi.replace(':id', id);
        logInspect('app','Environement instance sent successfully', id);
        this.sessionSendAttempts = 0;
        return this.instanceSaved = true;
      }) : null)
      .catch(err => null);
  }

  revertQueueSize(sessions: EventTrace[]) {
    this.traceQueue.unshift(...sessions);
    if (this.traceQueue.length > this.config.queueCapacity) {
      let diff = this.traceQueue.length - this.config.queueCapacity;
      this.traceQueue = this.traceQueue.slice(0, this.config.queueCapacity);
      logInspect('app',`Buffer size exeeded the max size,last sessions have been removed from buffer, (number of sessions removed):${diff}`)
    }
  }

  async dispatch(event: EventTrace | null) {
    try{
      if(event){
        if(this.isSessionExcluded(event)) return
        while (!this.sendSessionfinished) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        const index = this.traceQueue.findIndex((e:any)=>e.id && (<any>event).id  && e.id === (<any>event).id);
        if(index !== -1) {
            this.traceQueue[index] = event;
          logInspect('app',`Updated element to session queue, element id: ${(<any>event).id}`);
        }else {
          this.traceQueue.push(event);
          logInspect('app',`added element to session queue, new size is: ${this.traceQueue.length}`);
        }
      }
    }catch(e){
      console.warn(e)
      this.dispatch(createReport(String(e)))
    }
   }

   isSessionExcluded(event: EventTrace): boolean{
      return !!('@type' in event && event['@type'] === 'main-ses' && this.config.exclude?.some((e) => e.test((<MainSession>event).location)))
   }

}
