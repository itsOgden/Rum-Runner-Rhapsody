<script setup lang="ts">
import { ref } from 'vue'
import { helpModalOpen } from '../modalState'

type Tab = 'audio-setup'
const activeTab = ref<Tab>('audio-setup')

const tabs: { id: Tab; label: string }[] = [
  { id: 'audio-setup', label: 'VB Cables' },
]
</script>

<template>
  <Teleport to="body">
    <div
      v-if="helpModalOpen"
      class="fixed inset-0 bg-black/60 backdrop-blur-xs z-100 flex justify-center items-center"
      @click.self="helpModalOpen = false"
    >
      <div class="modal bg-bg-raised border border-border rounded-lg shadow-lg overflow-hidden">

        <!-- ── Header ────────────────────────────────────────────────────── -->
        <div class="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div class="text-lg font-bold text-text-primary">Help</div>
          <button class="close-btn" @click="helpModalOpen = false">×</button>
        </div>

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

            <!-- ── AUDIO SETUP tab ── -->
            <div v-if="activeTab === 'audio-setup'">

              <div class="guide-header">
                <div class="guide-title">Audio Routing with VB-Cable</div>
                <p class="guide-subtitle">How to make Discord and OBS hear your soundboard</p>
              </div>

              <div class="concept-box">
                VB-Cable creates a virtual microphone on your PC. You point your real mic and Rum-Runner Rhapsody at it, and Discord or OBS hears everything mixed together — as if it's all coming from one microphone.
              </div>

              <div class="steps">

                <div class="step">
                  <div class="step-badge">1</div>
                  <div class="step-content">
                    <div class="step-title">Install VB-Cable</div>
                    <p class="step-body">
                      Download and install the free driver from vb-audio.com/Cable.<br>
                      Right-click the installer → Run as Administrator.<br>
                      Restart your PC when prompted.
                    </p>
                  </div>
                </div>

                <div class="step">
                  <div class="step-badge">2</div>
                  <div class="step-content">
                    <div class="step-title">Route your microphone into the cable</div>
                    <p class="step-body">
                      Press Win + R, type <code>mmsys.cpl</code>, press Enter.<br>
                      Go to the Recording tab.<br>
                      Right-click your microphone → Properties → Listen tab.<br>
                      <span class="step-check">✓</span> Check "Listen to this device"<br>
                      Set "Playback through this device" to CABLE Input (VB-Audio Virtual Cable).<br>
                      Click Apply.
                    </p>
                    <div class="screenshot-placeholder">📷 Screenshot: Listen tab with the correct settings</div>
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
                    <div class="screenshot-placeholder">📷 Screenshot: RRR device selector with CABLE Input selected</div>
                  </div>
                </div>

                <div class="step">
                  <div class="step-badge">4</div>
                  <div class="step-content">
                    <div class="step-title">Set Discord or OBS to listen to the cable</div>
                    <p class="step-body">
                      Discord: Settings → Voice &amp; Video → Input Device → CABLE Output (VB-Audio Virtual Cable)<br>
                      OBS: Settings → Audio → Mic/Aux → CABLE Output (VB-Audio Virtual Cable)
                    </p>
                  </div>
                </div>

              </div>

              <p class="guide-closing">That's it. Both your voice and your soundboard now come through as one input.</p>

            </div>

          </div>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* ---- Modal shell ---- */
.modal {
  width: 600px;
}

/* ---- Tab list (left panel) ---- */
.tab-list {
  width: 120px;
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

/* ---- Close button ---- */
.close-btn {
  background: none;
  border: none;
  color: var(--color-text-dim);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
  border-radius: 4px;
  transition: color 0.15s;
}
.close-btn:hover { color: var(--color-text-primary); }

/* ---- Guide header ---- */
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

/* ---- Step cards ---- */
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

/* ---- Concept box ---- */
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

/* ---- Inline code ---- */
code {
  font-family: var(--font-mono);
  font-size: 11px;
  background: var(--color-bg-surface-active);
  color: var(--color-text-primary);
  padding: 1px 5px;
  border-radius: 3px;
}

/* ---- Checkmark ---- */
.step-check {
  color: var(--color-accent);
  font-weight: 600;
}

/* ---- Screenshot placeholder ---- */
.screenshot-placeholder {
  border: 1px dashed var(--color-border);
  background: var(--color-bg-surface);
  padding: 12px;
  border-radius: 4px;
  color: var(--color-text-secondary);
  font-size: 12px;
  margin-top: 8px;
}

/* ---- Closing line ---- */
.guide-closing {
  margin-top: 16px;
  margin-bottom: 0;
  font-size: 12px;
  color: var(--color-text-dim);
  font-style: italic;
}
</style>
