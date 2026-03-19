import chalk from 'chalk';
import {
  boardExists,
  listBoards,
  readConfig,
  readCards,
  writeCards,
} from '../lib/store.js';
import { isInteractive, selectIfMissing } from '../lib/prompt.js';

export function registerMoveCommand(program) {
  program
    .command('move')
    .description('Move a card to a different column')
    .argument('[board]', 'Board name')
    .argument('[cardId]', 'Card ID')
    .argument('[status]', 'Target column/status')
    .action(async (boardName, cardId, status) => {
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

      // Prompt for card if missing
      cardId = await promptCard(cardId, cards, interactive);
      if (!cardId) return;

      const card = cards.find((c) => c.id === cardId);

      if (!card) {
        console.error(chalk.red(`Card "${cardId}" not found.`));
        process.exitCode = 1;
        return;
      }

      // Prompt for target column if missing
      status = await selectIfMissing(status, {
        message: `Move "${card.title}" to:`,
        choices: config.columns
          .filter((c) => c !== card.status)
          .map((c) => ({ name: c, value: c })),
      }, interactive);

      if (!status) {
        console.error(chalk.red('Target status is required.'));
        process.exitCode = 1;
        return;
      }

      if (!config.columns.includes(status)) {
        console.error(
          chalk.red(`Invalid status "${status}". Valid columns: ${config.columns.join(', ')}`)
        );
        process.exitCode = 1;
        return;
      }

      const oldStatus = card.status;
      card.status = status;
      card.updatedAt = new Date().toISOString();

      await writeCards(boardName, cards);
      console.log(
        chalk.green(`Moved "${card.title}" from "${oldStatus}" to "${status}"`)
      );
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
    message: 'Select card to move:',
    choices: cards.map((c) => ({
      name: `${c.title} (${c.status}) [${c.id}]`,
      value: c.id,
    })),
  });
}
