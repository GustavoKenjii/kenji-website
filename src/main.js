import Lenis from 'lenis'

// ---------- smooth scroll + single unified rAF (was 3 separate loops) ----------
const lenis = new Lenis({ lerp: 0.12, wheelMultiplier: 1.0 })
const reduceMotionMain = matchMedia('(prefers-reduced-motion: reduce)').matches

// anchor scrolling through lenis
document.querySelectorAll('[data-scroll]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href')
    if (!id || !id.startsWith('#')) return
    e.preventDefault()
    document.body.classList.remove('menu-open')
    const el = document.querySelector(id === '#top' ? 'main' : id)
    if (el) lenis.scrollTo(el, { offset: id === '#top' ? 0 : -10, duration: 1.0 })
  })
})

// ---------- loader: progress follows real milestones, failsafe at 2.5s ----------
const loader = document.getElementById('loader')
const loadNum = document.getElementById('load-num')
const loadBar = document.getElementById('load-bar')
const bootT0 = performance.now()
let target = 12
let shown = 0
const bump = v => { target = Math.max(target, v) }
const ltick = setInterval(() => {
  shown += (target - shown) * 0.3
  if (target >= 100 && target - shown < 0.6) shown = 100
  loadNum.textContent = String(Math.floor(shown)).padStart(3, '0')
  loadBar.style.width = shown + '%'
  if (shown >= 100) {
    clearInterval(ltick)
    const wait = Math.max(0, 350 - (performance.now() - bootT0)) // min display time
    setTimeout(() => {
      loader.classList.add('done')
      document.querySelectorAll('.hero [data-reveal]').forEach((el, i) => {
        setTimeout(() => el.classList.add('in'), 200 + i * 80)
      })
    }, wait)
  }
}, 50)

const heroImg = document.getElementById('hero-img')
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => bump(45))
if (heroImg && heroImg.decode) heroImg.decode().then(() => bump(78)).catch(() => bump(78))
if (document.readyState === 'complete') bump(100)
else window.addEventListener('load', () => bump(100), { once: true })
setTimeout(() => bump(100), 2500) // failsafe: never trap the visitor

// ---------- hero visibility (gates motion work when off-screen) ----------
let heroVisible = true
const heroSec = document.querySelector('.hero')
if (heroSec) new IntersectionObserver(([e]) => (heroVisible = e.isIntersecting)).observe(heroSec)

// ---------- menu ----------
document.getElementById('menu-btn').addEventListener('click', () => {
  document.body.classList.toggle('menu-open')
})

// ---------- reveals + counters ----------
const io = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return
    e.target.classList.add('in')
    e.target.querySelectorAll('[data-count]').forEach(runCounter)
    if (e.target.hasAttribute('data-count')) runCounter(e.target)
    io.unobserve(e.target)
  })
}, { threshold: 0.15 })
document.querySelectorAll('[data-reveal]').forEach(el => io.observe(el))

