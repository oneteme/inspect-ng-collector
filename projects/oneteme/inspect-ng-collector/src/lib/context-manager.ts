import {dateNow} from "./util";
import {
  adaptedConfig,
  CollectorConfig,
  detectBrowser,
  detectOs, getNumberOrCall, getRegArrOrCall,
  getStringOrCall, matchRegex,
  require, requirePostitiveValue, TechnicalConf
} from "./configuration";
import {InstanceEnvironment} from "./trace.model";
export const SLASH = '/';
export const  HOST_PATERN = /https?:\/\/[\w\-.]+(:\d{2,5})?\/?/;
export class ContextManager {

  private static _instance: ContextManager;

  constructor(   private readonly _instanceEnv: any,
    private readonly _techConfig: any,
 ) {
  }

  get techConfig(): any {
    return this._techConfig;
  }
  get instanceEnv(): any {
    return this._instanceEnv;
  }

  static  get instance(){
    if(!ContextManager._instance){
      console.warn("[Inspect-ng-collecotor] Error while initializing ContextManager");
    }
    return ContextManager._instance;
  }

  static init(conf:CollectorConfig){
      let id = crypto.randomUUID();
      return ContextManager._instance = new ContextManager(ContextManager.createInstance(conf,id),ContextManager.validateAndGetConfig(conf,id));
  }

    static validateAndGetConfig(conf:CollectorConfig, instanceId: string):TechnicalConf{
    let host = matchRegex(getStringOrCall(conf?.tracing?.remote?.host), "host" , HOST_PATERN)
    let sessionApi =   "v4/trace/instance/:id/session"
    let instanceApi =  "v4/trace/instance"

    return  {
      user : getStringOrCall(conf?.monitoring?.user),
      queueCapacity:  requirePostitiveValue(getNumberOrCall(conf?.tracing?.queueCapacity),"queueCapacity", 1000) ,
      interval: requirePostitiveValue(getNumberOrCall(conf?.scheduling?.interval),"interval", 60000),
      delayIfPending: requirePostitiveValue(getNumberOrCall(conf?.tracing?.delayIfPending),"delayIfPending", 30),
      instanceApi: sessionApiURL(host, instanceApi),
      sessionApi: instanceApiURL(host, sessionApi).replace(':id', instanceId),
      exclude: getRegArrOrCall(conf?.monitoring?.httpRoute?.excludes?.path) || [],
      hostExcludes: conf?.monitoring?.httpRequest?.excludes?.host || [],
      debugMode: conf.debugMode ?? false,
      analytics: conf?.monitoring?.analytics?.enabled ?? false,
      resources: conf?.monitoring?.resources?.enabled ?? false,
      storage: conf?.monitoring?.storage?.enabled ?? false,
      enabled: conf.enabled ?? false
    }
  }


  static createInstance(conf:CollectorConfig,instanceId: string): InstanceEnvironment{
      return {
      id: instanceId,
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
      resource:{ maxHeap: (('memory' in performance) && (performance as any).memory.jsHeapSizeLimit / (1024 * 1024)) || undefined},
      additionalProperties: conf?.monitoring?.additionalProperties(),
      configuration: adaptedConfig(conf)
    }
  }
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
