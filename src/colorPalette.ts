export const COLOR_PALETTE = [
  // Warm
  { hex: '#F9B71D', label: 'Gold'    },
  { hex: '#FF8C20', label: 'Amber'   },
  { hex: '#FF5530', label: 'Ember'   },
  { hex: '#FF3060', label: 'Rose'    },
  // Jewel
  { hex: '#E040C0', label: 'Magenta' },
  { hex: '#9040F0', label: 'Violet'  },
  { hex: '#5060F0', label: 'Indigo'  },
  { hex: '#2888FF', label: 'Blue'    },
  // Fresh
  { hex: '#20B0E8', label: 'Sky'     },
  { hex: '#20C0A8', label: 'Teal'    },
  { hex: '#28B050', label: 'Jade'    },
  { hex: '#78C020', label: 'Lime'    },
  // Neutral
  { hex: '#C08830', label: 'Bronze'  },
  { hex: '#6888A8', label: 'Slate'   },
  { hex: '#909090', label: 'Gray'    },
] as const

export type PaletteEntry = (typeof COLOR_PALETTE)[number]
export const DEFAULT_ACCENT = COLOR_PALETTE[0].hex
