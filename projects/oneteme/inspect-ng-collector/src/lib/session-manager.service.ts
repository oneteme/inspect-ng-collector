import {Injectable} from '@angular/core';
import {createReport, dateNow, logInspect} from './util';
import {EventTraceScheduledDispatcherService} from "./event-trace-scheduled-dispatcher.service";


@Injectable({ providedIn: 'root' })
export class SessionManager {

    //config: TechnicalConf;
    currentSession!: any

    private static _instance: SessionManager;

    constructor(private readonly dispatcher: EventTraceScheduledDispatcherService) {
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
            this.dispatcher.addToQueue(this.currentSession);
            // todo fix this
           // logInspect('app',() => prettySessionFormat(this.currentSession));
        }
        if (url) {
            this.currentSession = {
                '@type': "main-ses",
                id: crypto.randomUUID(),
                user: "",
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

    addException(exception: any) {
        if (this.currentSession) {
            this.currentSession.exceptions.push(exception);
        }else {
            this.dispatcher.addToQueue(createReport("no active session found for instance1: "+ this.dispatcher.instanceEnvironment.id))
        }
    }

}
