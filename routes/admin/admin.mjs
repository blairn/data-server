import {mongo} from '../../libs/databases.mjs'
// TODO: tags, databases, collection CAN'T HAVE DOTS IN their names.

const all_parents_query = (node_ids) => ([
  {$match: {_id: {$in:node_ids}}},
  {$graphLookup: {
      from: "security",
      startWith: "$parents",
      connectFromField: "parents",
      connectToField: "_id",
      as: "path",
      maxDepth: 20
  }},
  {$unwind: "$path"},
  {$replaceRoot: {newRoot: "$path"}},
  {$group:{
    _id:"$_id",
    record:{$first:"$$ROOT"}
  }},
  {$unwind: "$record"},
  {$replaceRoot: {newRoot: "$record"}},
])

const all_children_query = (node_ids) => ([
  {$match: {_id: {$in:node_ids}}},
  {$graphLookup: {
      from: "security",
      startWith: "$_id",
      connectFromField: "children",
      connectToField: "_id",
      as: "path",
      maxDepth: 20
  }},
  {$unwind: "$path"},
  {$replaceRoot: {newRoot: "$path"}},
  {$group:{
    _id:"$_id",
    record:{$first:"$$ROOT"}
  }},
  {$unwind: "$record"},
  {$replaceRoot: {newRoot: "$record"}},
])

const toArray = (x) => (x instanceof Array)?x:[x]

export const getAllParents = node_ids => mongo.db('control').collection("security").aggregate(all_parents_query(toArray(node_ids)))

export const getAllChildren = node_ids => mongo.db('control').collection("security").aggregate(all_children_query(toArray(node_ids)))

export const getNode = _id => mongo.db('control').collection("security").findOne({_id})

export const canAdmin = async(user, node_id, parents_only = false) => {
  if (!parents_only && user.admins.includes(node_id)) {
    return true
  }
  const parents = await getAllParents([node_id]).toArray()
  const can = parents.some(parent => user.admins.includes(parent._id))
  return can
}

export const allKnownChildren = async (user) => await getAllChildren(user.admins)

export const addTagToNode = async (user, tag, node_id, org=false) => {
  const security = mongo.db('control').collection("security")
  if (!await canAdmin(user, node_id)) {
    console.log("can't do this *************")
    throw 'ಠ_ಠ, you do not have admin rights to the node you are trying to add this to'
  }
  const _id = tag.startsWith('#')?tag:'#'+tag
  // if we add a collection which already exists, then just return it.... we are already done.
  const dupe_check = await security.findOne({_id})
  if (dupe_check) {
    throw "this tag already exists, so you can't create it"
  }

  const new_tag = {
    _id,
    type:'tag',
    parents:[node_id],
    adminedBy:[user._id],
    children:[],
    org,
    restrictions:{}
  }
  await security.insertOne(new_tag)
  await security.updateOne({_id:node_id}, {$addToSet:{children:_id}})
  // await security.updateOne({_id:user._id}, {$addToSet:{admins:_id}}) // do we need to do this now?
  return new_tag
}

export const addCollection = async (user, db, collection) => {
  const security = mongo.db('control').collection("security")
  if (!user.collectionCreator) {
    console.log("can't do this *************")
    throw "ಠ_ಠ, you do not have collection creator access, so you can't create collections"
  }
  const _id = `&${db}/${collection}`

  // if we add a collection which already exists, then just return it.... we are already done.
  const dupe_check = await security.findOne({_id})
  if (dupe_check) {
    console.log("can't do this *************")
    throw "this collection already exists, so you can't create it"
  }

  const new_collection = {
    _id,
    db,
    collection,
    type:'collection',
    parents:[],
    children:[],
    createdBy: user._id,
    restrictions:{}
  }

  const collection_result = await security.insertOne(new_collection)
  const admin_update_result = await security.updateOne({_id:user._id}, {$addToSet:{admins:_id}})
  await addParent(await update(user), user._id, _id)
  return new_collection
}

export const addParent = async (user, node_id, parent_id) => {
  const security = mongo.db('control').collection("security")
  if (!await canAdmin(user,parent_id)) {
    throw "ಠ_ಠ, you can't add children to a node you don't admin"
  }
  await security.updateOne({_id:parent_id}, {$addToSet:{children:node_id}})
  await security.updateOne({_id:node_id}, {$addToSet:{parents:parent_id}})
  return {result:"ok"}
}

export const removeParent = async (user, node_id, parent_id) => {
  const security = mongo.db('control').collection("security")
  if (!await canAdmin(user,parent_id)) {
    throw "ಠ_ಠ, you can't remove children from node you don't admin"
  }
  await security.updateOne({_id:parent_id}, {$pull:{children:node_id}})
  await security.updateOne({_id:node_id}, {$pull:{parents:parent_id}})
  return {result:"ok"}
}

