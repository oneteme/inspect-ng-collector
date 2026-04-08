import { dispatchTraces, dispatchReport, WIN, dispatchLog } from './event-bus';
import {
  dateNow,
  LogLevel,
  MainSession,
  MainSessionCallBack,
  RequestMask,
  SessionMaskUpdate,
  TRACE_TYPE_MAIN_SESSION,
  TRACE_TYPE_MAIN_SESSION_CALLBACK,
  TRACE_TYPE_SESSION_MASK_UPDATE
} from "./trace.model";
import {getOrCall, TechnicalConf} from "./configuration";

export class SessionManager {

   static _instance: SessionManager;
   constructor(private readonly _techConfig: TechnicalConf) {
   }

  currentSession?: MainSession;
  currentSessionCallBack?: MainSessionCallBack;

  static get instance(): SessionManager {
    return SessionManager._instance;
  }

  navigate(url?: string) {
    const now = dateNow();
    this.endSession(now);
    if (url) {
      const id = crypto.randomUUID();
      this.currentSession = {
        '@type': TRACE_TYPE_MAIN_SESSION,
        id: id,
        type: "VIEW",
        user: getOrCall<string>(this._techConfig.user),
        start: now,
        location: url,
        requestMask: 0,
      };
      this.currentSessionCallBack = {
        '@type': TRACE_TYPE_MAIN_SESSION_CALLBACK,
        id: id,
        requestMask: 0,
      }
    }
  }

  private endSession(end : number){
    this.getCurrentSessionCallBack(call =>{
      call.end = end;
      dispatchTraces(call);
    });
    this.currentSessionCallBack = undefined;
  }

  updateSession() {
    if (this.currentSession) {
      this.currentSession.name = document.title; // add settimeout
      this.currentSession.location = document.URL;
      if (!this._techConfig.exclude?.some((e: any) => e.test(this.currentSession?.location))) {
        dispatchTraces(this.currentSession)
      }
      this.currentSession = undefined;
    }
    else{
      dispatchReport('updateSession', 'no active session');
    }
  }

  getCurrentSessionCallBack(fn: (s: MainSessionCallBack) => any) {
    if (this.currentSessionCallBack) {
      return fn(this.currentSessionCallBack);
    }
    dispatchReport('getCurrentSessionCallBack', 'no active session');
    return undefined;
  }

  currentSessionID(): string | undefined {
    return this.getCurrentSessionCallBack(s=> s.id);
  }

  initRestRequest(mask: RequestMask){
    const req = this.getCurrentSessionCallBack(s=>{
      if ((s.requestMask & mask) !== mask) {
        s.requestMask |= mask;
        dispatchTraces({
          "@type": TRACE_TYPE_SESSION_MASK_UPDATE,
          id: s.id,
          main: true,
          mask: s.requestMask
        } as SessionMaskUpdate);
      }
      return {sessionId:s.id};
    });
    return req || {};
  }

  initUserAction(){
    const req = this.getCurrentSessionCallBack(s=> ({sessionId:s.id}));
    return req || {};
  }

  addException(exception: any) {
    this.getCurrentSessionCallBack(s => s.exception = exception)
  }

  info(message: string) {
    this.log("INFO", message);
  }

  warn(message: string) {
    this.log("WARN", message);
  }

  error(message: string) {
    this.log("ERROR", message);
  }

  private log(level: LogLevel, message: string){
    if (message) {
      this.getCurrentSessionCallBack(s=> dispatchLog(level, message, s.id));
    }
  }
}

export function sessionlogger(): SessionManager {
  return SessionManager.instance;
}

export function sessionManager(tech: TechnicalConf){
  SessionManager._instance = new SessionManager(tech);
  WIN["inspect-session-manager"] = SessionManager._instance;
}
