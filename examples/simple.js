'use strict'

var slack = require('slack')

// Beepboop manages the hosting infrastructure for your bot and  publishes events
// when a team adds, updates, or removes the bot, thereby enabling multitenancy
// (multiple team instances of bot in one bot process). The beepboop-smallwins-slack package
// listens for those events handles and starting/stopping the given team bot for you.
// It is the develper's responsiblity to ensure any state stored outside of the configs
// set in the project's bot.yml supports multitency (if you allow multiple teams to run your bot)
var beepboop = require('../index.js')

// beepboop.start returns a EventEmitter that will emit a single event
// `start` when a new rtm connection is made. The start event passes a single
// argument of `bot` of type RTM see https://github.com/smallwins/slack#rtm-events
var workers = beepboop.start(slack, {
  debug: true
})

workers.on('start', (bot) => {
  // on bot started register handlers
  bot.hello((message) => {
    // connection succeeded
    console.log('Got a message: ' + JSON.stringify(message))
  })
  // use the webapi to add a emoji reaction on every received message
  bot.message((message) => {
    slack.reactions.add({
      token: bot.token,
      name: 'wave',
      timestamp: message.ts,
      channel: message.channel
    }, (err, data) => {
      if (err) {
        console.log(err)
      }
    })
  })
})
// after teams have been removed
workers.on('stop', function (bot) {
  // this is an instance of a botkit worker
  console.log('closed bot' + bot)
})
