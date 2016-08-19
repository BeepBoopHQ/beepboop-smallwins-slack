[![Build Status](https://travis-ci.org/BeepBoopHQ/beepboop-smallwins-slack.svg)](https://travis-ci.org/BeepBoopHQ/beepboop-smallwins-slack)

## beepboop-smallwins-slack - Run a multi-team smallwins-slack bot on Beep Boop.

`beepboop-smallwins-slack` allows bot developers to run a [smallwins/slack](https://github.com/smallwins/slack) based bot on the [Beep Boop HQ](http://beepboophq.com) bot hosting platform and support multiple teams.

Supporting multiple teams from a single bot process is made simpler as `beepboop-smallwins-slack` handles creating new RTM connections as new teams add your bot.

## Install
`npm install --save beepboop-smallwins-slack`

## Use

```javascript
var slack = require('slack')
var beepboop = require('beepboop-smallwins-slack')
var workers = beepboop.start(slack, {
  debug: true
})

workers.on('start', (bot) => {
  // on bot started register handlers
  bot.hello((message) => {
    // connection succeeded
    console.log('Got a message: ' + JSON.stringify(message))
  })
})

```

see [examples/simple.js](https://github.com/BeepBoopHQ/beepboop-smallwins-slack/blob/master/examples/simple.js) for an example.

## Module: beepboop-smallwins-slack

Module has exported function `start`

### BeepBoop.start([options Object])

* `options.debug` Boolean - Logs debug output if true
* Returns an [EventEmitter2](https://github.com/asyncly/EventEmitter2) instance.  For more information on the events exposed, please see the underlying [`beepboop`](https://github.com/BeepBoopHQ/beepboop-js) module's documentation, as it is what is returned here.

### Accessing slack workers

Since there can be multiple slack workers spawned (1 for each team), these are exposed via a `workers` property on the returned beepboop instance after calling `start()`.  The `workers` property is an object hash where the key is a unique bot token identifying the worker, and the value is the [rtm client](https://github.com/smallwins/slack/blob/master/src/rtm.client.js) as returned from slack's `listen()` function.

```javascript
var slack = require('slack')
var beepboop = require('beepboop-smallwins-slack')
var workers = beepboop.start(slack, {
  debug: true
})

// after teams have been added
workers.on('start', function (bot) {
  bot.hello(message=> {
    console.log(`Got a message: ${message}`)
  })
})
```

### Additional Events

This module will bubble up events sent from the [beepboop-js](https://github.com/BeepBoopHQ/beepboop-js#module-beepboop) package
