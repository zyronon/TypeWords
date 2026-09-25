// Minimal loader/wrapper for the YouTube IFrame Player API.

declare global {
  interface Window {
    YT?: any
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiReady: Promise<any> | null = null

export function loadYouTubeApi(): Promise<any> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  apiReady ??= new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve(window.YT)
    }
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    s.onerror = () => {
      apiReady = null
      reject(new Error('Could not load the YouTube player'))
    }
    document.head.appendChild(s)
  })
  return apiReady
}

export const YT_STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 }

/** Turn off YouTube's own subtitles — many music videos carry the lyrics as captions. */
export function hideCaptions(p: any) {
  for (const mod of ['captions', 'cc']) {
    try {
      p?.unloadModule?.(mod)
    } catch {}
  }
}

export function youTubeErrorText(code: number) {
  if (code === 101 || code === 150 || code === 153)
    return 'The owner of this video does not allow playing it outside YouTube. Try another upload of the same song (e.g. a lyric video).'
  if (code === 100) return 'Video not found or it is private.'
  if (code === 2) return 'Invalid YouTube link.'
  return 'The video could not be played (error ' + code + ').'
}

export function createPlayer(
  el: HTMLElement,
  videoId: string,
  handlers: { onReady?: (p: any) => void; onState?: (s: number) => void; onError?: (code: number) => void }
): Promise<any> {
  return loadYouTubeApi().then(
    YT =>
      new Promise(resolve => {
        const player = new YT.Player(el, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: { rel: 0, modestbranding: 1, playsinline: 1, cc_load_policy: 0, iv_load_policy: 3 },
          events: {
            onReady: () => {
              handlers.onReady?.(player)
              resolve(player)
            },
            onStateChange: (e: any) => handlers.onState?.(e.data),
            onError: (e: any) => handlers.onError?.(e.data),
          },
        })
      })
  )
}
