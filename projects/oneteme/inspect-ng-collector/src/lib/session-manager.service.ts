
import {createReport, dateNow, DISPATCH, WIN} from './util';
import {ContextManager} from "./context-manager";
import {MainSession} from "./trace.model";

export class SessionManager {

    currentSession!: any
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
            s.end = dateNow();
            window.dispatchEvent(new CustomEvent( DISPATCH, { detail : { force: !url } }));
          }
          this.currentSession = null
        })

        if (url) {
            this.currentSession = {
                '@type': "main-ses",
                id: crypto.randomUUID(),
                user: ContextManager.instance.techConfig.user,
                start: dateNow(),
                type: "VIEW",
                location: url,
                loading: true,
                exceptions: [],
                requestsMask: 0,
                end: null
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

  currentSessionID(): string | undefined { // (s) => {}
    return this.getCurrentSession(s=> s.id );
    }

    updateMask(requestMask: number) {
       this.getCurrentSession(s => s.requestsMask |= requestMask)
    }

    addException(exception: any) {
        this.getCurrentSession(s => s.exceptions.push(exception))
    }
}



