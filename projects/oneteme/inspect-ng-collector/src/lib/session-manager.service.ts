import { Inject, Injectable, OnDestroy  } from '@angular/core';
import { InstanceEnvironment, MainSession } from './trace.model';
import { BehaviorSubject, from, interval, Observable, of, Subscription, tap } from 'rxjs';
import { dateNow,logInspect, prettySessionFormat } from './util';
import { TechnicalConf } from './configuration';


@Injectable({ providedIn: 'root' })
export class SessionManager implements OnDestroy {


    instanceEnvironment : InstanceEnvironment;
    scheduledSessionSender: Subscription;
    sessionQueue: MainSession[]= [];
    sessionSendAttempts: number = 0
    InstanceEnvSendAttempts: number = 0;
    instance!: BehaviorSubject<string>;
    sendSessionfinished:boolean= true;
    sendInstanceEnvFinished: boolean = true;
    

    currentSession!: MainSession;
    config: TechnicalConf;
    constructor(  @Inject('config') config: TechnicalConf,
                  @Inject('instance') instance: InstanceEnvironment){
        this.config = config;
        this.instanceEnvironment = instance;
        this.scheduledSessionSender = interval(config.delay)
        .pipe(tap(()=> {
            if(this.sendSessionfinished){
                this.sendSessions();
            }}))
        .subscribe();
        logInspect('SessionManager initialized');
    }



    addSessions(sessions:MainSession){
        this.sessionQueue.push(sessions);
        logInspect("added element to session queue, new size is: "+ this.sessionQueue.length);
    }


    newSession(url?:string){
        if(this.currentSession){
            this.currentSession.end = dateNow();
            if(this.config.exclude.every((e) => !e.test(this.currentSession.location))){
                this.addSessions(this.currentSession);
            }
            logInspect(()=>prettySessionFormat(this.currentSession));
        }
        if(url){
            this.currentSession = {
                '@type': "main",
                user: this.config.user,
                start: dateNow(),
                type: "VIEW",
                location: url,
                restRequests: []
            }
        }
    }



    sendSessions() {
        if(this.sessionQueue.length> 0){
            this.getInsertedInstanceId().subscribe((id:string|null)=>{
                if(id) {
                    this.sendSessionfinished = false;
                    let sessions: MainSession[] = [...this.sessionQueue];
                    this.sessionQueue.splice(0,sessions.length); // add rest of sessions
                    logInspect(`sending sessions, attempts:${++this.sessionSendAttempts}, queue size : ${sessions.length}`)

                    const requestOptions: RequestInit = {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        mode : 'cors',
                        body: JSON.stringify(sessions)
                    };

                    fetch(this.config.sessionApi, requestOptions)
                    .then(data=> {
                        if(data.ok){
                            logInspect('sessions sent successfully, queue size reset, new size is: '+this.sessionQueue.length)
                            this.sessionSendAttempts= 0;
                        }else{
                            console.warn(`Error while attempting to send sessions, attempts: ${this.sessionSendAttempts}`)//
                            this.revertQueueSize(sessions);
                        }
                    })
                    .catch(error => {
                        console.warn(`Error while attempting to send sessions, attempts: ${this.sessionSendAttempts}`,error)//
                        this.revertQueueSize(sessions);
                    }).finally( ()=> {
                        this.sendSessionfinished = true;
                    })

                }else {
                    console.warn(`Error while attempting to send Environement instance, attempts ${this.sessionSendAttempts}`);
                }
            })
        }
    }

    revertQueueSize(sessions: MainSession[]){
        this.sessionQueue.unshift(...sessions);
        if(this.sessionQueue.length > this.config.bufferMaxSize ){
            let diff = this.sessionQueue.length - this.config.bufferMaxSize;
            this.sessionQueue = this.sessionQueue.slice(0, this.config.bufferMaxSize);
            logInspect('Buffer size exeeded the max size,last sessions have been removed from buffer, (number of sessions removed):'+diff)
        }
    }

    getInsertedInstanceId() : Observable<any> {
        if(this.instance){
            return this.instance;
        }
        if(this.sendInstanceEnvFinished){// move up in send session  ? 
            this.sendInstanceEnvFinished = false;
            const requestOptions: RequestInit = {
                
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                mode: 'cors',
                body: JSON.stringify(this.instanceEnvironment)
            };
            this.sessionSendAttempts++;
            return from( fetch(this.config.instanceApi, requestOptions)
            .then(res => res.ok ? res.text().then(id=> {
                this.instance = new BehaviorSubject<string>(id);
                this.config.sessionApi = this.config.sessionApi .replace(':id',id);
                this.sessionSendAttempts=0;
                logInspect('Environement instance sent successfully');
                return id; 
            }) : null)
            .catch(err => {
                console.warn(err)
                return null;
            }).finally(()=> {
                this.sendInstanceEnvFinished = true;
            }))
        }
        return of(null);
    }

    

     ngOnDestroy(): void {
        if(this.scheduledSessionSender){
            this.scheduledSessionSender.unsubscribe();
        }
    }

    getCurrentSession() {
        return this.currentSession;
    }
}
