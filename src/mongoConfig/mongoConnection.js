import {MongoClient} from 'mongodb';
import {mongoConfig, initializeMongoConfig} from './settings.js';

let _connection = undefined;
let _db = undefined;
let _initialized = false;

const dbConnection = async () => {
  // Initialize config from Gist if not already done
  if (!_initialized) {
    await initializeMongoConfig();
    _initialized = true;
  }

  if (!_connection) {
    const uri = mongoConfig.serverUrl;
    if (!uri) {
      throw new Error('MongoDB URI is not configured. Failed to fetch from Gist. Please ensure Gist is accessible.');
    }
    const client = new MongoClient(uri);
    _connection = await client.connect();
    _db = _connection.db(mongoConfig.database);
  }

  return _db;
};

const closeConnection = async () => {
  if (_connection) {
    await _connection.close();
    _connection = undefined;
    _db = undefined;
  }
};

export {dbConnection, closeConnection};
