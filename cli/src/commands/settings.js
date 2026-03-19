import chalk from 'chalk';
import {
  boardExists,
  listBoards,
  readConfig,
  readSettings,
  writeSettings,
} from '../lib/store.js';
import { isInteractive, promptIfMissing, selectIfMissing } from '../lib/prompt.js';

export function registerSettingsCommands(program) {
  const settings = program
    .command('settings')
    .description('Manage board settings (GitHub label → status mapping)');

  settings
    .command('show')
    .description('Show settings for a board')
    .argument('[board]', 'Board name')
    .action(async (board) => {
      const interactive = isInteractive(program);

      // Prompt for board if missing
      board = await promptBoard(board, interactive);
      if (!board) return;

      if (!(await boardExists(board))) {
        console.error(chalk.red(`Board "${board}" does not exist.`));
        process.exitCode = 1;
        return;
      }

      const config = await readConfig(board);
      const s = await readSettings(board);

      console.log(chalk.bold(`Settings for board "${board}":`));
      console.log();

      const map = s.githubStatusMap || {};
      const entries = Object.entries(map);

      if (entries.length === 0) {
        console.log(chalk.dim('  No GitHub label → status mappings configured.'));
        console.log();
        console.log(chalk.dim('  Add one with:'));
        console.log(chalk.dim(`    kanban settings set-map ${board} "<label>" "<status>"`));
      } else {
        console.log(chalk.bold('  GitHub label → Local status:'));
        for (const [label, status] of entries) {
          const valid = config.columns.includes(status);
          const statusStr = valid ? chalk.green(status) : chalk.red(`${status} (invalid column)`);
          console.log(`    ${chalk.cyan(label)} → ${statusStr}`);
        }
      }

      console.log();
      console.log(chalk.dim(`  Available columns: ${config.columns.join(', ')}`));
    });

  settings
    .command('set-map')
    .description('Map a GitHub label to a local board status/column')
    .argument('[board]', 'Board name')
    .argument('[label]', 'GitHub label name')
    .argument('[status]', 'Local column/status name')
    .action(async (board, label, status) => {
      const interactive = isInteractive(program);

      // Prompt for board if missing
      board = await promptBoard(board, interactive);
      if (!board) return;

      if (!(await boardExists(board))) {
        console.error(chalk.red(`Board "${board}" does not exist.`));
        process.exitCode = 1;
        return;
      }

      const config = await readConfig(board);

      // Prompt for label if missing
      label = await promptIfMissing(label, {
        message: 'GitHub label name:',
        validate: (v) => v.length > 0 || 'Label is required',
      }, interactive);

      if (!label) {
        console.error(chalk.red('GitHub label name is required.'));
        process.exitCode = 1;
        return;
      }

      // Prompt for target column if missing
      status = await selectIfMissing(status, {
        message: 'Map to column:',
        choices: config.columns.map((c) => ({ name: c, value: c })),
      }, interactive);

      if (!status) {
        console.error(chalk.red('Target column/status is required.'));
        process.exitCode = 1;
        return;
      }

      if (!config.columns.includes(status)) {
        console.error(
          chalk.red(
            `"${status}" is not a valid column. Available: ${config.columns.join(', ')}`
          )
        );
        process.exitCode = 1;
        return;
      }

      const s = await readSettings(board);
      if (!s.githubStatusMap) s.githubStatusMap = {};
      s.githubStatusMap[label] = status;
      await writeSettings(board, s);

      console.log(
        chalk.green(`Mapped GitHub label "${label}" → "${status}" for board "${board}".`)
      );
    });

  settings
    .command('remove-map')
    .description('Remove a GitHub label → status mapping')
    .argument('[board]', 'Board name')
    .argument('[label]', 'GitHub label name to remove')
    .action(async (board, label) => {
      const interactive = isInteractive(program);

      // Prompt for board if missing
      board = await promptBoard(board, interactive);
      if (!board) return;

      if (!(await boardExists(board))) {
        console.error(chalk.red(`Board "${board}" does not exist.`));
        process.exitCode = 1;
        return;
      }

      const s = await readSettings(board);
      const map = s.githubStatusMap || {};
      const entries = Object.entries(map);

      // Prompt for label selection if missing
      if (!label && interactive) {
        if (entries.length === 0) {
          console.log(chalk.yellow('No mappings to remove.'));
          return;
        }
        const { select } = await import('@inquirer/prompts');
        label = await select({
          message: 'Select mapping to remove:',
          choices: entries.map(([l, st]) => ({
            name: `${l} → ${st}`,
            value: l,
          })),
        });
      }

      if (!label) {
        console.error(chalk.red('GitHub label name is required.'));
        process.exitCode = 1;
        return;
      }

      if (!s.githubStatusMap || !(label in s.githubStatusMap)) {
        console.error(chalk.yellow(`No mapping found for label "${label}".`));
        process.exitCode = 1;
        return;
      }

      delete s.githubStatusMap[label];
      await writeSettings(board, s);

      console.log(
        chalk.green(`Removed mapping for GitHub label "${label}" from board "${board}".`)
      );
    });

  return settings;
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
