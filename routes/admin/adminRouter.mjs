import express from 'express'
import {streamResults,streamObject} from '../streaming.mjs'
import {getAllParents,getAllChildren,canAdmin,allKnownChildren,addTagToNode,addCollection,addParent,removeParent,addAdmin,removeAdmin,matchFor,setRestriction,setUp,getNode,couldEditPermissionsFor} from './admin.mjs'

export const adminRouter = express.Router()

adminRouter.get("/whoAmI", async (req, res, next) => {
    streamObject(req, res, req.dbUser)
})

adminRouter.get("/whoAmIToken", async (req, res, next) => {
    streamObject(req, res, req.user)
})

adminRouter.get("/setup", async (req, res, next) => {
    streamObject(req, res, await setUp(req.dbUser))  
})

adminRouter.get("/", async (req, res, next) => {
    streamResults(req, res, await allKnownChildren(req.dbUser))
})

adminRouter.post("/canEditPermissions", async (req, res, next) => {
    const {node, permission} = req.body
    streamObject(req, res, await couldEditPermissionsFor(req.dbUser, node, permission))
})

adminRouter.put("/createLink", async (req, res, next) => {
    const {parent,child} = req.body
    streamObject(req, res, await addParent(req.dbUser, child, parent))
})

adminRouter.delete("/createLink", async (req, res, next) => {
    const {parent,child} = req.body
    streamObject(req, res, await removeParent(req.dbUser, child, parent))
})

adminRouter.put("/db", async (req, res, next) => {
    const {db,collection} = req.body
    streamObject(req, res, await addCollection(req.dbUser, db, collection))
})

adminRouter.put("/addNode", async (req, res, next) => {
    const {parent,child,org} = req.body
    streamObject(req, res, await addTagToNode(req.dbUser, child, parent))
})

adminRouter.put("/admin", async (req, res, next) => {
    const {node,admin} = req.body
    streamObject(req, res, await addAdmin(req.dbUser, node,admin))
})

adminRouter.delete("/admin", async (req, res, next) => {
    const {node,admin} = req.body
    streamObject(req, res, await removeAdmin(req.dbUser, node,admin))
})

adminRouter.put("/restriction", async (req, res, next) => {
    const {db, collection, node, permission, org} = req.body
    streamObject(req, res, await setRestriction(node, db, collection, node, permission))
})

adminRouter.post("/matchFor", async (req, res, next) => {
    const {db, collection, node, permission} = req.body
    streamObject(req, res, await matchFor(node, db, collection, node, permission))
})

adminRouter.post("/parents", async (req, res, next) => {
    const {node} = req.body
    streamResults(req, res, await getAllParents(req.dbUser, node))
})

adminRouter.post("/children", async (req, res, next) => {
    const {node} = req.body
    streamObject(req, res, await getAllChildren(req.dbUser, node))
})

adminRouter.post("/canAdmin", async (req, res, next) => {
    const {node} = req.body
    streamObject(req, res, {result: await canAdmin(req.dbUser, node)})
})

adminRouter.post("/", async (req, res, next) => {
    const {node} = req.body
    streamObject(req, res, {result: await getNode(req.dbUser, node)})
})

  
//   export const _setUp = async (req, res, next) => {
//     const {node} = req.params
//     streamObject(req, res, await setUp(req.dbUser, node))
//   }
  

// adminRouter.get("/allKnownChildren", _allKnownChildren) // adds a tag, returns the new tag
// adminRouter.put("/nodes/:node/:tag", addTag) // adds a tag, returns the new tag
// adminRouter.get("/nodes/:node", getNode) // gets the node, if you are an admin for it.
// apiRouter.get("/:node", node) // gets the node, if you are an admin for it.
// apiRouter.get("/:node/admins", admins) // gets all of the admins for a node
// apiRouter.get("/search/:string", search) // searchs the nodes
