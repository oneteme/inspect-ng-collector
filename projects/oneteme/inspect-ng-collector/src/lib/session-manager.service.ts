
import {createReport, dateNow, DISPATCH, WIN} from './util';
import {ContextManager} from "./context-manager";
import {MainSession, MainSessionCallBack} from "./trace.model";

export class SessionManager {

    currentSession!: any
    currentSessionCallBack!: MainSessionCallBack;
    private static _instance: SessionManager;

    static get instance(): SessionManager{
        if(!SessionManager._instance) {
            SessionManager._instance = new SessionManager();
            WIN["inspect-session-manager"] = SessionManager._instance;
        }
        return SessionManager._instance;
    }

    navigate(url?: string) {
        this.getCurrentSession(s => {
          if(s){
            this.getCurrentSessionCallBack(cb => cb.end =dateNow())
            window.dispatchEvent(new CustomEvent( DISPATCH, { detail : { force: !url, traces :  this.currentSessionCallBack } }));
          }
          this.currentSession = null
        })
        if (url) {
            let id = crypto.randomUUID()
            this.currentSession = {
                '@type': "10",
                id: id,
                user: ContextManager.instance.techConfig.user,
                start: dateNow(),
                type: "VIEW",
                location: url,
                loading: true,
                requestMask: 0,
            }
            this.currentSessionCallBack = {
              '@type': "11",
               id: id,
               requestMask: 0,
            }
        }
    }

    updateSession(){
      this.getCurrentSession(s => {
            s.name = document.title;
            s.location = document.URL;
            if(!ContextManager.instance.techConfig.exclude?.some((e:any) => e.test(s.location))){
              window.dispatchEvent(new CustomEvent( DISPATCH, { detail : { traces :  s } }));
            }
        });
    }

    getCurrentSession( fn:(s:MainSession)=> any ) {
      if(this.currentSession){
        return fn(this.currentSession);
      }
      window.dispatchEvent(new CustomEvent( DISPATCH, { detail :  { traces : createReport("no active session found ") } }));
      return undefined
    }

    getCurrentSessionCallBack( fn:(s:MainSessionCallBack)=> any ) {
      if(this.currentSessionCallBack){
        return fn(this.currentSessionCallBack);
      }
      window.dispatchEvent(new CustomEvent( DISPATCH, { detail :  { traces : createReport("no active session found ") } }));
      return undefined;
    }

    currentSessionID(): string | undefined { // (s) => {}
       return this.getCurrentSession(s=> s.id );
    }

    updateMask(requestMask: number) {
       return  this.getCurrentSessionCallBack(s => {
         let before = s.requestMask;
         s.requestMask |= requestMask
         return s.requestMask !== before;
       })
    }

    addException(exception: any) {
        this.getCurrentSessionCallBack(s => s.exception = exception)
    }
}



