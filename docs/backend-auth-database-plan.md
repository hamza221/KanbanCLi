# Backend, Auth, and Database Plan

## Recommendation

Use PostgreSQL with Prisma, keep Express for the backend, and use cookie-based sessions for authentication.

This fits the app better than NoSQL because the data is naturally relational: users own boards, boards have members, boards have columns, columns contain cards, and cards may have GitHub metadata, deadlines, recurring rules, and custom fields. PostgreSQL also supports `jsonb`, so flexible card fields can stay flexible without giving up relational constraints.

## Target Stack

- Runtime: Node.js
- Server: Express
- Database: PostgreSQL
- ORM: Prisma
- Auth: email/password with secure HTTP-only session cookies
- Password hashing: argon2
- Validation: reuse or move the existing Zod schemas into a shared package/module
- Local development: Docker Compose PostgreSQL service

## Core Data Model

### users

- `id`
- `email`
- `name`
- `password_hash`
- `created_at`
- `updated_at`

### sessions

- `id`
- `user_id`
- `expires_at`
- `created_at`

### boards

- `id`
- `owner_id`
- `name`
- `created_at`
- `updated_at`

### board_members

- `board_id`
- `user_id`
- `role`

Roles:

- `owner`
- `editor`
- `viewer`

### columns

- `id`
- `board_id`
- `name`
- `position`

### cards

- `id`
- `board_id`
- `column_id`
- `title`
- `link`
- `link_meta jsonb`
- `deadline`
- `recurring jsonb`
- `custom_fields jsonb`
- `position`
- `created_at`
- `updated_at`

### board_settings

- `board_id`
- `github_status_map jsonb`

## API Plan

