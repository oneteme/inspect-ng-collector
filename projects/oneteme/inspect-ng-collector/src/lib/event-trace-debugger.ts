import {
  EventTrace,
  HttpRequestStage,
  LocalRequest,
  LogEntry, MachineRessourceUsage,
  MainSession,
  RestRequest,
  UserAction
} from "./trace.model";
import {createReport, DISPATCH} from "./util";
import {ContextManager} from "./context-manager";
import {SessionManager} from "./session-manager.service";
const WIN:any = window;

export function eventTraceDebugger(){
  EventTraceDebugger._instance = new EventTraceDebugger();
}

export class EventTraceDebugger{

  static _instance: EventTraceDebugger;
  restRequests: RestRequest[] = [];
  httpRequestStages: HttpRequestStage[] = [];
  localRequests: LocalRequest[] = [];
  userActions: UserAction[] = [];
  logEntries: LogEntry[] = [];
  constructor() {
    try {
      if (ContextManager.instance.techConfig.debugMode || WIN['inspect']) {
        window.addEventListener(DISPATCH,  this.handleTraces.bind(this))
      }
      WIN["inspect-setup"] =  {
        init:() => {
          WIN['inspect'] = true;
          EventTraceDebugger.init();
        },
        printConfig: () => console.log(ContextManager.instance.techConfig),
        printInstance: () => console.log(ContextManager.instance)
      }
    } catch (e) {
      console.warn(e)
      window.dispatchEvent(new CustomEvent(DISPATCH, {detail: {traces: createReport("Error while setting up debug mode: " + JSON.stringify(e))}}));
    }
  }

  handleTraces(e: Event){
    let trace = (e as CustomEvent).detail.traces
    if(trace && !(e as CustomEvent).detail.force){
      switch (trace['@type']){
        case 'main-ses':
          if(trace.end){
            console.log(this.prettySessionFormat(SessionManager.instance.currentSession));
          }
          break;
        case 'http-req':
          this.restRequests.push(trace);
          break;
        case 'http-stg':
          this.httpRequestStages.push(trace);
          break;
        case 'user-act':
          this.userActions.push(trace);
          break;
        case 'locl-req':
          this.localRequests.push(trace);
          break;
        case 'log':
          trace.sessionId ? this.logEntries.push(trace) : console.warn(this.prettyLogEntryFormat(trace));
          break;
        case 'rsrc-usg':
          console.log(this.prettyMachineResourceUsageFormat(trace))
          break;
      }
    }
  }

  static init(){
    return EventTraceDebugger._instance = new EventTraceDebugger();
  }

  prettySessionFormat(session: MainSession){
    let s= `[${session.name}]`;
    if(session.user){
      s+= `<${session.user}>`
    }
    if(session.location){
      s+= `(${session.location}) `
    }
    s+= this.prettyDurationFormat(session.start, session.end)+'\n';
    s+= this.getChildPrint(this.restRequests, this.prettyRestRequestFormat.bind(this));
    s+= this.getChildPrint(this.localRequests, this.prettyLocalRequestFormat.bind(this));
    s+= this.getChildPrint(this.userActions, this.prettyActionUserFormat.bind(this));
    s+= this.getChildPrint(this.logEntries, this.prettyLogEntryFormat.bind(this))
    this.resetList()
    return s;
  }

   prettyRestRequestFormat(rest: RestRequest){
    let s = `  -  [${rest.method}]`
    if(rest.protocol){
      s+= `${rest.protocol}://`
    }
    if(rest.host){
      s+= rest.host
    }
    if(rest.port > 0){
      s+= `:${rest.port}`
    }
    if(rest.path){
      if(!rest.path.startsWith("/") && !s.endsWith("/")){
        s+= '/'
      }
      s+= rest.path;
    }
    if(rest.query){
      s+= rest.query
    }
    s+= ` >> ${rest.status} `
    s+= this.prettyDurationFormat(rest.start,rest.end)+'\n';
    this.httpRequestStages.filter((s)=>s.requestId == rest.id).forEach((stage:HttpRequestStage) => {
      s+= this.prettyHttpRequestStageFormat(stage)  ;
    })
    return s;
  }
  prettyHttpRequestStageFormat(stage: HttpRequestStage){
    let s = `         -  [${stage.name}]`
    s+= " >> ";
    if(stage.exception?.type){
      s+= ` ${stage.exception?.type}:`;
    }
    if(stage.exception?.message){
      s+= ` ${stage.exception.message}`;
    }
    s+= ` ${this.prettyDurationFormat(stage.start, stage.end)}`;
    return s;
  }

   prettyLocalRequestFormat(local: LocalRequest){
    let s = `  -  [${local.name}]`;
    if(local.location){
      s+= `(${local.location})`
    }
     s+= " >> ";
    if(local.exception?.type){
      s+= ` ${local.exception?.type}:`;
    }
    if(local.exception?.message){
      s+= ` ${local.exception.message}`
    }
    s+= ` ${this.prettyDurationFormat(local.start, local.end)}`;
    return s;
  }

  prettyLogEntryFormat(log: LogEntry){
    let s = `  -  [${log.level}]`;
    if(log.message){
      s+= ` ${log.message}`
    }
    s+= ` >> ${new Date(log.instant*1000).toISOString()}`;
    return s;
  }

  prettyMachineResourceUsageFormat(resource: MachineRessourceUsage){
    return `  -  [METRIC] heap :${resource.usedHeap.toFixed(2)}/${resource.commitedHeap.toFixed(2)} >> ${new Date(resource.instant*1000).toISOString()}`;
  }



  prettyActionUserFormat(userAction:UserAction){
    let s = `  -  `
    if(userAction.type){
      s+= `[${userAction.type}]`;
    }

    if(userAction.nodeName){
      s+= `<${userAction.nodeName}>`
    }

    if(userAction.name){
      s+= `(${userAction.name}) `
    }

    s+=  ` >> ${new Date(userAction.start*1000).toISOString()}`
    return s;
  }

  getChildPrint(o: any[], print: (r:any) => string){
    let s="";
    if(o.length){
      o = o.filter((r) => {
        if (r.sessionId === SessionManager.instance.currentSessionID()) {
          s += print(r) + '\n';
          return false;
        }
        return true;
      });
      const remainingRequests = o.map((r) => print(r)).join('\n');
      if(remainingRequests){
        console.warn(remainingRequests);
      }
    }
    return s;
  }

   prettyDurationFormat(start:number,end:number|undefined){
    return  start && end ? `(in ${ (end - start).toFixed(2) } s)` : '';
  }

  resetList(){
    this.restRequests = [];
    this.httpRequestStages = [];
    this.localRequests = [];
    this.userActions = [];
  }





}
