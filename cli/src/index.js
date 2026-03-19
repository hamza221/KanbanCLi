import { Command } from 'commander';
import { registerBoardCommands } from './commands/board.js';
import { registerCardCommands } from './commands/card.js';
import { registerMoveCommand } from './commands/move.js';
import { registerGitHubCommands } from './commands/github.js';
import { registerRecurringCommand } from './commands/recurring.js';
import { registerSettingsCommands } from './commands/settings.js';
import { registerHelpCommand } from './commands/help.js';

export function createProgram() {
  const program = new Command();

  program
    .name('clikanban')
    .description('CLIkanban — CLI tool for managing Kanban boards')
    .version('1.0.0')
    .option('--interactive', 'Force interactive mode (prompts for missing args)')
    .option('--no-interactive', 'Disable interactive mode (for agents/CI/scripts)')
    .option('--ni', 'Shorthand for --no-interactive');

  registerBoardCommands(program);
  const cardCmd = registerCardCommands(program);
  registerMoveCommand(program);
  registerGitHubCommands(cardCmd);
  registerRecurringCommand(program);
  registerSettingsCommands(program);
  registerHelpCommand(program);

  return program;
}
