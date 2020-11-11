import {mongo} from './databases.mjs'
import fetch from 'node-fetch'
import bson from 'bson'

export const ejsonBodyParser = async (req,res,next) => {
  let json = req.body
  if (json) {
    req.body = bson.EJSON.parse(JSON.stringify(json))
  }
  next()
}