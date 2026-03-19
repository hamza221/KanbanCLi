# CLIkanban User Guide

## Installation

```bash
git clone <repo-url> kanban
cd kanban
npm install
```

To make the `kanban` command available globally on your system:

```bash
npm link --workspace=cli
```

This creates a symlink so you can run `kanban` directly from any directory. Without linking, use `npm run cli --` or `node cli/bin/kanban.js` instead.

## Getting Started

### Create Your First Board

```bash
# Interactive (will prompt for name and columns)
kanban board create

# Non-interactive
kanban board create my-project -c "To Do,In Progress,Review,Done"
```

### Add Cards

```bash
# Interactive
kanban card add

# Non-interactive
kanban card add my-project "Implement login page" -s "To Do"

# With a deadline
kanban card add my-project "Fix bug #42" -s "To Do" -d 2026-04-01

# With a link
kanban card add my-project "Auth issue" -s "To Do" -l https://github.com/user/repo/issues/42

# Recurring (resets weekly)
kanban card add my-project "Weekly standup notes" -s "To Do" -r
```

### View Your Board

```bash
kanban board show my-project    # Summary view
kanban card list my-project     # Cards grouped by column
kanban card list my-project -s "In Progress"   # Filter by status
```

### Move Cards

```bash
kanban move my-project <cardId> "Done"
```

### Edit and Remove Cards

```bash
kanban card edit my-project <cardId> -t "Updated title" -s "Review"
kanban card remove my-project <cardId>
```

## Interactive Mode

By default, the CLI runs in **interactive mode** when connected to a terminal (TTY). In this mode, all arguments are optional — the CLI will prompt you to select or enter missing values.

```bash
# These are equivalent in interactive mode:
kanban card add
kanban card add my-project
kanban card add my-project "My card title"
```

To disable interactive mode (for scripts, CI, or agent usage):

```bash
kanban card add my-project "Title" --no-interactive
kanban card add my-project "Title" --ni    # shorthand
```

When interactive mode is disabled, all required arguments must be provided or the command will fail with an error.

## GitHub Integration

CLIkanban can pull metadata from GitHub issues and pull requests using the `gh` CLI.

### Prerequisites

Install and authenticate the [GitHub CLI](https://cli.github.com/):

```bash
gh auth login
```

### Add a Card from GitHub

```bash
kanban card add-gh my-project https://github.com/user/repo/issues/42
```

This creates a card with the issue/PR title and stores metadata (state, labels, milestone, assignees, etc.).

### Refresh Metadata

```bash
kanban card refresh my-project
```

This updates metadata for all cards that have GitHub links.

### Label-to-Column Mapping

You can configure automatic column moves based on GitHub labels:

```bash
# Map the "bug" label to the "To Do" column
kanban settings set-map my-project "bug" "To Do"

# Map "in-progress" to "In Progress"
kanban settings set-map my-project "in-progress" "In Progress"

# View current mappings
kanban settings show my-project

# Remove a mapping
kanban settings remove-map my-project "bug"
```

When you run `kanban card refresh`, cards whose GitHub issues have matching labels will be automatically moved to the mapped column.

## Custom Fields

Boards can define custom fields that appear on every card. Field types: `text`, `number`, `select`, `date`, `boolean`.

Custom fields are defined in the board's `config.json` and can be set when adding or editing cards:

```bash
kanban card add my-project "Task" -f priority=High -f estimate=5
kanban card edit my-project <cardId> -f priority=Low
```

## Recurring Tasks

Mark a card as recurring when creating it:

```bash
kanban card add my-project "Weekly review" -r
```

Process resets (moves recurring cards back to their reset column):

```bash
kanban reset my-project
```

Recurring tasks use a weekly frequency. The `reset` command checks each recurring card's `lastReset` timestamp and moves it back if a week has passed.

## Web UI

Start the development server:

```bash
npm run dev
```

Or build and run the production server:

```bash
npm run build
npm run start
```

The web UI provides:

- **Board selector** — Switch between boards or create new ones
- **Drag-and-drop** — Move cards between columns by dragging
- **Card editor** — Edit title, status, link, deadline, custom fields
- **GitHub refresh** — Button to refresh all GitHub metadata
- **Dark mode** — Toggle via the UI, persisted in localStorage
- **Settings** — Configure GitHub label-to-column mappings

## Data Storage

Board data is stored as JSON files in the `boards/` directory:

```
boards/
└── my-project/
    ├── config.json      # Board name, columns, custom field definitions
    ├── cards.json       # Array of card objects
    └── settings.json    # Board settings (GitHub label mapping)
```

Card IDs are generated with `nanoid(10)`. Deadlines use `YYYY-MM-DD` format. Timestamps use full ISO 8601 strings.

## Command Reference

Run `kanban help` for a full list of commands, or `kanban help <group>` for a specific group:

```bash
kanban help            # All commands
kanban help board      # Board commands only
kanban help card       # Card commands only
kanban help settings   # Settings commands only
```
