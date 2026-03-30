# Prendere una carta a scelta dalla pila scarti (restricted)

Agisci direttamente sul progetto HeroToSlay e implementa la feature end-to-end, facendo modifiche reali ai file e verificando i test.

## Obiettivo funzionale

1. I giocatori devono poter prendere una carta a scelta dalla pila degli scarti.
2. La scelta deve essere realmente specifica (non solo top card), quindi l'utente deve poter selezionare una carta precisa dalla lista completa degli scarti.
3. L'azione deve essere restricted: deve passare dal normale flusso request_action e approval queue quando Approval Mode e ON.
4. Una volta presa, la carta deve finire nella hand del giocatore che ha effettuato l'azione.
5. Spectator e giocatori non validi non devono poter eseguire questa azione.

## Vincoli tecnici

1. Riusa il sistema esistente di request_action, approval queue e restricted_log.
2. Non rompere il comportamento attuale di view_discard e delle altre azioni gia presenti.
3. Mantieni naming e stile coerenti col progetto.
4. Evita logiche duplicate lato client/server.

## File probabili da aggiornare

1. Srcs/public/components/GameView.js
2. Srcs/public/app.js
3. Srcs/server/game/GameManager.js
4. Srcs/server/socket/gameHandlers.js (solo se serve una validazione aggiuntiva)
5. test/unit/GameManager.test.js
6. test/integration/game.test.js oppure test/integration/approval.test.js

## Implementazione attesa

1. Introduci un nuovo action type server-side, ad esempio TAKE_FROM_DISCARD.
2. Nel GameManager:
   - aggiungi TAKE_FROM_DISCARD nei supportedActionTypes;
   - implementa handler dedicato che rimuove dalla discardPile la carta indicata da payload.cardId;
   - se payload.cardId manca o non e valido, definisci fallback sicuro (esempio: nessuna azione o top discard, ma in modo esplicito e testato);
   - imposta ownerId al requester e stato coerente per una carta in hand;
   - inserisci la carta nella hand del requester.
3. Aggiorna describeAction per dettagliare TAKE_FROM_DISCARD nel restricted log.
4. Lato UI:
   - conserva View full pile sul discard;
   - nella modal degli scarti consenti di selezionare una carta specifica e inviare request_action TAKE_FROM_DISCARD con cardId;
   - rendi chiara l'azione utente (esempio: context menu sulla carta della modal, oppure bottone/action visibile per ogni carta).
5. L'azione deve funzionare sia con Approval Mode ON (con approvazione) sia con Approval Mode OFF (esecuzione immediata), seguendo il comportamento gia esistente delle restricted actions.

## Casi limite da coprire

1. Discard vuota: nessuna azione, nessun crash.
2. cardId inesistente: nessuna mutazione stato.
3. Richiesta durante approval pendente: comportamento invariato (gia gestito globalmente).
4. Spectator: azione bloccata.

## Test richiesti

1. Unit test su GameManager:
   - TAKE_FROM_DISCARD sposta la carta scelta da discardPile a hand del requester;
   - verifica che venga rimossa la carta corretta (anche se non e in cima);
   - verifica comportamento su cardId non valido.
2. Integration test socket:
   - flusso con due player e Approval Mode ON: request_action TAKE_FROM_DISCARD + approve => stato aggiornato correttamente;
   - almeno una verifica con Approval Mode OFF per esecuzione immediata.
3. Esegui i test con gli script npm in Srcs/package.json e risolvi eventuali regressioni legate alla feature.

## Criteri di accettazione

1. Da UI e possibile scegliere una carta specifica dalla pila scarti.
2. La carta scelta passa nella hand del player richiedente.
3. L'azione compare nel restricted action history.
4. Nessuna regressione sulle funzionalita esistenti.
5. Test unit e integration verdi.

## Output finale richiesto

1. Elenco sintetico file modificati.
2. Spiegazione breve delle scelte implementative.
3. Test eseguiti con risultato.
