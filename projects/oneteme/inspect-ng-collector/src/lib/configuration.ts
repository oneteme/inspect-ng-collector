import { TRACE_TYPE_COLLECTOR_CONFIGURATION } from "./trace.model";

type Provider<T> = T | (()=>T);

const SLASH = '/';
const HOST_PATERN = /https?:\/\/[\w\-.]+(:\d{2,5})?\/?/;

export interface CollectorConfig {
  enabled?: boolean; // default: false
  debugMode?: boolean;
  scheduling?: {
    interval?: number; // default: '60s'
  };
  monitoring?: {
    httpRoute?: {
      excludes?: {
        path?: Provider<RegExp[]>; // replace this with string[]
      };
    };
    httpRequest?: {
      excludes?: {
        host?: string[];
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
    name: Provider<string>;
    version?: Provider<string>;
    env?: Provider<string>;
    user?: Provider<string>;
    additionalProperties: ()=> {[key:string]: any};
  };
  tracing?: {
    queueCapacity?: number; // default: 10000
    remote?: {
      '@type'?: string;
      mode?: string; // default: null
      host?: string; // default: 'localhost'
      retentionMaxAge?: number; // default: '30'
    };
  };
}

export interface TechnicalConf {
  user?: Provider<string>;
  queueCapacity: number;
  interval: number;
  instanceApi: string;
  sessionApi: string;
  exclude?: RegExp[];
  hostExcludes?: string[];
  debugMode: boolean;
  analytics: boolean;
  resources: boolean;
  storage: boolean;
  enabled: boolean;
}

export function getNumberOrCall(o?: Provider<number>): number | undefined {
  return typeof o === "function" ? o() : o;
}

export function getStringOrCall(o?: Provider<string>): string | undefined {
  return typeof o === "function" ? o() : o;
}

export function getRegArrOrCall(o?: Provider<RegExp[]>): RegExp[] | undefined {
  return typeof o === "function" ? o() : o;
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
    scheduling: {
    ...conf.scheduling,
        interval: conf.scheduling?.interval && conf.scheduling.interval / 1000
    },
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
        path: (conf?.monitoring?.httpRoute?.excludes?.path as RegExp[]).map(r => r.source)
      }
    }
  },
    tracing: {
    ...conf.tracing,
        remote: {
      ...conf.tracing?.remote,
          '@type': TRACE_TYPE_COLLECTOR_CONFIGURATION,
          retentionMaxAge : (conf.tracing?.remote?.retentionMaxAge ?? 10)  * 60 * 60 * 24
      }
    }
  }
}

export function validateAndGetConfig(conf: CollectorConfig, instanceId: string): TechnicalConf {
  let host = matchRegex(getStringOrCall(conf?.tracing?.remote?.host), "host", HOST_PATERN)
  let sessionApi = "v4/trace/instance/:id/session"
  let instanceApi = "v4/trace/instance"
  return {
    user: conf?.monitoring?.user,
    queueCapacity: requirePostitiveValue(getNumberOrCall(conf?.tracing?.queueCapacity), "queueCapacity", 1000),
    interval: requirePostitiveValue(getNumberOrCall(conf?.scheduling?.interval), "interval", 60000),
    instanceApi: toURL(host, instanceApi),
    sessionApi: toURL(host, sessionApi).replace(':id', instanceId),
    exclude: getRegArrOrCall(conf?.monitoring?.httpRoute?.excludes?.path) || [],
    hostExcludes: conf?.monitoring?.httpRequest?.excludes?.host || [],
    debugMode: conf.debugMode ?? false,
    analytics: conf?.monitoring?.analytics?.enabled ?? false,
    resources: conf?.monitoring?.resources?.enabled ?? false,
    storage: conf?.monitoring?.storage?.enabled ?? false,
    enabled: conf.enabled ?? false
  }
}