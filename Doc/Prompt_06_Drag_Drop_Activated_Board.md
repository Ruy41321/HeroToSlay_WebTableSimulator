# Prompt 06 - Drag and drop libero delle carte attivate sulla board

Agisci direttamente sul progetto HeroToSlay e implementa la feature end-to-end con modifiche reali ai file e test.

## Obiettivo funzionale

1. Le carte presenti nel campo attivato (board) devono essere trascinabili liberamente nello spazio di gioco.
2. L utente deve poter spostare una carta da una posizione all altra della board con drag and drop.
3. La posizione finale deve rimanere persistente nello stato di gioco (non deve resettarsi al prossimo state_update).
4. Gli altri giocatori devono vedere la posizione aggiornata della carta.

## Regole funzionali

1. Le carte sulla board di un giocatore possono essere spostate anche sulle board degli altri giocatori.
2. Le carte degli avversari devono essere trascinabili dal client locale.
3. Lo spostamento non deve passare dal flusso restricted approval (evitare spam di richieste in coda).
4. Non devono rompersi le azioni gia esistenti su board (flip, discard, return to hand, return mainhero, ecc.).
5. Tutti i giocatori non-spectator possono trascinare qualsiasi carta presente sulla board, indipendentemente dall owner.
6. Ogni carta sulla board deve poter essere ruotata di 90 gradi per volta:
   - premendo R mentre si sta trascinando quella carta;
   - tramite azione Rotate nel context/action menu delle carte in board.

## File probabili da aggiornare

1. Srcs/public/components/PlayerZone.js
2. Srcs/public/components/CardComponent.js (solo se serve supporto eventi/stili, altrimenti evita modifiche inutili)
3. Srcs/public/style.css
4. Srcs/public/app.js
5. Srcs/server/socket/gameHandlers.js
6. Srcs/server/game/GameManager.js
7. test/unit/GameManager.test.js
8. test/integration/game.test.js

## Implementazione attesa

1. Modello stato carta su board:
   - aggiungi metadati posizione sulle carte in board (es. boardPosition: { x, y }).

2. Posizionamento iniziale:
   - quando una carta entra in board senza posizione, assegna una posizione default valida (layout a griglia o offset progressivo).

3. Drag and drop client:
   - implementa drag con pointer events (mouse + touch) per robustezza;
   - durante il drag, aggiorna posizione locale fluida;
   - al rilascio invia update posizione al server.
   - durante il drag, intercetta il tasto R e applica rotazione +90 gradi alla carta corrente.

4. Rotazione carte:
   - aggiungi metadato persistente di rotazione (es. boardRotation) sulla carta;
   - normalizza i valori su step di 90 gradi (0, 90, 180, 270);
   - aggiungi azione Rotate nel menu contestuale delle carte in board, disponibile a tutti i non-spectator;
   - la rotazione via tasto R e via menu deve usare lo stesso flusso di persistenza server.

5. Sync server:
   - aggiungi nuovo evento socket dedicato (es. move_board_card) con payload { cardId, x, y };
   - aggiungi evento per rotazione (es. rotate_board_card) oppure estendi move_board_card con rotation;
   - valida requester e gameInProgress, senza vincolo ownership (tranne spectator gia bloccato lato socket);
   - aggiorna posizione nel GameManager e broadcastState.

6. Boundaries:
   - clamp coordinate ai limiti della board (no carte trascinate fuori area visibile).

7. Logging:
   - niente entry in restricted_log per ogni movimento;
   - niente entry in restricted_log per rotazioni;
   - evita spam in event_log per spostamenti/rotazioni frequenti.

## CSS/UI richiesti

1. Trasforma la board in area di gioco posizionabile comune per tutti i giocatori (contenitore position: relative).
2. Le carte in board devono poter essere renderizzate con position: absolute quando hanno boardPosition.
3. Mantieni leggibilita su desktop e mobile.
4. Non rompere rotazioni/zone esistenti degli altri player.

## Casi limite da coprire

1. cardId inesistente: nessuna mutazione.
2. payload coordinate non numeriche: richiesta ignorata.
3. payload rotazione non valido: richiesta ignorata o normalizzata in modo sicuro.
4. pressione ripetuta di R durante drag: rotazione coerente a step di +90.
5. spectator: impossibilitato a muovere o ruotare carte.

## Test richiesti

1. Unit test GameManager:
   - move_board_card aggiorna boardPosition della carta corretta;
   - rotate_board_card (o equivalente) aggiorna boardRotation a step di 90;
   - nessun controllo owner: un non-spectator puo muovere/ruotare qualsiasi carta in board.

2. Integration test socket:
   - client A muove carta in board -> state_update riflette nuova posizione;
   - client B riceve la stessa posizione aggiornata;
   - client B puo muovere o ruotare una carta non sua;
   - spectator non puo muovere o ruotare carte.

3. Esegui test rilevanti via script npm in Srcs/package.json.

## Criteri di accettazione

1. Le carte della board sono trascinabili liberamente nell area board.
2. La posizione resta stabile dopo state_update successivi.
3. Le carte in board si possono ruotare di 90 gradi sia con tasto R durante drag sia con azione Rotate nel menu.
4. Gli altri client vedono le stesse posizioni e rotazioni.
5. Nessuna regressione sulle azioni gia presenti.
6. Test verdi.

## Output finale richiesto

1. Elenco file modificati.
2. Breve spiegazione tecnica delle scelte.
3. Test eseguiti con esito.
