const plugin = require('tailwindcss/plugin')

function mediaMin(breakpoint) {
  return `(min-width: ${breakpoint})`
}
function mediaMax(breakpoint) {
  return `(max-width: ${Number.parseInt(breakpoint) - 1}px)`
}

module.exports = plugin(({ addVariant, theme }) => {
  const screens = theme('screens')
  addVariant('disabled', '&:disabled')
  addVariant('ios', '@supports (-webkit-touch-callout: none) { & }')
  addVariant('not-ios', '@supports not (-webkit-touch-callout: none) { & }')
  addVariant('hover', '@media (hover: hover) and (pointer: fine) { &:hover }')

  const screenKeys = Object.keys(screens)
  screenKeys.forEach((a, indexA) => {
    const start = mediaMin(screens[a])
    // looks like we don't actually need this as `max-` is a default with tailwind 3
    // also disabling it because overriding it like this makes max-[] not work
    // addVariant(`max-${a}`, `@media ${start}`)
    screenKeys.forEach((b, indexB) => {
      if (indexA < indexB) {
        const end = mediaMax(screens[b])
        addVariant(`${a}-${b}`, `@media ${start} and ${end}`)
      }
    })
  })

  addVariant('not-hover', ['&:not(:hover)'])
})