export const addAdmin = async (user, node, admin) => {
  const security = mongo.db('control').collection("security")
  // TODO can't remove last assigner - must make find all assignees.
  if (!await canAdmin(user,node)) {
    throw "ಠ_ಠ, you can't add admins to a place you don't admin"
  }
  await security.updateOne({_id:admin}, {$addToSet:{admins:node}})
  return {result:"ok"}
}

export const removeAdmin = async (user, node, admin) => {
  const security = mongo.db('control').collection("security")
  // TODO can't remove last assigner - must make find all assignees.
  if (!await canAdmin(user,node)) {
    throw "ಠ_ಠ, you can't boot admins from a place you don't admin"
  }
  await security.updateOne({_id:admin}, {$pull:{admins:node}})
  return {result:"ok"}
}

const handleKeyCollision = (o1,o2) => {
  const collision = Object.keys(o1).some(k=> Object.keys(o2).includes(k)) // is any key in both objects
  if (collision) {
    return {$and:[o1,o2]} // can't merge
  } else {
    return {...o1, ...o2} // merged
  }
}

const _matchFor = async (node, db, collection, permission, all_parents) => {
  let _permission = node?.restrictions?.[db]?.[collection]?.[permission]
  if (_permission) {
    _permission = JSON.parse(_permission)
  }  
  // lets deal with the case where this is the wrong collection.
  if (node.type=='collection'){
    if (node.db != db || node.collection != collection) return undefined // no path to collection, no data from this path.
    return _permission || {} // get the permission (everything if not defined) TODO: check that.
  }
  // so, now we are not a collection, and therefore expected to have parents....

  const node_parents = all_parents.filter(x=>x.children.includes(node._id))

  const unfiltered_matches = await Promise.all(node_parents.map(parent => _matchFor(parent,db,collection,permission,all_parents)))
  let matches = unfiltered_matches.filter(x => !!x)
  if (matches.length == 0) return undefined // there is no path to collection, bail out now

  // simplification stage.
  if (matches.some(x => Object.keys(x).length == 0)) {
    matches = [{}] // if there is a path which gives you everything, then, you get everything.
  }

  const parentMatches = matches.length == 1?matches[0]:{ $or:matches }
  if (_permission == undefined) {
    return parentMatches // passthough.
  }
  return handleKeyCollision(parentMatches, _permission??{}) // merge if we can
}

export const matchFor = async (node,db,collection,permission) => {
  const parents = await getAllParents(node._id).toArray()
  console.log("parents are ", parents)
  return await _matchFor(node,db,collection,permission, parents)
}

const couldEdit = async (user, node_id, db, collection, permission, parents) => {
  const node = getNode(node_id)
  const err_no_path = !_matchFor(node,db,collection,permission, parents)
  if (err_no_path) {
    throw "there is no path to collection from here, so, you can't edit rights for that path"
  }
  if (node.org) {
    throw "you can't edit restrictions on an org node. If an org node HAS restrictions, something has gone VERY wrong"
  }
  return await Promise.all(parents.map(parent => canAdmin(user, parent._id).then(x => x && _matchFor(parent,db,collection,permission, parents))))  
}

export const couldEditPermissionsFor = async (user, node_id, permission) => {
  const node = getNode(node_id)
  const parents = await getAllParents(node_id).toArray()
  console.log("parents are ", parents)
  return await Promise.all(
    parents
      .filter(parent => parent.type == 'collection')
      .map(async collection_node => ({
        db:collection_node.db,
        collection:collection_node.collection,
        can_edit: (await couldEdit(user, node_id, collection_node.db, collection_node.collection, permission, parents)).some(x=>x)
      }))
  )
}

export const setRestriction = async (user, node_id, db, collection, permission, restriction) => {
  const node = getNode(node_id)
  const security = mongo.db('control').collection("security")
  const parents = await getAllParents(node).toArray()

  const err_no_path = !_matchFor(node,db,collection,permission, parents)

  if (err_no_path) {
    throw "there is no path to collection from here, so, you can't edit rights for that path"
  }

  if (node.org) {
    throw "you can't edit restrictions on an org node. If an org node HAS restrictions, something has gone VERY wrong"
  }

  const can = await Promise.all(parents.map(parent => canAdmin(user, parent._id).then(x => x && _matchFor(parent,db,collection,permission, parents))))  
  const err_no_perm = !can.some(x=>x)

  // const err_no_perm = parents.some(parent => await canAdmin(user, parent._id) && _matchFor(parent,db,collection,permission, parents))
  if (err_no_perm) {
    throw 'you do not have sufficiant permissions to change this, you must have assigner rights to all parents, go make a child from here'
  } // weirdly enough, it is ok for you not to have admin rights to THIS node.

  const path = `restrictions.${db}.${collection}`

  const update = { $set:{
    [path]:{
      [permission]:JSON.stringify(restriction)
    }
  }}

  return security.update({"_id":node},update)
}

