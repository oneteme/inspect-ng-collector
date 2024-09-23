
## Installation 
```sh
$ npm i @oneteme/inspect-ng-collector
```
  
## Utilisation 
Tout d'abord, importer le **NgCollectorModule** dans le module de votre application.

```ts
// app.module.ts
import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { NgCollectorModule } from '@oneteme/inspect-ng-collector';
import { environment } from 'src/environments/environment';
import { AppComponent } from './app.component';

@NgModule({
  declarations: [
    AppComponent,
    //... autres composants
  ],
  imports: [
    BrowserModule,
    NgCollectorModule.forRoot(environment.application),
    //... autres modules
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule{} 
```
## Configuration 
La bibliothèque nécessite certaines configurations pour fonctionner correctement. ces configurations doivent être fournies lors de l'initialisation du module.

```ts
// app.module.ts
export const environment = {

    application: {
        host: `https://backend-url.fr`,
        name: "ihm-name",
        version: "0.0.0",
        env: 'dev/rec...',
        user: () => '',
        instanceApi: 'v3/trace/instance', // instance endpoint
        sessionApi: 'v3/trace/instance/:id/session', // sessions endpoint
        exclude:  [/scope/], // routes to exclude
        delay : 60000,  // trace frequency
        bufferMaxSize: 1000, // maximum number of sessions
        debug: true, // enable debug mode
        enabled: false
    }
};
```

## Référence API

| Request                                                | Description        |     | Valeur par défaut | 
|--------------------------------------------------------|--------------|----|----|
| enabled                                                | **boolean**       |  obligatoire  |  false  | 
| host                                                   | **string**   |  obligatoire  |  null  |
| name                                                   | **string\|(()=>string)** |  obligatoire  |  null  | 
| env                                                    | **string\|(()=>string)** | obligatoire| null |
| instanceApi                                            | **string\|(()=>string)** |  obligatoire  |  null | 
| sessionApi                                             | **string\|(()=>string)**   | obligatoire   |  null  | 
| exclude                                                | **RegExp[]\|(()=>RegExp[])** | optionnel   |  []  | 
| delay                                                  | **number \|(()=>number )** | optionnel   |  60000ms  | 
| bufferMaxSize                                          | **number \|(()=>number )**   |  optionnel  |  1000  | 
| debug                                                  | **boolean**  |  optionnel  |  false  | 
| version                                                | **string\|(()=>string)**  |  optionnel  |  null  | 
| user                                                   | **string\|(()=>string)**   | optionnel   |  null  | 

