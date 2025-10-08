
import {createReport, dateNow, DISPATCH, WIN} from './util';
import {ContextManager} from "./context-manager";

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

    newSession(url?: string) {
        if (this.currentSession) {
            this.currentSession.end = dateNow();
            this.currentSession.name = document.title;
            this.currentSession.location = document.URL;
            if(!ContextManager.instance.techConfig.exclude?.some((e:any) => e.test(this.currentSession.location))){
              window.dispatchEvent(new CustomEvent( DISPATCH, { detail : { traces :  this.currentSession } }));
            }
        }
        if (url) {
            this.currentSession = {
                '@type': "main-ses",
                id: crypto.randomUUID(),
                user: "",
                start: dateNow(),
                type: "VIEW",
                location: url,
                loading: true,
                exceptions: [],
                requestsMask: 0
            }
        window.dispatchEvent(new CustomEvent( DISPATCH, { detail : { traces :  this.currentSession} }));
        }
    }

    currentSessionID(): string | undefined {
      if(this.currentSession){
        return this.currentSession.id;
      }
      window.dispatchEvent(new CustomEvent( DISPATCH, { detail :  { traces : createReport("no active session found ") } }));
      return undefined;
    }

    getCurrentSession() {
        return this.currentSession;
    }

    updateMask(requestMask: number) {
       if(this.currentSession){
          this.currentSession.requestsMask |= requestMask
       }else {
         window.dispatchEvent(new CustomEvent( DISPATCH, { detail :  { traces : createReport("no active session found ") } }));
       }
    }

    addException(exception: any) {
        if (this.currentSession) {
            this.currentSession.exceptions.push(exception);
        }else {
        window.dispatchEvent(new CustomEvent( DISPATCH, { detail :  { traces : createReport("no active session found ") } }));
        }
    }
}



