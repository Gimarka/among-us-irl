# Les Fiches de la Compagnie: project notes

> Memory of the project. Read this first in every session.
> **Status: planning done (one question left, §9). No code yet.** Next: create the
> GitHub repo `fiches-jdr` and the accounts (§8).
>
> Note: this file temporarily lives in the `among-us-irl` repo (the only repo attached to
> the session where the project started). It will move to its own repository at step 0.

---

## 1. Goal

**Les Fiches de la Compagnie** is a small website. The players of my tabletop RPG
campaign log in **on their phone** to see their **character sheet**. I (the game
master, "MJ") have an **admin page** to edit characters and to add items, skills,
weapons, and so on. **Every change is recorded in a history** so I can see what was used,
when, and by whom.

- Users: 1 game master (admin) + about 5 players.
- Language: **French UI** (the game is played in France). Code and docs in English.
- Cost: **100% free**. No credit card, no paid plan.
- Look: tabletop medieval-fantasy feel (parchment, ink, serif titles), light theme with
  a **dark mode switch**. **Ease of use comes first**: readable on a phone at the table,
  big touch targets, no clutter.

## 2. Game rules the app must know

- **d100 system.** A modifier like `p+15` means "roll target +15", `p-10` means "roll
  target −10".
- **5 characteristics, the same for every character:** Physique, Mental, Social,
  Agilité, Charisme.
- **Skills are mostly tied to one characteristic** (for example Intimidation → Charisme).
  When they are, the app shows the final target (Charisme 45 + 15 = **60**). The link
  is optional: a skill without a characteristic just shows its modifier.
- **PV**: current / max, shown as a **health bar**.
- **Money**: PA (pièces d'argent) and PO (pièces d'or). 1000 PA = 1 PO, but the app
  does **not** convert automatically: PA and PO are two separate amounts.
- **Level**: just a number. It changes nothing automatically.

## 3. The example sheet (CARMEN DELERANVRI)

| Block | Content in the example | Fields |
|---|---|---|
| Identity | Carmen Deleranvri, Age 23, Taille 1m75, Niveau 1 | name, age, height, level |
| Characteristics | PHYSIQUE 70, MENTAL 40, SOCIAL 55, AGILITE 50, CHARISME 45 | 5 numbers |
| Health | PV 90 | current PV / max PV |
| Description | Free text background | long text |
| Compétences | Intimidation p+15; Cri de ralliement "+5 au prochain jet de chaque joueur (1 seule fois par combat)"; Œil d'aigle "Voit de loin" p+15; Sang froid "Résiste au stress" P+5 | icon, name, description, modifier, linked characteristic |
| Incompétences | Berserk "Doublement de sa puissance, perte de contrôle"; Naïveté "Se laisse facilement bernée" p-10; Superstitieuse | icon, name, description, modifier, linked characteristic |
| Vêtements / Armure | Armure légère p+10; Fourrure de renard; Amulette sacrée +10 en chance | icon, name, effect / modifier |
| Armes | Hâche à 2 mains 12+1D6; Bouclier p-10; Couteau de poche 2+1D6 | icon, name, damage formula or modifier |
| Inventaire | ¼ de saucisson ×1, guitare mal accordée ×1, torche ×2, potion d'hilarité ×1 | icon, name, quantity |
| Money | 440 PA | PA / PO |

The 5 sections (Compétences, Incompétences, Vêtements/Armure, Armes, Inventaire) are
**fixed for now**.

## 4. Features

### Player side (phone first)
- Log in with a **username only, no password** (trust basis). Stay logged in on the phone.
- See their own character sheet, organised in clear sections (tabs or collapsible
  blocks).
- **Health bar** for PV at the top of the sheet. The player can **change their current
  PV** (damage, healing). Max PV is changed by the GM only.
- Every item and skill shows a **small icon**.
- Can **view the other characters** of the party: everything, read-only, except the
  hidden notes.
- Can **remove an item they used** (or lower its quantity: torche ×2 → ×1), with an
  optional short note. Can **undo** their own removal if it was a mistake.
- Can **not** edit anything else (names, stats, descriptions, items...).
- **Print / PDF**: a button makes a **single-page PDF** of the sheet to download or print.
- Live updates: when the GM gives an item or changes PV, the phone updates without
  reloading.
- Light / dark mode switch.

### Admin side (GM)
- Designed **for a laptop first** (wide screen, tables, keyboard). It should still work
  on a phone in an emergency, but that is not the priority.
- Protected by a **password** (unlike the player side).
- Manage players (usernames) and characters (create, edit). No archive / death
  feature: characters don't die in this campaign.
