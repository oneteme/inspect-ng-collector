import {Inject, Injectable} from "@angular/core";
import {DOCUMENT} from "@angular/common";
import {Element} from "./trace.model";
import {SessionManager} from "./session-manager.service";

@Injectable({
  providedIn: 'root'
})
export class AnalyticsCollector {

  constructor(@Inject(DOCUMENT) private readonly document: Document,
              private readonly sessionManager: SessionManager) {

  }

  subscribeToEvents(){
    const body = this.document.body;
    body.addEventListener('click', (event) => this.clickHandler(event), true);
    //body.addEventListener()
  }



  clickHandler(event: MouseEvent){
    try {
      let tag = Element.createElement(event.target as HTMLElement);
      this.sessionManager.getCurrentSession().userActions.push({
        type: "CLICK",
        start: Date.now(),
        name : tag.extractName(),
      });
    }catch(err){
      console.warn(err);
    }
  }

}
