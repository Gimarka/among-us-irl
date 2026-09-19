# Among Us IRL

A real-life version of Among Us for 4–6 players in one house. See `CLAUDE.md` and
`docs/` for the full design and roadmap.

## Project layout
- `server/` — Node.js + Socket.IO game server (the referee: state, timers, roles, votes).
- `client/` — Phone web app, plain HTML/CSS/JS with Vite.

## Run it locally

Terminal 1 — start the server:
```
cd server
npm install
npm start
```

Terminal 2 — start the client:
```
cd client
npm install
npm run dev
```

Open the client URL Vite prints (usually http://localhost:5173) in two browser tabs,
enter a name in each, and tap "Rejoindre". Both tabs should show both names.

## Run the tests
```
cd server
npm test
```
