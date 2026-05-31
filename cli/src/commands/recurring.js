import chalk from 'chalk';
import {
  boardExists,
  listBoards,
  readConfig,
  readCards,
  writeCards,
} from '../lib/store.js';
import { processRecurring } from '../lib/recurring.js';
import { isInteractive } from '../lib/prompt.js';

export function registerRecurringCommand(program) {
  program
    .command('reset')
    .description('Process weekly recurring task resets for a board')
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
      const cards = await readCards(boardName);

      // Snapshot lastReset values so we can count only the cards actually reset
      const beforeReset = cards.map((c) => c.recurring?.lastReset ?? null);
      const modified = processRecurring(cards, config);

      if (modified) {
        await writeCards(boardName, cards);
        const resetCount = cards.filter(
          (c, i) => c.recurring && (c.recurring.lastReset ?? null) !== beforeReset[i]
        ).length;
        console.log(
          chalk.green(`Reset ${resetCount} recurring card(s) on "${boardName}".`)
        );
      } else {
        console.log(chalk.yellow('No recurring cards needed resetting.'));
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
