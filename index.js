'use strict'

var BeepBoop = require('beepboop')
var BeepBoopSmallwins = require('./lib/beepboop-smallwins-slack.js')

exports.start = function (slack, config) {
  var beepboop = BeepBoop.start(config)
  var beepBoopSmallwins = new BeepBoopSmallwins(slack, config, beepboop)
  beepBoopSmallwins.start()
}
