
import { dateNow, dispatchTraces, dispatchReport, WIN } from './util';
import { ContextManager } from "./context-manager";
import { MainSession, MainSessionCallBack, RequestMask, SessionMaskUpdate } from "./trace.model";
import { getStringOrCall } from "./configuration";

export class SessionManager {
  
  private static _instance: SessionManager;

  currentSession?: MainSession;
  currentSessionCallBack?: MainSessionCallBack;
  initialized: boolean = false;

  static get instance(): SessionManager {
    if (!SessionManager._instance) {
      SessionManager._instance = new SessionManager();
      WIN["inspect-session-manager"] = SessionManager._instance;
    }
    return SessionManager._instance;
  }

  navigate(url?: string) {
    const now = dateNow();
    this.endSession(now);
    if (url) {
      this.initialized = true;
      const id = crypto.randomUUID();
      this.currentSession = {
        '@type': '10',
        id: id,
        type: "VIEW",
        user: getStringOrCall(ContextManager.instance.techConfig.user),
        start: now,
        location: url,
        requestMask: 0,
      };
      this.currentSessionCallBack = {
        '@type': '11',
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
      this.currentSession.name = document.title;
      this.currentSession.location = document.URL;
      if (!ContextManager.instance.techConfig.exclude?.some((e: any) => e.test(this.currentSession?.location))) {
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
    var req = this.getCurrentSessionCallBack(s=>{
      if ((s.requestMask & mask) !== mask) {
        s.requestMask &= mask;
        dispatchTraces({
          "@type": '03',
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
    var req = this.getCurrentSessionCallBack(s=> ({sessionId:s.id}));
    return req || {};
  }
  
  addException(exception: any) {
    this.getCurrentSessionCallBack(s => s.exception = exception)
  }
}