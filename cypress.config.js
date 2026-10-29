const { defineConfig } = require("cypress");
require('dotenv').config()

module.exports = defineConfig({
  reporter: 'mochawesome',
	reporterOptions:{
		reportDir:'cypress/results',
		overwrite: false,
		html: false,
		json: true,
	},
  e2e: {
    defaultCommandTimeout: 10000,
    viewportHeight: 768,
    viewportWidth: 1024,
    setupNodeEvents(on, config) {
      if (process.env.staging_url) {
        config.baseUrl = process.env.staging_url
      }
      return config;
    },
  },
});
