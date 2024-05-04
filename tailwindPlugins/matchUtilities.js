const plugin = require('tailwindcss/plugin')
const {
  default: flattenColorPalette,
} = require('tailwindcss/lib/util/flattenColorPalette')

module.exports = plugin(({ theme, matchUtilities }) => {
  matchUtilities(
    {
      'scrollbar-track': value => ({
        '--scrollbar-track-color': value,
        'scrollbar-color':
          'var(--scrollbar-thumb-color) var(--scrollbar-track-color)',
        '&::-webkit-scrollbar-track': {
          'background-color': 'var(--scrollbar-track-color)',
        },
      }),
      'scrollbar-thumb': value => ({
        '--scrollbar-thumb-color': value,
        'scrollbar-color':
          'var(--scrollbar-thumb-color) var(--scrollbar-track-color)',
        '&::-webkit-scrollbar-thumb': {
          'background-color': 'var(--scrollbar-thumb-color)',
        },
      }),
    },
    {
      values: flattenColorPalette(theme('colors')),
      type: 'color',
    },
  )
})
