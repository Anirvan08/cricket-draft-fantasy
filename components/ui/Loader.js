import styles from './Loader.module.css'

export function PageLoader() {
  return (
    <div className={styles.page}>
      <div className={styles.spinner} />
    </div>
  )
}

export function SkeletonLine({ width = '100%', height = '1rem' }) {
  return <div className={styles.skeleton} style={{ width, height }} />
}

export function SkeletonCard({ height = '3.5rem' }) {
  return <div className={`${styles.skeleton} ${styles.card}`} style={{ height }} />
}

export function LeaderboardSkeleton() {
  return (
    <div className={styles.container}>
      <div className={styles.headerBlock}>
        <SkeletonLine width="10rem" height="1.75rem" />
        <SkeletonLine width="8rem" height="0.875rem" />
      </div>
      <div className={styles.tabsBlock}>
        <SkeletonLine width="6rem" height="2rem" />
        <SkeletonLine width="8rem" height="2rem" />
      </div>
      <div className={styles.list}>
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} height="3.25rem" />
        ))}
      </div>
    </div>
  )
}

export function SquadSkeleton() {
  return (
    <div className={styles.container}>
      <div className={styles.headerBlock}>
        <SkeletonLine width="8rem" height="1.75rem" />
        <SkeletonLine width="6rem" height="0.875rem" />
      </div>
      {[1, 2, 3].map(section => (
        <div key={section} className={styles.section}>
          <SkeletonLine width="4rem" height="1.25rem" />
          <div className={styles.grid}>
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} height="3rem" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function LobbySkeleton() {
  return (
    <div className={styles.container}>
      <div className={styles.headerBlock}>
        <SkeletonLine width="10rem" height="1.75rem" />
        <SkeletonLine width="5rem" height="1.5rem" />
      </div>
      <SkeletonCard height="3rem" />
      <div className={styles.list} style={{ marginTop: '1.5rem' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} height="3.25rem" />
        ))}
      </div>
    </div>
  )
}
