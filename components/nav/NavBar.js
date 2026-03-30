'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import styles from './NavBar.module.css'

export default function NavBar({ leagueId, isAdmin }) {
  const pathname = usePathname()

  const tabs = [
    { href: `/leaderboard/${leagueId}`, label: 'Leaderboard', icon: '🏆' },
    { href: `/squad/${leagueId}`, label: 'My Squad', icon: '👤' },
    { href: '/lobby', label: 'Lobby', icon: '🏠' },
  ]

  if (isAdmin) {
    tabs.push({ href: `/admin/${leagueId}`, label: 'Admin', icon: '⚙️' })
  }

  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        <span className={styles.brand}>IPL Fantasy</span>
        <div className={styles.tabs}>
          {tabs.map(tab => {
            const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/')
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`${styles.tab} ${isActive ? styles.active : ''}`}
              >
                <span className={styles.icon}>{tab.icon}</span>
                <span className={styles.label}>{tab.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
