"use strict";
// Public website route. External integrations must use /api/generate-image with a Shakil API key.
module.exports = function handler(req, res) {
  req._shakilAllowPublicAccess = true;
  return require("../generate-image")(req, res);
};
