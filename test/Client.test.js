import {expect} from 'chai';
import Client, {CLIENT_CONFIG_DEFAULTS} from '../src/Client';
import {CLIENT_STATES} from '../src/Constants';
import Logdown from 'logdown';

describe('Client', function() {
  it('Initializes with the default configuration', function() {
    const client = new Client();
    expect(client._config).to.be.deep.equal(CLIENT_CONFIG_DEFAULTS);
  });

  it('Negotiates the connection', function(done) {
    const client = new Client({url: 'http://signalr.pwnt.co:1984/raw-connection'});
    client._negotiate()
      .then(connection => {
        expect(connection).to.not.be.empty;
        done();
      });
  });

  it('Starts', function(done) {
    const client = new Client({url: 'http://signalr.pwnt.co:1984/raw-connection'});
    client.start()
      .then(client => {
        expect(client.state).to.be.equal(CLIENT_STATES.started);
        done();
      });
  });
  it('Stops', function(done) {
    const client = new Client({url: 'http://signalr.pwnt.co:1984/raw-connection'});
    client.start()
      .then(client => {
        expect(client.state).to.be.equal(CLIENT_STATES.started);
        client.stop();
        setTimeout(() => {
          expect(client.state).to.be.equal(CLIENT_STATES.stopped);
          done();
        }, 100);
      });
  });
  it('Can handle events: Starting and Started', function(done) {
    let starting = false;
    let started = false;
    const client = new Client({url: 'http://signalr.pwnt.co:1984/raw-connection'});
    client.starting(() => {
      client._logger.info('Starting true');
      starting = true;
    });
    client.started(() => {
      client._logger.info('Started true');
      started = true;
    });
    client.start()
      .then(() => {
        if(starting && started) {
          done();
        }
    });
  });
  it('Can handle events: Stopping and Stopped', function(done) {
    let stopping = false;
    let stopped = false;
    const client = new Client({url: 'http://signalr.pwnt.co:1984/raw-connection'});
    client.stopping(() => {
      stopping = true;
    });
    client.stopped(() => {
      stopped = true;
    });
    client.start()
      .then(client => {
        client.stop();
        setTimeout(() => {
          if(stopping && stopped){
            done();
          }
        }, 100);
      });
  });
  it('Can handle events: onStateChanging and onStateChanged', function(done){

  });
});

