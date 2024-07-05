import { Injectable, OnDestroy  } from '@angular/core';
import { InstanceEnvironment, MainSession } from './trace.model';
import { BehaviorSubject, from, interval, Observable, of, Subscription, tap } from 'rxjs';
import { dateNow, detectBrowser, detectOs, getNumberOrCall, getStringOrCall, logTraceapi } from './util';

const SLASH = '/';

@Injectable({ providedIn: 'root' })
export class SessionManager implements OnDestroy {

    logServerMain!: string;
    logInstanceEnv!: string;
    maxBufferSize!: number;
    delay!:number
    instanceEnvironment !: InstanceEnvironment;
    scheduledSessionSender!: Subscription;
    sessionQueue: MainSession[]= [];
    sessionSendAttempts: number = 0
    InstanceEnvSendAttempts: number = 0;
    instance!: BehaviorSubject<string>;
    sendSessionfinished:boolean= true;
    sendInstanceEnvFinished: boolean = true;
    constructor(){

    }


    initialize(config:any, host:string) {
        this.logServerMain = this.sessionApiURL(host,getStringOrCall(config.sessionApi)!);
        this.logInstanceEnv = this.instanceApiURL(host,getStringOrCall(config.instanceApi)!);
        this.maxBufferSize =  getNumberOrCall(config.bufferMaxSize) ?? 1000;
        this.delay = getNumberOrCall(config.delay) ?? 60000;
        this.instanceEnvironment = {
            name: getStringOrCall(config.name),
            version: getStringOrCall(config.version),
            address: undefined, //server side
            env: getStringOrCall(config.env),
            os: detectOs(),
            re: detectBrowser(),
            user: undefined, // cannot get user
            type: "CLIENT",
            instant: dateNow(),
            collector: "inspect-ng-collector-0.0.1"
        }

        this.scheduledSessionSender = interval(this.delay)
        .pipe(tap(()=> {
            if(this.sendSessionfinished){
                this.sendSessions();
            }}))
        .subscribe();
    }

    addSessions(sessions:MainSession){
        this.sessionQueue.push(sessions);
        logTraceapi('log',"added element to session queue, new size is: "+ this.sessionQueue.length);
    }


    sendSessions() {
        if(this.sessionQueue.length> 0){
            this.getInsertedInstanceId().subscribe((id:string|null)=>{
                if(id) {
                    this.sendSessionfinished = false;
                    let sessions: MainSession[] = [...this.sessionQueue];
                    this.sessionQueue.splice(0,sessions.length); // add rest of sessions
                    logTraceapi('log',`sending sessions, attempts:${++this.sessionSendAttempts}, queue size : ${sessions.length}`)

                    const requestOptions = {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        },
                        body: JSON.stringify(sessions)
                    };

                    fetch(this.logServerMain, requestOptions)
                    .then(data=> {
                        if(data.ok){
                            logTraceapi('log','sessions sent successfully, queue size reset, new size is: '+this.sessionQueue.length)
                            this.sessionSendAttempts= 0;
                        }else{
                            logTraceapi('warn',`Error while attempting to send sessions, attempts: ${this.sessionSendAttempts}`)//
                            this.revertQueueSize(sessions);
                        }
                    })
                    .catch(error => {
                        logTraceapi('warn',`Error while attempting to send sessions, attempts: ${this.sessionSendAttempts}`)//
                        logTraceapi('warn',error)
                        this.revertQueueSize(sessions);
                    }).finally( ()=> {
                        this.sendSessionfinished = true;
                    })

                }else {
                    logTraceapi('warn',`Error while attempting to send Environement instance, attempts ${this.sessionSendAttempts}`);
                }
            })
        }
    }

    revertQueueSize(sessions: MainSession[]){
        this.sessionQueue.unshift(...sessions);
        if(this.sessionQueue.length > this.maxBufferSize ){
            let diff = this.sessionQueue.length - this.maxBufferSize;
            this.sessionQueue = this.sessionQueue.slice(0,this.maxBufferSize);
            logTraceapi('log','Buffer size exeeded the max size,last sessions have been removed from buffer, (number of sessions removed):'+diff)
        }
    }

    getInsertedInstanceId() : Observable<any> {
        if(this.instance){
            return this.instance;
        }
        if(this.sendInstanceEnvFinished){
            this.sendInstanceEnvFinished = false;
            const requestOptions = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*' // retest
                },
                body: JSON.stringify(this.instanceEnvironment)
            };
            this.sessionSendAttempts++;
            return from( fetch(this.logInstanceEnv,requestOptions)
            .then(res => res.ok ? res.text().then(id=> {
                this.instance = new BehaviorSubject<string>(id);
                this.logServerMain =this.logServerMain.replace(':id',id);
                this.sessionSendAttempts=0;
                logTraceapi('log','Environement instance sent successfully');
                return id; // return logserverMain
            }) : null)
            .catch(err => {
                logTraceapi('warn',err)
                return null;
            }).finally(()=> {
                this.sendInstanceEnvFinished = true;
            }))
        }
        return of(null);
    }

    instanceApiURL(host:string, path:string){
        return  this.toURL(host,path);
     }

     sessionApiURL(host:string, path:string){
        return  this.toURL(host,path);
     }

     toURL( host:string,  path:string ){
         return host.endsWith(SLASH) || path.startsWith(SLASH) ? host + path : [host,path].join(SLASH);
     }

     ngOnDestroy(): void {
        if(this.scheduledSessionSender){
            this.scheduledSessionSender.unsubscribe();
        }
    }
}
