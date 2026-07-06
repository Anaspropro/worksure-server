const crypto = require('crypto');

function mockV4() {
  return crypto.randomUUID();
}

function mockV7() {
  // Return a valid v7 format string (version 7, variant 1)
  const hex = crypto.randomBytes(16).toString('hex');
  return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-7${hex.substring(13, 16)}-8${hex.substring(17, 20)}-${hex.substring(20, 32)}`;
}

module.exports = {
  v4: mockV4,
  v7: mockV7,
};
