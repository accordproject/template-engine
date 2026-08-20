"use strict";

module.exports = {
  default: {
    paths: ["features/*.feature"],
    require: ["stateless-template_steps.js", "stateful-template_steps.js"],
    format: ["progress-bar", "html:reports/cucumber-report.html"],
    publishQuiet: true,
    timeout: 120000,
  },
};
