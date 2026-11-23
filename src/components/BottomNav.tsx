import { DumbbellIcon, HistoryIcon, OverviewIcon, SettingsIcon } from './icons'

export type Tab = 'workout' | 'overview' | 'history' | 'settings'

const TABS = [
  { id: 'workout', label: 'Workout', Icon: DumbbellIcon },
  { id: 'overview', label: 'Overview', Icon: OverviewIcon },
  { id: 'history', label: 'History', Icon: HistoryIcon },
  { id: 'settings', label: 'Settings', Icon: SettingsIcon },
] as const

interface BottomNavProps {
  tab: Tab
  onChange: (tab: Tab) => void
}

export function BottomNav({ tab, onChange }: BottomNavProps) {
  return (
    <nav className="nav" aria-label="Main">
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className="nav-btn"
          aria-current={tab === id ? 'page' : undefined}
          onClick={() => onChange(id)}
        >
          <Icon />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}
