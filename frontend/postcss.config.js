export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {
      // Configure autoprefixer to handle vendor prefixes properly
      grid: true,
      // Enable removal of outdated vendor prefixes that cause warnings in modern browsers
      remove: true,
      // Specify modern browsers to target - this will prevent adding unnecessary old prefixes
      overrideBrowserslist: [
        '> 1%', // Support browsers with more than 1% market share
        'last 2 versions', // Support last 2 versions of each browser
        'not dead', // Exclude browsers that are no longer maintained
        'not IE 11', // Explicitly exclude IE11
        'not firefox < 60', // Exclude older Firefox versions
        'not safari < 12', // Exclude older Safari versions
        'not ios_saf < 12' // Exclude older iOS Safari versions
      ],
      // Disable specific outdated prefixes
      flexbox: 'no-2009', // Don't add -webkit-box, -moz-box prefixes
      grid: true, // Keep grid prefixes for older browsers
      // Remove outdated text-size-adjust prefixes
      supports: false,
      // Be more aggressive about cleaning up old prefixes
      cascade: true,
    },
  },
}
