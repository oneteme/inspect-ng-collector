import { dateNow, initDebug } from "./util";
const SLASH = '/';
const HOST_PATERN = /https?:\/\/[\w\-.]+(:\d{2,5})?\/?/;
const PATH_PATERN = /[\w-]+(\/[\w-]+)*/;
export interface ApplicationConf {
  host?: string;
  name?: string | (() => string);
  version?: string | (() => string);
  env?: string | (() => string);
  user?: string | (() => string);
  bufferMaxSize?: number | (() => number);
  delay?: number| (() => number);
  instanceApi?: string | (() => string);
  sessionApi?: string | (() => string);
  exclude?: RegExp[] | (() => RegExp[]);
  debug?: {app: boolean, user: boolean};
  enabled?: boolean;
}

export interface TechnicalConf {
  user: () => string ;
  bufferMaxSize: number;
  delay: number;
  instanceApi: string;
  sessionApi: string;
  exclude: RegExp[];
  debug: {app: boolean, user: boolean};
  enabled: boolean;
}

export function validateAndGetConfig(conf:any):TechnicalConf{
  let host = matchRegex(getStringOrCall(conf.host), "host" , HOST_PATERN)
  let sessionApi =   matchRegex(getStringOrCall(conf.sessionApi),"sessionApi", PATH_PATERN, "v3/trace/instance/:id/session")
  let instanceApi =  matchRegex(getStringOrCall(conf.instanceApi),"intanceApi", PATH_PATERN, "v3/trace/instance")
  initDebug(conf.debug ?? {app: false, user: false});
  return  {
    user : typeof conf.user  == 'function' ? conf.user : ()=> conf.user,
    bufferMaxSize:  requirePostitiveValue(getNumberOrCall(conf.bufferMaxSize),"bufferMaxSize", 1000) ,
    delay: requirePostitiveValue(getNumberOrCall(conf.delay),"delay", 60000),
    instanceApi: sessionApiURL(host, instanceApi),
    sessionApi: instanceApiURL(host, sessionApi),
    exclude: getRegArrOrCall(conf.exclude) || [],
    debug: conf.debug ?? {app: false, user: false},
    enabled: conf.enabled ?? false
  }
}

export function GetInstanceEnvironement(conf:ApplicationConf){
  return {
    name: require(getStringOrCall(conf.name), 'name'),
    version: getStringOrCall(conf.version),
    address: undefined, //server side
    env: require(getStringOrCall(conf.env),'env'),
    os: detectOs(),
    re: detectBrowser(),
    user: undefined, // cannot get user
    type: "CLIENT",
    instant: dateNow(),
    collector: "inspect-ng-collector-0.0.1"
  }
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
          case agent.indexOf('edg') > -1:
              return 'Edge';
          case agent.indexOf('opr') > -1:
              return 'Opera';
          case agent.indexOf('chrome') > -1:
              return 'Chrome';
          case agent.indexOf('firefox') > -1:
              return 'Firefox';
          case agent.indexOf('safari') > -1:
              return 'Safari';
          case agent.indexOf('msie') > -1:
            return 'Microsoft Internet Explorer';
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

function instanceApiURL(host:string, path:string){
  return  toURL(host,path);
}

function sessionApiURL(host:string, path:string){
  return  toURL(host,path);
}

function toURL(host:string, path:string ){
   return host.endsWith(SLASH) || path.startsWith(SLASH) ? host + path : [host,path].join(SLASH);
}

export function matchRegex(v: string | undefined,  name: string, pattern: RegExp, defaultValue?: string) {
  if(v && pattern.exec(v)){
     return v;
  }
  if(!defaultValue){
    if(v != undefined){
      throw new Error(`bad value ${name}=${v}, pattern=${pattern}`);
    }else {
      throw new Error(`${name} property is required`);
    }
  }
  return defaultValue;
}

export function requirePostitiveValue(v: number | undefined, name: string, defaultValue:number){
  if(v && v > 0) {
    return v;
  }
  if(v == undefined){
    return defaultValue;
  }
  throw new Error(`bad value ${name}=${v} <= 0`);
}

export function require(v: string | undefined, name: string){
  if(v!= undefined){
    return v;
  }
  throw new Error(`${name} property is required`);
}


