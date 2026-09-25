<script setup lang="ts">
import { BaseButton, BaseInput, BasePage, PopConfirm, Toast } from '@/base'
import { APP_NAME } from '@/core/config/env.ts'
import { LEVELS } from '@/core/songs/lyrics.ts'
import { parseYouTubeId } from '@/core/songs/lyrics.ts'
import { loadSongs, removeSong, type Song } from '@/core/songs/library.ts'

useSeoMeta({ title: APP_NAME + ' Songs' })

const router = useRouter()
let link = $ref('')
let songs = $ref<Song[]>([])
let loading = $ref(true)

onMounted(async () => {
  songs = await loadSongs()
  loading = false
})

function open() {
  const id = parseYouTubeId(link)
  if (!id) return Toast.warning('Paste a YouTube link, e.g. https://www.youtube.com/watch?v=…')
  router.push('/songs/' + id)
}

function searchYouTube() {
  const q = link.trim() || 'song lyrics'
  window.open('https://www.youtube.com/results?search_query=' + encodeURIComponent(q), '_blank')
}

async function del(s: Song) {
  await removeSong(s.videoId)
  songs = songs.filter(x => x.videoId !== s.videoId)
}

function bestOf(s: Song) {
  const entries = LEVELS.filter(l => s.best?.[l.key] != null).map(l => `${l.label} ${s.best[l.key]}%`)
  return entries.length ? entries.join(' · ') : 'Not played yet'
}
</script>

<template>
  <BasePage>
    <div class="card-white mb-4">
      <div class="page-title flex items-center gap-2">
        <IconPhMusicNotes />
        Learn English with songs
      </div>
      <div class="color-sub mt-2 mb-4 leading-6">
        Paste a YouTube link of a song. The app finds the synced lyrics, plays the video and pauses at the end of each line
        until you type the missing words. Afterwards you can turn the song's words into a dictionary with Serbian
        translations and practice them like any other word list.
      </div>
      <div class="flex gap-3 items-center flex-wrap">
        <BaseInput
          v-model="link"
          class="flex-1 min-w-60"
          size="large"
          clearable
          placeholder="YouTube link (https://www.youtube.com/watch?v=…)"
          @enter="open"
        />
        <BaseButton size="large" @click="open">Open song</BaseButton>
        <BaseButton size="large" type="info" @click="searchYouTube">
          <div class="flex items-center gap-1"><IconFluentSearch20Regular />Find on YouTube</div>
        </BaseButton>
      </div>
      <div class="text-sm color-sub mt-2">
        Tip: official music videos sometimes can't be embedded. If a video won't play, try a "lyric video" upload of the same song.
      </div>
    </div>

    <div class="card-white">
      <div class="title mb-4">My songs</div>
      <div v-if="loading" class="py-10 center"><IconEosIconsLoading /></div>
      <div v-else-if="!songs.length" class="py-10 text-center color-sub">No songs yet — paste a YouTube link above.</div>
      <div v-else class="grid gap-4 grid-cols-[repeat(auto-fill,minmax(14rem,1fr))]">
        <div v-for="s in songs" :key="s.videoId" class="song-card" @click="router.push('/songs/' + s.videoId)">
          <img :src="`https://i.ytimg.com/vi/${s.videoId}/mqdefault.jpg`" alt="" class="w-full aspect-video object-cover rounded-t-lg" />
          <div class="p-3">
            <div class="font-bold truncate" :title="s.track">{{ s.track || s.title }}</div>
            <div class="text-sm color-sub truncate">{{ s.artist }}</div>
            <div class="text-xs color-sub mt-2">{{ bestOf(s) }}</div>
            <div class="flex justify-between items-center mt-2 text-xs color-sub">
              <span>{{ s.lines.length }} lines{{ s.synced ? '' : ' · not synced' }}</span>
              <PopConfirm title="Remove this song?" @confirm="del(s)">
                <IconFluentDelete20Regular class="cp hover:color-red" @click.stop />
              </PopConfirm>
            </div>
          </div>
        </div>
      </div>
    </div>
  </BasePage>
</template>

<style scoped lang="scss">
.color-sub {
  color: var(--color-sub-text);
}
.song-card {
  border-radius: 0.6rem;
  background: var(--color-second);
  border: 1px solid var(--color-item-border);
  cursor: pointer;
  overflow: hidden;
  transition: transform 0.15s;
  &:hover {
    transform: translateY(-2px);
  }
}
</style>
