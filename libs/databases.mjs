import dotenv from 'dotenv'
import mongodb from 'mongodb'
const {MongoClient, ObjectId} = mongodb

dotenv.config()
const {MONGO_URI, MONGO_LOG_URI} = process.env;

export {ObjectId}

export const mongo = new MongoClient(MONGO_URI, { poolSize:10, useNewUrlParser: true, useUnifiedTopology:true });
mongo.connect();

export const mongo_log = new MongoClient(MONGO_LOG_URI, { poolSize:2, useNewUrlParser: true, useUnifiedTopology:true });
mongo_log.connect();

