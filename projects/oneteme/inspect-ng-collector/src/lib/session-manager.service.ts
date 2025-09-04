import { Inject, Injectable, OnDestroy } from '@angular/core';
import {EventTrace, InstanceEnvironment, MainSession} from './trace.model';
import { interval, startWith, Subscription, tap } from 'rxjs';
import { dateNow, logInspect, prettySessionFormat } from './util';
import { TechnicalConf } from './configuration';


@Injectable({ providedIn: 'root' })
export class SessionManager implements OnDestroy {

    config: TechnicalConf;
    instanceEnvironment: InstanceEnvironment;
    scheduledSessionSender: Subscription;
    traceQueue: EventTrace[] = []; //
    sessionSendAttempts: number = 0
    sendSessionfinished: boolean = true;
    instanceSaved: boolean = false;
    currentSession!: MainSession;
    private static _instance: SessionManager;

    constructor(@Inject('config') config: TechnicalConf,
        @Inject('instance') instance: InstanceEnvironment) {
        this.config = config;
        this.instanceEnvironment = instance;
        SessionManager._instance = this;
        this.scheduledSessionSender = interval(config.delay)
            .pipe(startWith(0))
            .pipe(tap(() => {
                if (this.sendSessionfinished) {
                    this.sendSessionfinished = false;
                    this.manageCache().finally(() => { this.sendSessionfinished = true });
                }
            }))
            .subscribe();
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
            if (this.config.exclude.every((e) => !e.test(this.currentSession.location))) {
                this.traceQueue.push(this.currentSession);
                logInspect('app',`added element to session queue, new size is: ${this.traceQueue.length}`);
            }

           // logInspect('app',() => prettySessionFormat(this.currentSession));
        }
        if (url) {
            this.currentSession = {
                '@type': "main-ses",
                id: crypto.randomUUID(),
                user: this.config.user(),
                start: dateNow(),
                type: "VIEW",
                location: url,
                loading: true,
                exceptions: []
            }
            this.traceQueue.push(this.currentSession)
        }
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

    ngOnDestroy(): void {
        if (this.scheduledSessionSender) {
            this.scheduledSessionSender.unsubscribe();
        }
    }

    getCurrentSession() {
        return this.currentSession;
    }

    /* // todo: apply this to the queue
       add(event: EventTrace) {
          const index = this.queue.findIndex(e => e.id === event.id);
          if (index !== -1) {
            // Remplacer l'ancien par le nouveau
            this.queue[index] = event;
          } else {
            // Ajouter à la fin (queue)
            this.queue.push(event);
          }
        }
    */
}
