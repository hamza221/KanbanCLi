import chalk from 'chalk';
import { nanoid } from 'nanoid';
import { formatDistanceToNow, parseISO } from 'date-fns';
import {
  boardExists,
  listBoards,
  readConfig,
  readCards,
  writeCards,
} from '../lib/store.js';
import { validateCustomFields } from '../lib/schema.js';
import { isInteractive, promptIfMissing, selectIfMissing, confirmPrompt } from '../lib/prompt.js';
import { parseGitHubUrl } from '../lib/github.js';

export function registerCardCommands(program) {
  const card = program
    .command('card')
    .description('Manage cards on a board');

  card
    .command('list')
    .description('List cards on a board, grouped by column')
    .argument('[board]', 'Board name')
    .option('-s, --status <status>', 'Filter by column/status')
    .addHelpText('after', `
Examples:
  $ kanban card list my-board
  $ kanban card list my-board -s "In Progress"`)
    .action(async (boardName, opts) => {
      const interactive = isInteractive(program);

      boardName = await promptBoard(boardName, interactive);
      if (!boardName) return;

      if (!(await boardExists(boardName))) {
        console.error(chalk.red(`Board "${boardName}" does not exist.`));
        process.exitCode = 1;
        return;
      }
      const config = await readConfig(boardName);
      let cards = await readCards(boardName);

      // Prompt for status filter if interactive and not provided
      if (!opts.status && interactive && cards.length > 0) {
        const { select } = await import('@inquirer/prompts');
        const filterChoice = await select({
          message: 'Filter by column?',
          choices: [
            { name: 'All columns', value: '' },
            ...config.columns.map((c) => ({ name: c, value: c })),
          ],
        });
        if (filterChoice) opts.status = filterChoice;
      }

      if (opts.status) {
        if (!config.columns.includes(opts.status)) {
          console.error(
            chalk.red(`Unknown column "${opts.status}". Valid: ${config.columns.join(', ')}`)
          );
          process.exitCode = 1;
          return;
        }
        cards = cards.filter((c) => c.status === opts.status);
      }

      if (cards.length === 0) {
        console.log(chalk.yellow('No cards found.'));
        return;
      }

      // Group by column
      for (const col of config.columns) {
        const colCards = cards.filter((c) => c.status === col);
        if (colCards.length === 0) continue;
        console.log(chalk.bold.underline(col));
        for (const c of colCards) {
          const deadlineStr = c.deadline ? chalk.dim(` [${c.deadline}]`) : '';
          const recurring = c.recurring ? chalk.magenta(' ↻') : '';
          const link = c.link ? chalk.dim(' 🔗') : '';
          console.log(`  ${chalk.dim(c.id)} ${formatCardTitle(c)}${deadlineStr}${recurring}${link}`);
        }
        console.log();
      }
    });

  card
    .command('show')
    .description('Show full details of a card')
    .argument('[board]', 'Board name')
    .argument('[cardId]', 'Card ID')
    .action(async (boardName, cardId) => {
      const interactive = isInteractive(program);

      boardName = await promptBoard(boardName, interactive);
      if (!boardName) return;

      if (!(await boardExists(boardName))) {
        console.error(chalk.red(`Board "${boardName}" does not exist.`));
        process.exitCode = 1;
        return;
      }
      const config = await readConfig(boardName);
      const cards = await readCards(boardName);

      // Prompt for card selection if missing
      cardId = await promptCard(cardId, cards, interactive);
      if (!cardId) return;

      const cardItem = cards.find((c) => c.id === cardId);

      if (!cardItem) {
        console.error(chalk.red(`Card "${cardId}" not found.`));
        process.exitCode = 1;
        return;
      }

      console.log(chalk.bold(formatCardTitle(cardItem)));
      console.log(`${chalk.dim('ID:')}       ${cardItem.id}`);
      console.log(`${chalk.dim('Status:')}   ${cardItem.status}`);
      console.log(`${chalk.dim('Created:')}  ${formatDate(cardItem.createdAt)}`);
      console.log(`${chalk.dim('Updated:')}  ${formatDate(cardItem.updatedAt)}`);

      if (cardItem.deadline) {
        console.log(`${chalk.dim('Deadline:')} ${cardItem.deadline}`);
      }
      if (cardItem.link) {
        console.log(`${chalk.dim('Link:')}     ${cardItem.link}`);
      }
      if (cardItem.recurring) {
        console.log(
          `${chalk.dim('Recurring:')} ${cardItem.recurring.frequency} (last reset: ${cardItem.recurring.lastReset || 'never'})`
        );
      }
      if (cardItem.linkMeta) {
        const m = cardItem.linkMeta;
        console.log(`${chalk.dim('GitHub:')}   ${m.owner}/${m.repo}#${m.number} (${m.state || 'unknown'})`);
        if (m.labels?.length) {
          console.log(`${chalk.dim('Labels:')}   ${m.labels.map((l) => l.name).join(', ')}`);
        }
        if (m.milestone) {
          console.log(`${chalk.dim('Milestone:')} ${m.milestone}`);
        }
      }
      if (cardItem.customFields && Object.keys(cardItem.customFields).length > 0) {
        console.log(chalk.dim('Fields:'));
        for (const [key, val] of Object.entries(cardItem.customFields)) {
          const def = config.customFields?.find((f) => f.key === key);
          const label = def?.label || key;
          console.log(`  ${chalk.cyan(label)}: ${val}`);
        }
      }
    });

  card
    .command('add')
    .description('Add a new card to a board')
    .argument('[board]', 'Board name')
    .argument('[title]', 'Card title')
    .option('-s, --status <status>', 'Column/status (default: first column)')
    .option('-l, --link <url>', 'Link URL')
    .option('-d, --deadline <date>', 'Deadline date (YYYY-MM-DD)')
    .option('-r, --recurring', 'Make this a weekly recurring task')
    .option('-f, --field <key=value...>', 'Custom field values', collectFields, {})
    .addHelpText('after', `
Examples:
  $ kanban card add my-board "Fix login bug"
  $ kanban card add my-board "Deploy v2" -s "In Progress" -d 2026-04-01
  $ kanban card add my-board "Weekly standup" -r
  $ kanban card add my-board "Task" -f priority=high -f points=5`)
    .action(async (boardName, title, opts) => {
      const interactive = isInteractive(program);

      boardName = await promptBoard(boardName, interactive);
      if (!boardName) return;

      if (!(await boardExists(boardName))) {
        console.error(chalk.red(`Board "${boardName}" does not exist.`));
        process.exitCode = 1;
        return;
      }
      const config = await readConfig(boardName);

      const link = opts.link?.trim() || null;
      const hasGithubCardLink = link && parseGitHubUrl(link);

      // Prompt for title if missing and it cannot be filled by GitHub sync.
      title = await promptIfMissing(title, {
        message: 'Card title:',
        validate: (v) => v.length > 0 || 'Title is required',
      }, interactive && !hasGithubCardLink);

      title = title?.trim() || '';

      if (!title && !hasGithubCardLink) {
        console.error(chalk.red('Card title is required unless a GitHub issue or PR link is provided.'));
        process.exitCode = 1;
        return;
      }

      // Prompt for status if missing
      const status = await selectIfMissing(opts.status, {
        message: 'Column/status:',
        choices: config.columns.map((c) => ({ name: c, value: c })),
      }, interactive) || config.columns[0];

      if (!config.columns.includes(status)) {
        console.error(
          chalk.red(`Invalid status "${status}". Valid columns: ${config.columns.join(', ')}`)
        );
        process.exitCode = 1;
        return;
      }

      // Prompt for deadline if interactive and not provided
      let deadline = opts.deadline;
      if (!deadline && interactive) {
        deadline = await promptIfMissing(undefined, {
          message: 'Deadline (YYYY-MM-DD, or press Enter to skip):',
        }, interactive) || null;
        if (deadline === '') deadline = null;
      }

      // Validate custom fields
      if (config.customFields?.length && Object.keys(opts.field).length > 0) {
        const result = validateCustomFields(opts.field, config.customFields);
        if (!result.valid) {
          for (const err of result.errors) {
            console.error(chalk.red(err));
          }
          process.exitCode = 1;
          return;
        }
      }

      // Validate deadline format
      if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
        console.error(chalk.red('Deadline must be in YYYY-MM-DD format.'));
        process.exitCode = 1;
        return;
      }

      const now = new Date().toISOString();
      const cardItem = {
        id: nanoid(10),
        title,
        status,
        link,
        linkMeta: null,
        deadline: deadline || null,
        recurring: opts.recurring
          ? {
              frequency: 'weekly',
              lastReset: new Date().toISOString().slice(0, 10),
              resetToStatus: config.columns[0],
            }
          : null,
        customFields: opts.field || {},
        createdAt: now,
        updatedAt: now,
      };

      const cards = await readCards(boardName);
      cards.push(cardItem);
      await writeCards(boardName, cards);

      console.log(chalk.green(`Card "${formatCardTitle(cardItem)}" added to "${status}" (${chalk.dim(cardItem.id)})`));
    });

  card
    .command('edit')
    .description('Edit an existing card')
    .argument('[board]', 'Board name')
    .argument('[cardId]', 'Card ID')
    .option('-t, --title <title>', 'New title')
    .option('-s, --status <status>', 'New status/column')
    .option('-l, --link <url>', 'New link URL')
    .option('-d, --deadline <date>', 'New deadline (YYYY-MM-DD)')
    .option('-f, --field <key=value...>', 'Custom field values', collectFields, {})
    .addHelpText('after', `
Examples:
  $ kanban card edit my-board abc123 -t "New title"
  $ kanban card edit my-board abc123 -s Done -d 2026-05-01`)
    .action(async (boardName, cardId, opts) => {
      const interactive = isInteractive(program);

      boardName = await promptBoard(boardName, interactive);
      if (!boardName) return;

      if (!(await boardExists(boardName))) {
        console.error(chalk.red(`Board "${boardName}" does not exist.`));
        process.exitCode = 1;
        return;
      }
      const config = await readConfig(boardName);
      const cards = await readCards(boardName);

      // Prompt for card selection if missing
      cardId = await promptCard(cardId, cards, interactive);
      if (!cardId) return;

      const idx = cards.findIndex((c) => c.id === cardId);

      if (idx === -1) {
        console.error(chalk.red(`Card "${cardId}" not found.`));
        process.exitCode = 1;
        return;
      }

      const cardItem = cards[idx];

      // In interactive mode, prompt for fields to edit if no opts provided
      const hasOpts = opts.title || opts.status || opts.link || opts.deadline || Object.keys(opts.field).length > 0;
      if (!hasOpts && interactive) {
        opts.title = await promptIfMissing(undefined, {
          message: `Title (current: "${formatCardTitle(cardItem)}", Enter to keep):`,
        }, interactive) || undefined;

        const { select } = await import('@inquirer/prompts');
        const newStatus = await select({
          message: `Status (current: "${cardItem.status}"):`,
          choices: [
            { name: `Keep "${cardItem.status}"`, value: '' },
            ...config.columns.filter((c) => c !== cardItem.status).map((c) => ({ name: c, value: c })),
          ],
        });
        if (newStatus) opts.status = newStatus;

        const newDeadline = await promptIfMissing(undefined, {
          message: `Deadline (current: ${cardItem.deadline || 'none'}, Enter to keep):`,
        }, interactive);
        if (newDeadline) opts.deadline = newDeadline;
      }

      if (opts.status && !config.columns.includes(opts.status)) {
        console.error(
          chalk.red(`Invalid status "${opts.status}". Valid: ${config.columns.join(', ')}`)
        );
        process.exitCode = 1;
        return;
      }

      if (opts.deadline && !/^\d{4}-\d{2}-\d{2}$/.test(opts.deadline)) {
        console.error(chalk.red('Deadline must be in YYYY-MM-DD format.'));
        process.exitCode = 1;
        return;
      }

      if (opts.title) cardItem.title = opts.title;
      if (opts.status) cardItem.status = opts.status;
      if (opts.link) cardItem.link = opts.link;
      if (opts.deadline) cardItem.deadline = opts.deadline;
      if (Object.keys(opts.field).length > 0) {
        cardItem.customFields = { ...cardItem.customFields, ...opts.field };
      }
      cardItem.updatedAt = new Date().toISOString();

      await writeCards(boardName, cards);
      console.log(chalk.green(`Card "${formatCardTitle(cardItem)}" updated.`));
    });

  card
    .command('remove')
    .description('Remove a card')
    .argument('[board]', 'Board name')
    .argument('[cardId]', 'Card ID')
    .action(async (boardName, cardId) => {
      const interactive = isInteractive(program);

      boardName = await promptBoard(boardName, interactive);
      if (!boardName) return;

      if (!(await boardExists(boardName))) {
        console.error(chalk.red(`Board "${boardName}" does not exist.`));
        process.exitCode = 1;
        return;
      }
      const cards = await readCards(boardName);

      // Prompt for card selection if missing
      cardId = await promptCard(cardId, cards, interactive);
      if (!cardId) return;

      const idx = cards.findIndex((c) => c.id === cardId);

      if (idx === -1) {
        console.error(chalk.red(`Card "${cardId}" not found.`));
        process.exitCode = 1;
        return;
      }

      const removed = cards[idx];

      // Confirm deletion in interactive mode
      const confirmed = await confirmPrompt({
        message: `Remove card "${formatCardTitle(removed)}"?`,
        default: false,
      }, interactive);

      if (!confirmed) {
        console.log(chalk.dim('Cancelled.'));
        return;
      }

      cards.splice(idx, 1);
      await writeCards(boardName, cards);
      console.log(chalk.green(`Card "${formatCardTitle(removed)}" removed.`));
    });

  return card;
}

