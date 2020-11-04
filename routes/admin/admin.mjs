import {mongo} from '../../libs/databases.mjs'

const all_parents_query = (node_ids) => ([
  {$match: {_id: {$in:node_ids}}}, 
  {$graphLookup: {
      from: "security",
      startWith: "$parents",
      connectFromField: "parents",
      connectToField: "_id",
      as: "path",
      maxDepth: 60
  }}
])

const all_children_query = (node_ids) => ([
  {$match: {_id: {$in:node_ids}}}, 
  {$graphLookup: {
      from: "security",
      startWith: "$_id",
      connectFromField: "children",
      connectToField: "_id",
      as: "path",
      maxDepth: 60
  }},
  {$unwind: "$path"},
  {$replaceRoot: {newRoot: "$path"}},
  {$group:{
    _id:"$_id",
    record:{$first:"$$ROOT"}
  }},
  {$replaceRoot: {newRoot: "$record"}},
])

export const getAllParents = node_ids => mongo.db('control').collection("security").aggregate(all_parents_query(node_ids))
export const getAllChildren = node_ids => mongo.db('control').collection("security").aggregate(all_children_query(node_ids))

export const canAdmin = async(user, node_id, parents_only = false) => {
  if (!parents_only && user.admins.includes(node_id)) {
    return true
  }
  const parents = await getAllParents([node_id]).toArray()
  return parents.some(parent => parent.path.some(id => user.admins.includes(id)))
}

export const allKnownChildren = async (user) => {
  console.log("getting children", user)
  const children = await getAllChildren(user.admins)
  return await children
}

export const addTagToNode = async (user, tag, node_id) => {
  const security = mongo.db('control').collection("security")
  if (!canAdmin(user, node_id)) {
    throw 'ಠ_ಠ, you do not have admin rights to the node you are trying to add this to'
  }
  const _id = tag.startsWith('#')?tag:'#'+tag
  // if we add a collection which already exists, then just return it.... we are already done.
  const dupe_check = await security.findOne({_id})
  console.log("is the thing there? ", dupe_check)
  if (dupe_check) {
    return dupe_check
  }

  const new_tag = {
    _id,
    type:'tag',
    parents:[node_id],
    adminedBy:[user._id],
    children:[],
    restrictions:{}
  }
  await security.insertOne(new_tag)
  await security.updateOne({_id:node_id}, {$addToSet:{children:_id}})
  await security.updateOne({_id:user._id}, {$addToSet:{admins:_id}})
  return new_tag
}

export const addCollection = async (user, db, collection) => {
  const security = mongo.db('control').collection("security")
  if (!user.collectionCreator) {
    throw "ಠ_ಠ, you do not have collection creator access, so you can't create collections" 
  }
  const _id = `&${db}/${collection}`

  // if we add a collection which already exists, then just return it.... we are already done.
  const dupe_check = await security.findOne({_id})
  console.log("is the thing there? ", dupe_check)
  if (dupe_check) {
    return dupe_check
  }

  const new_collection = {
    _id,
    db,
    collection,
    type:'collection',
    parents:[],
    children:[],
    adminedBy:[user._id],
    restrictions:{}
  }
  const collection_result = await security.insertOne(new_collection)
  const admin_update_result = await security.updateOne({_id:user._id}, {$addToSet:{admins:_id}})
  return new_collection
}

export const addParent = async (user, node_id, parent_id) => {
  const security = mongo.db('control').collection("security")
  if (!canAdmin(user,parent_id)) {
    throw "ಠ_ಠ, you can't add children to a node you don't admin"
  }
  await security.updateOne({_id:parent_id}, {$addToSet:{children:node_id}})
  await security.updateOne({_id:node_id}, {$addToSet:{parents:parent_id}})
}

export const setUp = async (user) => {
  const hourly = await addCollection(user,"population","hourly")
  const monthly = await addCollection(user,"population","monthly")
  const hourly_by_rto = await addCollection(user,"population","hourly_by_rto")
  const hourly_by_talb = await addCollection(user,"population","hourly_by_talb")
  const hourly_by_region = await addCollection(user,"population","hourly_by_region")
  const noon_by_rto = await addCollection(user,"population","noon_by_rto")
  const tag_dv = await addTagToNode(user,"#dv",noon_by_rto._id)
  addParent(user,tag_dv._id,hourly._id)
  addParent(user,tag_dv._id,monthly._id)
  addParent(user,tag_dv._id,hourly_by_rto._id)
  addParent(user,tag_dv._id,hourly_by_talb._id)
  addParent(user,tag_dv._id,hourly_by_region._id)
  addParent(user,user._id,"#dv") // add me as a user of #dv
  const tag_tnz = await addTagToNode(user,"#tnz",noon_by_rto._id)
  addParent(user,tag_tnz._id,hourly_by_rto._id)
  const tag_auckland = await addTagToNode(user,"#auckland",tag_tnz._id)
  const tag_wellington = await addTagToNode(user,"#wellington",tag_tnz._id)
  return await getAllParents("#wellington")
}

