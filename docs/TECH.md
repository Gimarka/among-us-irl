# Technical design

## Architecture
Web app on each phone + one small online server that holds the true game state.

```
Phones (browser) <-- WebSocket (Socket.IO) --> Game server (Node.js, online, HTTPS)
Printed QR codes --scanned by phone camera--> phone sends scan to server
```

- The server is the referee: roles, timers, cooldowns, QR scan validation, votes, win detection.
- Online (not a home laptop) because browsers only allow the camera on HTTPS.
- Free tiers are enough for 6 players.

## Stack
| Part | Tool |
| --- | --- |
| Language | JavaScript |
| Phone app | Plain HTML/CSS/JS with Vite |
| Server | Node.js + Socket.IO (rooms + auto-reconnect) |
| QR scanning | html5-qrcode |
| QR printing | Any QR generator; codes contain short IDs |
| Hosting | Free-tier Node host (Render, Railway…) |

UI text in French in `src/texts.fr.js`. Code and comments in English.

## Feature notes
- Secret roles: server sends each phone only its own role (+ partner for imposters).
- Kill is honour-based ("I'm dead" button, hold 2 s); touches cannot be detected.
- Phone disruption: server event; phones overlay a scramble and disable scanning.
- Emergency event 2-player fix: server checks both holds overlap.
- Meeting alerts: sound (enabled by a tap in the lobby), full-screen takeover.

## Risks and mitigations
| Risk | Mitigation |
| --- | --- |
| Screen locks pause the page (missed alerts) | Screen Wake Lock API; auto-reconnect and resume state |
| No vibration on iPhone browsers | Sound + screen; house rule: shout "Meeting!" |
| Wi-Fi in Garage/Garden | Test coverage; mobile data fallback; resume after reconnect |
| Photographed QR codes | Honour rule among friends |
| Battery | ~10–15% per game; fine |
| Traffic inspection | Never send others' roles |

## Roadmap
1. Hello server: two phones join the same room and see each other's names.
2. Roles and lobby: create/join by code, secret roles, colours and avatars.
3. QR tasks: scan a room code, play one mini-game, count progress.
4. Deaths and meetings: "I'm dead", body QR, meetings, voting, win detection. Deploy online. First playtest.
5. Sabotages: door locks, phone disruption, emergency events.
6. Polish: all 10 mini-games, settings, ambient sound, wake lock, reconnect.

## Who does what
- Claude: writes most code, explains it, keeps docs updated, proposes fixes, writes test plans.
- Owner: decisions, runs code on computer and phones, creates accounts and deploys,
  prints/places QR codes, runs playtests, reports bugs (screenshots help).

## Testing
- Claude: automated tests simulating full games with fake players; server tests for
  disconnects and timers; headless browser checks of pages.
- Owner: real phones (camera, iPhone quirks, sound, wake lock), real house (Wi-Fi, walking times).
