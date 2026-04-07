import {dateNow, InstanceEnvironment, TRACE_TYPE_COLLECTOR_CONFIGURATION} from "./trace.model";
import {dispatchReport} from "./event-bus";

type Provider<T> = T | (() => T);

const HOST_PATERN = /https?:\/\/[\w\-.]+(:\d{2,5})?\/?/;

export interface CollectorConfig {
  enabled?: boolean; // default: false
  debugMode?: boolean;
  name: Provider<string>;
  version?: Provider<string>;
  env?: Provider<string>;
  user?: Provider<string>;
  additionalProperties: ()=> {[key:string]: any};
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
  };
  tracing?: {
    queueCapacity?: number; // default: 1000
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

export function getOrCall<T>(o?: Provider<T>): T | undefined {
  return typeof o === "function" ? (o as () => T)() : o;
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
  if(v != undefined){
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
      additionalProperties: String(conf.additionalProperties),
      name: String(conf.name),
      version: String(conf.version),
      env: String(conf.env),
      user: String(conf.user),
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

export function validateAndGetConfig(conf: CollectorConfig, instanceId: string) : TechnicalConf {
  const host = matchRegex(getOrCall<string>(conf?.tracing?.remote?.host), "host", HOST_PATERN);
  return {
    user: conf?.user,
    queueCapacity: requirePostitiveValue(getOrCall<number>(conf?.tracing?.queueCapacity), "queueCapacity", 1000),
    interval: requirePostitiveValue(getOrCall<number>(conf?.scheduling?.interval), "interval", 60000),
    instanceApi: new URL('v4/trace/instance', host).href,
    sessionApi : new URL(`v4/trace/instance/${instanceId}/session`, host).href,
    exclude: getOrCall<RegExp[]>(conf?.monitoring?.httpRoute?.excludes?.path) || [],
    hostExcludes: conf?.monitoring?.httpRequest?.excludes?.host || [],
    debugMode: !!conf.debugMode,
    analytics: !!conf?.monitoring?.analytics?.enabled,
    resources: !!conf?.monitoring?.resources?.enabled,
    storage: !!conf?.monitoring?.storage?.enabled,
    enabled: !!conf.enabled
  }
}

export function createInstance(conf: CollectorConfig, instanceId: string): InstanceEnvironment {
  return {
    id: instanceId,
    instant: dateNow(),
    name: require(getOrCall<string>(conf?.name), 'configuration.name'),
    version: getOrCall<string>(conf?.version),
    address: getClientID(), //server side
    env: require(getOrCall<string>(conf?.env), 'env'),
    os: detectOs(),
    re: detectBrowser(),
    user: undefined, // cannot get user
    type: "CLIENT",
    collector: "inspect-ng-collector-0.0.1",
    resource: { maxHeap: (('memory' in performance) && (performance as any).memory.jsHeapSizeLimit / (1024 * 1024)) || undefined },
    additionalProperties: conf?.additionalProperties(),
    configuration: adaptedConfig(conf)
  }
}

function getClientID() {
  let cid = localStorage.getItem("jarvis.inspect.cid");
  if (!cid) {
    localStorage.setItem("jarvis.inspect.cid", cid = crypto.randomUUID());
  }
  return cid;
}

function detectOs() {

  try {
    throw new Error("fe")
    let versionMatch, version;
    const agent = window.navigator.userAgent.toLowerCase() //TODO see also  https://developer.mozilla.org/en-US/docs/Web/API/Navigator/userAgentData
    switch (true) {
      case (/windows/.test(agent)):
        versionMatch = /windows nt (\d+\.\d+)/.exec(agent);
        version = versionMatch ? versionMatch[1] : '?';
        return `Windows ${version}`;
      case (/linux/.test(agent)):
        return 'Linux';

      case (/macintosh/.test(agent)):
        versionMatch = /mac os x (\d+[._]\d+[._]\d+)/.exec(agent);
        version = versionMatch ? versionMatch[1] : '?';
        return `MacOs ${version}`
    }
  }
  catch (e) {
    dispatchReport("detectOs", e) ;
  }
  return undefined;
}

function detectBrowser() {
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
        return 'IE';
    }
  }
  catch (e) {
    dispatchReport("detectBrowser", e)
  }
  return undefined;
}

export function refreshConfig(tech: TechnicalConf) {
  const newInstanceId = crypto.randomUUID();
  const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  tech.sessionApi = tech.sessionApi.replace(uuidRegex, newInstanceId);
  return newInstanceId;
}

export function refreshInstance(instance: InstanceEnvironment) {
  const newInstanceId = crypto.randomUUID();
  return instance;
}

