import {mongo} from './databases.mjs'
import fetch from 'node-fetch'

// TODO: can give dupes under obsure conditions
const resolveTag = async (nickname) => {
  let tag = '@' + nickname.replace(/\s+/g,"_")
  let tags = await mongo.db("control").collection("security").count({tag})
  if (tags == 0) {
    return tag
  } else {
    return tag+tags
  }
}

export const addUser = async (req,res,next) => {
  const sub = req.user.sub
  let user = await mongo.db("control").collection("security").findOne({sub})
  if (!user) {
    const auth0Request = await fetch(req.user.aud[1], {headers:{"Authorization":req.header('Authorization'), "Content-Type": "application/json"}})
    const auth0User = await auth0Request.json()
    const _id = await resolveTag(auth0User.nickname)
    user = {
      _id,
      sub,
      type:'user',
      collectionCreator:true,
      name:auth0User.name,
      email:auth0User.email,
      nickname:auth0User.nickname,
      admins:[],
      parents:[],
      restrictions:{}
    }
    await mongo.db("control").collection("security").insert(user)
  }
  req.dbUser = user
  next()
}