// --- Helpers ---

/**
 * Prompt for board selection if boardName is missing.
 */
async function promptBoard(boardName, interactive) {
  if (boardName) return boardName;
  if (!interactive) {
    console.error(chalk.red('Board name is required.'));
    process.exitCode = 1;
    return null;
  }
  const boards = await listBoards();
  if (boards.length === 0) {
    console.log(chalk.yellow('No boards found. Create one with: kanban board create <name>'));
    return null;
  }
  const { select } = await import('@inquirer/prompts');
  return select({
    message: 'Select board:',
    choices: boards.map((b) => ({ name: b, value: b })),
  });
}

/**
 * Prompt for card selection if cardId is missing.
 */
async function promptCard(cardId, cards, interactive) {
  if (cardId) return cardId;
  if (!interactive) {
    console.error(chalk.red('Card ID is required.'));
    process.exitCode = 1;
    return null;
  }
  if (cards.length === 0) {
    console.log(chalk.yellow('No cards on this board.'));
    return null;
  }
  const { select } = await import('@inquirer/prompts');
  return select({
    message: 'Select card:',
    choices: cards.map((c) => ({
      name: `${formatCardTitle(c)} (${c.status}) [${c.id}]`,
      value: c.id,
    })),
  });
}

/**
 * Commander option parser: collects `-f key=value` into an object.
 */
function collectFields(val, prev) {
  const [key, ...rest] = val.split('=');
  const value = rest.join('=');
  prev[key] = value;
  return prev;
}

function formatDate(isoString) {
  try {
    const date = parseISO(isoString);
    return `${isoString.slice(0, 10)} (${formatDistanceToNow(date, { addSuffix: true })})`;
  } catch {
    return isoString;
  }
}

function formatCardTitle(card) {
  const title = card.title?.trim();
  if (title) return title;

  const parsed = card.link ? parseGitHubUrl(card.link) : null;
  if (parsed) return `${parsed.owner}/${parsed.repo}#${parsed.number}`;

  return 'Untitled card';
}
