# Among Us IRL — project notes for Claude

Read this first in every session. It is the memory of the project.

## What we are building
A real-life version of Among Us, played in one specific house by 4–6 friends.
Each player's phone runs a web app. Crewmates walk to rooms and scan printed QR codes
to play short mini-games (tasks). Hidden imposters "kill" by touching someone and
sabotage through the app. There is no game master: the app runs the whole game.

Full design is in `docs/`:
- `docs/GAME_RULES.md` — rules, settings, win conditions, decision log (source of truth)
- `docs/SCREENS.md` — every screen, per role
- `docs/MINIGAMES.md` — the 10 mini-games + special mini-games
- `docs/HOUSE_MAP.md` — rooms, doors, QR codes, safety
- `docs/TECH.md` — architecture, stack, risks, roadmap

## Who we are and how we work
- The project owner is a **beginner developer**. Claude writes most of the code.
- Always explain what you did and why, in plain words, after each piece of work.
- Give the owner exact commands to run when they must do something themselves
  (install, deploy, test on phones). One step at a time.
- Work in small steps from the roadmap in `docs/TECH.md`. Each step must be runnable
  and tested before starting the next.
- Design decisions are made in a separate claude.ai project. If a rule seems missing
  or contradictory, ask the owner rather than inventing it. When a decision is made
  here, add it to the decision log in `docs/GAME_RULES.md`.

## Languages
- **Player-facing UI: French.** All UI text lives in `src/texts.fr.js`, never hardcoded.
- Code, comments, commit messages, docs: English.

## Stack (see docs/TECH.md)
- JavaScript everywhere (no TypeScript for now, readability first).
- Phone app: plain HTML/CSS/JS with Vite. No framework.
- Server: Node.js + Socket.IO. The server is the referee: it owns all game state,
  timers, roles, votes. Phones only display and send actions.
- QR scanning: html5-qrcode. Must run over HTTPS (camera requirement).
- Hosting: a free-tier Node host (Render, Railway or similar), chosen at step 4.

## Non-negotiable rules for the code
- Never send a player another player's role (except imposter partners to each other).
- Crewmate and imposter main screens must look identical.
- Every timer runs on the server, never trusted from a phone.
- Phones must survive sleep/disconnect: reconnect and resume the game state.
- Write automated tests for game logic (simulate full games with fake players).

## Current status
Step 1 in progress: server + client skeleton created. Two phones should be able to
join the same room and see each other's names. See `server/` and `client/`.
