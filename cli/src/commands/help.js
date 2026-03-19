import chalk from 'chalk';

const COMMANDS = [
  {
    group: 'Board',
    commands: [
      { name: 'board list', desc: 'List all boards' },
      { name: 'board create [name]', desc: 'Create a new board', opts: '-c, --columns <cols>' },
      { name: 'board show [name]', desc: 'Show board config and card summary' },
      { name: 'board delete [name]', desc: 'Delete a board and all its cards' },
    ],
  },
  {
    group: 'Card',
    commands: [
      { name: 'card list [board]', desc: 'List cards grouped by column', opts: '-s, --status <status>' },
      { name: 'card show [board] [cardId]', desc: 'Show full card details' },
      {
        name: 'card add [board] [title]',
        desc: 'Add a new card',
        opts: '-s <status> -l <url> -d <date> -r -f <key=val>',
      },
      {
        name: 'card edit [board] [cardId]',
        desc: 'Edit an existing card',
        opts: '-t <title> -s <status> -l <url> -d <date> -f <key=val>',
      },
      { name: 'card remove [board] [cardId]', desc: 'Remove a card' },
    ],
  },
  {
    group: 'Move',
    commands: [
      { name: 'move [board] [cardId] [status]', desc: 'Move a card to a different column' },
    ],
  },
  {
    group: 'GitHub',
    commands: [
      { name: 'card add-gh [board] [url]', desc: 'Add card from GitHub issue/PR', opts: '-s <status>' },
      { name: 'card refresh [board]', desc: 'Refresh GitHub metadata for all cards' },
    ],
  },
  {
    group: 'Recurring',
    commands: [
      { name: 'reset [board]', desc: 'Process weekly recurring task resets' },
    ],
  },
  {
    group: 'Settings',
    commands: [
      { name: 'settings show [board]', desc: 'Show board settings' },
      { name: 'settings set-map [board] [label] [status]', desc: 'Map GitHub label to column' },
      { name: 'settings remove-map [board] [label]', desc: 'Remove a label mapping' },
    ],
  },
];

function padEnd(str, len) {
  // eslint-disable-next-line no-control-regex
  const stripped = str.replace(/\x1b\[[0-9;]*m/g, '');
  const padding = Math.max(0, len - stripped.length);
  return str + ' '.repeat(padding);
}

export function registerHelpCommand(program) {
  program
    .command('help')
    .description('Show detailed help for all commands')
    .argument('[command]', 'Show help for a specific command group')
    .action((commandFilter) => {
      const line = chalk.dim('─'.repeat(60));

      console.log('');
      console.log(chalk.bold('CLIkanban') + chalk.dim(' — CLI tool for managing Kanban boards'));
      console.log(line);

      // Filter to specific group if requested
      const groups = commandFilter
        ? COMMANDS.filter(
            (g) => g.group.toLowerCase() === commandFilter.toLowerCase()
          )
        : COMMANDS;

      if (commandFilter && groups.length === 0) {
        console.log(chalk.red(`Unknown command group: "${commandFilter}"`));
        console.log(
          chalk.dim('Available groups: ') +
            COMMANDS.map((g) => chalk.cyan(g.group.toLowerCase())).join(', ')
        );
        console.log('');
        return;
      }

      for (const group of groups) {
        console.log('');
        console.log(chalk.bold.cyan(`  ${group.group}`));

        for (const cmd of group.commands) {
          const nameStr = padEnd(`    kanban ${chalk.green(cmd.name)}`, 58);
          console.log(`${nameStr} ${chalk.dim(cmd.desc)}`);
          if (cmd.opts) {
            console.log(`${' '.repeat(4)}  ${chalk.yellow(cmd.opts)}`);
          }
        }
      }

      console.log('');
      console.log(line);
      console.log(chalk.dim('  Global options:'));
      console.log(`    ${chalk.yellow('--interactive')}      ${chalk.dim('Force interactive mode (prompts for missing args)')}`);
      console.log(`    ${chalk.yellow('--no-interactive')}   ${chalk.dim('Disable interactive mode (for agents/CI/scripts)')}`);
      console.log(`    ${chalk.yellow('--ni')}               ${chalk.dim('Shorthand for --no-interactive')}`);
      console.log(`    ${chalk.yellow('--version')}          ${chalk.dim('Show version number')}`);
      console.log('');
      console.log(
        chalk.dim('  All arguments in [brackets] are optional in interactive mode.')
      );
      console.log(
        chalk.dim('  Run ') +
          chalk.cyan('kanban help <group>') +
          chalk.dim(' for details on a specific group.')
      );
      console.log('');
    });
}
