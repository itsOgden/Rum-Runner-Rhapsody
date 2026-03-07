<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { helpModalOpen } from '../modalState'
import BaseModal from './BaseModal.vue'

type Tab = 'patch-notes' | 'audio-setup'
const activeTab = ref<Tab>('patch-notes')

const tabs: { id: Tab; label: string }[] = [
  { id: 'patch-notes', label: 'Patch Notes' },
  { id: 'audio-setup', label: 'VB-Cable' },
]

function handleExternalLink(e: MouseEvent) {
  e.preventDefault()
  const href = (e.currentTarget as HTMLAnchorElement).href
  window.api.openExternal(href)
}

// ── Changelog parsing ────────────────────────────────────────────────────────

interface ChangelogSection {
  heading: string
  items: string[]
}

interface ChangelogRelease {
  version: string
  date: string
  sections: ChangelogSection[]
}

function parseChangelog(md: string): ChangelogRelease[] {
  const releases: ChangelogRelease[] = []
  // Each release starts at a "## " line; split on them and drop the preamble.
  const blocks = md.split(/^## /m).slice(1)
  for (const block of blocks) {
    const lines = block.split('\n')
    const header = lines[0]
    const match = header.match(/\[([^\]]+)\].*?(\d{4}-\d{2}-\d{2})/)
    if (!match) continue
    const [, version, date] = match
    const sections: ChangelogSection[] = []
    let current: ChangelogSection | null = null
    for (const line of lines.slice(1)) {
      if (line.startsWith('### ')) {
        if (current) sections.push(current)
        current = { heading: line.slice(4).trim(), items: [] }
      } else if (line.startsWith('- ') && current) {
        current.items.push(line.slice(2))
      }
    }
    if (current) sections.push(current)
    releases.push({ version, date, sections })
  }
  return releases
}

const changelog = ref<ChangelogRelease[]>([])
const changelogError = ref(false)

onMounted(async () => {
  const raw = await window.api.getChangelog()
  if (raw) {
    changelog.value = parseChangelog(raw)
  } else {
    changelogError.value = true
  }
})
</script>

<template>
  <BaseModal :open="helpModalOpen" title="Help" width="600px" @close="helpModalOpen = false">

    <!-- ── Body: tab list + content ─────────────────────────────────── -->
    <div class="flex">

          <!-- Tab list -->
          <nav class="tab-list">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              class="tab-btn"
              :class="{ 'tab-btn-active': activeTab === tab.id }"
              @click="activeTab = tab.id"
            >
              {{ tab.label }}
            </button>
          </nav>

          <!-- Content -->
          <div class="tab-content">

            <!-- ── PATCH NOTES tab ── -->
            <div v-if="activeTab === 'patch-notes'">
              <div v-if="changelogError" class="cl-empty">
                Could not load patch notes.
              </div>
              <div v-else-if="!changelog.length" class="cl-empty">
                Loading…
              </div>
              <div v-else>
                <div
                  v-for="release in changelog"
                  :key="release.version"
                  class="cl-release"
                >
                  <div class="cl-release-header">
                    <span class="cl-version">v{{ release.version }}</span>
                    <span class="cl-date">{{ release.date }}</span>
                  </div>
                  <div
                    v-for="section in release.sections"
                    :key="section.heading"
                    class="cl-section"
                  >
                    <div class="cl-section-heading">{{ section.heading }}</div>
                    <ul class="cl-items">
                      <li v-for="item in section.items" :key="item">{{ item }}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <!-- ── AUDIO SETUP tab ── -->
            <div v-else-if="activeTab === 'audio-setup'">

              <div class="guide-header">
                <div class="guide-title">Audio Routing with VB-Cable</div>
                <p class="guide-subtitle">Our recommended way to let any app hear your soundboard</p>
              </div>

              <div class="concept-box">
                VB-Cable creates a virtual microphone on your PC. You point your real mic and Rum-Runner Rhapsody at it, and any app (Discord, OBS, Zoom, etc) hears everything mixed together as if it's all coming from one microphone.
              </div>

              <div class="steps">

                <div class="step">
                  <div class="step-badge">1</div>
                  <div class="step-content">
                    <div class="step-title">Install VB-Cable</div>
                    <p class="step-body">
                      Download and install the free driver from <a href="https://vb-audio.com/Cable" class="step-link" @click.prevent="handleExternalLink">vb-audio.com/Cable</a>.<br>
                      Right-click the installer → Run as Administrator.<br>
                      Restart your PC when prompted.
                    </p>
                  </div>
                </div>

                <div class="step">
                  <div class="step-badge">2</div>
                  <div class="step-content">
                    <div class="step-title">Route your microphone into the cable</div>
                    <ol class="step-substeps">
                      <li>Press <kbd>Win + R</kbd>, type <code>mmsys.cpl</code>, press Enter</li>
                      <li>Click the <strong>Recording</strong> tab</li>
                      <li>Right-click your microphone → <strong>Properties</strong> → <strong>Listen</strong> tab</li>
                      <li><span class="step-check">✓</span> Check <strong>"Listen to this device"</strong></li>
                      <li>Set <strong>"Playback through this device"</strong> to <em>CABLE Input (VB-Audio Virtual Cable)</em></li>
                      <li>Click <strong>Apply</strong></li>
                    </ol>
                    <img src="../assets/images/vb-cables-listen-tab.png" alt="Listen tab with the correct settings" class="step-screenshot" />
                    <div class="step-tip">
                      <span class="step-check">💡</span>
                      <span>We recommend renaming your VB-Cable device to something recognizable. In our example we named ours <strong>"Microphone RRR (VB-Audio Virtual Cable B)"</strong> — making it easy to identify in any app's device list. To rename: right-click the device in the Recording tab → Properties → change the name at the top.</span>
                    </div>
                  </div>
                </div>

                <div class="step">
                  <div class="step-badge">3</div>
                  <div class="step-content">
                    <div class="step-title">Route Rum-Runner Rhapsody into the cable</div>
                    <p class="step-body">
                      In Rum-Runner Rhapsody, open the device selector.<br>
                      Set one of your outputs to CABLE Input (VB-Audio Virtual Cable).
                    </p>
                    <img src="../assets/images/vb-cables-rrr-selection.png" alt="RRR device selector with CABLE Input selected" class="step-screenshot" />
                  </div>
                </div>

                <div class="step">
                  <div class="step-badge">4</div>
                  <div class="step-content">
                    <div class="step-title">Set your app to listen to the cable</div>
                    <p class="step-body">
                      In whichever app you use, find its microphone or audio input setting and select CABLE Output (VB-Audio Virtual Cable).<br><br>
                      Discord: Settings → Voice &amp; Video → Input Device<br>
                      OBS: Settings → Audio → Mic/Aux<br>
                      Zoom / Teams: Settings → Audio → Microphone
                    </p>
                  </div>
                </div>

              </div>

              <p class="guide-closing">That's it. Both your voice and your soundboard now come through as one input.</p>

            </div>

          </div>
    </div>
  </BaseModal>
