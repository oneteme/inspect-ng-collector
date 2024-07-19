import { MainSession, RestRequest } from "./trace.model";

const WIN:any = window;

export function dateNow() {
    return Date.now() / 1_000;
}

export function initDebug(value:boolean){
   WIN["inspect"] = { debug : value };
}

export function logInspect(...args: any[]){
  if(WIN["inspect"]?.debug){
    if(args.length == 1 && typeof args[0] == 'function'){
      args = args[0]();
      if(!Array.isArray(args)){
        args = [args];
      }
    }
    console.log('[INSPECT]', ...args);
  }
}

export function prettySessionFormat(session: MainSession){
  let s= `[${session.name}]`;
    if(session.user){
      s+= `<${session.user}>`
    }
    if(session.location){
      s+= `(${session.location}) `
    }
    s+=prettyDurationFormat(session.start,session.end!)+'\n';
    session.restRequests.forEach(r => {
      s+= prettyRestRequestFormat(r)+'\n';
    })
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
  if(rest.exception?.type){
    s+= ` ${rest.exception?.type}:`;
  }
  if(rest.exception?.message){
    s+= ` ${rest.exception.message}`;
  }
  s+= ` >> ${rest.status}`
  s+= prettyDurationFormat(rest.start,rest.end);
  return s;
}

function prettyDurationFormat(start:number,end:number){
    return  start && end ? `(in ${ (end - start).toFixed(2) } ms)` : '';
}



