import { MainSession, RestRequest } from "./trace.model";

let WIN:any = window;
let c:any = console;

export const HOST_PATERN = /https?:\/\/[\w\-\.]+(:\d{2,5})?\/?/;
export const PATH_PATERN = /[\w\-\{\}]+(\/[\w\-\{\}]+)*/;

export function dateNow() {
    return Date.now() / 1_000;
}

export function logInspect(fn:string ,...args: any[]){

  if(WIN["inspect"]){
      if( typeof c[fn] === 'function'){
        c[fn]('[INSPECT]', ...args)
      }
    }
}

export function prettySessionFormat(session: MainSession){
  let s="";
  if(WIN["inspect"]?.debug){
     s  = `[${session.name}]`;
    if(session.user != null){
      s+= `<${session.user}>`
    }
    if(session.location){
      s+= `(${session.location}) `
    }
    s+=prettyDurationFormat(session.start,session.end!);
    session.restRequests.forEach(r => {
      s+= prettyRestRequestFormat(r);
    })
  }
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
    return  start && end ? `(in ${ new Date(end*1000).getTime()- new Date(start*1000).getTime() } ms) \n` : '';
}



export function validate(v: string | undefined, pattern: RegExp) {
   if(v && pattern.exec(v)){
      return true;
   }


   console.warn("bad value=" + v + ", pattern=" + pattern);
   return false;
}

export function requirePostitiveValue(v: number | undefined, name: string){
  if(v == undefined ||  (v && v > 0)) {
    return true;
  }

  console.warn(name +'='+ v + " <= 0");
  return false;
}

export function getNumberOrCall(o?: number | (() => number)): number | undefined {
  return typeof o === "function" ? o() : o;
}

export function getStringOrCall(o?: string | (() => string)): string | undefined {
  return typeof o === "function" ? o() : o;
}

export function getRegArrOrCall(o?: RegExp[] | (() => RegExp[])): RegExp[] | undefined {
  return typeof o === "function" ? o() : o;
}

export function detectBrowser() {
  try {
      const agent = window.navigator.userAgent.toLowerCase()
      switch (true) {
          case agent.indexOf('edge') > -1:
              return 'edge';
          case agent.indexOf('opr') > -1:
              return 'opera';
          case agent.indexOf('chrome') > -1:
              return 'chrome';
          case agent.indexOf('firefox') > -1:
              return 'firefox';
          case agent.indexOf('safari') > -1:
              return 'safari';
      }
  }
  catch (e) {
      console.error(e);
  }
  return undefined;

}

export function detectOs() {
  try {
      let versionMatch, version;
      const agent = window.navigator.userAgent.toLowerCase()
      switch (true) {
          case (/windows/.test(agent)):

              versionMatch = /windows nt (\d+\.\d+)/.exec(agent);
              version = versionMatch ? versionMatch[1] : 'Unknown';
              return `Windows ${version}`;
          case (/linux/.test(agent)):
              return 'Linux';

          case (/macintosh/.test(agent)):
              versionMatch = /mac os x (\d+[._]\d+[._]\d+)/.exec(agent);
              version = versionMatch ? versionMatch[1] : 'Unknown';
              return `MacOs ${version}`
      }
  }
  catch (e) {
      console.error(e);
  }
  return undefined;
}
