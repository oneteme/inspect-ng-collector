
import { emitReport, dateNow, DISPATCH, emitTrace, WIN, RequestMask } from './util';
import { ContextManager } from "./context-manager";
import { MainSession, MainSessionCallBack, SessionMaskUpdate } from "./trace.model";
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
    this.endSession(!url);
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
        '@type': "11",
        id: id,
        requestMask: 0,
      }
    }
  }

  private endSession(dispatchNow: boolean){
    const now = dateNow();
    this.getCurrentSessionCallBack(call => call.end = now);
    window.dispatchEvent(new CustomEvent(DISPATCH, { detail: { force: dispatchNow, traces: this.currentSessionCallBack } })); //TODO emiTraces
    this.currentSessionCallBack = undefined;
  }

  updateSession() {
    if (this.currentSession) {
      this.currentSession.name = document.title;
      this.currentSession.location = document.URL;
      if (!ContextManager.instance.techConfig.exclude?.some((e: any) => e.test(this.currentSession?.location))) {
        emitTrace(this.currentSession)
      }
      this.currentSession = undefined;
    }
    else{
      emitReport('updateSession', 'no active session');
    }
  }

  getCurrentSessionCallBack(fn: (s: MainSessionCallBack) => any) {
    if (this.currentSessionCallBack) {
      return fn(this.currentSessionCallBack);
    }
    emitReport('getCurrentSessionCallBack', 'no active session');
    return undefined;
  }

  currentSessionID(): string | undefined {
    return this.getCurrentSessionCallBack(s=> s.id);
  }

  initRestRequest(){
    var req = this.getCurrentSessionCallBack(s=>{
      if ((s.requestMask & RequestMask.REST) !== RequestMask.REST) {
        s.requestMask &= RequestMask.REST;
        emitTrace({
          "@type": "03",
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