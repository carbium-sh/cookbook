// COOKBOOK_LANGUAGES picks the languages whose examples run, for a machine without every toolchain: a comma-separated
// list of runner names. A name that is no runner stops the run, so a typo cannot quietly drop a language.
import { RUNNERS } from '../scripts/recipes.mjs'

/** The chosen languages as a Set, or null when the variable is unset or empty (every language runs). */
export function chosenLanguages(value) {
  if (!value?.trim()) return null
  const names = value.split(',').map((name) => name.trim()).filter(Boolean)
  const unknown = names.filter((name) => !(name in RUNNERS))
  if (unknown.length) throw new Error(`COOKBOOK_LANGUAGES names ${unknown.join(', ')}, which is no runner; use any of ${Object.keys(RUNNERS).join(', ')}`)
  return new Set(names)
}
