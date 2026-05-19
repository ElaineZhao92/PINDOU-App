import { useState, useRef, useEffect } from 'react'
import { BeadColor, InventoryItem } from '../lib/types'

interface BeadColorCellProps {
  color: BeadColor
  item: InventoryItem | null
  threshold: number
  onSetQuantity: (colorCode: string, quantity: number) => void
  onUpdateQuantity: (colorCode: string, delta: number) => void
}

export default function BeadColorCell({
  color,
  item,
  threshold,
  onSetQuantity,
  onUpdateQuantity,
}: BeadColorCellProps) {
  const [editing, setEditing] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const quantity = item?.quantity ?? 0
  const isLow = quantity < threshold

  const isDark = isColorDark(color.hex)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const handleCellClick = () => {
    setInputValue(String(quantity))
    setEditing(true)
  }

  const handleInputSubmit = () => {
    const parsed = parseInt(inputValue, 10)
    if (!isNaN(parsed) && parsed >= 0) {
      onSetQuantity(color.code, parsed)
    }
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleInputSubmit()
    if (e.key === 'Escape') setEditing(false)
  }

  return (
    <div
      className={`relative rounded-xl overflow-hidden cursor-pointer transition-transform hover:scale-105 hover:shadow-md ${
        isLow ? 'ring-2 ring-orange-400 ring-offset-1' : ''
      }`}
      style={{ aspectRatio: '1' }}
      onClick={!editing ? handleCellClick : undefined}
    >
      {/* Color background */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: color.hex }}
      />

      {/* Low stock warning icon */}
      {isLow && (
        <div className="absolute top-1 right-1 z-10">
          <div className="w-4 h-4 bg-orange-400 rounded-full flex items-center justify-center">
            <span className="text-white text-[8px] font-bold leading-none">!</span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full p-1 gap-0.5">
        <span
          className={`text-[13px] font-bold leading-tight ${
            isDark ? 'text-white' : 'text-gray-800'
          }`}
        >
          {color.code}
        </span>

        {editing ? (
          <div
            className="flex flex-col items-center gap-0.5 w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* +/- buttons */}
            <div className="flex items-center gap-0.5">
              <button
                className="w-5 h-5 bg-black/20 hover:bg-black/30 rounded text-white text-xs font-bold flex items-center justify-center"
                onClick={(e) => {
                  e.stopPropagation()
                  onUpdateQuantity(color.code, -10)
                  setInputValue(String(Math.max(0, parseInt(inputValue || '0') - 10)))
                }}
              >
                -
              </button>
              <input
                ref={inputRef}
                type="number"
                min="0"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleInputSubmit}
                className="w-12 text-center text-xs font-bold bg-white/90 rounded px-0.5 py-0.5 border-0 outline-none text-gray-900"
                style={{ appearance: 'textfield' }}
              />
              <button
                className="w-5 h-5 bg-black/20 hover:bg-black/30 rounded text-white text-xs font-bold flex items-center justify-center"
                onClick={(e) => {
                  e.stopPropagation()
                  onUpdateQuantity(color.code, 10)
                  setInputValue(String(parseInt(inputValue || '0') + 10))
                }}
              >
                +
              </button>
            </div>
          </div>
        ) : (
          <span
            className={`text-[13px] font-semibold leading-tight ${
              isDark ? 'text-white/90' : 'text-gray-700'
            }`}
          >
            {quantity}
          </span>
        )}
      </div>
    </div>
  )
}

function isColorDark(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance < 0.5
}
