import {streamResults} from '../streaming.mjs'
import {mongo} from '../../libs/databases.mjs'
import {Readable} from 'stream'

// TODO:security

export const listDatabases = async (req, res, next) => {
  
  let databases = await mongo.db().admin().listDatabases({nameOnly:true, authorizedDatabases:true})
  streamResults(req,res,Readable.from(databases.databases))
}

export const listCollections = async (req, res, next) => {
  const { db } = req.params;
  const collections = await mongo.db(db).collections()
  streamResults(req,res,Readable.from(collections.map(x=>({db:x.dbName,collection:x.collectionName}))))
}