### Auth

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`

### Boards

- `GET /api/boards`
- `POST /api/boards`
- `GET /api/boards/:boardId`
- `PATCH /api/boards/:boardId`
- `DELETE /api/boards/:boardId`

### Cards

- `POST /api/boards/:boardId/cards`
- `PATCH /api/cards/:cardId`
- `DELETE /api/cards/:cardId`
- `PATCH /api/boards/:boardId/cards/reorder`

### Settings

- `GET /api/boards/:boardId/settings`
- `PUT /api/boards/:boardId/settings`

### GitHub Sync

- `POST /api/boards/:boardId/github-refresh`

## Migration Strategy

1. Add Prisma and PostgreSQL dependencies to the server workspace.
2. Add a PostgreSQL service to `docker-compose.yml`.
3. Create the first Prisma schema with users, sessions, boards, members, columns, cards, and settings.
4. Add migration scripts and a generated Prisma client.
5. Add auth routes:
   - signup
   - login
   - logout
   - current user
6. Add auth middleware that protects board, card, settings, and GitHub sync routes.
7. Replace file-based board reads and writes in `server/src/index.js` with database queries.
8. Add a one-time importer for the existing `boards/*/config.json`, `cards.json`, and `settings.json` files.
9. Update the frontend API client to use board IDs instead of board names.
10. Keep the current UI features unchanged while switching persistence from JSON files to the database.

## Important Implementation Notes

- Add explicit `position` fields for cards and columns. The current JSON storage preserves order through array order, but the database needs ordering to be stored directly.
- Keep `linkMeta`, `recurring`, `customFields`, and `githubStatusMap` as `jsonb` initially.
- Use HTTP-only cookies for sessions so session tokens are not readable by frontend JavaScript.
- Add permission checks on every board/card/settings route.
- Treat board membership as a first-class model from the start, even if the first UI only exposes personal boards.
- Keep the existing file-based board data until the importer is verified.

## Suggested Milestones

## Implemented First Slice

The first implementation slice uses SQLite through Node's built-in `node:sqlite` driver. This creates a real SQL database without adding package downloads or requiring a local PostgreSQL service during early development.

Runtime default:

- `KANBAN_DB_PATH`, when set, controls the database file path.
- The production server defaults to `data/kanban.db`.
- Docker Compose mounts `/app/data` as a persistent volume.
- Local backend testing uses `http://localhost:3000`.
- Vite development proxies authenticated `/api/auth`, `/api/me`, and `/api/account` requests to `http://localhost:3000`.

Implemented endpoints:

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`
- `GET /api/account/boards`
- `POST /api/account/boards`
- `GET /api/account/boards/:boardId`
- `POST /api/account/boards/:boardId/cards`
- `PATCH /api/account/cards/:cardId`
- `DELETE /api/account/cards/:cardId`
- `GET /api/account/boards/:boardId/settings`
- `PUT /api/account/boards/:boardId/settings`

Implemented tables:

- `users`
- `sessions`
- `boards`
- `board_members`
- `board_columns`
- `cards`
- `board_settings`

Manual smoke verification created:

- 1 user
- 1 session
- 1 board
- 3 columns
- 1 card

The smoke flow used real HTTP requests against the server:

1. `POST /api/auth/signup`
2. `GET /api/me`
3. `POST /api/account/boards`
4. `POST /api/account/boards/:boardId/cards`
5. `GET /api/account/boards/:boardId`
6. `PATCH /api/account/cards/:cardId`
7. `GET /api/account/boards/:boardId`
8. Direct SQLite query to confirm persisted values matched the HTTP response.

Next integration step: connect the frontend to the new authenticated account API while keeping the old file-backed API available as a migration fallback.

## Implemented Frontend Integration Slice

The Vue frontend now uses the authenticated account API.

Implemented frontend changes:

- Added an auth gate with login/signup modes.
- Added `useAuth()` for:
  - auth initialization through `GET /api/me`
  - signup
  - login
  - logout
- Switched `useBoard()` to account-scoped routes:
  - `GET /api/account/boards`
  - `POST /api/account/boards`
  - `GET /api/account/boards/:boardId`
  - `POST /api/account/boards/:boardId/cards`
  - `PATCH /api/account/cards/:cardId`
  - `DELETE /api/account/cards/:cardId`
  - `PUT /api/account/boards/:boardId/cards`
  - `GET /api/account/boards/:boardId/settings`
  - `PUT /api/account/boards/:boardId/settings`
- Kept existing board components unchanged by preserving the old frontend board contract:
  - board selector still receives board names
  - board data still exposes `config.columns`
  - cards still expose `status`
- Added a DB-backed bulk card save endpoint for drag/drop and recurring updates.

Manual integrated smoke verification:

1. Started the server with `KANBAN_DB_PATH=/tmp/clikanban-integrated.db`.
2. Fetched `/` and verified the built frontend was served.
3. Signed up `frontback@example.com`.
4. Created `Integrated Board`.
5. Created `Integrated card`.
6. Used `PUT /api/account/boards/:boardId/cards` to move the card to `Done`.
7. Queried SQLite directly and confirmed the persisted card row matched the HTTP response.

Next integration step: add import/migration from existing file-backed boards into a logged-in account.

### Milestone 1: Database Foundation

- Add PostgreSQL and Prisma.
- Create schema and run the first migration.
- Add a health check endpoint that verifies database connectivity.

### Milestone 2: Authentication

- Add signup/login/logout/current-user routes.
- Add argon2 password hashing.
- Add session cookie creation and validation.
- Add frontend login state handling.

### Milestone 3: Board Persistence

- Replace `GET /api/boards`, `POST /api/boards`, and `GET /api/board` with database-backed routes.
- Preserve current frontend behavior as much as possible.

### Milestone 4: Card Persistence

- Replace card save/update/delete with card-level database routes.
- Add reorder support with explicit card positions.

### Milestone 5: Import Existing Data

- Add a script that imports the current `boards/` folder into the logged-in user's account.
- Verify imported config, cards, settings, custom fields, deadlines, recurring metadata, and GitHub metadata.

### Milestone 6: Permissions and Sharing

- Enforce owner/editor/viewer permissions.
- Add board member support in the backend.
- Add UI for inviting/removing members only after backend enforcement is complete.

## Initial Prisma Shape

```prisma
model User {
  id           String        @id @default(cuid())
  email        String        @unique
  name         String?
  passwordHash String
  sessions     Session[]
  ownedBoards  Board[]       @relation("BoardOwner")
  memberships  BoardMember[]
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())
}

model Board {
  id        String        @id @default(cuid())
  ownerId   String
  owner     User          @relation("BoardOwner", fields: [ownerId], references: [id], onDelete: Cascade)
  name      String
  members   BoardMember[]
  columns   BoardColumn[]
  cards     Card[]
  settings  BoardSettings?
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt
}

model BoardMember {
  boardId String
  userId  String
  role    BoardRole
  board   Board     @relation(fields: [boardId], references: [id], onDelete: Cascade)
  user    User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([boardId, userId])
}

model BoardColumn {
  id       String @id @default(cuid())
  boardId  String
  board    Board  @relation(fields: [boardId], references: [id], onDelete: Cascade)
  name     String
  position Int
  cards    Card[]
}

model Card {
  id           String      @id @default(cuid())
  boardId      String
  columnId     String
  board        Board       @relation(fields: [boardId], references: [id], onDelete: Cascade)
  column       BoardColumn @relation(fields: [columnId], references: [id], onDelete: Cascade)
  title        String
  link         String?
  linkMeta     Json?
  deadline     DateTime?
  recurring    Json?
  customFields Json?
  position     Int
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
}

model BoardSettings {
  boardId         String @id
  board           Board  @relation(fields: [boardId], references: [id], onDelete: Cascade)
  githubStatusMap Json?
}

enum BoardRole {
  owner
  editor
  viewer
}
```
