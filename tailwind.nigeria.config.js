/** Build-only config for the Nigeria hub. Output is css/tailwind-ng.css. */
module.exports = {
  content: [
    "./ddbs-nig.html",
    "./js/nigeria-dashboard.js",
    "./js/nigeria-landing.js",
    "./js/nigeria-units.js",
    "./js/nigeria-dashboard-report.js",
    "./js/nigeria-gallery-manifest.js",
    "./js/ddbs-nigeria-programs.js",
    "./js/ddbs-nigeria-hero-billboard.js",
    "./js/ddbs-nigeria-meeting-notes.js",
    "./js/monthly-unit-report.js",
    "./js/billion-countdown.js",
    "./js/prayer-city-super-user.js",
    "./js/prayer-city-routing.js",
  ],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#0f3d5c", light: "#1a5f8a", soft: "#e8f4fc", accent: "#c9a227" },
        ng: { green: "#008751", white: "#ffffff" },
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        sans: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        verse: ['"Cormorant Garamond"', "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 4px 24px rgba(15, 61, 92, 0.08), 0 1px 3px rgba(0,0,0,0.06)",
        lift: "0 12px 40px rgba(15, 61, 92, 0.12)",
      },
    },
  },
};
