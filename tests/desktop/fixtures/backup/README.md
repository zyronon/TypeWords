# Synthetic Backup Fixture

These files contain isolated test data, not a personal learning backup or sync
credentials. They were retained from the synthetic backup scenario on 2026-09-11.
The JSON includes settings v23, dictionary v4, both practice caches, a custom word,
a custom article referencing `backup-tone`, and fixed learning statistics.
The MP3 is a generated 0.3-second test tone, not recorded speech.

Tests build ZIP files at runtime using the actual exporter with stub stores.
ZIP timestamps are not compared; JSON semantics and audio bytes are compared.
These tests do not prove audio playback, browser reload, or native UI behavior.

Historical browser ZIPs and reports remain local evidence and are deliberately
excluded from the default test glob. To audit those old artifacts explicitly:

```sh
node tests/desktop/backup-history-audit.mjs docs/plans/evidence/tauri2-continue
```

Missing historical files fail that audit; they never silently skip a default
regression test.

To run the full default regression suite from a temporary source-only copy:

```sh
node scripts/check-desktop-test-snapshot.mjs
```

The copy includes tracked and non-ignored untracked working-tree files, excludes
local plans and build caches, and reuses this checkout's `node_modules`. It is
removed after the run. This checks independence from local evidence, not a clean
Git checkout, frozen-lockfile installation, or reproducible release build.

To install from `pnpm-lock.yaml` in an independent tree (no `docs/plans`,
`.nuxt`, `.output`, or reused `node_modules`):

```sh
pnpm run test:desktop:clean-install
```

That is still not a commit of a dirty worktree, signed release, or EXE/NSIS rebuild.

Original SHA256:

- `backup-fixture.json`: `ca07d4ea05c94ffa20a5c028ac39ff7b5d95898e93d07d9c779e88416be06d6a`
- `backup-tone.mp3`: `d8b8b1279fd37e8642af60065c3d7906324a725c1169738440d264b2c025d1bb`
