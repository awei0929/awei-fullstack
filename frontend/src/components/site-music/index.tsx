import { useCallback, useEffect, useRef, useState } from 'react'
import type { SiteContent } from '../../types/site'
import { SiteTip, useSiteTip } from '../site-tip'
import styles from './style.module.less'

type Props = { music: SiteContent['music']; preview?: boolean; reducedMotion?: boolean; obscured?: boolean }
type Playback = 'paused' | 'loading' | 'playing'

export function SiteMusicPlayer({ music, preview = false, reducedMotion = false, obscured = false }: Props) {
  if (!music.enabled || !music.sourceUrl || preview) return null
  // Changing sources starts a new listening choice, never an automatic resume.
  return <MusicSession key={music.sourceUrl} music={music} reducedMotion={reducedMotion} obscured={obscured} />
}

function MusicSession({ music, reducedMotion = false, obscured = false }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const requestId = useRef(0)
  const requested = useRef(false)
  const loadingTimer = useRef(0)
  const pendingError = useRef('')
  const obscuredRef = useRef(obscured)
  const [playback, setPlayback] = useState<Playback>('paused')
  const { tip, showTip, dismissTip, clearTip } = useSiteTip()

  const stopTimer = useCallback(() => { window.clearTimeout(loadingTimer.current); loadingTimer.current = 0 }, [])
  const release = useCallback(() => {
    requestId.current += 1
    requested.current = false
    stopTimer()
    const audio = audioRef.current
    audioRef.current = null
    if (!audio) return
    audio.onplaying = audio.onwaiting = audio.onerror = audio.onended = null
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
  }, [stopTimer])

  useEffect(() => release, [release])

  useEffect(() => {
    obscuredRef.current = obscured
    if (obscured) clearTip()
    else if (pendingError.current) {
      showTip(pendingError.current, 'error')
      pendingError.current = ''
    }
  }, [obscured, clearTip, showTip])

  useEffect(() => {
    if (!audioRef.current) return
    audioRef.current.volume = Math.max(0, Math.min(100, music.volume)) / 100
    audioRef.current.loop = music.loop
  }, [music.volume, music.loop])

  function fail(message = '音乐暂时无法播放，请稍后重试') {
    stopTimer()
    requested.current = false
    requestId.current += 1
    audioRef.current?.pause()
    setPlayback('paused')
    if (obscuredRef.current) pendingError.current = message
    else showTip(message, 'error')
  }

  function waitForAudio() {
    stopTimer()
    const id = requestId.current
    setPlayback('loading')
    loadingTimer.current = window.setTimeout(() => {
      if (requestId.current === id && requested.current) fail('音乐加载较慢，请稍后再试')
    }, 12000)
  }

  async function toggle() {
    if (requested.current) {
      requested.current = false
      requestId.current += 1
      stopTimer()
      audioRef.current?.pause()
      setPlayback('paused')
      return
    }
    clearTip()
    if (audioRef.current?.error) release()
    let audio = audioRef.current
    if (!audio) {
      // Created only from the visitor's click: no autoplay and no initial download.
      audio = new Audio(music.sourceUrl)
      audio.preload = 'none'
      audio.volume = Math.max(0, Math.min(100, music.volume)) / 100
      audio.loop = music.loop
      audioRef.current = audio
      const currentAudio = audio
      const isCurrent = () => audioRef.current === currentAudio && requested.current
      audio.onplaying = () => {
        if (!isCurrent()) return
        stopTimer()
        setPlayback('playing')
      }
      audio.onwaiting = () => { if (isCurrent()) waitForAudio() }
      audio.onerror = () => { if (isCurrent()) fail() }
      audio.onended = () => {
        if (!isCurrent()) return
        stopTimer()
        requested.current = false
        setPlayback('paused')
      }
    }
    requested.current = true
    const id = ++requestId.current
    waitForAudio()
    try {
      await audio.play()
      if (requestId.current !== id || audioRef.current !== audio || !requested.current) return
      stopTimer()
      setPlayback('playing')
    } catch {
      if (requestId.current === id && audioRef.current === audio && requested.current) fail()
    }
  }

  const label = playback === 'playing' ? '暂停音乐' : playback === 'loading' ? '取消音乐加载' : '播放音乐'
  return <>
    <button className={styles.control} type="button" aria-label={label} aria-pressed={playback === 'playing'}
      title={music.title || '背景音乐'} onClick={() => void toggle()}>
      <span className={styles.note} aria-hidden="true">♪</span>
      <span>{playback === 'loading' ? '音乐加载中' : playback === 'playing' ? '音乐 · 开' : '音乐 · 关'}</span>
      <span className={`${styles.indicator} ${playback === 'playing' ? styles.playing : ''}`} aria-hidden="true" />
    </button>
    <SiteTip tip={tip} onClose={dismissTip} reducedMotion={reducedMotion} />
  </>
}
