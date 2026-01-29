const normalizers = require('./normalizers');

module.exports = function normalize(scraperName, result) {
  const normalizer = normalizers[scraperName];
  if (!normalizer) {
    throw new Error(`No normalizer registered for ${scraperName}`);
  }
  return normalizer(result);
};
