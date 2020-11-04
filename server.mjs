import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'

// import { EJSON, serialize, deserialize } from 'bson'
// import compression from 'compression'
import {apiRouter} from './routes/api/apiRouter.mjs'
import {adminRouter} from './routes/admin/adminRouter.mjs'
import {checkJwt} from './libs/checkJWT.mjs'
import {addUser} from './libs/addUser.mjs'
const app = express()

// compression
// JWT -> check token, record user
// look up user in mongo.
// log
// conversion bson, json, ymal -> ejson.
app.use(cors({})) // we do accept it all.
app.use(checkJwt)
app.use(addUser)

// turn body into a stream of ejson, if a post or put or whatever.
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

app.use("/api/", apiRouter)
app.use("/admin/", adminRouter)

//app.use("/", sapper)
// app.use("/user/", userRouter)
// app.use("/org/", orgRouter)

app.listen(2800)
