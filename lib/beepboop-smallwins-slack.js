'use strict'

var deap = require('deap')
var Back = require('back')
var EventEmitter = require('eventemitter2')

// Spawns new rtm clients as new teams are added
// Also closes connections and manages state as teams are removed
var BeepBoopSmallwins = module.exports = function (slack, config, resourcer) {
  this.config = deap.update({
    debug: false,
    retry: Infinity
  }, config || {})
  this.slack = slack
  this.workers = new EventEmitter()
  this.workers.tokens = {}
  this.workers.tokensByResource = {}
  this.log = console
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
          self.log.info(err)
          return
        }
        // add resource
        self.addResource(botResource)
        // bubble up beepboop resourcer events to clients
        this.workers.emit('add_resource', msg)
      })
      .on('update_resource', (msg) => {
        self.updateResource(BotResource(msg))
        // bubble up beepboop resourcer events to clients
        this.workers.emit('update_resource', msg)
      })
      .on('remove_resource', (msg) => {
        self.removeResource(msg.resourceID)
        // bubble up beepboop resourcer events to clients
        this.workers.emit('remove_resource', msg)
      })
      .on('open', () => {
        // on open, remove any existing resources because since we disconnected,
        // the resourcer should have rescheduled them
        Object.keys(this.workers.tokensByResource).forEach((resourceId) => {
          self.log.info('Removing existing resource: ' + resourceId)
          self.removeResource(resourceId)
        })
        // bubble up beepboop resourcer events to clients
        this.workers.emit('open')
      })
      .on('close', () => {
        self.log.info('Disconnected to Beep Boop Bot Resourcer server.')
        // bubble up beepboop resourcer events to clients
        this.workers.emit('close')
      })
      .on('error', (err) => {
        if (err.code === 'ECONNREFUSED' && err.address === '127.0.0.1') {
          self.log.info('Error connecting to Beep Boop Resource server . Please review' +
            'the BeepBoop Smallwins Slack development instructions here: https://github.com/BeepBoopHQ/beepboop-smallwins-slack' +
            err)
        } else {
          self.log.info('Error received from Beep Boop Resurcer ' + JSON.stringify(err))
        }
        return this
      })
    return this.workers
  },
  addResource: function (botResource) {
    var self = this

    // check if resource (team instance) already exists. If not, add it.
    if (this.workers.tokensByResource[botResource.id]) {
      return self.log.info('Received add_resource event for team that already exists, ignoring: ' + botResource.id)
    }

    var retryBackoff

    var bot = self.slack.rtm.client()
    bot.token = botResource.resource.SlackBotAccessToken
    bot.started((payload) => {
      bot.team_info = payload.team
      bot.identity = payload.self
      self.workers[bot.token] = bot
      self.workers.tokens[payload.team.id] = bot.token
      self.workers.tokensByResource[botResource.id] = bot.token
    })

    function reconnect () {
      var options = {
        minDelay: 1000,
        maxDelay: 30000,
        retries: self.config.retry
      }
      var back = retryBackoff || (retryBackoff = new Back(options))
      return back.backoff(function (fail) {
        if (fail) {
          self.log.info('Reconnect failed after #' + back.settings.attempt + ' attempts and ' + back.settings.timeout + 'ms')
          return
        }

        self.log.info('...reconnect attempt #' + back.settings.attempt + ' of ' + options.retries + ' being made after ' + back.settings.timeout + 'ms')
        listen()
      })
    }

    function listen () {
      bot.listen({token: bot.token}, function (err) {
        if (err) {
          self.log.error('Error calling bot.listen: ', err)
          return reconnect()
        }
        retryBackoff = null
        setupRTM()
        self.workers.emit('start', bot)
      })
    }

    function setupRTM () {
      var lastPong = null
      var pingIntervalId = null

      // monkey-patch close fn to make sure we cleanup any ping/pong or reconnect attempts
      var _close = bot.close
      bot.close = function () {
        // cancel any ping/pong interval we have
        clearPingPong()
        // cancel any retry that is in progress
        if (retryBackoff) {
          retryBackoff.close()
        }
        _close.apply(bot, arguments)
      }

      function clearPingPong () {
        lastPong = null
        if (pingIntervalId !== null) {
          clearInterval(pingIntervalId)
          pingIntervalId = null
        }
      }

      bot.ws.on('pong', function (obj) {
        lastPong = Date.now()
      })

      // Setup ping/pong to detect stale connections
      pingIntervalId = setInterval(function () {
        if (lastPong && lastPong + 12000 < Date.now()) {
          self.log.info('Stale RTM connection, closing RTM')

          clearPingPong()
          // immediately shuts down the connection w/o trying to send msg to server to close
          // this will trigger an ABNORMAL_CLOSE event when connection is broken, firing `reconnect()`
          return bot.ws.terminate()
        }

        bot.ws.ping(null, null, true)
      }, 5000)

      // Add reconnection logic
      bot.ws.on('close', function (code, message) {
        clearPingPong()
        // ABNORMAL_CLOSE event - try to reconnect
        if (code === 1006) {
          self.log.info('Abnormal websocket close event, attempting to reconnect')
          reconnect()
        }
      })
    }

    listen()
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
    if (self.workers.tokensByResource[botResourceId]) {
      var token = self.workers.tokensByResource[botResourceId]
      var bot = self.workers[token]
      if (bot) {
        bot.close()
        delete self.workers[token]
        delete self.workers.tokensByResource[botResourceId]
        delete self.workers.tokens[bot.team_info.id]
        this.workers.emit('stop', bot)
      }
    }
  }}

function BotResource (message) {
  return {
    id: message.resourceID,
    resource: message.resource,
    meta: {
      isNew: message.isNew
    }
  }
}