- **Catalogue**: a library of reusable entries (skills, incompetences, armour, weapons,
  items...), each with an icon, defined once and then given to any character.
  **Editing a catalogue entry updates it on every character who has it.**
  It is still possible to add a one-off custom entry directly on a sheet.
- **Hidden notes**, never sent to players:
  - one notes field per character;
  - one hidden note per item / skill (the player sees "Amulette sacrée", the GM also
    sees "maudite").
- Edit any field of any sheet. Quick actions for use at the table: ±PV, ±money,
  give or remove an item, change a quantity.
- **Game sessions**: the GM clicks "Commencer la séance" at the start of a game. All
  changes until "Terminer la séance" are grouped under it ("Séance 3 – 12/10").
- **History page**: every change with date, author (GM or player), character, what changed
  (old value → new value), optional note, session. Filters by character, session, type.
  The GM can restore a removed item from the history.
- Print / PDF of any sheet, same as players.

### History ("historisation"), how it should work
- Every change to a sheet produces one history line. Nothing is ever really deleted:
  removed items are marked as removed, so the history stays complete.
- History lines are written **by the database itself** (a trigger), not by the web page.
  That way no change can escape the history, whatever screen made it.

### Icons
- Source: **game-icons.net**. More than 4,000 free fantasy/RPG icons (swords, potions,
  torches, shields...), single-colour SVG, so they match both light and dark themes.
- Licence CC BY 3.0: free, but we must credit the authors (a small "Crédits" page).
- The GM picks the icon with a **search box** when creating a catalogue entry. Each
  section has a default icon, so an entry without a chosen icon still looks fine.

### Single-page PDF
- Generated **in the browser** (no server, free), with a PDF library.
- **Black & white** (ink-saving), same fonts and icons as the site.
- Always **one A4 page**. If a sheet has many items, the text gets smaller to fit.
- Contains: identity, characteristics, PV, money, all 5 sections with icons,
  description. **Never** hidden notes, and not the history.

## 5. Technical solution (all free)

| Need | Choice | Why |
|---|---|---|
| Code storage | **GitHub** (new repo, e.g. `fiches-jdr`) | Free, already used, Claude Code works with it |
| Database + login + live updates | **Supabase** (free plan) | Real database (Postgres), built-in login, live updates, triggers for the history, and a web dashboard that works as an emergency admin. No credit card |
| Website hosting | **Cloudflare Pages** (or Netlify) | Free, HTTPS, automatic deploy on every push, a preview URL per branch for testing on phones |
| Front-end | Plain HTML/CSS/JS with **Vite** (same as the Among Us IRL project) | Easy to read for a beginner, no framework to learn |
| Fonts | Google Fonts (e.g. *Cinzel* for titles, *EB Garamond* or *Crimson Pro* for text) | Free |
| Icons | game-icons.net (SVG) | Free, with credit |
| PDF | Browser-side PDF library (e.g. pdfmake or jsPDF, chosen at that step) | Free, works on phones |

Free plan limits are far above what 6 users need (Supabase: 500 MB database, 50,000
monthly users).

**Known catch:** a free Supabase project is **paused after 7 days without activity**.
The data is kept, and it is restarted with one click in the dashboard, but a player
opening the site before a game would see an error. Fix: a free scheduled GitHub Action
that pings the database every few days so it never sleeps.

**Alternative if we want zero pausing risk:** Cloudflare Pages + Cloudflare D1
(SQLite) + Workers. Also free and never paused, but we would have to build login and
live updates ourselves, so more code and more things that can break. Not chosen for v1.

## 6. Data model (draft)

- `profiles`: one per user. Username, role `admin` or `player`.
- `characters`: name, age, height, level, 5 characteristics, PV current / max, PA, PO,
  description, owner (player).
- `catalog_entries`: reusable library. Section (`competence`, `incompetence`,
  `armure`, `arme`, `objet`), icon, name, description, modifier, damage formula,
  linked characteristic (optional), hidden GM note.
- `character_entries`: what a character has. Link to a catalogue entry **or** custom
  fields (same as catalogue), quantity, `removed_at` / `removed_by`.
- `gm_notes`: hidden notes per character, in a separate table players can never read.
  (Hidden notes on catalogue entries are also kept out of what players can read.)
- `game_sessions`: number, date, started / ended.
- `history`: who, when, character, what (table + field), old value, new value, note,
  session.

Security rules (enforced by the database, not only by the page):
- A player can read every character (read-only), but never any hidden note.
- On **their own** character, a player can only: change current PV, remove / decrease /
  restore (undo, any time) items. Nothing else.
