import {Level, LocalRequest, MainSession, RestRequest, UserAction, LogEntry} from "./trace.model";
import {SessionManager} from "./session-manager.service";

const WIN:any = window;
type level = 'app' | 'user';
export function dateNow() {
    return Date.now() / 1_000;
}

export function initDebug(value: {app: boolean, user: boolean}){
   WIN["inspect"] = { app : value.app, user: value.user };
}

export function logInspect(level: level, ...args: any[]){
  if(WIN["inspect"][level]){
    if(args.length == 1 && typeof args[0] == 'function'){
      args = args[0]();
      if(!Array.isArray(args)){
        args = [args];
      }
    }
    console.log(`[INSPECT]-(${level})`, ...args);
  }
}

export function prettyActionUserFormat(session: MainSession,userAction:UserAction){
  let s = `(${session.location}) `
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

export function prettySessionFormat(session: MainSession){
  let s= `[${session.name}]`;
    if(session.user){
      s+= `<${session.user}>`
    }
    if(session.location){
      s+= `(${session.location}) `
    }
    s+=prettyDurationFormat(session.start, session.end)+'\n';
    //todo : fix below
    /*session.restRequests.forEach(r => {
      s+= prettyRestRequestFormat(r)+'\n';
    })
    session.localRequests.forEach(r => {
      s+= prettyLocalRequestFormat(r)+'\n';
    })*/
  return s;
}

function prettyRestRequestFormat(rest: RestRequest){
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
  //todo : fix below
  /*if(rest.exception?.type){
    s+= ` ${rest.exception?.type}:`;
  }
  if(rest.exception?.message){
    s+= ` ${rest.exception.message}`;
  }*/
  s+= ` >> ${rest.status}`
  s+= prettyDurationFormat(rest.start,rest.end);
  return s;
}

function prettyLocalRequestFormat(local: LocalRequest){
  let s = `  -  [${local.name}]`;
  if(local.location){
    s+= `(${local.location})`
  }
  if(local.exception?.type){
    s+= ` ${local.exception?.type}:`;
  }
  if(local.exception?.message){
    s+= ` ${local.exception.message}`
  }
  s+= ` >> ${prettyDurationFormat(local.start, local.end)}`;
  return s;
}

function prettyDurationFormat(start:number,end:number|undefined){
    return  start && end ? `(in ${ (end - start).toFixed(2) } s)` : '';
}

export function createLogEntry(level: Level, message: string): LogEntry {
  return {
    "@type": "log",
    level: level,
    message: message,
    instant: dateNow(),
//    sessionId :   SessionManager.instance.getCurrentSession()?.id,
    instanceId :   SessionManager.instance.instanceEnvironment.id
  }
}



