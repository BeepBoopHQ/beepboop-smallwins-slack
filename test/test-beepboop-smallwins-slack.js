/* global describe, it, before, beforeEach, afterEach, after */
var chai = require('chai')
var assert = chai.assert
var expect = chai.expect
var events = require('events')
var sinon = require('sinon')
var BeepBoop = require('beepboop')
var BeepBoopSmallwins = require('../lib/beepboop-smallwins-slack.js')
describe('Smallwins Slack', () => {
  var socket
  var resourcer
  var clock

  chai.should()

  before(() => { clock = sinon.useFakeTimers() })
  after(() => { clock.restore() })
  beforeEach(() => {
    resourcer = BeepBoop.start({logger: console})
    socket = new events.EventEmitter()
    socket.send = function () {}
    sinon.stub(resourcer, 'newWebSocket').returns(socket)

    resourcer.connect(socket)
  })

  afterEach(function () {
    resourcer.newWebSocket.restore()
  })
  describe('Resource', () => {
    it('should remove existing tokens on open', (done) => {
      var bbSmallwins = new BeepBoopSmallwins({}, {}, resourcer)
      bbSmallwins.start()
      bbSmallwins.removeResource = sinon.spy()
      bbSmallwins.workers.tokensByResource = {'resource1': 'token1'}
      resourcer.emit('open', {})
      assert(bbSmallwins.removeResource.called)
      done()
    })
    it("should add a resource when it's added", (done) => {
      var slack = getSlackClientStub()
      var bbSmallwins = new BeepBoopSmallwins(slack, {}, resourcer)
      var workers = bbSmallwins.start()
      resourcer.emit('add_resource', getAddResource())
      workers.tokens['someteam'].should.equal('xoxb-xxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx')
      workers.tokensByResource['resource1'].should.equal('xoxb-xxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx')
      workers['xoxb-xxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx'].should.have.property('team_info')
      done()
    })
    it('should update resource', (done) => {
      var bbSmallwins = new BeepBoopSmallwins({}, {}, resourcer)
      bbSmallwins.start()
      bbSmallwins.removeResource = sinon.spy()
      bbSmallwins.addResource = sinon.spy()
      resourcer.emit('update_resource', getUpdateResource())
      assert(bbSmallwins.removeResource.called)
      clock.tick(500) // advance time by 500ms
      assert(bbSmallwins.addResource.called)
      done()
    })
    it('should remove resource', (done) => {
      var slack = getSlackClientStub()
      var bbSmallwins = new BeepBoopSmallwins(slack, {}, resourcer)
      var workers = bbSmallwins.start()
      resourcer.emit('add_resource', getAddResource())
      resourcer.emit('remove_resource', {'resourceID': 'resource1'})
      expect(workers.tokens).be.empty
      expect(workers.tokensByResource).be.empty
      expect(workers['xoxb-xxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx']).to.not.exist
      done()
    })
  })
})

function getAddResource () {
  return {
    'type': 'add_resource',
    'date': '2016-03-18T20:58:52.907804207Z',
    'msgID': '106e930b-1c83-4406-801d-caf04e30da71',
    // unique identifier for this team connection
    'resourceID': 'resource1',
    'resourceType': 'SlackApp',
    'resource': {
      // Token you should use to connect to the Slack RTM API
      'SlackBotAccessToken': 'xoxb-xxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx',
      'SlackBotUserID': 'XXXXXXXXX',
      'SlackBotUserName': 'name-of-bot-user',
      // Regular access token - will contain additional scopes requested
      'SlackAccessToken': 'XXXXXXXXX',
      'SlackIncomingWebhookConfigURL': 'https://<slack-team-name>.slack.com/services/XXXXXXXXX',
      'SlackIncomingWebhookChannel': '#channel-name',
      'SlackTeamName': 'Name of Team',
      'SlackTeamID': 'XXXXXXXXX',
      'SlackUserID': 'XXXXXXXXX',
      'CUSTOM_CONFIG': 'Value for CUSTOM_CONFIG'
    }
  }
}

function getUpdateResource () {
  return {
    'type': 'update_resource',
    'date': '2016-03-18T21:02:49.719711877Z',
    'msgID': '2ca94d34-ef04-4167-8363-c778d129b8f1',
    'resourceID': '75f9c7334807421bb914c1cff8d4486c',
    'resource': {
      // Token you should use to connect to the Slack RTM API
      'SlackBotAccessToken': 'xoxb-xxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx',
      'SlackBotUserID': 'XXXXXXXXX',
      'SlackBotUserName': 'name-of-bot-user',
      // Regular access token - will contain additional scopes requested
      'SlackAccessToken': 'XXXXXXXXX',
      'SlackTeamName': 'Name of Team',
      'SlackTeamID': 'XXXXXXXXX',
      'SlackUserID': 'XXXXXXXXX',
      'CUSTOM_CONFIG': 'Updated Value for Config'
    }
  }
}
function getSlackClientStub () {
  return {
    'rtm': {
      client: function () {
        return {
          'tokens': {},
          started: (payload) => {
            return payload({'team': {'id': 'someteam'}})
          },
          close: sinon.spy(),
          listen: sinon.spy()
        }
      }
    }
  }
}
