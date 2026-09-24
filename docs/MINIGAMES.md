# Mini-games

## Design rules
- 30–60 s each; understood in 3 s; one hand, portrait.
- No fail state: mistakes only cost time.
- Pause on meetings and phone disruption, then resume.
- Eyes stay on the screen: that is what makes crewmates vulnerable.
- Imposters can play the same games as fake tasks; their completion counts for nothing
  but shows as completed on their own screen.

## Task mini-games
Every player (crewmate or imposter) is assigned 6 of these 9 at random each
game, no repeats - see `server/taskState.js`. Code entry, Door unlock and
Emergency fix are never assigned as a personal task; they're the shared
door/event mini-games below instead.

| id | Nom (FR) | What the player does | Length | Room |
| --- | --- | --- | --- | --- |
| wires | Câblage | Drag 4 coloured wires to the matching colour | ~30 s | Garage |
| card-swipe | Carte magnétique | Swipe a card at the right speed; too fast/slow retries | ~30 s | Bedroom 1 |
| download | Téléchargement | Hold a button while a bar fills; releasing pauses it | ~45 s | Garden |
| fuel | Plein d'essence | Hold to fill a tank to the line without overflowing | ~40 s | Bathroom |
| calibrate | Calibrage | Tap when a moving marker crosses the target, 3 times | ~30 s | Bedroom 2 |
| simon | Séquence | Repeat a growing sequence of 4 coloured buttons, 5 steps | ~45 s | Bedroom 2 |
| clean | Nettoyage | Tap 15 dust spots as they appear | ~30 s | Kitchen |
| sort | Tri | Drag 10 items into 3 bins | ~45 s | Kitchen |
| steady-hand | Main stable | Keep a dot inside a drifting circle by dragging it with a finger (no tilt) | ~40 s | Garage |

## Door mini-games
| Mini-game | Nom (FR) | What | Length |
| --- | --- | --- | --- |
| Code entry | Code d'accès | Required to open any of the 3 gated doors (Bathroom, Bedroom 1, Bedroom 2): scan the door QR, then type the 4-digit code shown on screen (digits 0-9 plus * and #, 12-key pad) | ~15 s |

## Special mini-games
| Mini-game | Nom (FR) | When | What | Length |
| --- | --- | --- | --- | --- |
| Emergency fix | Réparation d'urgence | Emergency event | Scan the event room QR, then hold a button until the bar fills. 2-player version: both hold at the same time in two rooms | ~15 s within the 90 s timer |

## In progress / not yet assigned
Prototyped in the client but not yet slotted into a room or the task pool -
reachable only from the "TEST MINIGAMES" test menu for now.

| Mini-game | Nom (FR) | What | Length |
| --- | --- | --- | --- |
| Dino jump | Saute par-dessus | Tap anywhere to jump a circle over boxes (random height and spacing) running at it; clear 12 to win. Placeholder shapes (circle/boxes) until real art exists | Until 12 clears |

Dino jump is the one exception to the "no fail state" design rule above:
touching an obstacle ends the run and restarts it from 0, the same
error-popup-then-retry pattern Code entry uses for a wrong digit.
