import { Inject, Injectable, OnDestroy } from '@angular/core';
import { InstanceEnvironment, MainSession } from './trace.model';
import { interval, Subscription, tap } from 'rxjs';
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
            .pipe(tap(() => {
                if (this.sendSessionfinished) {
                    this.sendSessionfinished = false;
                    this.sendSessions().finally(() => { this.sendSessionfinished = true });
                }
            }))
            .subscribe();
        logInspect('SessionManager initialized');
    }

    newSession(url?: string) {
        if (this.currentSession) {
            this.currentSession.end = dateNow();
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

    sendSessions(): Promise<any> {
        if (this.sessionQueue.length > 0) {
            this.sessionSendAttempts++;
            return this.postInstanceEnv().then((id: string | null) => {
                if (id) {
                    let sessions: MainSession[] = [...this.sessionQueue];
                    this.sessionQueue.splice(0, sessions.length); // add rest of sessions
                    logInspect(`sending sessions, attempts:${this.sessionSendAttempts}, queue size : ${sessions.length}`)
                    return this.putSessions(sessions)
                        .then(ok => {
                            if (ok) {
                                logInspect(`sessions sent successfully, queue size reset, new size is: ${this.sessionQueue.length}`)
                                this.sessionSendAttempts = 0;
                            } else {
                                console.warn(`Error while attempting to send sessions, attempts: ${this.sessionSendAttempts}`)//
                                this.revertQueueSize(sessions);
                            }
                        })
                }
                console.warn(`Error while attempting to send Environement instance, attempts ${this.sessionSendAttempts}`);
                return Promise.reject();
            });
        }
        return Promise.resolve();
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
        if (this.instanceEnvironment.id) {
            return Promise.resolve(this.instanceEnvironment.id)
        }
        return fetch(this.config.instanceApi, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            mode: 'cors',
            body: JSON.stringify(this.instanceEnvironment)
        })
            .then(res => res.ok ? res.text().then(id => {
                this.config.sessionApi = this.config.sessionApi.replace(':id', id);
                logInspect('Environement instance sent successfully');
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
