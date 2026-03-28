'use client'

import { useEffect, useState } from 'react'
import styles from './TurnBanner.module.css'

const TIMER_SECONDS = 60

export default function TurnBanner({ activeMember, currentUserId, roundNumber, pickNumber, totalPicks, onTimerExpire }) {
  const [secondsLeft, setSecondsLeft] = useState(TIMER_SECONDS)
  const isYourTurn = activeMember?.user_id === currentUserId

  // Reset and start countdown whenever the pick changes
  useEffect(() => {
    setSecondsLeft(TIMER_SECONDS)
    const interval = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          onTimerExpire?.()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [pickNumber])

  const timerColor = secondsLeft > 30 ? '#22c55e' : secondsLeft > 10 ? '#f59e0b' : '#ef4444'
  const timerPct = (secondsLeft / TIMER_SECONDS) * 100

  return (
    <div className={`${styles.banner} ${isYourTurn ? styles.yourTurn : ''}`}>
      <div className={styles.left}>
        <div className={styles.roundLabel}>Round {roundNumber} · Pick {pickNumber} of {totalPicks}</div>
        <div className={styles.pickerName}>
          {isYourTurn
            ? "Your pick!"
            : `${activeMember?.user?.display_name ?? '...'}'s turn`}
        </div>
      </div>

      <div className={styles.timerWrap}>
        <svg className={styles.timerSvg} viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1e293b" strokeWidth="3" />
          <circle
            cx="18" cy="18" r="15.9" fill="none"
            stroke={timerColor} strokeWidth="3"
            strokeDasharray={`${timerPct} 100`}
            strokeLinecap="round"
            transform="rotate(-90 18 18)"
            style={{ transition: 'stroke-dasharray 1s linear, stroke 0.3s' }}
          />
        </svg>
        <span className={styles.timerNum} style={{ color: timerColor }}>{secondsLeft}</span>
      </div>
    </div>
  )
}