</template>

<style scoped>
/* ---- Tab list (left panel) ---- */
.tab-list {
  width: 140px;
  flex-shrink: 0;
  background: var(--color-bg-surface);
  border-right: 1px solid var(--color-border);
  padding: 8px 0;
}

.tab-btn {
  display: block;
  width: 100%;
  text-align: left;
  padding: 10px 16px;
  font-family: var(--font-sans);
  font-size: 13px;
  background: transparent;
  border: none;
  border-left: 2px solid transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
  outline: none;
}

.tab-btn:hover {
  background: var(--color-bg-surface-hover);
  color: var(--color-text-primary);
}

.tab-btn-active {
  color: var(--color-text-primary);
  background: var(--color-bg-surface-hover);
  border-left-color: var(--color-accent);
}

/* ---- Tab content (right panel) ---- */
.tab-content {
  flex: 1;
  padding: 20px 24px 28px;
  overflow-y: auto;
  max-height: 480px;
}

/* ── Patch notes ──────────────────────────────────────────────────── */

.cl-empty {
  font-size: 12px;
  color: var(--color-text-dim);
}

.cl-release {
  padding-bottom: 20px;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 20px;
}

.cl-release:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.cl-release-header {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 12px;
}

.cl-version {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  font-family: var(--font-mono);
}

.cl-date {
  font-size: 11px;
  color: var(--color-text-dim);
  font-family: var(--font-mono);
}

.cl-section {
  margin-bottom: 10px;
}

.cl-section:last-child {
  margin-bottom: 0;
}

.cl-section-heading {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--color-accent);
  margin-bottom: 5px;
}

.cl-items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.cl-items li {
  font-size: 12px;
  color: var(--color-text-secondary);
  padding-left: 14px;
  position: relative;
  line-height: 1.5;
}

.cl-items li::before {
  content: '–';
  position: absolute;
  left: 0;
  color: var(--color-text-dim);
}

/* ── VB-Cable guide ────────────────────────────────────────────────── */

.guide-header {
  margin-bottom: 20px;
}

.guide-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--color-text-primary);
  margin-bottom: 4px;
}

.guide-subtitle {
  font-size: 12px;
  color: var(--color-text-dim);
  line-height: 1.5;
  margin: 0;
}

.steps {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.step {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.step-badge {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--color-accent);
  color: var(--color-text-on-accent);
  font-weight: 600;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
}

.step-content {
  flex: 1;
  min-width: 0;
}

.step-title {
  color: var(--color-text-primary);
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 4px;
}

.step-body {
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.6;
  margin: 0;
}

.concept-box {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-sm);
  padding: 12px 14px;
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.6;
  margin-bottom: 20px;
}

code {
  font-family: var(--font-mono);
  font-size: 11px;
  background: var(--color-bg-surface-active);
  color: var(--color-text-primary);
  padding: 1px 5px;
  border-radius: 3px;
}

.step-check {
  color: var(--color-accent);
  font-weight: 600;
}

.step-screenshot {
  display: block;
  width: 100%;
  border-radius: 4px;
  border: 1px solid var(--color-border);
  margin-top: 8px;
}

.step-tip {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  background: var(--color-bg-surface);
  border-left: 3px solid var(--color-accent);
  border-radius: 3px;
  padding: 8px 10px;
  font-size: 11px;
  color: var(--color-text-secondary);
  line-height: 1.5;
  margin-top: 8px;
}

.step-link {
  color: var(--color-accent);
  text-decoration: none;
}
.step-link:hover {
  text-decoration: underline;
}

.step-substeps {
  margin: 6px 0 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.step-substeps li {
  font-size: 12px;
  color: var(--color-text-secondary);
  padding-left: 14px;
  position: relative;
  line-height: 1.5;
}
.step-substeps li::before {
  content: '•';
  position: absolute;
  left: 0;
  color: var(--color-accent);
  font-size: 11px;
}

kbd {
  font-family: var(--font-mono);
  font-size: 11px;
  background: var(--color-bg-surface-active);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  padding: 1px 5px;
  color: var(--color-text-primary);
}

.guide-note {
  font-size: 11px;
  color: var(--color-text-dim);
  font-style: italic;
  margin: 0 0 12px;
}

.guide-closing {
  margin-top: 16px;
  margin-bottom: 0;
  font-size: 12px;
  color: var(--color-text-dim);
  font-style: italic;
}
</style>
