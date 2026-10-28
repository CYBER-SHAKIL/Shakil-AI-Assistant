"use strict";
// Public website route. External integrations must use /api/chat with a Shakil API key.
module.exports = function handler(req, res) {
  req._shakilAllowPublicAccess = true;
  return require("../chat")(req, res);
};
