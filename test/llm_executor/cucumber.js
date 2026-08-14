"use strict";

module.exports = {
  default: {
    paths: ["*.feature"],
    require: ["single-stateless-template_steps.js"],
    format: ["progress-bar", "html:reports/cucumber-report.html"],
    publishQuiet: true,
    timeout: 120000,
  },
};
