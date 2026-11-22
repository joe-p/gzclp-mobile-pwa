import {
  MAX_PLATE_PAIRS,
  STANDARD_PLATE_SIZES,
  normalizePlateInventory,
  pairsFor,
  totalPlateWeight,
  withPairs,
} from '../domain/plates'
import type { PlateInventory } from '../domain/types'
import { formatWeight } from '../domain/units'
import { WeightInput } from './WeightInput'

interface PlateInventoryEditorProps {
  value: PlateInventory
  onChange: (value: PlateInventory) => void
}

/**
 * Bar weight plus a pairs stepper for every standard plate size. Pair counts
 * (not individual plates) match how people think about a rack, and 0 means
 * "I don't have these".
 */
export function PlateInventoryEditor({ value, onChange }: PlateInventoryEditorProps) {
  const inventory = normalizePlateInventory(value)
  const total = totalPlateWeight(inventory)

  const setPairs = (size: number, pairs: number) => {
    onChange(withPairs(inventory, size, pairs))
  }

  return (
    <div className="plate-editor">
      <div className="plate-editor-bar">
        <span className="plate-editor-bar-label">
          Bar weight
          <span className="muted tiny">Used for every barbell lift</span>
        </span>
        <WeightInput
          value={inventory.bar}
          label="Bar weight"
          step={5}
          onChange={(bar) => onChange(normalizePlateInventory({ ...inventory, bar }))}
        />
      </div>

      <ul className="plate-editor-list">
        {STANDARD_PLATE_SIZES.map((size) => {
          const pairs = pairsFor(inventory, size)
          return (
            <li className={`plate-editor-row ${pairs === 0 ? 'is-empty' : ''}`} key={size}>
              <span className={`plate-swatch plate-size-${String(size).replace('.', '-')}`}>
                {formatWeight(size)}
              </span>
              <span className="plate-editor-name">
                {formatWeight(size)} lb
                <span className="muted tiny">
                  {pairs === 0 ? 'none' : `${pairs} pair${pairs === 1 ? '' : 's'} · ${pairs * 2} plates`}
                </span>
              </span>
              <div className="pair-stepper" role="group" aria-label={`${formatWeight(size)} pound plates`}>
                <button
                  type="button"
                  onClick={() => setPairs(size, pairs - 1)}
                  disabled={pairs === 0}
                  aria-label={`Remove a pair of ${formatWeight(size)} pound plates`}
                >
                  −
                </button>
                <span className="pair-count" aria-live="polite">
                  {pairs}
                </span>
                <button
                  type="button"
                  onClick={() => setPairs(size, pairs + 1)}
                  disabled={pairs >= MAX_PLATE_PAIRS}
                  aria-label={`Add a pair of ${formatWeight(size)} pound plates`}
                >
                  +
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      <p className="muted tiny plate-editor-total">
        You own {formatWeight(total)} lb of plates
        {inventory.bar > 0 ? ` plus a ${formatWeight(inventory.bar)} lb bar.` : '.'}
      </p>
    </div>
  )
}