function runCounter(el) {
  const end = +el.dataset.count
  const t0 = performance.now()
  const step = t => {
    const p = Math.min(1, (t - t0) / 1200)
    el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)))
    if (p < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

// ---------- manifesto word reveal (section may be removed) ----------
const mani = document.getElementById('mani')
if (mani) {
  mani.innerHTML = mani.textContent.trim().split(' ').map(w => {
    const hl = /GROOVE/.test(w) ? ' hl' : ''
    return `<span class="w${hl}">${w}</span>`
  }).join(' ')
  const words = [...mani.querySelectorAll('.w')]
  const mio = new IntersectionObserver(() => {
    words.forEach((w, i) => setTimeout(() => w.classList.add('on'), i * 90))
    mio.disconnect()
  }, { threshold: 0.4 })
  mio.observe(mani)
}

// ---------- velocity-reactive marquees + hero skew ----------
const velTracks = [...document.querySelectorAll('[data-velocity]')].map(box => {
  const item = {
    box,
    track: box.querySelector('.marquee-track'),
    x: 0,
    visible: true,
    dir: +(box.dataset.dir || 1)
  }
  new IntersectionObserver(([e]) => (item.visible = e.isIntersecting)).observe(box)
  return item
})
let lastY = window.scrollY, vel = 0, smooth = 0
const title = document.getElementById('kenji-title')
const letters = title ? [...title.querySelectorAll('.k-letter')] : []

window.addEventListener('scroll', () => {
  const y = window.scrollY
  vel = y - lastY
  lastY = y
}, { passive: true })

let lastAppliedY = -1
let lastAppliedSmooth = 0

function loop(time) {
  lenis.raf(time)
  if (document.hidden) { requestAnimationFrame(loop); return }

  smooth += (vel - smooth) * 0.08
  vel *= 0.92
  if (Math.abs(smooth) < 0.02) smooth = 0
  if (Math.abs(vel) < 0.02) vel = 0

  velTracks.forEach(({ track, dir, visible }) => {
    if (!visible || !track) return
    const w = track.scrollWidth / 2
    if (!w) return
    track._x = ((track._x ?? 0) - dir * (0.6 + Math.abs(smooth) * 0.12)) % w
    const skew = Math.max(-14, Math.min(14, smooth * 0.35 * dir))
    track.style.transform = `translateX(${track._x}px) skewX(${-skew}deg)`
  })

  // hero: only touch the DOM while scrolling / settling, never idle-bob every frame
  if (heroVisible && title && !reduceMotionMain) {
    const active = smooth !== 0 || vel !== 0 || lastY !== lastAppliedY
    if (active) {
      const skewH = Math.max(-10, Math.min(10, smooth * 0.25))
      const scaleX = 1 + Math.min(0.06, Math.abs(smooth) * 0.0012)
      title.style.transform = `skewX(${-skewH}deg) scaleX(${scaleX}) translateY(${Math.min(120, lastY * 0.12)}px)`
      const push = Math.min(24, Math.abs(smooth) * 0.35)
      letters.forEach((l, i) => {
        l.style.transform = `translateY(${push * (i % 2 ? 1 : -1)}px)`
      })
      lastAppliedY = lastY
      lastAppliedSmooth = smooth
    }
  }

  requestAnimationFrame(loop)
}
requestAnimationFrame(loop)

// ---------- about video: nudge autoplay (iOS needs the muted property + a retry) ----------
const aboutVid = document.getElementById('about-vid')
if (aboutVid) {
  aboutVid.muted = true
  aboutVid.defaultMuted = true
  const kickAbout = () => { if (aboutVid.paused) aboutVid.play().catch(() => {}) }
  new IntersectionObserver(([e]) => { if (e.isIntersecting) kickAbout() }).observe(aboutVid)
  // Low Power Mode blocks autoplay until first touch — start then
  window.addEventListener('touchstart', kickAbout, { passive: true })
  window.addEventListener('pointerdown', kickAbout, { passive: true })
}

// ---------- gallery flip cards (tap toggles on touch; hover handles desktop) ----------
const gCards = [...document.querySelectorAll('.g-card')]
let gFlipIdx = 0, gLastTap = 0
if (matchMedia('(hover: none)').matches) {
  gCards.forEach(card => {
    card.addEventListener('click', () => {
      gCards.forEach(c => c.classList.remove('flipped'))
      card.classList.add('flipped')
      gFlipIdx = gCards.indexOf(card)
      gLastTap = performance.now()
    })
  })
  // auto-flip a random card every 1.5s while the gallery is on screen
  let gVisible = false
  const strip = document.getElementById('g-strip')
  if (strip) new IntersectionObserver(([e]) => (gVisible = e.isIntersecting), { threshold: 0.2 }).observe(strip)
  setInterval(() => {
    if (!gVisible || document.hidden || performance.now() - gLastTap < 6000 || gCards.length < 2) return
    let n = gFlipIdx
    while (n === gFlipIdx) n = Math.floor(Math.random() * gCards.length)
    gFlipIdx = n
    gCards.forEach(c => c.classList.remove('flipped'))
    gCards[n].classList.add('flipped')
  }, 1500)
}

// ---------- lazy Spotify: only load iframe near viewport ----------
const spotFrame = document.querySelector('.spotify-frame')
if (spotFrame && spotFrame.dataset.src) {
  new IntersectionObserver((entries, obs) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return
      spotFrame.src = spotFrame.dataset.src
      obs.disconnect()
    })
  }, { rootMargin: '800px' }).observe(spotFrame)
}

