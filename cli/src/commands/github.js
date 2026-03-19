import chalk from 'chalk';
import { nanoid } from 'nanoid';
import {
  boardExists,
  listBoards,
  readConfig,
  readCards,
  writeCards,
  readSettings,
} from '../lib/store.js';
import { parseGitHubUrl, fetchGitHubMeta } from '../lib/github.js';
import { isInteractive, promptIfMissing, selectIfMissing } from '../lib/prompt.js';

export function registerGitHubCommands(cardCommand) {
  // The program reference is the root program — walk up from cardCommand
  const program = cardCommand.parent || cardCommand;

  cardCommand
    .command('add-gh')
    .description('Add a card from a GitHub issue or PR URL')
    .argument('[board]', 'Board name')
    .argument('[url]', 'GitHub issue or PR URL')
    .option('-s, --status <status>', 'Column/status (default: first column)')
    .action(async (boardName, url, opts) => {
      const interactive = isInteractive(program);

      // Prompt for board if missing
      boardName = await promptBoard(boardName, interactive);
      if (!boardName) return;

      if (!(await boardExists(boardName))) {
        console.error(chalk.red(`Board "${boardName}" does not exist.`));
        process.exitCode = 1;
        return;
      }

      // Prompt for URL if missing
      url = await promptIfMissing(url, {
        message: 'GitHub issue or PR URL:',
        validate: (v) => {
          if (!v) return 'URL is required';
          const parsed = parseGitHubUrl(v);
          return parsed ? true : 'Invalid GitHub URL. Expected: https://github.com/owner/repo/issues/123';
        },
      }, interactive);

      if (!url) {
        console.error(chalk.red('GitHub URL is required.'));
        process.exitCode = 1;
        return;
      }

      const parsed = parseGitHubUrl(url);
      if (!parsed) {
        console.error(chalk.red('Invalid GitHub URL. Expected: https://github.com/owner/repo/issues/123'));
        process.exitCode = 1;
        return;
      }

      const config = await readConfig(boardName);

      // Prompt for status if missing
      const status = await selectIfMissing(opts.status, {
        message: 'Column/status:',
        choices: config.columns.map((c) => ({ name: c, value: c })),
      }, interactive) || config.columns[0];

      if (!config.columns.includes(status)) {
        console.error(chalk.red(`Invalid status "${status}". Valid: ${config.columns.join(', ')}`));
        process.exitCode = 1;
        return;
      }

      console.log(chalk.dim(`Fetching metadata for ${parsed.owner}/${parsed.repo}#${parsed.number}...`));

      const meta = await fetchGitHubMeta(parsed);
      const title = meta?.title || `${parsed.owner}/${parsed.repo}#${parsed.number}`;

      // Use milestone due_on as deadline if available
      const deadline = meta?.milestoneDueOn || null;

      const now = new Date().toISOString();
      const card = {
        id: nanoid(10),
        title,
        status,
        link: url,
        linkMeta: meta,
        deadline,
        recurring: null,
        customFields: {},
        createdAt: now,
        updatedAt: now,
      };

      const cards = await readCards(boardName);
      cards.push(card);
      await writeCards(boardName, cards);

      console.log(chalk.green(`Card "${title}" added to "${status}" (${chalk.dim(card.id)})`));
      if (deadline) {
        console.log(chalk.dim(`  Deadline set from milestone: ${deadline}`));
      }
    });

  // Refresh command — updates linkMeta for all cards with GitHub links
  cardCommand
    .command('refresh')
    .description('Refresh GitHub metadata for all cards with GitHub links')
    .argument('[board]', 'Board name')
    .action(async (boardName) => {
      const interactive = isInteractive(program);

      // Prompt for board if missing
      boardName = await promptBoard(boardName, interactive);
      if (!boardName) return;

      if (!(await boardExists(boardName))) {
        console.error(chalk.red(`Board "${boardName}" does not exist.`));
        process.exitCode = 1;
        return;
      }

      const config = await readConfig(boardName);
      const settings = await readSettings(boardName);
      const statusMap = settings.githubStatusMap || {};
      const cards = await readCards(boardName);
      let updated = 0;
      let moved = 0;

      for (const card of cards) {
        if (!card.link) continue;
        const parsed = parseGitHubUrl(card.link);
        if (!parsed) continue;

        console.log(chalk.dim(`Refreshing ${parsed.owner}/${parsed.repo}#${parsed.number}...`));

        const meta = await fetchGitHubMeta(parsed);
        if (meta) {
          card.linkMeta = meta;
          if (meta.title) card.title = meta.title;
          if (meta.milestoneDueOn && !card.deadline) {
            card.deadline = meta.milestoneDueOn;
          }

          // Apply githubStatusMap: check if any label maps to a column
          if (meta.labels && meta.labels.length > 0 && Object.keys(statusMap).length > 0) {
            for (const label of meta.labels) {
              const targetColumn = statusMap[label.name];
              if (targetColumn && config.columns.includes(targetColumn) && card.status !== targetColumn) {
                console.log(chalk.dim(`  Moving "${card.title}" to "${targetColumn}" (label: ${label.name})`));
                card.status = targetColumn;
                moved++;
                break; // First matching label wins
              }
            }
          }

          card.updatedAt = new Date().toISOString();
          updated++;
        }
      }

      if (updated > 0) {
        await writeCards(boardName, cards);
        let msg = `Refreshed ${updated} card(s).`;
        if (moved > 0) {
          msg += ` Moved ${moved} card(s) via label mapping.`;
        }
        console.log(chalk.green(msg));
      } else {
        console.log(chalk.yellow('No GitHub-linked cards to refresh.'));
      }
    });
}

// --- Helpers ---

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
