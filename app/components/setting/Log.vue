<script setup lang="ts">
let logList = [
  {
    date: '2026/08/13',
    content: 'Self-test now includes “Quick Mark” and “Multiple Choice (4 options)”',
  },
  {
    date: '2026/08/11',
    content: 'Improved practice flow: words are no longer marked wrong while visible, saving about 15% of time',
  },
  {
    date: '2026/08/09',
    content: 'Project converted from a monorepo back to a plain Nuxt project',
  },
  {
    date: '2026/08/07',
    content: 'Restored the original word bookmarking feature',
  },
  {
    date: '2026/08/02',
    content: 'Review can now include words outside the study plan, for when there are no words to review',
  },
  {
    date: '2026/08/01',
    content: 'Rewrote the word practice flow; fixed incorrect flow when resuming practice from cache',
  },
  {
    date: '2026/07/22',
    content: 'Improved example sentence practice to feel more natural',
  },
  {
    date: '2026/07/19',
    content: 'Improved article list search and the article detail page',
  },
  {
    date: '2026/06/27',
    content: 'Words can be saved to other dictionaries',
  },
  {
    date: '2026/06/26',
    content: 'Example sentences can be played with shortcuts (Ctrl+1~9); example sentences auto-play after the word',
  },
  {
    date: '2026/06/25',
    content: 'Phrases now support pronunciation',
  },
  {
    date: '2026/06/24',
    content: 'One-click lookup when adding or editing words',
  },
  {
    date: '2026/06/23',
    content: 'New: update notifications',
  },
  {
    date: '2026/06/22',
    content: 'New: repeat word playback at a slower speed',
  },
  {
    date: '2026/06/18',
    content: 'Click-to-look-up words',
  },
  {
    date: '2026/06/13',
    content: 'Clearer flow and UI for importing words and articles',
  },
  {
    date: '2026/06/09',
    content: 'Article titles and questions now support pronunciation',
  },
  {
    date: '2026/06/08',
    content: 'Custom word range for random review/test; improved multi-language support',
  },
  {
    date: '2026/06/04',
    content: 'Fixed all known word and article errors',
  },
  {
    date: '2026/05/06',
    content: 'Added Mini Program link',
  },
  {
    date: '2026/05/05',
    content: 'Added a tip prompting users to bookmark the site',
  },
  {
    date: '2026/04/28',
    content: 'Fixed Chinese punctuation not being matched',
  },
  {
    date: '2026/04/27',
    content: 'Support for deployment under a subdirectory',
  },
  {
    date: '2026/04/26',
    content: 'Support for dictionaries with word frequency https://github.com/zyronon/TypeWords/pull/257',
  },
  {
    date: '2026/04/23',
    content: 'Fixed saved practice data being lost when switching dictionaries or changing practice',
  },
  {
    date: '2026/04/21',
    content: 'Added TTS voice options',
  },
  {
    date: '2026/04/14',
    content: 'New home page',
  },
  {
    date: '2026/04/05',
    content: 'Added timer pause',
  },
  {
    date: '2026/03/29',
    content: 'Added statistics; fixed example sentences not playing audio; improved the study record table; added quick self-test mode',
  },
  {
    date: '2026/03/28',
    content: 'Merged new feature: self-test (word test); fixed keys 1, 2, 3, 4 not responding',
  },
  {
    date: '2026/03/25',
    content: 'Shorter practice flow: 1. improved self-test logic and added Quick Mark; 2. words spelled correctly are removed from the mistakes list and no longer rescheduled',
  },
  {
    date: '2026/03/08',
    content: 'Added automatic local data backup',
  },
  {
    date: '2026/03/06',
    content: 'Added data sync via Supabase',
  },
  {
    date: '2026/02/27',
    content: 'Added forgetting-curve scheduling; review words are generated dynamically from it',
  },
  {
    date: '2026/02/24',
    content: 'Added Docker support',
  },
  {
    date: '2026/02/10',
    content: 'Added hints to the practice screen and improved onboarding',
  },
  {
    date: '2026/02/09',
    content: 'Released the VS Code extension',
  },
  {
    date: '2026/02/04',
    content: 'Added a word test entry on the home page',
  },
  {
    date: '2026/02/02',
    content: 'Restructured the project; added example sentence pronunciation',
  },
  {
    date: '2026/01/19',
    content: 'Added auto-scroll to article practice; fixed event conflicts when opening the settings dialog during practice',
  },
  {
    date: '2026/01/16',
    content: 'Rebuilt with Nuxt',
  },
  {
    date: '2026/01/06',
    content: 'Improved the book detail page',
  },
  {
    date: '2025/12/30',
    content: 'Removed the “Continue dictation” option',
  },
  {
    date: '2025/12/29',
    content: 'Added an audio settings button to the bottom toolbar in word practice',
  },
  {
    date: '2025/12/27',
    content: 'Improved the progress bar; it now shows the current stage and all stages',
  },
  {
    date: '2025/12/23',
    content: 'Added review, self-test, recall writing, and dictation modes',
  },
  {
    date: '2025/12/20',
    content: 'Added a resource sharing page',
  },
  {
    date: '2025/12/17',
    content: 'Added a help page',
  },
  {
    date: '2025/12/16',
    content: 'Fixed dialog padding being too small; word, article, and general settings are now available on both the settings page and the practice screen',
  },
  {
    date: '2025/12/15',
    content: 'Fixed incorrect translation color in dark mode; support for Chinese punctuation input',
  },
  {
    date: '2025/12/11',
    content: 'Fixed phonetic symbols displaying incorrectly; improved the feedback page',
  },
  {
    date: '2025/12/10',
    content: 'New option: review ratio (ratio of review words to new words in word practice)',
  },
  {
    date: '2025/12/5',
    content: 'Fixed being unable to copy or select all on the practice screen',
  },
  {
    date: '2025/12/3',
    content: 'Word and article settings moved into a dialog for convenience',
  },
  {
    date: '2025/12/3',
    content: 'Added some audio for New Concept English (Books 3 and 4); improved article features',
  },
  {
    date: '2025/12/2',
    content: 'Completed audio for New Concept English (Book 1); improved the article management page',
  },
  {
    date: '2025/11/30',
    content: 'Words in articles can be clicked to play audio',
  },
  {
    date: '2025/11/29',
    content: 'Fixed a Slider display bug; added an Internet Explorer detection notice',
  },
  {
    date: '2025/11/28',
    content: 'Added onboarding tips; added dictionary test mode (developed by hebeihang)',
  },
  {
    date: '2025/11/25',
    content: 'Article practice can now ignore personal names (fully supported for New Concept English Book 1); uploaded audio for New Concept English Book 1, lessons 1-18',
  },
  {
    date: '2025/11/23',
    content: 'Improved the practice summary screen; added sharing',
  },
  {
    date: '2025/11/22',
    content: 'Mobile support',
  },
  {
    date: '2025/11/16',
    content: 'During word self-test, you can type an unknown word directly and it is marked wrong automatically, no need to press 2',
  },
  {
    date: '2025/11/15',
    content: 'Added a “Skip to next stage” button to the bottom toolbar in word practice',
  },
  {
    date: '2025/11/14',
    content:
      'Article practice can skip spaces: at the end of a word, typing the next letter without Space jumps to the next word automatically; pressing Space also jumps',
  },
  {
    date: '2025/11/13',
    content: 'Added the “Ignore symbols/numbers when typing” option for article practice',
  },
  {
    date: '2025/11/6',
    content: 'Added random review',
  },
  {
    date: '2025/10/30',
    content: 'Added basic PWA support so the app can be opened like a native app',
  },
  {
    date: '2025/10/26',
    content: 'Further improved word practice; fixed too many review words',
  },
  {
    date: '2025/10/8',
    content: 'Articles can auto-play the next one',
  },
  {
    date: '2025/9/14',
    content: 'Improved article editing, import, and export',
  },
  {
    date: '2025/8/10',
    content: 'Version 2.0 released: new UI, new logic, plus phrases, example sentences, synonyms, and more',
  },
  {
    date: '2025/7/19',
    content: 'Version 1.0 released',
  },
]
</script>

<template>
  <div>
    <div class="log-item" v-for="item in logList" :key="item.date">
      <div class="mb-2">
        <div>
          <div>Date: {{ item.date }}</div>
          <div>Changes: {{ item.content }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.log-item {
  border-bottom: 1px solid var(--color-input-border);
  margin-bottom: 1rem;
}
</style>
