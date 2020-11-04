import express from 'express'
import {whoAmIToken, whoAmIDB,setup, _allKnownChildren} from './adminController.mjs'
export const adminRouter = express.Router()

// adminRouter.put("/collections/:collection", addCollection) // gets the node, if you are an admin for it.
adminRouter.get("/whoAmIToken", whoAmIToken)
adminRouter.get("/whoAmIDB", whoAmIDB)
adminRouter.get("/setup", setup) // adds a tag, returns the new tag
adminRouter.get("/allKnownChildren", _allKnownChildren) // adds a tag, returns the new tag
// adminRouter.put("/nodes/:node/:tag", addTag) // adds a tag, returns the new tag
// adminRouter.get("/nodes/:node", getNode) // gets the node, if you are an admin for it.
// apiRouter.get("/:node", node) // gets the node, if you are an admin for it.
// apiRouter.get("/:node/admins", admins) // gets all of the admins for a node
// apiRouter.get("/search/:string", search) // searchs the nodes
