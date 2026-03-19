import chalk from 'chalk';
import {
  listBoards,
  boardExists,
  createBoard,
  deleteBoard,
  readConfig,
  readCards,
} from '../lib/store.js';
import { isInteractive, promptIfMissing, confirmPrompt } from '../lib/prompt.js';

const BOARD_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

export function registerBoardCommands(program) {
  const board = program
    .command('board')
    .description('Manage boards');

  board
    .command('list')
    .description('List all boards')
    .action(async () => {
      const boards = await listBoards();
      if (boards.length === 0) {
        console.log(chalk.yellow('No boards found. Create one with: kanban board create <name>'));
        return;
      }
      console.log(chalk.bold('Boards:'));
      for (const name of boards) {
        try {
          const config = await readConfig(name);
          const cards = await readCards(name);
          console.log(
            `  ${chalk.cyan(name)}  [${config.columns.join(', ')}]  ${chalk.dim(`(${cards.length} cards)`)}`
          );
        } catch {
          console.log(`  ${chalk.cyan(name)}  ${chalk.red('(error reading config)')}`);
        }
      }
    });

  board
    .command('create')
    .description('Create a new board')
    .argument('[name]', 'Board name (letters, numbers, hyphens, dots, underscores)')
    .option('-c, --columns <columns>', 'Comma-separated column names', 'To Do,In Progress,Done')
    .addHelpText('after', `
Examples:
  $ kanban board create my-project
  $ kanban board create sprint-1 -c "Backlog,In Progress,Review,Done"`)
    .action(async (name, opts) => {
      const interactive = isInteractive(program);

      // Prompt for name if missing
      name = await promptIfMissing(name, {
        message: 'Board name:',
        validate: (v) => BOARD_NAME_RE.test(v) || 'Use only letters, numbers, hyphens, dots, underscores (must start with alphanumeric)',
      }, interactive);

      if (!name) {
        console.error(chalk.red('Board name is required.'));
        process.exitCode = 1;
        return;
      }

      if (!BOARD_NAME_RE.test(name)) {
        console.error(
          chalk.red(
            `Invalid board name "${name}". Use only letters, numbers, hyphens, dots, and underscores.`
          )
        );
        process.exitCode = 1;
        return;
      }

      if (await boardExists(name)) {
        console.error(chalk.red(`Board "${name}" already exists.`));
        process.exitCode = 1;
        return;
      }

      // Prompt for columns if interactive and default was used
      if (interactive && opts.columns === 'To Do,In Progress,Done') {
        const colInput = await promptIfMissing(undefined, {
          message: 'Columns (comma-separated):',
          default: 'To Do,In Progress,Done',
        }, interactive);
        if (colInput) opts.columns = colInput;
      }

      const columns = opts.columns.split(',').map((c) => c.trim()).filter(Boolean);
      if (columns.length === 0) {
        console.error(chalk.red('At least one column is required.'));
        process.exitCode = 1;
        return;
      }

      const config = await createBoard(name, columns);
      console.log(chalk.green(`Board "${name}" created with columns: ${config.columns.join(', ')}`));
    });

  board
    .command('delete')
    .description('Delete a board and all its cards')
    .argument('[name]', 'Board name')
    .action(async (name) => {
      const interactive = isInteractive(program);

      // Prompt for board name if missing
      if (!name && interactive) {
        const boards = await listBoards();
        if (boards.length === 0) {
          console.log(chalk.yellow('No boards to delete.'));
          return;
        }
        const { select } = await import('@inquirer/prompts');
        name = await select({
          message: 'Select board to delete:',
          choices: boards.map((b) => ({ name: b, value: b })),
        });
      }

      if (!name) {
        console.error(chalk.red('Board name is required.'));
        process.exitCode = 1;
        return;
      }

      if (!(await boardExists(name))) {
        console.error(chalk.red(`Board "${name}" does not exist.`));
        process.exitCode = 1;
        return;
      }

      // Confirm deletion in interactive mode
      const confirmed = await confirmPrompt({
        message: `Delete board "${name}" and all its cards?`,
        default: false,
      }, interactive);

      if (!confirmed) {
        console.log(chalk.dim('Cancelled.'));
        return;
      }

      await deleteBoard(name);
      console.log(chalk.green(`Board "${name}" deleted.`));
    });

  board
    .command('show')
    .description('Show board configuration and card summary')
    .argument('[name]', 'Board name')
    .action(async (name) => {
      const interactive = isInteractive(program);

      // Prompt for board name if missing
      if (!name && interactive) {
        const boards = await listBoards();
        if (boards.length === 0) {
          console.log(chalk.yellow('No boards found.'));
          return;
        }
        const { select } = await import('@inquirer/prompts');
        name = await select({
          message: 'Select board:',
          choices: boards.map((b) => ({ name: b, value: b })),
        });
      }

      if (!name) {
        console.error(chalk.red('Board name is required.'));
        process.exitCode = 1;
        return;
      }

      if (!(await boardExists(name))) {
        console.error(chalk.red(`Board "${name}" does not exist.`));
        process.exitCode = 1;
        return;
      }
      const config = await readConfig(name);
      const cards = await readCards(name);

      console.log(chalk.bold(`Board: ${config.name}`));
      console.log(`Columns: ${config.columns.join(', ')}`);
      console.log();

      // Card summary per column
      for (const col of config.columns) {
        const count = cards.filter((c) => c.status === col).length;
        const bar = '█'.repeat(count) || chalk.dim('(empty)');
        console.log(`  ${chalk.cyan(col.padEnd(16))} ${bar} ${count}`);
      }
      console.log();
      console.log(`Total: ${cards.length} card(s)`);

      if (config.customFields?.length) {
        console.log();
        console.log(chalk.bold('Custom fields:'));
        for (const f of config.customFields) {
          const label = f.label || f.key;
          const req = f.required ? chalk.red(' *') : '';
          const extra = f.type === 'select' ? ` [${f.options?.join(', ')}]` : '';
          console.log(`  ${chalk.cyan(f.key)} (${f.type})${extra} — ${label}${req}`);
        }
      }
    });

  return board;
}
