import { Inject, Injectable, OnDestroy } from '@angular/core';
import { InstanceEnvironment, MainSession } from './trace.model';
import { interval, startWith, Subscription, tap } from 'rxjs';
import { dateNow, logInspect, prettySessionFormat } from './util';
import { TechnicalConf } from './configuration';


@Injectable({ providedIn: 'root' })
export class SessionManager implements OnDestroy {

    config: TechnicalConf;
    instanceEnvironment: InstanceEnvironment;
    scheduledSessionSender: Subscription;
    sessionQueue: MainSession[] = [];
    sessionSendAttempts: number = 0
    sendSessionfinished: boolean = true;
    currentSession!: MainSession;

    constructor(@Inject('config') config: TechnicalConf,
        @Inject('instance') instance: InstanceEnvironment) {
        this.config = config;
        this.instanceEnvironment = instance;
        this.scheduledSessionSender = interval(config.delay)
            .pipe(startWith(0))
            .pipe(tap(() => {
                if (this.sendSessionfinished) {
                    this.sendSessionfinished = false;
                    this.manageCache().finally(() => { this.sendSessionfinished = true });
                }
            }))
            .subscribe();
        logInspect('SessionManager initialized');
    }

    newSession(url?: string) {
        if (this.currentSession) {
            this.currentSession.end = dateNow();
            this.currentSession.name = document.title;
            this.currentSession.location = document.URL;
            if (this.config.exclude.every((e) => !e.test(this.currentSession.location))) {
                this.sessionQueue.push(this.currentSession);
                logInspect(`added element to session queue, new size is:${this.sessionQueue.length}`);
            }

            logInspect(() => prettySessionFormat(this.currentSession));
        }
        if (url) {
            this.currentSession = {
                '@type': "main",
                user: this.config.user,
                start: dateNow(),
                type: "VIEW",
                location: url,
                loading: true,
                restRequests: []
            }
        }
    }

    manageCache(): Promise<any> {
        if(this.instanceEnvironment.id){
            return this.sendSessions();
        }
        return this.postInstanceEnv().then((id: string | null) => {
            if (id) {
               return this.sendSessions();
            }
            console.warn(`Error while attempting to send Environement instance, attempts ${this.sessionSendAttempts}`);
            return Promise.reject(new Error('No instance id'));
        });
    }

    sendSessions() : Promise<number>{
        if (this.sessionQueue.length > 0) {
            this.sessionSendAttempts++;
            let sessions: MainSession[] = [...this.sessionQueue];
            this.sessionQueue.splice(0, sessions.length); // add rest of sessions
            logInspect(`sending sessions, attempts:${this.sessionSendAttempts}, queue size : ${sessions.length}`)
            return this.putSessions(sessions)
                .then(ok => {
                    if (ok) {
                        logInspect(`sessions sent successfully, queue size reset, new size is: ${this.sessionQueue.length}`)
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

    putSessions(sessionList: MainSession[]): Promise<boolean> {
        return fetch(this.config.sessionApi, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            mode: 'cors',
            body: JSON.stringify(sessionList)
        })
            .then(res => res.ok)
            .catch(err => false);
    }

    postInstanceEnv(): Promise<string | null> {
        this.sessionSendAttempts++;
        return fetch(this.config.instanceApi, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            mode: 'cors',
            body: JSON.stringify(this.instanceEnvironment)
        })
        .then(res => res.ok ? res.text().then(id => {
            this.config.sessionApi = this.config.sessionApi.replace(':id', id);
            logInspect('Environement instance sent successfully', id);
            this.sessionSendAttempts = 0;
            return this.instanceEnvironment.id = id;
        }) : null)
        .catch(err => null);
    }

    revertQueueSize(sessions: MainSession[]) {
        this.sessionQueue.unshift(...sessions);
        if (this.sessionQueue.length > this.config.bufferMaxSize) {
            let diff = this.sessionQueue.length - this.config.bufferMaxSize;
            this.sessionQueue = this.sessionQueue.slice(0, this.config.bufferMaxSize);
            logInspect(`Buffer size exeeded the max size,last sessions have been removed from buffer, (number of sessions removed):${diff}`)
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
}
