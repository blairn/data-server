import express from 'express'
import * as permissions from '../permissions.mjs'
import {listDatabases,  listCollections} from './databaseController.mjs'
import {headCollection, readCollection, createCollection, bulkWrite, deleteCollection, getMeta, getExtents} from './collectionController.mjs'
import {headObject, getObject, addObject, updateObject, deleteObject} from './recordController.mjs'
import {headSchema, getSchema, updateSchema, patchSchema} from './schemaController.mjs'
import {getIndex, createIndex, deleteIndex} from './indexController.mjs'
import {watchCollection, watchAggregation} from './watchController.mjs'
import {test1} from './testController.mjs'
export const apiRouter = express.Router()

// headers we support
// ACCEPT, one of **/JSON, **/CSV, **/TSV, **/BSON, **/EJSON, **/XML, **/
// one of **/JSON, **/CSV, **/TSV, **/BSON, **/EJSON, **/XML

// with_id:[true|false], returns _id as part of records. defaults false
// with_last_updated:[true|false], returns _last_updated as part of records. defaults false
// with_owner:[true|false], returns _owner as part of records. defaults false
// with_processed:[true|false], returns _processed as part of records. defaults false

// watch streams, may use a different service for this.
// apiRouter.get("/:db/:collection/:id/_watch", [permissions.streamUpdates], watchCollection) // streams object updates
// apiRouter.post("/:db/:collection/:id/_watch", [permissions.streamUpdates], watchCollection) // watches pipeline changes
// apiRouter.post("/:db/:collection/:id/_watch_agg", [permissions.streamUpdates], watchAggregation) // watches changes in aggregation results

// heads are REALLY only for ETags
// apiRouter.head("/:db/:collection/_schema", [permissions.readCollection], headSchema) // etag for schema
// apiRouter.head("/:db/:collection/:id", [permissions.readCollection], headObject) // etag for object, use HEAD /:db/:collection with post for complex etag
// apiRouter.head("/:db/:collection", [permissions.readCollection], headCollection) // body technically not aloud.

// apiRouter.get("/:db/:collection/_schema", [permissions.readCollection], getSchema) // downloads the entire collection, defaults to csv
// apiRouter.get("/:db/:collection/_index/:index", [permissions.readCollection], getIndex) // gets a single Index, defaults to csv
// apiRouter.get("/:db/:collection/_index", [permissions.readCollection], getIndex) // downloads the entire collection, defaults to csv
// apiRouter.get("/:db/:collection/_meta", [permissions.readCollection], getMeta) // gets general meta data
apiRouter.get("/:db/:collection/_extents/:field", [permissions.readCollection], getExtents) // gets the min and max of the field, which the user can see.
// apiRouter.get("/:db/:collection/:id", [permissions.readCollection], getObject) // post to filter if complex id.
apiRouter.get("/:db/:collection", [permissions.readCollection], readCollection) // downloads the entire collection, defaults to csv
apiRouter.get("/:db", [permissions.listCollections], listCollections) // lists the collections in a database, defaults to text
apiRouter.get("/", [permissions.any], listDatabases) // lists the databases, default to text

// apiRouter.post("/") // never used
// apiRouter.post("/:db/:collection/_schema", [permissions.updateSchema], updateSchema) // for pushing schema updates
// apiRouter.post("/:db/:collection/:id", [permissions.updateObject], updateObject) // simplified patch, defaults to json
apiRouter.post("/:db/:collection", [permissions.readCollection], readCollection) // queries collection, defaults to csv

// if you put AND create_collection:true is in the header, it can create a new collection
// apiRouter.put("/") // never used
// apiRouter.put("/:db", [permissions.createDB], createDB) // creates a database, never used
// apiRouter.put("/:db/:collection/_index/:index", [permissions.createCollection], createIndex) // creates a new collection, body is schema.
// apiRouter.put("/:db/:collection/_index", [permissions.createCollection], createIndex) // creates a new collection, body is schema.
// apiRouter.put("/:db/:collection/_schema", [permissions.createCollection], createCollection) // creates a new collection, body is schema.
// apiRouter.put("/:db/:collection/:id", [permissions.addObject], addObject) // puts a new object, (or overwrites old one), chances are you actually want to use post version.
// apiRouter.put("/:db/:collection", [permissions.bulkWrite], bulkWrite()) // pushes many records, can create collection, schema is build by context.

// apiRouter.patch("/:db/:collection/_schema", [permissions.updateSchema], patchSchema) // patches schema
// apiRouter.patch("/:db/:collection/:id", [permissions.updateObject], updateObject) // patches object
// apiRouter.patch("/:db/:collection", [permissions.bulkWrite], bulkWrite(true)) // does an mongoBulkWrite, updating the old field.

// apiRouter.delete("/:db/:collection/_index/:index", [permissions.deleteIndex], deleteIndex) // deletes an index
// apiRouter.delete("/:db/:collection/:id", [permissions.deleteObject], deleteObject) // deletes an object
// apiRouter.delete("/:db/:collection", [permissions.deleteCollection], deleteCollection) // delete a collection

apiRouter.get("/test/test1", test1)