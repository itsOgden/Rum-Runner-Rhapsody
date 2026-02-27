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
                <div class="guide-title">Setting Up VB-Cable for Streaming</div>
                <p class="guide-subtitle">Route your microphone and soundboard audio into a single input for Discord, OBS, or any streaming app.</p>
              </div>

              <div class="steps">

                <div class="step">
                  <div class="step-badge">1</div>
                  <div class="step-content">
                    <div class="step-title">Download &amp; Install VB-Cable</div>
                    <p class="step-body">Visit vb-audio.com/Cable and download the free VB-CABLE driver. Run VBCABLE_Setup_x64.exe as Administrator and follow the prompts. Restart your computer when prompted — this is required for the driver to load correctly.</p>
                    <p class="step-note">VB-Cable is free (donationware). You only need the base package.</p>
                  </div>
                </div>

                <div class="step">
                  <div class="step-badge">2</div>
                  <div class="step-content">
                    <div class="step-title">Verify the Virtual Devices Appear</div>
                    <p class="step-body">After restarting, open Windows Settings → System → Sound. Confirm you can see two new devices: "CABLE Input (VB-Audio Virtual Cable)" in your output devices, and "CABLE Output (VB-Audio Virtual Cable)" in your input devices.</p>
                  </div>
                </div>

                <div class="step">
                  <div class="step-badge">3</div>
                  <div class="step-content">
                    <div class="step-title">Route Your Microphone into the Cable</div>
                    <p class="step-body">Open Windows Settings → System → Sound → More sound settings. Go to the Recording tab, right-click your microphone, and select Properties. Click the Listen tab, check "Listen to this device", and set "Playback through this device" to "CABLE Input (VB-Audio Virtual Cable)". Click Apply.</p>
                    <p class="step-note">This makes your mic audio flow into the virtual cable so it can be mixed with the soundboard.</p>
                  </div>
                </div>

                <div class="step">
                  <div class="step-badge">4</div>
                  <div class="step-content">
                    <div class="step-title">Set Rum-Runner Rhapsody's Output to CABLE Input</div>
                    <p class="step-body">In Rum-Runner Rhapsody, open the device settings and set one of your output devices to "CABLE Input (VB-Audio Virtual Cable)". This routes all soundboard audio into the same virtual cable that your microphone is flowing through.</p>
                  </div>
                </div>

                <div class="step">
                  <div class="step-badge">5</div>
                  <div class="step-content">
                    <div class="step-title">Select CABLE Output in Your App</div>
                    <p class="step-body">In Discord, OBS, or your streaming app, set the microphone/input device to "CABLE Output (VB-Audio Virtual Cable)". Your app will now receive both your microphone and the soundboard mixed together as a single input.</p>
                  </div>
                </div>

                <div class="step">
                  <div class="step-badge">6</div>
                  <div class="step-content">
                    <div class="step-title">Optional: Monitor Your Mixed Audio</div>
                    <p class="step-body">To hear the mixed output through your headphones, open Sound settings, go to the Recording tab, right-click "CABLE Output", select Properties → Listen tab, check "Listen to this device", and set playback to your headphones.</p>
                    <p class="step-note">This lets you confirm the mix sounds right before going live.</p>
                  </div>
                </div>

              </div>
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

.step-note {
  font-style: italic;
  color: var(--color-text-secondary);
  font-size: 11px;
  margin-top: 6px;
  margin-bottom: 0;
  border-left: 2px solid var(--color-accent);
  padding-left: 8px;
}
</style>
