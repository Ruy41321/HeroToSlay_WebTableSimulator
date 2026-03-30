# Prompt 05 - Nuovo tipo MainHero e MainHeroDeck in alto a destra

Agisci direttamente sul progetto HeroToSlay e implementa la feature end-to-end con modifiche reali ai file e test.

## Obiettivo funzionale

1. Aggiungi un nuovo tipo di carte MainHero, con asset in /Assets/Cards/MainHeroes.
2. Aggiungi un MainHeroDeck in alto a destra del tavolo centrale.
3. Dal MainHeroDeck deve essere possibile:
   - visualizzare liberamente l intera pila;
   - scegliere una carta specifica;
   - prendere la carta scelta e metterla nel proprio campo attivo (board), non in hand.
4. Una carta MainHero presa dal deck deve poter essere anche riposta nel MainHeroDeck.

## Vincoli tecnici

1. Mantieni coerenza con architettura esistente (request_action, approval queue, restricted log).
2. Non rompere le meccaniche esistenti di Hero Deck, Monster Deck, Discard e Active Monsters.
3. Mantieni naming/stile del progetto e fallback sicuri su payload invalidi.

## File probabili da aggiornare

1. Srcs/indexer.js
2. Srcs/cards.json (rigenerato da indexer)
3. Srcs/server/game/GameManager.js
4. Srcs/server/socket/gameHandlers.js
5. Srcs/public/components/GameView.js
6. Srcs/public/components/CenterTable.js
7. Srcs/public/components/CardComponent.js
8. Srcs/public/app.js
9. Srcs/public/style.css
10. test/unit/GameManager.test.js
11. test/integration/game.test.js oppure test/integration/approval.test.js

## Implementazione attesa

1. Estensione indicizzazione carte:
   - in indexer aggiungi folder /Assets/Cards/MainHeroes con type: mainhero;
   - mantieni id univoci e ordinati;
   - rigenera cards.json includendo le nuove carte.

2. Stato server:
   - in GameManager aggiungi mainHeroDeck nello state iniziale;
   - in startGame separa anche le carte type === mainhero;
   - crea il deck MainHero e inizializzalo nello stato.

3. Nuove azioni restricted:
   - TAKE_MAIN_HERO_TO_BOARD: prende una carta specifica dal mainHeroDeck e la mette in board del requester;
   - RETURN_MAIN_HERO_TO_DECK: ripone una carta MainHero dalla board del requester al fondo del mainHeroDeck.

4. Regole mutazione carte:
   - quando una MainHero va in board: ownerId = requester.id, isFaceUp = true;
   - quando viene riposta nel deck: ownerId = null, isFaceUp = false;
   - se cardId e mancante/non valido: nessuna mutazione.

5. Logging e descrizione azioni:
   - aggiungi i nuovi action type ai supportedActionTypes;
   - aggiorna describeAction;
   - assicurati che le azioni compaiano nel restricted action history.

6. UI MainHeroDeck:
   - mostra MainHeroDeck in alto a destra del blocco center-table;
   - right click su MainHeroDeck apre menu con View full pile;
   - dalla modal della pila MainHero l utente puo prendere una carta specifica con azione restricted TAKE_MAIN_HERO_TO_BOARD.

7. Azione di riposta:
   - su carta propria in board, se card.type === mainhero, aggiungi opzione context menu Return to MainHero Deck;
   - l azione invia request_action con RETURN_MAIN_HERO_TO_DECK e cardId.

8. Compatibilita visuale carte:
   - in CardComponent gestisci type mainhero coerentemente con il rendering;
   - se non esiste un retro dedicato, usa fallback sicuro (es. retro hero).

## Casi limite da coprire

1. MainHeroDeck vuoto: nessun crash, UI coerente.
2. Card non trovata nel deck o in board: nessuna mutazione.
3. Richiesta durante approval pendente: comportamento invariato (blocco globale gia esistente).
4. Spectator non puo eseguire azioni restricted.

## Test richiesti

1. Unit test GameManager:
   - TAKE_MAIN_HERO_TO_BOARD sposta la carta scelta da mainHeroDeck a board;
   - RETURN_MAIN_HERO_TO_DECK sposta la carta MainHero da board al fondo del mainHeroDeck;
   - verifica ownerId/isFaceUp in entrambi i passaggi;
   - verifica no-op su cardId invalido.

2. Integration test socket:
   - flow con Approval Mode ON: request_action + approve -> stato aggiornato correttamente;
   - almeno un controllo con Approval Mode OFF per esecuzione immediata.

3. Esegui test rilevanti da Srcs/package.json e correggi eventuali regressioni.

## Criteri di accettazione

1. Le carte MainHero vengono indicizzate da /Assets/Cards/MainHeroes e presenti in cards.json.
2. Il MainHeroDeck e visibile in alto a destra del centro tavolo.
3. Si puo visualizzare la pila MainHero completa e prendere una carta specifica.
4. La carta presa va in board (attiva), non in hand.
5. La carta MainHero puo essere riposta nel MainHeroDeck.
6. Le nuove azioni compaiono nel restricted action history.
7. Nessuna regressione sulle feature esistenti, test verdi.

## Output finale richiesto

1. Spiegazione breve delle scelte implementative.
2. Elenco test eseguiti e risultato.
