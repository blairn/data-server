// this creates a single bulk create or update record
// we will use this, pretty much all the time, it is our _primary_ way to push updates to mongo.

export const convertToBulkWrite = (options, update=false) => (r) => {

  // yeah, it looks the wrong way around, but, this is how assignments work.
  const {arrayFilters:_arrayFilters, collation:_collation, upsert_fields:_upsert_fields} = options

  const arrayFilters = _arrayFilters ?? JSON.parse(_arrayFilters)
  const collation = _collation ?? JSON.parse(_collation)
  const upsert_fields = (_upsert_fields ?? JSON.parse(_upsert_fields)) || []
  const has_upsert_fields = upsert_fields.length == 0

  // if we are doing an update, then it is updateOne.
  // otherwise, we insert or replace, depending on if it is an upsert.
  // WEIRDLY enough, updateOne, can ALSO upsert, and will be, if upsert_fields is used.
  // MOSTLY we expect that updates will be through api/[db]/[collection]/[_id], but, it is ALSO here for completeness, since you can bulk it if it IS here.
  let opName = update?"updateOne":has_upsert_fields?"insertOne":"replaceOne"
  let opRecord = update?"update":has_upsert_fields?"document":"replacement"
  let opValues = {arrayFilters, collation, [opRecord]:r}

  // it is an upsert
  if (upsert_fields.length != 0) {
    let filter = {}
    for (let field of upsert_fields){ filter[field] = r[field] } // move over the upset fields.
    opValues = {...opValues, filter, upsert:true}
  }
  return {[opName]: opValues}
}