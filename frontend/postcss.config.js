export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {
      // Configure autoprefixer to handle vendor prefixes properly
      grid: false, // Disable grid prefixes to reduce warnings
      // Disable outdated vendor prefixes that cause warnings in modern browsers
      remove: true, // Remove outdated prefixes
      // Specify browsers to target - this will prevent adding unnecessary old prefixes
      overrideBrowserslist: [
        '> 1%', // Support browsers with more than 1% market share
        'last 2 versions', // Support last 2 versions of each browser
        'not dead', // Exclude browsers that are no longer maintained
        'not IE 11', // Explicitly exclude IE11
        'not firefox < 60', // Exclude old Firefox versions
        'not chrome < 60', // Exclude old Chrome versions
        'not safari < 12' // Exclude old Safari versions
      ],
      // Disable specific outdated prefixes
      flexbox: 'no-2009', // Don't add -webkit-box, -moz-box prefixes
      // Suppress warnings for known problematic properties
      ignoreUnknownVersions: true,
    },
  },
}
