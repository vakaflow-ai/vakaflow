export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {
      // Configure autoprefixer to handle vendor prefixes properly
      grid: true,
      // Disable outdated vendor prefixes that cause warnings in modern browsers
      remove: false,
      // Specify browsers to target - this will prevent adding unnecessary old prefixes
      overrideBrowserslist: [
        '> 0.5%', // Support browsers with more than 0.5% market share
        'last 2 versions', // Support last 2 versions of each browser
        'not dead', // Exclude browsers that are no longer maintained
        'not IE 11', // Explicitly exclude IE11
        'not firefox < 52' // Exclude very old Firefox versions that need -moz-column-gap
      ],
      // Disable specific outdated prefixes
      flexbox: 'no-2009', // Don't add -webkit-box, -moz-box prefixes
      grid: true, // Keep grid prefixes for older browsers
    },
  },
}
