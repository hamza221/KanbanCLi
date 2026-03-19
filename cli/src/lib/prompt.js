/**
 * Interactive prompt helpers for CLIkanban CLI.
 *
 * Design:
 * - Interactive mode is ON by default when stdin is a TTY (human user).
 * - Pass `--no-interactive` or `--ni` to disable (for agents/CI/scripts).
 * - Pass `--interactive` to force enable even without TTY.
 * - When interactive, missing arguments trigger prompts instead of errors.
 * - When non-interactive, missing arguments are errors (existing behavior).
 */
import { input, select, confirm, checkbox } from '@inquirer/prompts';

/**
 * Detect whether interactive mode should be used.
 * Reads from the Commander program's opts().
 */
export function isInteractive(program) {
  const opts = program.opts();
  // Explicit --no-interactive or --ni flag
  if (opts.interactive === false || opts.ni) return false;
  // Explicit --interactive flag
  if (opts.interactive === true) return true;
  // Default: interactive if stdin is a TTY
  return Boolean(process.stdin.isTTY);
}

/**
 * Prompt for text input if value is missing.
 * @param {string|undefined} value - Current value
 * @param {object} promptOpts - { message, default?, validate? }
 * @param {boolean} interactive - Whether we're in interactive mode
 * @returns {Promise<string|undefined>}
 */
export async function promptIfMissing(value, promptOpts, interactive) {
  if (value !== undefined && value !== null && value !== '') return value;
  if (!interactive) return undefined;
  return input(promptOpts);
}

/**
 * Prompt to select one option from a list.
 * @param {string|undefined} value - Current value
 * @param {object} promptOpts - { message, choices: [{name, value}] }
 * @param {boolean} interactive - Whether we're in interactive mode
 * @returns {Promise<string|undefined>}
 */
export async function selectIfMissing(value, promptOpts, interactive) {
  if (value !== undefined && value !== null && value !== '') return value;
  if (!interactive) return undefined;
  return select(promptOpts);
}

/**
 * Prompt for confirmation.
 * @param {object} promptOpts - { message, default? }
 * @param {boolean} interactive - Whether we're in interactive mode
 * @returns {Promise<boolean>} - Returns true if non-interactive (skip confirmation)
 */
export async function confirmPrompt(promptOpts, interactive) {
  if (!interactive) return true;
  return confirm(promptOpts);
}

/**
 * Prompt to select multiple options from a list.
 * @param {object} promptOpts - { message, choices: [{name, value}] }
 * @param {boolean} interactive
 * @returns {Promise<string[]>}
 */
export async function checkboxPrompt(promptOpts, interactive) {
  if (!interactive) return [];
  return checkbox(promptOpts);
}

export { input, select, confirm, checkbox };
