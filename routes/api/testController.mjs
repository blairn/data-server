// this is the scratchpad controller for testing shit.
import {Readable} from 'stream'
import {streamResults} from '../streaming.mjs'

export const test1 = async (req, res, next) => {
  function* generator() {
    let i = 10000
    while (i++ < 20000) {
      yield {
        time:new Date(),
        count:i,
        international:i,
        national:i,
        domestic:i
      }
    }
    return {done:true}
  }
  const collections = Readable.from([
    {_id:"exists?", name:"blair", age:"too old", dob:new Date()},
    {name:"bob", age:"22"}
  ])
  streamResults(req,res,Readable.from(generator()))
}

