<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { helpModalOpen, helpModalInitialTab } from '../modalState'
import BaseModal from './BaseModal.vue'
import ModalTabs from './ModalTabs.vue'
import InstructionStep from './InstructionStep.vue'

type Tab = 'patch-notes' | 'audio-setup'
const activeTab = ref<Tab>('patch-notes')

watch(helpModalOpen, (open) => {
  if (open && helpModalInitialTab.value) {
    activeTab.value = helpModalInitialTab.value as Tab
    helpModalInitialTab.value = null
  }
})

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'patch-notes', label: 'Patch Notes' },
  { id: 'audio-setup', label: 'VB-Cable'    },
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

interface ChangelogSubsection {
  name: string
  sections: ChangelogSection[]
}

interface ChangelogRelease {
  version: string
  date: string
  subsections: ChangelogSubsection[]
}

function parseInlineCode(text: string): Array<{ text: string; code: boolean }> {
  const parts: Array<{ text: string; code: boolean }> = []
  const segments = text.split('`')
  for (let i = 0; i < segments.length; i++) {
    if (segments[i]) parts.push({ text: segments[i], code: i % 2 === 1 })
  }
  return parts
}

function parseChangelog(md: string): ChangelogRelease[] {
  const releases: ChangelogRelease[] = []
  const blocks = md.split(/^## /m).slice(1)
  for (const block of blocks) {
    const lines = block.split('\n')
    const header = lines[0]
    const match = header.match(/\[([^\]]+)\].*?(\d{4}-\d{2}-\d{2})/)
    if (!match) continue
    const [, version, date] = match
    const subsections: ChangelogSubsection[] = []
    let currentSub: ChangelogSubsection | null = null
    let currentSec: ChangelogSection | null = null
    for (const line of lines.slice(1)) {
      if (line.startsWith('### ')) {
        if (currentSec && currentSub) currentSub.sections.push(currentSec)
        currentSec = null
        if (currentSub) subsections.push(currentSub)
        currentSub = { name: line.slice(4).trim(), sections: [] }
      } else if (line.startsWith('#### ')) {
        if (currentSec && currentSub) currentSub.sections.push(currentSec)
        currentSec = { heading: line.slice(5).trim(), items: [] }
      } else if (line.startsWith('- ') && currentSec) {
        currentSec.items.push(line.slice(2))
      }
    }
    if (currentSec && currentSub) currentSub.sections.push(currentSec)
    if (currentSub) subsections.push(currentSub)
    releases.push({ version, date, subsections })
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
  <BaseModal :open="helpModalOpen" size="lg" title="Help" @close="helpModalOpen = false">
    <div class="flex flex-1 min-h-0">

      <ModalTabs :tabs="tabs" v-model="activeTab" />

      <div class="flex-1 pt-5 px-6 pb-7 min-h-0 overflow-y-auto">

        <!-- ── PATCH NOTES tab ── -->
        <div v-if="activeTab === 'patch-notes'">
          <div v-if="changelogError" class="text-xs text-text-dim">Could not load patch notes.</div>
          <div v-else-if="!changelog.length" class="text-xs text-text-dim">Loading…</div>
          <div v-else>
            <div
              v-for="release in changelog"
              :key="release.version"
              class="pb-[22px] mb-[22px] border-b border-border-light last:border-b-0 last:mb-0 last:pb-0"
            >
              <div class="mb-[14px]">
                <span class="block font-display text-lg text-accent leading-[1.1] lowercase">
                  <span class="text-xs mr-[1px]">v</span>{{ release.version }}
                </span>
                <span class="block text-xs text-text-secondary mt-[2px]">{{ release.date }}</span>
              </div>
              <div
                v-for="sub in release.subsections"
                :key="sub.name"
                class="mb-3 last:mb-0"
              >
                <div class="font-display text-sm text-text-primary mb-1.5 pb-1 border-b border-border-light">{{ sub.name }}</div>
                <div
                  v-for="section in sub.sections"
                  :key="section.heading"
                  class="mb-1.5 last:mb-0"
                >
                  <div class="text-xs font-medium uppercase tracking-[0.08em] text-text-secondary mb-1">{{ section.heading }}</div>
                  <ul class="list-none m-0 p-0 flex flex-col gap-[2px]">
                    <li v-for="item in section.items" :key="item"
                        class="text-sm text-text-secondary pl-[13px] relative leading-[1.45] before:content-['–'] before:absolute before:left-0 before:text-text-dim">
                      <template v-for="(part, i) in parseInlineCode(item)" :key="i">
                        <code v-if="part.code" class="font-mono text-xs bg-bg-surface-active text-text-primary px-1 py-px rounded-[3px]">{{ part.text }}</code>
                        <template v-else>{{ part.text }}</template>
                      </template>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ── AUDIO SETUP tab ── -->
        <div v-else-if="activeTab === 'audio-setup'">

          <div class="mb-5">
            <div class="font-display text-sm text-text-primary mb-1">Audio Routing with VB-Cable</div>
            <p class="text-xs text-text-secondary leading-[1.5] m-0">Our recommended way to let any app hear your soundboard</p>
          </div>

          <div class="bg-bg-surface-hover border border-border-light rounded-sm px-[14px] py-3 text-sm text-text-secondary leading-[1.6] mb-5">
            VB-Cable creates a virtual microphone on your PC. You point your real mic and Rum-Runner Rhapsody at it, and any app (Discord, OBS, Zoom, etc) hears everything mixed together as if it's all coming from one microphone.
          </div>

          <div class="flex flex-col gap-4">

            <InstructionStep :number="1" title="Install VB-Cable">
              <p class="text-text-secondary text-sm leading-[1.6] m-0">
                Download and install the free driver from <a href="https://vb-audio.com/Cable" class="text-accent no-underline hover:underline" @click.prevent="handleExternalLink">vb-audio.com/Cable</a>.<br>
                Right-click the installer → Run as Administrator.<br>
                Restart your PC when prompted.
              </p>
            </InstructionStep>

            <InstructionStep :number="2" title="Route your microphone into the cable">
              <ol class="mt-[6px] m-0 p-0 list-none flex flex-col gap-[5px]">
                <li class="guide-bullet">Press <kbd class="font-mono text-xs bg-bg-surface-active border border-border-light rounded-[3px] px-[5px] py-px text-text-primary">Win + R</kbd>, type <code class="font-mono text-xs bg-bg-surface-active text-text-primary px-[5px] py-px rounded-[3px]">mmsys.cpl</code>, press Enter</li>
                <li class="guide-bullet">Click the <strong>Recording</strong> tab</li>
                <li class="guide-bullet">Right-click your microphone → <strong>Properties</strong> → <strong>Listen</strong> tab</li>
                <li class="guide-bullet">Check <strong>"Listen to this device"</strong></li>
                <li class="guide-bullet">Set <strong>"Playback through this device"</strong> to <em>CABLE Input (VB-Audio Virtual Cable)</em></li>
                <li class="guide-bullet">Click <strong>Apply</strong></li>
              </ol>
              <img src="../assets/images/vb-cables-listen-tab.png" alt="Listen tab with the correct settings" class="block w-full border border-border-light mt-2" />
              <div class="bg-bg-surface border-l-[3px] border-l-accent px-2.5 py-2 text-sm text-text-secondary leading-[1.5] mt-2">
                We recommend renaming your VB-Cable device to something recognizable. In our example we named ours <strong>"Microphone RRR (VB-Audio Virtual Cable B)"</strong> — making it easy to identify in any app's device list. To rename: right-click the device in the Recording tab → Properties → change the name at the top.
              </div>
            </InstructionStep>

            <InstructionStep :number="3" title="Route Rum-Runner Rhapsody into the cable">
              <p class="text-text-secondary text-sm leading-[1.6] m-0">
                In Rum-Runner Rhapsody, open the device selector.<br>
                Set one of your outputs to CABLE Input (VB-Audio Virtual Cable).
              </p>
              <img src="../assets/images/vb-cables-rrr-selection.png" alt="RRR device selector with CABLE Input selected" class="block w-full border border-border-light mt-2" />
            </InstructionStep>

            <InstructionStep :number="4" title="Set your app to listen to the cable">
              <p class="text-text-secondary text-sm leading-[1.6] m-0">
                In whichever app you use, find its microphone or audio input setting and select CABLE Output (VB-Audio Virtual Cable).<br><br>
                Discord: Settings → Voice &amp; Video → Input Device<br>
                OBS: Settings → Audio → Mic/Aux<br>
                Zoom / Teams: Settings → Audio → Microphone
              </p>
            </InstructionStep>

          </div>

          <p class="mt-4 mb-0 text-xs text-text-secondary italic">That's it. Both your voice and your soundboard now come through as one input.</p>

        </div>

      </div>
    </div>
  </BaseModal>
</template>
