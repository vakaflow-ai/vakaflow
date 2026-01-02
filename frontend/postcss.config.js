export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {
      // Configure autoprefixer to handle vendor prefixes properly
      grid: true,
      flexbox: true,
      // Disable outdated vendor prefixes that cause warnings in modern browsers
      remove: false,
      // Specify browsers to target - this will prevent adding unnecessary old prefixes
      overrideBrowserslist: [
        '> 0.5%', // Support browsers with more than 0.5% market share
        'last 2 versions', // Support last 2 versions of each browser
        'not dead', // Exclude browsers that are no longer maintained
        'not IE 11' // Explicitly exclude IE11
      ],
      // Disable specific outdated prefixes
      flexbox: 'no-2009', // Don't add -webkit-box, -moz-box prefixes
      grid: true, // Keep grid prefixes for older browsers
      // Don't add column-gap prefixes for Firefox < 52 (very old)
      'column-gap': false
    },
  },
}