const createUser = async (_id) => {
  const user = {
    _id:'@'+_id,
    type:'user',
    collectionCreator:true,
    name:_id,
    email:_id,
    nickname:_id,
    admins:[],
    parents:[],
    restrictions:{}
  }
  await mongo.db("control").collection("security").insert(user)
  return user
}

const update = (node) => mongo.db("control").collection("security").findOne({_id:node._id})


export const setUp = async (user) => {
  console.log("clear the stage")
  await mongo.db("control").collection("security").remove({})
  await mongo.db("control").collection("security").insertOne(user)
  
  console.log("ACT I - Taylor wants to get shit done")
  console.log("let us welcome our cast")
  console.log()

  console.log("creating user blair, he is the hourly admin")
  let blair = user // person who looks after hourly

  console.log("creating user samantha, she is the monthly admin")
  let samantha = await createUser("samantha") // person who looks after monthly

  console.log("creating user jamie, he is given all of the powers (eventually)")
  let jamie = await createUser("jamie") // person who also admins stuff

  console.log("creating user taylor, he works for dv")
  let taylor = await createUser("taylor") // person who actually does real work

  console.log()
  console.log("and the play begins")
  console.log()

  console.log("blair creates a collection, test/hourly")
  const hourly = await addCollection(blair, "test", "hourly")

  console.log("samantha creates a collection, test/monthly")
  const monthly = await addCollection(samantha, "test","monthly")

  blair = await update(blair) // this db record has changed, and the in memory one hasn't.
  console.log("blair is", blair)
  console.log("blair, being a collection creator, can see his own collection by default")
  console.log("his match looks like", await matchFor(blair,"test","hourly","read"))

  console.log("blair, can't see his samanthas collection by default")
  console.log("his match looks like", await matchFor(blair,"test","monthly","read"))

  console.log("samantha assigns jamie rights to monthly")
  samantha = await update(samantha) // this db record has changed, and the in memory one hasn't.
  await addAdmin(samantha, monthly._id, '@jamie')

  console.log("realizing blair forgot to do so samantha tries to assign jamie rights to hourly, she shouldn't be able to")
  try {
    await addAdmin(samantha, hourly._id, jamie._id)
  } catch (ex) {
    console.log("and samantha can't because ", ex)
  }

  console.log("she tells blair to do so, and he does")
  await addAdmin(blair, hourly._id, jamie._id)

  console.log("so, taylor needs to use the datasets, and blair, samantha, and jamie would like to see them too so we create a DataVentures tag")
  console.log("blair does so")
  const dataventures = await addTagToNode(blair, "#dv", hourly._id)

  blair = await update(blair) // this db record has changed, and the in memory one hasn't.

  console.log("he even adds everyone to the group (the dried frog pills are working!)")
  await addParent(blair, '@taylor', '#dv')
  await addParent(blair, '@samantha', '#dv')
  await addParent(blair, '@jamie', '#dv')
  await addParent(blair, '@blair', '#dv')

  taylor = await update(taylor) // this db record has changed, and the in memory one hasn't.

  console.log("taylor can see hourly", await matchFor(taylor,"test","hourly","read"))
  console.log("but not monthly", await matchFor(taylor,"test","monthly","read"))

  console.log("with samantha being on holiday, taylor tries to fix it")
  try {
    await addParent(taylor, '#dv', monthly._id)
  } catch (ex) {
    console.log("and he can't because ", ex)
  }

  console.log("jamie can though")
  jamie = await update(jamie) // this db record has changed, and the in memory one hasn't.

  await addParent(jamie, '#dv', monthly._id)

  console.log("now taylor can see both hourly", await matchFor(taylor,"test","hourly","read"))
  console.log("and monthly", await matchFor(taylor,"test","monthly","read"))

console.log("everyone is happy - they go out for beer")
console.log()


console.log("ACT II - Whats this? A customer?")
console.log("let us welcome our new cast members")
console.log()

console.log("amy, she admins for another org (azOrg), who tend to use stuff on a regional and time basis")
let amy = await createUser("amy") // admin for another org

console.log("zach, he works for amy's org")
let zach = await createUser("zach") // user for another org

console.log("wendy is from another org, getting stuff from Amy's org, she is only interested in wellington")
let wendy = await createUser("wendy") // wendy wellington

console.log("arthur is from another org, getting stuff from Amy's org, she is only interested in auckland")
let arthur = await createUser("arthur") // arthur auckland

console.log("criss is from another org, getting stuff from Amy's org, he is only interested in christchurch")
let criss = await createUser("criss") // criss christchurch

console.log("cordy is a contractor, they work for different orgs, on and off, sometimes more than one")
let cordy = await createUser("cordy") // cordy the contractor

console.log("lets start our story.... blair sets up stuff for amy to run")
console.log("they get hourly for this year")
let azOrg = await addTagToNode(blair, "#azOrg", hourly._id)
blair = await update(blair)

console.log("he sets a restriction on it")
await setRestriction(blair, azOrg._id, "test", "hourly", "read", {time_utc:{$gt:"2020-01-01T00:00:00"}})

console.log("they get monthly for the last 2 years- but blair shouldn't be able to since he isn't assigner to monthly.")
try {
  await addParent(blair, azOrg._id, monthly._id)
} catch (ex) {
  console.log("and he can't because ", ex)
}

console.log("samantha steps in and fixes that by giving blair assigner to monthly")
await addAdmin(samantha, monthly._id, blair._id)

blair = await update(blair)

console.log("Blair then finishes setup")
await addParent(blair, azOrg._id, monthly._id)

console.log("Blair sets the restriction")
await setRestriction(blair, azOrg._id, "test", "monthly", "read", {time_utc:{$gt:"2019-01-01T00:00:00"}})

console.log("samantha points out it should be time_nzst, and goes to fix it")
await setRestriction(samantha, azOrg._id, "test", "monthly", "read", {time_nzst:{$gt:"2019-01-01T00:00:00"}})

console.log("samantha tries to fix hourly, but, she doesn't have assigner access, so she shouldn't be able to edit that")
try {
  await setRestriction(samantha, azOrg._id, "test", "hourly", "read", {time_nzst:{$gt:"2020-01-01T00:00:00"}})
} catch (ex) {
  console.log("and she can't because ", ex)
}

console.log("Blair adds her to hourly as he should have a long time ago")
await addAdmin(blair, hourly._id, samantha._id)

samantha = await update(samantha)

console.log("Since she is already on the screen, and it is ready to go, she presses apply again.....")
await setRestriction(samantha, azOrg._id, "test", "hourly", "read", {time_nzst:{$gt:"2020-01-01T00:00:00"}})

console.log("blair hands over azOrg to amy")
await addAdmin(blair, azOrg._id, amy._id)

amy = await update(amy)

console.log("who gives zach acess")
await addParent(amy, zach._id, azOrg._id)

console.log("who run a query")

zach = await update(zach)
console.log("now zach can see both hourly", await matchFor(zach,"test","hourly","read"))
console.log("and monthly", await matchFor(zach,"test","monthly","read"))


console.log("wendy wellington and authur auckland come on board, forcing the creation of more tags, amy gets to work")
const wellington = await addTagToNode(amy, "#wellington", azOrg._id)
const auckland = await addTagToNode(amy, "#auckland", azOrg._id)
amy = await update(amy)

await setRestriction(amy, auckland._id, "test", "hourly", "read", {region:1})
await setRestriction(amy, auckland._id, "test", "monthly", "read", {region:1})
await setRestriction(amy, wellington._id, "test", "hourly", "read", {region:4})
await setRestriction(amy, wellington._id, "test", "monthly", "read", {region:4})

await addParent(amy, arthur._id,auckland._id)
await addParent(amy, wendy._id,wellington._id)

arthur = await update(arthur)

console.log("now arthur can see both hourly", await matchFor(arthur,"test","hourly","read"))
console.log("and monthly", await matchFor(arthur,"test","monthly","read"))

wendy = await update(wendy)

console.log("and wendy can see both hourly", await matchFor(wendy,"test","hourly","read"))
console.log("and monthly", await matchFor(wendy,"test","monthly","read"))

console.log("cordy comes on board, and amy sets to work giving her both wellington and auckland permissions")
await addParent(amy, cordy._id, auckland._id)
await addParent(amy, cordy._id, wellington._id)

cordy = await update(cordy)
console.log("and cordy can see both hourly", JSON.stringify(await matchFor(cordy,"test","hourly","read")))
console.log("and monthly", JSON.stringify(await matchFor(cordy,"test","monthly","read")))

  return await matchFor(cordy,"test","monthly","read")
}