// ---------- sessions: muted autoplay, tap button for sound ----------
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
document.querySelectorAll('.sess-card').forEach(card => {
  const film = card.querySelector('.session-film')
  const t = card.querySelector('.sess-toggle')
  if (!film || typeof film.play !== 'function') return
  const url = film.dataset.src
  if (!url) return
  let live = false, srcSet = false, soundOn = false
  film.muted = true // required for autoplay; user enables sound via button
  film.volume = 1
  film.preload = 'none' // src assigned only near viewport — keeps initial load fast
  const renderBtn = () => {
    if (!t) return
    const on = t.querySelector('.ic-on'), off = t.querySelector('.ic-off')
    if (on && off) {
      // inline styles: immune to stylesheet/cascade issues
      on.style.display = soundOn ? 'block' : 'none'
      off.style.display = soundOn ? 'none' : 'block'
      t.setAttribute('aria-label', soundOn ? 'Turn sound off' : 'Turn sound on')
    } else {
      t.textContent = soundOn ? 'SOUND ON' : 'SOUND OFF'
    }
  }
  renderBtn()
  const killFilm = () => {
    live = false
    card.classList.remove('is-live')
    film.remove() // poster underneath stays; page untouched
  }
  film.addEventListener('playing', () => {
    live = true
    card.classList.add('is-live')
  })
  film.addEventListener('error', killFilm, { once: true })
  new IntersectionObserver(([e]) => {
    if (!film.isConnected) return
    if (e.isIntersecting) {
      if (!srcSet) { srcSet = true; film.src = url; film.load(); }
      if (!reduceMotion && !card.classList.contains('held')) film.play().catch(() => {})
    } else film.pause()
  }, { rootMargin: '400px' }).observe(card)
  card.addEventListener('click', e => {
    if (e.target.closest('.sess-toggle')) return // button handles sound only
    if (e.target.closest('.sess-vol')) return // slider handles volume only
    // no 'live' gate: taps are user gestures, so play() works even where autoplay is blocked
    if (film.paused) { card.classList.remove('held'); film.play().catch(() => {}) }
    else { card.classList.add('held'); film.pause() }
  })
  if (t) t.addEventListener('pointerdown', e => {
    e.stopPropagation()
    e.preventDefault()
    soundOn = !soundOn
    try {
      film.muted = !soundOn
      if (soundOn && film.paused) film.play().catch(() => {})
    } catch (err) {}
    renderBtn()
  })
  const vol = card.querySelector('.sess-vol')
  if (vol) vol.addEventListener('input', () => {
    const v = +vol.value
    try {
      film.volume = v / 100
      if (v > 0) {
        soundOn = true
        film.muted = false
        if (film.paused) film.play().catch(() => {})
      } else {
        soundOn = false
      }
    } catch (err) {}
    renderBtn()
  })
})

// ---------- back to top ----------
document.getElementById('to-top').addEventListener('click', () => lenis.scrollTo(0, { duration: 1.1 }))

// ---------- sound badge: standalone soundcloud player (no section needed) ----------
const soundWrap = document.getElementById('sound-wrap')
const soundPill = document.getElementById('sound-pill')
const soundLabel = document.getElementById('sound-label')
let scWidget = null, scReady = false, scWanted = true

