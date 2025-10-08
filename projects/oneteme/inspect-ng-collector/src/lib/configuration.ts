const SLASH = '/';
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

export interface TechnicalConf {
  user?: string;
  queueCapacity: number;
  delayIfPending: number
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


