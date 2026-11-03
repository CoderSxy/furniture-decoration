import { Text, View } from '@tarojs/components'
import {
  CATEGORY_FILTER_OPTIONS,
  CATEGORY_LABELS,
  PRICE_RANGE_FILTER_OPTIONS,
  PRICE_RANGE_LABELS,
  ROOM_FILTER_OPTIONS,
  ROOM_LABELS,
  STYLE_FILTER_OPTIONS,
  STYLE_LABELS,
} from '../../constants/labels'
import type { CatalogFilters, PriceRange, ProductCategory, RoomType, StyleTag } from '../../types/domain'
import { hasActiveFilters } from '../../utils/filterProducts'
import './index.scss'

export type FilterBarProps = {
  filters: CatalogFilters
  onChange: (patch: Partial<CatalogFilters>) => void
  onClear: () => void
}

const ALL_LABEL = '全部'

function ChipRow<T extends string>({
  options,
  labelOf,
  value,
  onSelect,
}: {
  options: readonly T[]
  labelOf: (option: T) => string
  value: T
  onSelect: (option: T) => void
}) {
  return (
    <View className='filter-bar__row'>
      {options.map((option) => {
        const active = option === value
        return (
          <View
            key={option}
            className={active ? 'filter-bar__chip filter-bar__chip--active' : 'filter-bar__chip'}
            onClick={() => onSelect(option)}
          >
            <Text
              className={
                active ? 'filter-bar__chip-text filter-bar__chip-text--active' : 'filter-bar__chip-text'
              }
            >
              {labelOf(option)}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

export function FilterBar({ filters, onChange, onClear }: FilterBarProps) {
  return (
    <View className='filter-bar'>
      <Text className='filter-bar__legend'>品类</Text>
      <ChipRow
        options={CATEGORY_FILTER_OPTIONS}
        value={filters.category}
        labelOf={(option) => (option === 'all' ? ALL_LABEL : CATEGORY_LABELS[option as ProductCategory])}
        onSelect={(category) => onChange({ category })}
      />
      <Text className='filter-bar__legend'>房间</Text>
      <ChipRow
        options={ROOM_FILTER_OPTIONS}
        value={filters.room}
        labelOf={(option) => (option === 'all' ? ALL_LABEL : ROOM_LABELS[option as RoomType])}
        onSelect={(room) => onChange({ room })}
      />
      <Text className='filter-bar__legend'>风格</Text>
      <ChipRow
        options={STYLE_FILTER_OPTIONS}
        value={filters.style}
        labelOf={(option) => (option === 'all' ? ALL_LABEL : STYLE_LABELS[option as StyleTag])}
        onSelect={(style) => onChange({ style })}
      />
      <Text className='filter-bar__legend'>价格</Text>
      <ChipRow
        options={PRICE_RANGE_FILTER_OPTIONS}
        value={filters.priceRange}
        labelOf={(option) => PRICE_RANGE_LABELS[option as PriceRange]}
        onSelect={(priceRange) => onChange({ priceRange })}
      />
      {hasActiveFilters(filters) ? (
        <View className='filter-bar__clear' onClick={onClear}>
          <Text className='filter-bar__clear-text'>清空筛选</Text>
        </View>
      ) : null}
    </View>
  )
}
