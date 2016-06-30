'use strict'

var deap = require('deap')
var EventEmitter = require('events')

// Spawns new rtm clients as new teams are added
// Also closes connections and manages state as teams are removed
var BeepBoopSmallwins = module.exports = function (slack, config, resourcer) {
  this.config = deap.update({
    debug: false,
    retry: Infinity
  }, config || {})
  this.slack = slack
  this.bots = new EventEmitter()
  this.bots.tokens = {}
  this.bots.tokensByResource = {}
  this.bots.bots = {}
  this.log = resourcer.log
  this.resourcer = resourcer
}

BeepBoopSmallwins.prototype = {
  start: function () {
    var self = this

    // Register new bot resource
    this.resourcer
      .on('add_resource', (msg) => {
        var botResource = BotResource(msg)

        if (!botResource.resource.SlackBotAccessToken) {
          var err = new Error('SlackBotAccessToken not present in message: ' + JSON.stringify(botResource) + '. Bot not added.')
          self.log.error(err.toString())
          return
        }
        // add resource
        self.addResource(botResource)
      })
      .on('update_resource', (msg) => {
        self.updateResource(BotResource(msg))
      })
      .on('remove_resource', (msg) => {
        var botResource = BotResource(msg)
        self.removeResource(botResource.id)
      })
      .on('open', () => {
        // on open, remove any existing resources because since we disconnected,
        // the resourcer should have rescheduled them
        Object.keys(this.bots.tokensByResource).forEach((resourceId) => {
          self.log.info('Removing existing resource: ' + resourceId)
          self.removeResource(resourceId)
        })
      })
      .on('close', () => {
        self.log.error('Disconnected to Beep Boop Bot Resourcer server.')
      })
      .on('error', (err) => {
        if (err.code === 'ECONNREFUSED' && err.address === '127.0.0.1') {
          self.log.error('Error connecting to Beep Boop Resource server . Please review' +
            'the BeepBoop Smallwins Slack development instructions here: https://github.com/BeepBoopHQ/beepboop-smallwins-slack' +
            JSON.stringify(err))
        } else {
          self.log.error('Error received from Beep Boop Resurcer ' + JSON.stringify(err))
        }

        return this
      })
  },
  addResource: function (botResource) {
    var self = this

    // check if resource (team instance) already exists. If not, add it.
    if (!this.bots.bots[botResource.id]) {
      var bot = self.slack.rtm.client()
      bot.token = botResource.slackBotAccessToken
      bot.started((payload) => {
        bot.team_info = payload.team
        bot.identity = payload.self
        self.bots[bot.token] = bot
        self.bots.tokens[payload.team.id] = bot.token
        self.bots.tokensByResource[botResource.id] = bot.token
      })
      bot.listen({token: bot.token})
    }
  },
  updateResource: function (botResource) {
    var self = this

    self.removeResource(botResource)
    setTimeout(() => {
      self.addResource(botResource)
    }, 500)
  },
  removeResource: function (botResourceId) {
    var self = this

    if (self.bots.bots[botResourceId]) {
      var token = self.bots.tokensByResource[botResourceId]
      var bot = self.bots[token]
      if (bot) {
        bot.close()
        delete self.bots.bots[token]
        delete self.bots.tokensByResource[botResourceId]
        delete self.bots.tokens[bot.team_info.id]
      }
    }
  }}

function BotResource (message) {
  return {
    id: message.resourceID,
    resource: message.resource,
    slackBotAccessToken: message.resource.SlackBotAccessToken,
    meta: {
      isNew: message.isNew
    }
  }
}
