import {Inject, Injectable} from '@angular/core';
import { MainSession, } from './trace.model';
import {createReport, dateNow, logInspect} from './util';
import {TechnicalConf} from "./configuration";
import {EventTraceScheduledDispatcherService} from "./event-trace-scheduled-dispatcher.service";


@Injectable({ providedIn: 'root' })
export class SessionManager {

    //config: TechnicalConf;
    currentSession!: any;
    private static _instance: SessionManager;

    constructor(/*@Inject('config') config: TechnicalConf*/ // todo  remove this somehow,
                private readonly dispatcher: EventTraceScheduledDispatcherService) {
     // this.config = config;
      SessionManager._instance = this;
        logInspect('app','SessionManager initialized');
    }

    static get instance(): SessionManager{
        return SessionManager._instance;
    }

    newSession(url?: string) {
        if (this.currentSession) {
            this.currentSession.end = dateNow();
            this.currentSession.name = document.title;
            this.currentSession.location = document.URL;
            //if (this.config.exclude.every((e) => !e.test(this.currentSession.location))) { // todo fix this
                this.dispatcher.addToQueue(this.currentSession);
                logInspect('app',`added element to session queue, new size is: ${this.dispatcher.traceQueue.length}`);
           // }
            // todo fix this
           // logInspect('app',() => prettySessionFormat(this.currentSession));
        }
        if (url) {
            this.currentSession = {
                '@type': "main-ses",
                id: crypto.randomUUID(),
                user: "",//this.config.user(),
                start: dateNow(),
                type: "VIEW",
                location: url,
                loading: true,
                exceptions: []
            }
            this.dispatcher.addToQueue(this.currentSession)
        }
    }

    currentSessionID(): string | undefined {
      if(this.currentSession){
        return this.currentSession.id;
      }
      this.dispatcher.addToQueue(createReport("no active session found for instance: "+ this.dispatcher.instanceEnvironment.id))
      return undefined;
    }

    getCurrentSession() {
        return this.currentSession;
    }

}
