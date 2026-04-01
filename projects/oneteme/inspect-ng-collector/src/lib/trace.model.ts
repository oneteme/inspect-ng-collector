type InstantType = "SERVER" | "CLIENT";
type MainSessionType = "VIEW" | "BATCH" | "STARTUP";

export type LogLevel = "INFO" | "WARN" | "ERROR" | "REPORT";
export type UUID = `${string}-${string}-${string}-${string}-${string}`;

export enum RequestMask { LOCAL = 1, REST = 4 }

export const TRACE_TYPE_LOG = '00';
export const TRACE_TYPE_RESOURCE_USAGE = '01';
export const TRACE_TYPE_COLLECTOR_CONFIGURATION = '02';
export const TRACE_TYPE_SESSION_MASK_UPDATE = '03';
export const TRACE_TYPE_MAIN_SESSION = '10';
export const TRACE_TYPE_MAIN_SESSION_CALLBACK = '11';
export const TRACE_TYPE_LOCAL_REQUEST = '110';
export const TRACE_TYPE_LOCAL_REQUEST_CALLBACK = '111';
export const TRACE_TYPE_REST_REQUEST = '120';
export const TRACE_TYPE_REST_REQUEST_CALLBACK = '121';
export const TRACE_TYPE_HTTP_REQUEST_STAGE = '220';
export const TRACE_TYPE_USER_ACTION = '300';

export type TraceType =
  | typeof TRACE_TYPE_LOG
  | typeof TRACE_TYPE_RESOURCE_USAGE
  | typeof TRACE_TYPE_COLLECTOR_CONFIGURATION
  | typeof TRACE_TYPE_SESSION_MASK_UPDATE
  | typeof TRACE_TYPE_MAIN_SESSION
  | typeof TRACE_TYPE_MAIN_SESSION_CALLBACK
  | typeof TRACE_TYPE_LOCAL_REQUEST
  | typeof TRACE_TYPE_LOCAL_REQUEST_CALLBACK
  | typeof TRACE_TYPE_REST_REQUEST
  | typeof TRACE_TYPE_REST_REQUEST_CALLBACK
  | typeof TRACE_TYPE_HTTP_REQUEST_STAGE
  | typeof TRACE_TYPE_USER_ACTION;

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
}

export interface EventTrace { }

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
  exception?: ExceptionInfo; // make a list ?
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
  exception?: ExceptionInfo;
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
  exception?: ExceptionInfo;//TODO add id & exception .. - DONE
}

export interface ExceptionInfo {
  type?: string;
  message?: string;
}

export interface UserAction extends EventTrace {
  '@type': typeof TRACE_TYPE_USER_ACTION;
  type: string;
  instant: number; //todo  rename  instant - DONE
  name: string | null;
  nodeName: string;
  sessionId: string;
}

export interface LogEntry extends EventTrace {
  '@type': typeof TRACE_TYPE_LOG;
  instant: number;
  level: LogLevel;
  message: string;
  sessionId?: UUID;
}

export interface MachineResource extends EventTrace {
  maxHeap?: number;
}

export interface MachineRessourceUsage extends EventTrace {
  '@type': typeof TRACE_TYPE_RESOURCE_USAGE;
  instant: number;
  commitedHeap: number;
  usedHeap: number;
}

export const genericMap: ((t: HTMLElement) => string | null)[] = [
  t => t.getAttribute('placeholder'),
  t => t.getAttribute('title'),
  t => t.innerText,
  t => t.getAttribute('name'),
  t => t.getAttribute('id'),
]

export const MAP: { [key: string]: ((t: HTMLElement) => string | null)[] } = {
  'img': [
    t => t.getAttribute('alt'),
    t => t.getAttribute('src'),
  ],
  'input': [
    t => t.getAttribute('name'),
  ],
  'a': [
    t => t.getAttribute('href'),
  ],
  'label': [
    t => t.getAttribute('for'),
  ],
}