- Only the admin can edit sheets and the catalogue.
- Nobody can edit or delete history lines.

Note on "username without password": anyone who knows the site address and a username
can open that player's sheet. Accepted (trust basis). The **admin access is protected by
a password**, otherwise anyone could open the admin page and read the hidden notes.

## 7. Plan of action

Each step ends with something you can open and test on a phone before the next one starts.

0. **Prerequisites & decisions.** Create the accounts and repo (see §8 below), answer the
   last questions, freeze the data model.
1. **Database.** Supabase project, tables, security rules, history trigger. Load Carmen's
   sheet as test data.
2. **Player sheet, read-only.** Login by username and Carmen's sheet on a phone, with the
   health bar and computed targets. Deployed on Cloudflare Pages. Basic styling.
3. **Admin, characters.** Password login, list characters, edit every field, create
   players and characters, hidden notes.
4. **Admin, catalogue & icons.** Create entries with the icon picker, give them to
   characters, quantities, custom entries.
5. **Player actions.** Change PV, remove a used item / lower its quantity, undo, with
   optional note.
6. **History & sessions.** Start / end a session, history page with filters, restore.
7. **Single-page PDF.**
8. **Medieval look & polish.** Light / dark theme, empty states, French error messages,
   credits page.
9. **Real test** with the players at a game, then fixes.
10. Later / optional: dice roller (d100, 1D6...), private player notes, offline mode,
    custom sections.

## 8. Prerequisites (what you need to do)

| # | What | Cost | Notes |
|---|---|---|---|
| 1 | GitHub account | Free | You already have one (`gimarka`) |
| 2 | New GitHub repository for this project (e.g. `fiches-jdr`, private is fine) | Free | Then add it to Claude Code so I can work in it |
| 3 | Supabase account (sign up with GitHub) | Free | No credit card |
| 4 | Cloudflare account (sign up, then connect GitHub in Pages) | Free | Or Netlify, same idea |
| 5 | The players' usernames | – | No emails needed |
| 6 | The other character sheets (Word/PDF) | – | To load the real data |
| – | Domain name | Not needed | Free address like `fiches-jdr.pages.dev` |
| – | Node.js on your computer | Optional | Only if you want to run the site locally; deploy previews are enough |

## 9. Open questions

1. PV limits: can current PV go **below 0** (e.g. −10 = dying) and/or **above max**
   (temporary bonus)? The health bar needs to know how to show it.

## 10. Decision log

| Date | Decision |
|---|---|
| 2026-10-10 | Project started. No code until the plan and prerequisites are agreed. |
| 2026-10-10 | Game uses a d100. `p+15` means the roll target +15. |
| 2026-10-10 | PV shown as a health bar (current / max). |
| 2026-10-10 | Players can remove items they used (or lower the quantity). |
| 2026-10-10 | Player login: username only, no password (trust basis). Admin keeps a password. |
| 2026-10-10 | Players can view other characters, read-only: everything except hidden notes. |
| 2026-10-10 | GM hidden notes, per character and per item/skill. |
| 2026-10-10 | Admin page is designed for laptop first. |
| 2026-10-10 | Skills are mostly tied to one characteristic (optional link); app shows final target. |
| 2026-10-10 | Same 5 characteristics for every character. |
| 2026-10-10 | Currency: PA and PO, 1000 PA = 1 PO. |
| 2026-10-10 | Level is just a number. |
| 2026-10-10 | Both players and GM can change current PV. |
| 2026-10-10 | Editing a catalogue entry updates it on every character who has it. |
| 2026-10-10 | Players can undo their own item removals. |
| 2026-10-10 | History grouped by game session. |
| 2026-10-10 | The 5 sheet sections are fixed for now. |
| 2026-10-10 | No shared table password. |
| 2026-10-10 | No portraits. Every item and skill has a small icon (game-icons.net). |
| 2026-10-10 | Light theme + dark mode switch. |
| 2026-10-10 | Site name: "Les Fiches de la Compagnie". |
| 2026-10-10 | Single-page PDF export of a sheet, for printing. |
| 2026-10-10 | Money: PA and PO kept as two separate amounts, no automatic conversion. |
| 2026-10-10 | Max PV changed by the GM only; players change current PV. |
| 2026-10-10 | Players can undo their own removals at any time. |
| 2026-10-10 | PDF is black & white. |
| 2026-10-10 | No dead characters, so no archive feature. |
| 2026-10-10 | Stack validated: GitHub + Supabase + Cloudflare Pages + Vite/plain JS. |
