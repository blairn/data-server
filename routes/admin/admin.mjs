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

export const canAdmin = async(user, node_id, parents_only = false) => {
  console.log("can the user ", user, "admin", node_id)
  if (!parents_only && user.admins.includes(node_id)) {
    return true
  }
  const parents = await getAllParents([node_id]).toArray()
  console.log("The parents for ", node_id, "are" , parents)
  return parents.some(id => user.admins.includes(id))
}

export const allKnownChildren = async (user) => await getAllChildren(user.admins)

export const addTagToNode = async (user, tag, node_id) => {
  const security = mongo.db('control').collection("security")
  if (!canAdmin(user, node_id)) {
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
    throw "ಠ_ಠ, you do not have collection creator access, so you can't create collections" 
  }
  const _id = `&${db}/${collection}`

  // if we add a collection which already exists, then just return it.... we are already done.
  const dupe_check = await security.findOne({_id})
  if (dupe_check) {
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
  if (!canAdmin(user,parent_id)) {
    throw "ಠ_ಠ, you can't add children to a node you don't admin"
  }
  await security.updateOne({_id:parent_id}, {$addToSet:{children:node_id}})
  await security.updateOne({_id:node_id}, {$addToSet:{parents:parent_id}})
  return {result:"ok"}
}

export const removeParent = async (user, node_id, parent_id) => {
  const security = mongo.db('control').collection("security")
  if (!canAdmin(user,parent_id)) {
    throw "ಠ_ಠ, you can't remove children from node you don't admin"
  }
  await security.updateOne({_id:parent_id}, {$pull:{children:node_id}})
  await security.updateOne({_id:node_id}, {$pull:{parents:parent_id}})
  return {result:"ok"}
}

export const addAdmin = async (user, node, admin) => {
  const security = mongo.db('control').collection("security")
  // TODO can't remove last assigner - must make find all assignees.
  if (!canAdmin(user,node)) {
    throw "ಠ_ಠ, you can't add admins to a place you don't admin"
  }
  await security.updateOne({_id:admin}, {$addToSet:{admins:node}})
  return {result:"ok"}
}

export const removeAdmin = async (user, node, admin) => {
  const security = mongo.db('control').collection("security")
  // TODO can't remove last assigner - must make find all assignees.
  if (!canAdmin(user,node)) {
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

const _matchFor = async (node,db,collection,permission,all_parents) => {
  let _permission = node?.restrictions?.[db]?.[collection]?.[permission]
  
  // lets deal with the case where this is the wrong collection.
  if (node.type=='collection'){
    if (node.db != db || node.collection != collection) return undefined // no path to collection, no data from this path.
    return _permission || {} // get the permission (everything if not defined) TODO: check that.
  }
  // so, now we are not a collection, and therefore expected to have parents....

  const node_parents = all_parents.filter(x=>x.children.includes(node._id))

  const unfiltered_matches = await Promise.all(node_parents.map(parent => _matchFor(parent,db,collection,permission,all_parents)))
  const matches = unfiltered_matches.filter(x => !!x)
  if (matches.length == 0) return undefined // there is no path to collection, bail out now

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


const setRestriction = async (user, node, db, collection, permission, restriction) => {
  const security = mongo.db('control').collection("security")
  const parents = await getAllParents(node)

  const err_no_path = !_matchFor(node,db,collection,permission, parents)
  if (err_no_path) {
    throw "there is no path to collection from here, so, you can't edit rights for that path"
  }

  const err_no_perm = parents.some(parent => canAdmin(user, parent._id) && _matchFor(parent,db,collection,permission, parents))
  if (err_no_perm) {
    throw 'you do not have sufficiant permissions to change this, you must have assigner rights to all parents, go make a child from here'
  } // weirdly enough, it is ok for you not to have admin rights to THIS node.

  const path = `${db}.${collection}`

  const update = {$set: {
    [path]: {
      [permission]:restriction
    }
  }}

  return security.update({"_id":node},update)
}

const createUser = async (_id) => {
  const user = {
    _id,
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

  console.log("ACT I - Taylor wants to get shit done")
  console.log("let us welcome our cast")
  console.log()

  console.log("creating user blair, he is the hourly admin")
  let blair = await createUser("blair") // person who looks after hourly

  console.log("creating user sarah, she is the monthly admin")
  let sarah = await createUser("sarah") // person who looks after monthly

  console.log("creating user jamie, he is given all of the powers (eventually)")
  let jamie = await createUser("jamie") // person who also admins stuff

  console.log("creating user taylor, he works for dv")
  let taylor = await createUser("taylor") // person who actually does real work

  console.log()
  console.log("and the play begins")
  console.log()

  console.log("blair creates a collection, test/hourly")
  const hourly = await addCollection(blair, "test", "hourly")

  console.log("sarah creates a collection, test/monthly")
  const monthly = await addCollection(sarah, "test","monthly")

  blair = await update(blair) // this db record has changed, and the in memory one hasn't.
  console.log("blair is", blair)
  console.log("blair, being a collection creator, can see his own collection by default")
  console.log("his match looks like", await matchFor(blair,"test","hourly","read"))

  console.log("blair, can't see his sarahs collection by default")
  console.log("his match looks like", await matchFor(blair,"test","monthly","read"))

  console.log("sarah assigns jamie rights to monthly")
  await addAdmin(sarah, monthly._id, jamie._id)

  console.log("realizing blair forgot to do so sarah tries to assign jamie rights to hourly, she shouldn't be able to")
  try {
    await addAdmin(sarah, hourly._id, jamie._id)
  } catch (ex) {
    console.log("and sarah can't because ", ex)
  }

  console.log("she tells blair to do so, and he does")
  await addAdmin(blair, hourly._id, jamie._id)

  console.log("so, taylor needs to use the datasets, and blair, sarah, and jamie would like to see them too so we create a DataVentures tag")
  console.log("blair does so")
  const dataventures = await addTagToNode(blair, "#dv", hourly._id)

  console.log("he even adds everyone to the group (the dried frog pills are working!)")
  await addParent(blair, '@taylor', '#dv')
  await addParent(blair, '@sarah', '#dv')
  await addParent(blair, '@jamie', '#dv')
  await addParent(blair, '@blair', '#dv')

  taylor = await update(taylor) // this db record has changed, and the in memory one hasn't.

  console.log("taylor can see hourly", await matchFor(taylor,"test","hourly","read"))
  console.log("but not monthly", await matchFor(taylor,"test","monthly","read"))

  console.log("with sarah being on holiday, taylor tries to fix it")
  try {
    await addParent(taylor, dataventures, monthly)
  } catch (ex) {
    console.log("and he can't because ", ex)
  }

  console.log("jamie can though")
  await addParent(jamie, dataventures, monthly)

  console.log("now taylor can see both hourly", await matchFor(taylor,"test","hourly","read"))
  console.log("and monthly", await matchFor(taylor,"test","monthly","read"))

console.log("everyone is happy - they go out for beer")
console.log()
// console.log("ACT II - Whats this? A customer?")
// console.log("let us welcome our new cast members")
// console.log()

// console.log("amy, she admins for another org (azOrg), who tend to use stuff on a regional and time basis")
// const amy = createUser("amy") // admin for another org

// console.log("zach, he works for amy's org")
// const zach = createUser("zach") // user for another org

// console.log("wendy is from another org, getting stuff from Amy's org, she is only interested in wellington")
// const wendy = createUser("wendy") // wendy wellington

// console.log("arthur is from another org, getting stuff from Amy's org, she is only interested in auckland")
// const arthur = createUser("arthur") // arthur auckland

// console.log("criss is from another org, getting stuff from Amy's org, he is only interested in christchurch")
// const criss = createUser("criss") // criss christchurch

// console.log("cordy is a contractor, they work for different orgs, on and off, sometimes more than one")
// const cordy = createUser("cordy") // cordy the contractor

// console.log("lets start our story.... blair sets up stuff for amy to run")
// console.log("they get hourly for this year")
// const azOrg = createTag("azOrg", hourly, blair)

// console.log("he sets a restriction on it")
// setRestriction(azOrg, "test", "hourly", "read", {time_utc:{$gt:"2020-01-01T00:00:00"}}, blair)

// console.log("they get monthly for the last 2 years- but blair shouldn't be able to since he isn't assigner to monthly.")
// try {
//   addChildToParent(azOrg,monthly,blair)
// } catch (ex) {
//   console.log("and he can't because ", ex)
// }

// console.log("Sarah steps in and fixes that by giving blair assigner to monthly")
// assign(monthly,blair,sarah)

// console.log("Blair then finishes setup")
// addChildToParent(azOrg,monthly,blair)
// setRestriction(azOrg, "test", "monthly", "read", {time_utc:{$gt:"2019-01-01T00:00:00"}}, blair)

// console.log("Sarah points out it should be time_nzst, and goes to fix it")
// setRestriction(azOrg, "test", "monthly", "read", {time_nzst:{$gt:"2019-01-01T00:00:00"}}, sarah)

// console.log("Sarah tries to fix hourly, but, she doesn't have assigner access, so she shouldn't be able to edit that")
// try {
//   setRestriction(azOrg, "test", "hourly", "read", {time_nzst:{$gt:"2020-01-01T00:00:00"}}, sarah)
// } catch (ex) {
//   console.log("and she can't because ", ex)
// }

// console.log("Blair adds her to hourly as he should have a long time ago")
// assign(hourly,sarah,blair)

// console.log("Since she is already on the screen, and it is ready to go, she presses apply again.....")
// setRestriction(azOrg, "test", "hourly", "read", {time_nzst:{$gt:"2020-01-01T00:00:00"}}, sarah)

// console.log("blair hands over azOrg to amy")
// assign(azOrg,amy,blair)

// console.log("who gives zach acess")
// addChildToParent(zach,azOrg,amy)

// console.log("who run a query")

// console.log("now zach can see both hourly", matchFor(zach,"test","hourly","read"))
// console.log("and monthly", matchFor(zach,"test","monthly","read"))


// console.log("wendy wellington and authur auckland come on board, forcing the creation of more tags, amy gets to work")
// const wellington = createTag("Wellington", azOrg, amy)
// const auckland = createTag("Auckland", azOrg, amy)
// setRestriction(auckland, "test", "hourly", "read", {region:1}, amy)
// setRestriction(auckland, "test", "monthly", "read", {region:1}, amy)
// setRestriction(wellington, "test", "hourly", "read", {region:4}, amy)
// setRestriction(wellington, "test", "monthly", "read", {region:4}, amy)

// addChildToParent(arthur,auckland,amy)
// addChildToParent(wendy,wellington,amy)

// console.log("now arthur can see both hourly", matchFor(arthur,"test","hourly","read"))
// console.log("and monthly", matchFor(arthur,"test","monthly","read"))

// console.log("and wendy can see both hourly", matchFor(wendy,"test","hourly","read"))
// console.log("and monthly", matchFor(wendy,"test","monthly","read"))

// console.log("cordy comes on board, and amy sets to work giving her both wellington and auckland permissions")
// addChildToParent(cordy,auckland,amy)
// addChildToParent(cordy,wellington,amy)
// console.log("and cordy can see both hourly", matchFor(cordy,"test","hourly","read"))
// console.log("and monthly", matchFor(cordy,"test","monthly","read"))

  return await matchFor(user,"#wellington",'test','hourly_bt_rto','read')
}

