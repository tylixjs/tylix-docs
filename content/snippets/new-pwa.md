```js
// tylix.config.js: or run `npx tylix make:pwa`
export default defineConfig({
  pwa: {
    name: 'Acme Console',
    shortName: 'Acme',
    themeColor: '#0034CA',
    // Long-press the home-screen icon for these
    shortcuts: [{ name: 'Status', url: '/status' }],
  },
})
```
