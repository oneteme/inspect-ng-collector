import { dateNow } from "./util";
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
  debug?: boolean;
  enabled?: boolean;
}

export interface TechnicalConf {
  user:string ;
  bufferMaxSize: number;
  delay: number;
  instanceApi: string;
  sessionApi: string;
  exclude: RegExp[];
  debug: boolean;
  enabled: boolean;
}

 const validationMap  = { // remove 
  host: { func: matchRegex, args: [HOST_PATERN] },
  bufferMaxSize:  { func: requirePostitiveValue, args: [HOST_PATERN] },
  delay:  { func: matchRegex, args: [HOST_PATERN] },
  instanceApi:  { func: matchRegex, args: [HOST_PATERN] },
  sessionApi:  { func: matchRegex, args: [HOST_PATERN] }
 }

export function setConfig(conf:ApplicationConf){
  return  {
    host: conf.host,
    name: getStringOrCall(conf.name) ?? '',
    version: getStringOrCall(conf.version) ?? '',
    env: getStringOrCall(conf.env)?? '',
    user: getStringOrCall(conf.user) ?? '',
    bufferMaxSize: getNumberOrCall(conf.bufferMaxSize),
    delay: getNumberOrCall(conf.delay),
    instanceApi: getStringOrCall(conf.sessionApi),
    sessionApi: getStringOrCall(conf.instanceApi),
    exclude: getRegArrOrCall(conf.exclude) ?? [], 
    debug: conf?.debug ?? false,
    enabled: conf.enabled || false
  }
 /*
  this.logServerMain = this.sessionApiURL(host,getStringOrCall(config.sessionApi)!);
  this.logInstanceEnv = this.instanceApiURL(host,getStringOrCall(config.instanceApi)!);
  this.maxBufferSize =  getNumberOrCall(config.bufferMaxSize) ?? 1000;
  this.delay = getNumberOrCall(config.delay) ?? 60000;
  */
} 

export function validateAndGetConfig(conf:any):TechnicalConf{
    let host = validateProperty(conf.host, ()=> matchRegex(conf.host, HOST_PATERN) )
    let sessionApi =  validateProperty( conf.sessionApi,()=> matchRegex(conf.sessionApi, PATH_PATERN) )
    let instanceApi = validateProperty( conf.instanceApi,()=> matchRegex(conf.sessionApi, PATH_PATERN))
    return  {
      user : conf.user,
      bufferMaxSize:  validateProperty( conf.delay,()=> requirePostitiveValue(conf.delay,"bufferMaxSize")) ?? 1000,
      delay: validateProperty( conf.delay,()=> requirePostitiveValue(conf.delay,"delay")) ?? 60000,
      instanceApi: sessionApiURL(host, sessionApi),
      sessionApi: instanceApiURL(host, instanceApi),
      exclude: conf.exclude,
      debug: conf.debug,
      enabled: conf.enabled
    }
}

export function validateProperty(value:any, func : (...args:any)=> boolean){
  if(func()){
      return value;
  }
  throw new Error('error') // pass the error return from the the passed function 
}

export function GetInstanceEnvironement(conf:any){
    return {
      name: getStringOrCall(conf.name),
      version: getStringOrCall(conf.version),
      address: undefined, //server side
      env: getStringOrCall(conf.env),
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

function instanceApiURL(host:string, path:string){
  return  toURL(host,path);
}

function sessionApiURL(host:string, path:string){
  return  toURL(host,path);
}

function toURL( host:string,  path:string ){
   return host.endsWith(SLASH) || path.startsWith(SLASH) ? host + path : [host,path].join(SLASH);
}

export function matchRegex(v: string | undefined, pattern: RegExp) {
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

