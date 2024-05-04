const plugin = require('tailwindcss/plugin')

module.exports = plugin(({ addComponents }) => {
  addComponents({
    '.ellipsis': {
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    '.flex-center': {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    '.absolute-fill': {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    },
    '.fixed-fill': {
      position: 'fixed',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    },
    '.text-one-line': {
      wordSpacing: '100vw',
    },
    '.scrollbar-thin': {
      'scrollbar-width': 'thin',
      '&::-webkit-scrollbar': {
        width: '8px',
      },
    },
    '.scrollbar-regular': {
      'scrollbar-width': 'auto',
      '&::-webkit-scrollbar': {
        width: '16px',
      },
    },
    '.scrollbar-hidden': {
      'scrollbar-width': 'none',
      '&::-webkit-scrollbar': {
        width: '0px',
      },
    },
    '.scroll-touch': {
      '-webkit-overflow-scrolling': 'touch',
    },
  })
})
