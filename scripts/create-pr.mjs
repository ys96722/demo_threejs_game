#!/usr/bin/env node
/**
 * create-pr.mjs
 *
 * Captures before/after screenshots, commits them to the feature branch,
 * pushes, and creates a GitHub PR with embedded images.
 *
 * Usage:
 *   npm run create-pr
 *   npm run create-pr -- --title "My PR" --body "Extra context" --draft
 *   npm run create-pr -- --skip-before
 */

import { execSync, spawn, spawnSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as readline from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SCREENSHOTS_DIR = resolve(ROOT, 'screenshots');
const SCREENSHOT_SCRIPT = resolve(__dirname, 'screenshot.mjs');
const DEV_PORT = 5200;

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

function getFlag(name) {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1] ?? null;
}

function hasFlag(name) {
  return args.includes(name);
}

const FLAG_TITLE = getFlag('--title');
const FLAG_BODY = getFlag('--body');
const IS_DRAFT = hasFlag('--draft');
const SKIP_BEFORE = hasFlag('--skip-before');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function run(cmd, opts = {}) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe', ...opts }).trim();
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function log(msg) {
  console.log(`\n→ ${msg}`);
}

function err(msg) {
  console.error(`\n✗ ${msg}`);
}

/**
 * Spawn the Vite dev server and resolve when it signals readiness.
 * Returns { proc, url }.
 */
function startDevServer(port) {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['vite', '--port', String(port), '--strictPort'], {
      cwd: ROOT,
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';

    function stripAnsi(str) {
      // eslint-disable-next-line no-control-regex
      return str.replace(/\x1B\[[0-9;]*[mGKHF]/g, '');
    }

    function checkReady(chunk) {
      output += chunk.toString();
      const clean = stripAnsi(output);
      // Vite prints "Local:   http://localhost:XXXX/" or "ready in"
      const match = clean.match(/Local:\s+(http:\/\/localhost:\d+\/)/);
      if (match) {
        resolve({ proc, url: match[1] });
        return;
      }
      // Fallback: if "ready in" appears, assume default port
      if (clean.includes('ready in')) {
        resolve({ proc, url: `http://localhost:${port}/` });
      }
    }

    proc.stdout.on('data', checkReady);
    proc.stderr.on('data', checkReady);

    proc.on('error', reject);
    proc.on('close', code => {
      if (code !== null && code !== 0) {
        reject(new Error(`Dev server exited with code ${code}\n${output}`));
      }
    });

    // Timeout after 60 s
    setTimeout(() => reject(new Error(`Dev server did not become ready within 60 s\nOutput:\n${output}`)), 60_000);
  });
}

function killServer(proc) {
  try {
    proc.kill('SIGTERM');
  } catch {
    // already dead
  }
}

async function captureScreenshot(outputPath) {
  const { proc, url } = await startDevServer(DEV_PORT);
  try {
    log(`Dev server ready at ${url} — taking screenshot…`);
    run(`node "${SCREENSHOT_SCRIPT}" "${url}" "${outputPath}"`);
    log(`Screenshot saved → ${outputPath}`);
  } finally {
    killServer(proc);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // 1. Validate prerequisites
  log('Checking prerequisites…');

  try {
    run('gh auth status');
  } catch {
    err('gh is not authenticated. Run `gh auth login` first.');
    process.exit(1);
  }

  const dirty = run('git status --porcelain');
  if (dirty) {
    console.warn('\n⚠  You have uncommitted changes. They will be stashed during the before-screenshot step.');
  }

  const branch = run('git branch --show-current');
  if (branch === 'main' || branch === 'master') {
    err(`You are on '${branch}'. Create a feature branch first.`);
    process.exit(1);
  }
  log(`Branch: ${branch}`);

  // 2. Repo metadata
  const repo = run('gh repo view --json nameWithOwner -q .nameWithOwner');
  log(`Repo: ${repo}`);

  // 3. Ensure screenshots dir exists
  mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const afterPath = resolve(SCREENSHOTS_DIR, 'after.png');
  const beforePath = resolve(SCREENSHOTS_DIR, 'before.png');

  // 4. Capture "after" screenshot (current branch)
  log('Capturing AFTER screenshot (current branch)…');
  await captureScreenshot(afterPath);

  // 5. Capture "before" screenshot (main branch)
  if (SKIP_BEFORE && existsSync(beforePath)) {
    log('--skip-before: reusing existing before.png');
  } else {
    log('Capturing BEFORE screenshot (main branch)…');

    const hasStash = dirty.length > 0;
    if (hasStash) {
      run('git stash');
      log('Stashed local changes.');
    }

    run('git checkout main');
    log('Checked out main.');

    try {
      await captureScreenshot(beforePath);
    } finally {
      run(`git checkout "${branch}"`);
      log(`Returned to branch: ${branch}`);

      if (hasStash) {
        run('git stash pop');
        log('Restored stashed changes.');
      }
    }
  }

  // 6. Commit screenshots
  log('Committing screenshots…');
  run(`git add "${beforePath}" "${afterPath}"`);

  try {
    run('git commit -m "Add PR screenshots"');
    log('Screenshots committed.');
  } catch (e) {
    // Nothing to commit (already up to date)
    if (String(e).includes('nothing to commit')) {
      log('Screenshots already committed — skipping commit.');
    } else {
      throw e;
    }
  }

  // 7. Push branch
  log(`Pushing branch '${branch}'…`);
  run(`git push -u origin "${branch}"`);

  // 8. Build raw image URLs
  const baseUrl = `https://raw.githubusercontent.com/${repo}/${branch}/screenshots`;
  const beforeUrl = `${baseUrl}/before.png`;
  const afterUrl = `${baseUrl}/after.png`;

  // 9. Prompt for PR title / body
  const title = FLAG_TITLE ?? (await ask('PR title: '));
  if (!title) {
    err('PR title is required.');
    process.exit(1);
  }

  const extraBody = FLAG_BODY ? `${FLAG_BODY}\n\n` : '';

  const screenshotsSection = `## Screenshots

| Before | After |
|--------|-------|
| ![Before](${beforeUrl}) | ![After](${afterUrl}) |
`;

  const body = `${extraBody}${screenshotsSection}`;

  // 10. Create PR — write body to a temp file to avoid shell-escaping issues
  log('Creating PR…');
  const bodyFile = `/tmp/pr-body-${Date.now()}.md`;
  writeFileSync(bodyFile, body, 'utf8');
  try {
    const ghArgs = [
      'pr', 'create',
      '--base', 'main',
      '--head', branch,
      '--title', title,
      '--body-file', bodyFile,
    ];
    if (IS_DRAFT) ghArgs.push('--draft');

    const result = spawnSync('gh', ghArgs, { cwd: ROOT, encoding: 'utf8' });
    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout);
    }
    const prUrl = (result.stdout || '').trim();
    console.log(`\n✓ PR created: ${prUrl}`);
  } finally {
    try { unlinkSync(bodyFile); } catch { /* ignore */ }
  }
}

main().catch(e => {
  err(String(e));
  process.exit(1);
});
