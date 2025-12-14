import { MongoClient } from 'mongodb';
const mongoUri = process.env.NEXT_MONGODB_URI

let _connection = undefined;
let _db = undefined;

const dbConnection = async () => {
  if (!_connection) {
    _connection = await MongoClient.connect(mongoUri);
    
    const url = new URL(mongoUri);    
    _db = _connection.db('locallens-data');
  }

  return _db;
};

const closeConnection = async () => {
  await _connection.close();
};

export { dbConnection, closeConnection };
