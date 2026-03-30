# Azione Activate e inversione hand/board

Agisci direttamente sul progetto HeroToSlay e implementa questa feature end-to-end, facendo modifiche reali ai file, senza fermarti al piano.

## Obiettivo funzionale

1. Aggiungi una nuova azione contestuale chiamata Activate sulle carte del giocatore locale in hand.
2. Activate deve spostare la carta selezionata da hand a board.
3. Aggiungi l'azione inversa sulle carte del giocatore locale in board, chiamata Return to hand (o etichetta equivalente chiara), che sposta la carta da board a hand.
4. Inverti la posizione visiva delle due zone del player: hand piu vicina al bordo dello schermo, board piu vicina al centro tavolo.
5. Mantieni invariato il comportamento delle carte avversarie e dei spectator (nessuna azione extra non autorizzata).

## Vincoli tecnici

1. Riusa il sistema esistente di menu contestuale e request_action.
2. Mantieni la compatibilita con la logica approvazioni gia presente.
3. Non introdurre regressioni su flip, discard, draw, take monster, take from opponent.
4. Mantieni stile e naming coerenti con il progetto.

## File probabili da aggiornare

1. Srcs/public/components/GameView.js
2. Srcs/public/components/PlayerZone.js
3. Srcs/public/style.css
4. Srcs/server/game/GameManager.js
5. Srcs/server/socket/gameHandlers.js

## Implementazione attesa

1. Introduci un nuovo action type server-side (esempio: ACTIVATE_CARD) che muove una carta specifica da hand a board del requester.
2. Introduci un action type inverso (esempio: RETURN_CARD_TO_HAND) che muove una carta specifica da board a hand.
3. Gestisci cardId in payload, con fallback sicuro se non trovato.
4. Nel context menu:
   - Se zone = hand e carta propria: mostra Activate oltre alle opzioni gia esistenti.
   - Se zone = board e carta propria: mostra Return to hand oltre alle opzioni gia esistenti.
5. Invia le nuove request_action dal client con payload coerente.
6. Inverti l'ordine visuale hand/board in PlayerZone e/o CSS in modo consistente per top/left/right/bottom, garantendo che per il player locale hand resti verso il bordo e board verso il centro.

## Test richiesti

1. Aggiorna o aggiungi unit test su GameManager per i due nuovi action type e movimenti tra zone.
2. Aggiungi almeno un test integrazione socket per verificare che request_action produca il movimento corretto.
3. Esegui i test con gli script npm disponibili in Srcs/package.json e correggi eventuali rotture collegate alla modifica.

## Criteri di accettazione

1. Right click su carta propria in hand mostra Activate e, dopo l'azione, la carta appare in board.
2. Right click su carta propria in board mostra azione inversa e, dopo l'azione, la carta torna in hand.
3. Disposizione visiva invertita: hand piu esterna, board piu centrale.
4. Test unit e integrazione verdi.

## Output finale richiesto

1. Elenco sintetico dei file modificati.
2. Spiegazione breve delle scelte implementative.
3. Elenco test eseguiti e risultato.
