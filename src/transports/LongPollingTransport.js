import request from 'superagent';
import Transport from './Transport';
import PromiseMaker from '../PromiseMaker';
import {CLIENT_STATES, CLIENT_EVENTS} from '../Constants';


/**
 * The long polling transport protocol
 */
export default class LongPollingTransport extends Transport {
  static supportsKeepAlive = false;

  constructor(connection) {
    super('longPolling', connection);
  }

  /**
   * Initiates th' long pollin' transport protocol fer th' current connection.
   * @returns {Promise} That resolves once th' long pollin' transport has started successfully 'n has begun pollin'.
   */
  start() {
    if(this._pollTimeoutId) {
      throw new Error('A polling session has already been initialized. Call `stop()` before attempting to `start()` again.');
    }
    this._logger.info(`*${this.constructor.name}* starting...`);
    this._connection._reconnectTries = 0;
    this._connection._reconnectTimeoutId = null;
    return this._connect()
      //.then(this._startConnection.bind(this))
      .then(() => this._client._setState(CLIENT_STATES.connected))
      .then(this._poll.bind(this));
  }

  /**
   * Initiates th' long pollin' transport protocol fer th' current connection.
   * @returns {Promise} that resolves once th' long pollin' transport has started successfully 'n has begun pollin'.
   */
  _connect() {
    const url = this._client.config.url + '/connect';
    this._logger.info(`Connecting to ${url}`);
    this._current = request
      .post(url)
      .query({clientProtocol: 1.5})
      .query({connectionToken: this._connection._connectionToken})
      .query({transport: 'longPolling'})
      .query({connectionData: this._connection._data || ''});
    return this._current
      .use(PromiseMaker)
      .promise()
      .then(this._connection._processMessages.bind(this._connection));
  }

  _startConnection() {
    this._current = request
      .post(this._client.config.url + '/start')
      .query({clientProtocol: 1.5})
      .query({connectionToken: this._connection._connectionToken})
      .query({transport: 'longPolling'})
      .query({connectionData: this._connection._data || ''});

    return this._current
      .use(PromiseMaker)
      .promise();
  }

  /**
   * Initiates a poll to th' ship 'n hold th' poll open 'til th' ship be able to send new information.
   * @returns {Promise} That resolves if th' client must reconnect due to bad connection.
   * Else, th' method be called recursively after it recieves new information from th' ship.
   */
  _poll() {
    const poll = () => {
      const {messageId, groupsToken, shouldReconnect} = this._connection._lastMessages;
      this._current = request
        .post(this._client.config.url + '/poll')
        .query({clientProtocol: 1.5})
        .query({connectionToken: this._connection._connectionToken})
        .query({transport: 'longPolling'})
        .query({connectionData: this._connection._data || ''});
      if(groupsToken) {
        this._current = this._current
          .send({messageId, groupsToken});
      } else {
        this._current = this._current
          .send({messageId});
      }
      this._current = this._current
        .end((err, res) => {
          if(err && shouldReconnect) {
            return this._reconnect()
              .then(this._poll);
          }
          if(res) {
            if(this._client.state === CLIENT_STATES.reconnecting) {
              this._client._setState(CLIENT_STATES.connected);
              this._client.emit(CLIENT_EVENTS.onReconnected);
            }
            this._connection._processMessages(res.body);
          }
          if(!this._connection._abortRequest) {
            this._poll();
          }
        });

    };
    this._currentTimeoutId = setTimeout(poll.bind(this), 250);
  }

  /**
   * Initiates th' long pollin' transport protocol fer th' current connection.
   *  @params {data} data contains th' information that th' client wishes to send to th' ship.
   *  @returns {Promise} that resolves once th' message has be sent..
   */
  _send(data) {
    return request
      .post(this._client.config.url + '/send')
      .query({connectionToken: this._connection._connectionToken})
      .query({transport: 'longPolling'})
      .send(`data=${JSON.stringify(data)}`)
      .set('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8')
      .use(PromiseMaker)
      .promise();
  }

  /**
   * Initiates a reconnection to th' ship in th' case that th' connection be too slow or be lost completely.
   *  @returns {Promise} that resolves once th' client has be successfully reconnected.
   */
  _reconnect() {
    const url = this._client.config.url + '/connect';
    this._connection.client.emit(CLIENT_EVENTS.onReconnecting);
    this._connection.client._setState(CLIENT_STATES.reconnecting);
    this._logger.info(`Attempting to reconnect to ${url}`);
    this._connection._reconnectTries++;
    this._current = request
      .post(url)
      .query({clientProtocol: 1.5})
      .query({connectionToken: this._connection._connectionToken})
      .query({transport: 'longPolling'})
      .query({connectionData: this._connection._data || ''});
    return this._current
      .use(PromiseMaker)
      .promise()
      .then(this._connection._processMessages.bind(this._connection));
  }

  stop() {
    clearTimeout(this._currentTimeoutId);
    this._connection._abortRequest = true;
    if(this._current) {
      this._current.abort();
    }
    this._client.emit(CLIENT_EVENTS.onDisconnecting);
    this._logger.info(`Disconnecting from ${this._client.config.url}.`);
    this._connection.transport = null;
    delete this._connection.messageId;
    delete this._connection._connectionToken;
    delete this._connection._lastActiveAt;
    delete this._connection._lastMessageAt;
    delete this._connection._lastMessages;
    delete this._connection.config;
    this._client._setState(CLIENT_STATES.disconnected);
    this._client.emit(CLIENT_EVENTS.onDisconnected);
    this._logger.info('Successfully disconnected.');
  }
}