function setScUI(playing) {
  if (soundPill) {
    soundPill.classList.toggle('pulse', !playing)
    if (soundLabel) soundLabel.textContent = playing ? 'SOUND ON' : 'TAP FOR SOUND'
  }
  const np = document.getElementById('np-state')
  if (np) np.textContent = playing ? 'NOW PLAYING' : 'PAUSED'
  const tgl = document.getElementById('sp-toggle')
  if (tgl) tgl.textContent = playing ? '❚❚' : '▶'
}
function scPlay() { scWanted = true; if (scReady && scWidget) scWidget.play() }
function scPause() { scWanted = false; if (scReady && scWidget) scWidget.pause() }
function scToggle() {
  if (!scReady || !scWidget) return
  scWidget.isPaused(paused => { paused ? scPlay() : scPause() })
}

if (soundWrap && soundPill) {
  // deferred init: don't pay SoundCloud cost on page load — wait for idle
  let scInitDone = false
  const initSC = () => {
    if (scInitDone) return
    scInitDone = true
    const frame = document.getElementById('sc-widget')
    if (frame && frame.dataset.src && !frame.src) frame.src = frame.dataset.src
    const s = document.createElement('script')
    s.src = 'https://w.soundcloud.com/player/api.js'
    s.async = true
    s.onload = startSCPoll
    s.onerror = () => {}
    document.head.appendChild(s)
    // fallback if CDN blocked: still try for 10s in case SC already present
    setTimeout(() => { if (window.SC && window.SC.Widget && !scWidget) startSCPoll() }, 3000)
  }
  const idleInit = () => {
    if ('requestIdleCallback' in window) requestIdleCallback(initSC, { timeout: 4000 })
    else setTimeout(initSC, 2500)
  }
  idleInit()
  // widget init (API loads async; give up quietly after ~10s — adblock etc.)
  let scStarted = false
  function startSCPoll() {
    if (scStarted) return
    scStarted = true
    let scTries = 0
    const scTimer = setInterval(() => {
    const frame = document.getElementById('sc-widget')
    if (frame && window.SC && window.SC.Widget) {
      clearInterval(scTimer)
      scWidget = window.SC.Widget(frame)
      scWidget.bind(window.SC.Widget.Events.READY, () => {
        scReady = true
        scWidget.setVolume(50)
        soundWrap.hidden = false // visible from here on; state syncs via events below
        setScUI(false)
        if (scWanted) scWidget.play() // browsers usually block until first gesture
        setTimeout(() => {
          if (!scReady) return
          try { scWidget.isPaused(paused => setScUI(!paused)) } catch (e) {}
        }, 1200)
      })
      scWidget.bind(window.SC.Widget.Events.PLAY, () => { soundWrap.hidden = false; setScUI(true) })
      scWidget.bind(window.SC.Widget.Events.PAUSE, () => setScUI(false))
      scWidget.bind(window.SC.Widget.Events.FINISH, () => setScUI(false))
    } else if (++scTries > 40) clearInterval(scTimer)
    }, 250)
  }

  // first gesture anywhere starts the mix (autoplay policies require it)
  window.addEventListener('pointerdown', function kick() {
    if (scReady && scWanted && scWidget) scWidget.isPaused(paused => { if (paused) scWidget.play() })
  }, { once: true })

  const isTouch = matchMedia('(hover: none)').matches
  let panelOpen = false
  soundPill.addEventListener('click', () => {
    initSC()
    if (isTouch && !panelOpen) { // touch: first tap opens the panel
      panelOpen = true
      soundWrap.classList.add('open')
      return
    }
    scToggle()
  })
  document.addEventListener('pointerdown', e => {
    if (panelOpen && !soundWrap.contains(e.target)) {
      panelOpen = false
      soundWrap.classList.remove('open')
    }
  })

  const spToggle = document.getElementById('sp-toggle')
  if (spToggle) spToggle.addEventListener('click', () => scToggle())

  const vol = document.getElementById('vol')
  if (vol) vol.addEventListener('input', () => {
    if (scReady && scWidget) scWidget.setVolume(+vol.value)
  })
}
