const ReebeloScraper = require('./ReebeloScraper');
const GreenGadgetsScraper = require("./GreenGadgetsScraper");

module.exports = [
  new ReebeloScraper(),
  new GreenGadgetsScraper()
];
