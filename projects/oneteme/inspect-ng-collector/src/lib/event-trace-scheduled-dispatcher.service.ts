import {Inject, Injectable, OnDestroy} from "@angular/core";
import {interval, startWith, Subscription, tap} from "rxjs";
import {EventTrace, InstanceEnvironment} from "./trace.model";
import {TechnicalConf} from "./configuration";
import {logInspect} from "./util";
import {MachineRessourceMonitorService} from "./machine-ressource-monitor.service";

@Injectable({ providedIn: 'root' })
export class  EventTraceScheduledDispatcherService implements OnDestroy {

  config: TechnicalConf;
  instanceEnvironment: InstanceEnvironment;
  scheduledSessionSender: Subscription;
  traceQueue: EventTrace[] = []; //
  sessionSendAttempts: number = 0
  sendSessionfinished: boolean = true;
  instanceSaved: boolean = false;
  private static _instance: EventTraceScheduledDispatcherService;

  constructor(@Inject('config') config: TechnicalConf,
              @Inject('instance') instance: InstanceEnvironment,
              private readonly mrmService: MachineRessourceMonitorService) {

    this.config = config;
    this.instanceEnvironment = instance;
    EventTraceScheduledDispatcherService._instance = this;
    this.scheduledSessionSender = interval(config.delay)
      .pipe(startWith(0))
      .pipe(tap(() => {
        if (this.sendSessionfinished) {
          this.sendSessionfinished = false;
          this.addToQueue(this.mrmService.getMemoryInfo())
          this.manageCache().finally(() => { this.sendSessionfinished = true });
        }
      }))
      .subscribe();
    logInspect('app','Dispatcher initialized');
  }

  static get instance(): EventTraceScheduledDispatcherService{
    return EventTraceScheduledDispatcherService._instance;
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
        this.config.sessionApi +="?end="+ new Date().toISOString();
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
    if (this.traceQueue.length > this.config.bufferMaxSize) {
      let diff = this.traceQueue.length - this.config.bufferMaxSize;
      this.traceQueue = this.traceQueue.slice(0, this.config.bufferMaxSize);
      logInspect('app',`Buffer size exeeded the max size,last sessions have been removed from buffer, (number of sessions removed):${diff}`)
    }
  }

  addToQueue(event: EventTrace | null) {
    if(event){
      this.traceQueue.push(event);
    }else {
      // tooo report
    }

    /* const index = this.queue.findIndex(e => e.id === event.id);
     if (index !== -1) {
       // Remplacer l'ancien par le nouveau
       this.queue[index] = event;
     } else {
       // Ajouter à la fin (queue)
       this.queue.push(event);
     }*/
   }


  ngOnDestroy(): void {
    if (this.scheduledSessionSender) {
      this.scheduledSessionSender.unsubscribe();
    }
  }
}
