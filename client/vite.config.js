import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';

// Baked in at build time so the join screen can show which commit is
// actually deployed - falls back to 'dev' if git isn't available (e.g. a
// build from a source archive with no .git directory).
function commitHash() {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash()),
  },
});
