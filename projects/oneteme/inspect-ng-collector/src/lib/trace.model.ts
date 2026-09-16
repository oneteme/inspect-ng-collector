type InstantType = "SERVER" | "CLIENT";
type MainSessionType = "VIEW" | "BATCH" | "STARTUP";

export type LogLevel = "INFO" | "WARN" | "ERROR" | "REPORT";
export type UUID = `${string}-${string}-${string}-${string}-${string}`;

export enum Mask { LOCAL = 1, REST = 4, EVENT = 1024  }
export const TRACE_TYPE_LOG = '00';
export const TRACE_TYPE_RESOURCE_USAGE = '01';
export const TRACE_TYPE_COLLECTOR_CONFIGURATION = '02';
export const TRACE_TYPE_SESSION_MASK_UPDATE = '03';
export const TRACE_TYPE_EXEPTION = '04';
export const TRACE_TYPE_MAIN_SESSION = '10';
export const TRACE_TYPE_MAIN_SESSION_CALLBACK = '11';
export const TRACE_TYPE_LOCAL_REQUEST = '110';
export const TRACE_TYPE_LOCAL_REQUEST_CALLBACK = '111';
export const TRACE_TYPE_REST_REQUEST = '120';
export const TRACE_TYPE_REST_REQUEST_CALLBACK = '121';
export const TRACE_TYPE_HTTP_REQUEST_STAGE = '220';
export const TRACE_TYPE_SESSION_EVENT = '300';
export const TRACE_TYPE_ADDITIONAL_VALUES = '400';


export function dateNow() {
  return Date.now() / 1_000;
}

export interface InstanceEnvironment {
  id: string;
  name?: string;
  address?: string;
  version?: string;
  env?: string;
  os?: string;
  re?: string;
  user?: string;
  type?: InstantType;
  instant?: number;
  collector?: string;
  resource: MachineResource;
  additionalProperties?: { [key: string]: any };
  configuration?: { [key: string]: any };
  namespace: string;
}

export interface EventTrace { }

export interface BrowserConfig extends EventTrace  {
  '@type': typeof TRACE_TYPE_ADDITIONAL_VALUES
  deviceDisplayResolution?:string
  deviceOrientation?:string;
  deviceConnectivity?:string;
  windowViewportBounds?:string;
  windowZoomLevel?:string;
  userLanguage?:string;
  userTheme?:string;
  navigationReferrer?:string;
}

export interface MainSession extends EventTrace {
  '@type': typeof TRACE_TYPE_MAIN_SESSION;
  id: UUID;
  type: MainSessionType;
  name?: string;
  location: string;
  user?: string;
  start: number;
  requestMask: number;
}

export interface MainSessionCallBack extends EventTrace {
  '@type': typeof TRACE_TYPE_MAIN_SESSION_CALLBACK;
  id: UUID;
  end?: number;
  requestMask: number;
  status?: number;
}

export interface SessionMaskUpdate {
  '@type': typeof TRACE_TYPE_SESSION_MASK_UPDATE;
  id: UUID;
  main: boolean;
  mask: number;
}

export interface RestRequest extends EventTrace {
  '@type': typeof TRACE_TYPE_REST_REQUEST;
  id: UUID;
  method: string;
  protocol: string;
  host: string;
  port: number;
  path: string;
  query: string;
  contentType?: string;
  authScheme?: string;
  dataSize: number;
  user?: string;
  start: number;
  sessionId?: UUID;
}

export interface RestRequestCallBack extends EventTrace {
  '@type': typeof TRACE_TYPE_REST_REQUEST_CALLBACK;
  id: UUID;
  status?: number;
  end?: number;
  dataSize?: number;
  linked?: boolean;
  contentType?: string;
  bodyContent?: string;
}

export interface HttpRequestStage extends EventTrace {
  '@type': typeof TRACE_TYPE_HTTP_REQUEST_STAGE;
  name: string;
  start: number;
  end?: number;
  requestId: string;
}

export interface LocalRequest extends EventTrace {
  '@type': typeof TRACE_TYPE_LOCAL_REQUEST;
  id: UUID;
  name: string;
  location: string;
  user?: string;
  start: number;
  sessionId: UUID;
}

export interface LocalRequestCallBack extends EventTrace {
  '@type': typeof TRACE_TYPE_LOCAL_REQUEST_CALLBACK;
  id: UUID;
  end: number;
  status: number;
}

export interface ExceptionTrace extends EventTrace {
  '@type':  typeof TRACE_TYPE_EXEPTION;
  type?:string;
  message?: string;
  stackTraceRows?: StackTraceRow[];
  //cause?: ExceptionTrace;
  traceId?: UUID;
  offset: number;
}

export interface StackTraceRow extends EventTrace{
  className?: string;
  methodName?: string;
  lineNumber?: number;
}

export interface SessionEvent extends EventTrace {
  '@type': typeof TRACE_TYPE_SESSION_EVENT;
  type: string;
  instant: number;
  value?: string;
  location?: string;
  sessionId?: UUID;
}

export interface LogEntry extends EventTrace {
  '@type': typeof TRACE_TYPE_LOG;
  instant: number;
  message: string;
  stackTraceRows?: StackTraceRow[];
  sessionId?: UUID;
}

export interface MachineResource extends EventTrace {
  maxHeap?: number;
  availableProcessors?: number;
}

export interface MachineRessourceUsage extends EventTrace {
  '@type': typeof TRACE_TYPE_RESOURCE_USAGE;
  instant: number;
  commitedHeap: number;
  usedHeap: number;
}
