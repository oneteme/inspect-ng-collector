import { dateNow, initDebug } from "./util";

const SLASH = '/';
const HOST_PATERN = /https?:\/\/[\w\-.]+(:\d{2,5})?\/?/;
const PATH_PATERN = /[\w-]+(\/[\w-]+)*/;

export interface CollectorConfig {
  enabled?: boolean; // default: false
  debugMode?: boolean;
  scheduling?: {
    interval?: number; // default: '60s'
  };
  monitoring?: {
    httpRoute?: {
      excludes?: {
        path?: RegExp[] | (() => RegExp[]); // replace this with string[]
      };
    };
    resources?: {
      enabled?: boolean; // default: false
    };
    analytics?: {
      enabled?: boolean; // default: false
    };
    storage?: {
      enabled: boolean // default: false
    }
    name: string | (() => string);
    version?: string | (() => string);
    env?: string | (() => string);
    user?: string | (() => string);
    additionalProperties: ()=> {[key:string]: any};
  };
  tracing?: {
    queueCapacity?: number; // default: 10000
    delayIfPending?: number; // default: 30
    remote?: {
      '@type'?: string;
      mode?: string; // default: null
      host?: string; // default: 'localhost'
      retentionMaxAge?: number; // default: '30'
    };
  };
}
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
  analytics?:boolean;
  enabled?: boolean;
}

export interface TechnicalConf {
  user?: string;
  queueCapacity: number;
  delayIfPending: number
  interval: number;
  instanceApi: string;
  sessionApi: string;
  exclude?: RegExp[];
  debugMode: boolean;
  analytics: boolean;
  resources: boolean;
  storage: boolean;
  enabled: boolean;
}

export function validateAndGetConfig(conf:CollectorConfig):TechnicalConf{
  let host = matchRegex(getStringOrCall(conf?.tracing?.remote?.host), "host" , HOST_PATERN)
  let sessionApi =   "v4/trace/instance/:id/session"
  let instanceApi =  "v4/trace/instance"
  initDebug(conf.debugMode? {app: true, user: true} : {app: false, user: false}); // todo fix this to use one bool
   return  {
    user : getStringOrCall(conf?.monitoring?.user),
    queueCapacity:  requirePostitiveValue(getNumberOrCall(conf?.tracing?.queueCapacity),"queueCapacity", 1000) , // queueCapacity increase ?
    interval: requirePostitiveValue(getNumberOrCall(conf?.scheduling?.interval),"interval", 60000),
    delayIfPending: requirePostitiveValue(getNumberOrCall(conf?.tracing?.delayIfPending),"delayIfPending", 30),
    instanceApi: sessionApiURL(host, instanceApi),
    sessionApi: instanceApiURL(host, sessionApi),
    exclude: getRegArrOrCall(conf?.monitoring?.httpRoute?.excludes?.path) || [],
    debugMode: conf.debugMode ?? false,
    analytics: conf?.monitoring?.analytics?.enabled ?? false,
    resources: conf?.monitoring?.resources?.enabled ?? false,
    storage: conf?.monitoring?.storage?.enabled ?? false,
    enabled: conf.enabled ?? false
  }
}

export function GetInstanceEnvironement(conf:CollectorConfig){
  return {
    id: crypto.randomUUID(),
    name: require(getStringOrCall(conf?.monitoring?.name), 'name'),
    version: getStringOrCall(conf?.monitoring?.version),
    address: undefined, //server side
    env: require(getStringOrCall(conf?.monitoring?.env),'env'),
    os: detectOs(),
    re: detectBrowser(),
    user: undefined, // cannot get user
    type: "CLIENT",
    instant: dateNow(),
    collector: "inspect-ng-collector-0.0.1",
    resource:{ maxHeap: ('memory' in performance) && (performance as any).memory.jsHeapSizeLimit / (1024 * 1024)},
    additionalProperties: conf?.monitoring?.additionalProperties(),
    configuration: adaptedConfig(conf)
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

export function adaptedConfig(conf: CollectorConfig) {
  return {
  ...conf,
    monitoring: {
  ...conf.monitoring,
      additionalProperties :String(conf.monitoring?.additionalProperties),
      name: String(conf.monitoring?.name),
      version: String(conf.monitoring?.version),
      env: String(conf.monitoring?.env),
      user: String(conf.monitoring?.user),
      httpRoute: {
    ...conf.monitoring?.httpRoute,
        excludes: {
        path: (conf?.monitoring?.httpRoute?.excludes?.path as RegExp[]).map(r => r.source) // convert to string array to conform to backend expectation
      }
    }
  },
    tracing: {
    ...conf.tracing,
        remote: {
      ...conf.tracing?.remote,
          '@type':"rest-rmt", // add this to conform to backend expectation
      }
    }
  }
}


