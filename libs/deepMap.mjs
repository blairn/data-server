import {isSafe} from './mongosafe.mjs'

// deepMap is used for 2 things, firstly, we intergrated query sanitisation.
// yeah, I know, white lists on keys is not ideal, but, there is very little
// we don't want the user doing. no adding records, no linking back to self or to other tables.
// we also block some informational requests which people shouldn't have any reason to use.
// this is more aggressive than realm (which is mongoDBs version of this)
// and we have checked to that EVERYTHING they don't like, we also don't let the users do.
// we have added more to the list, because we are paranoid like that. (if we can't see a regular use for it, it is gone)

// the short answer to what the hell is it doing is we rebuild a query, and if any of the keys don't pass the mongoSafe rules (see mongosafe.js)
// we kick them out. we ALSO apply a function to the values, but, that is so we can remap "#2018-01-01#" for instance to a date
export function deepMap(value, mapFn=(x) => x, thisArg, key, cache=new Map()) {
  // Use cached value, if present:
  if (cache.has(value)) {
    return cache.get(value)
  }  
  console.log(JSON.stringify(value), typeof value)
  if (Array.isArray(value)) { // for arrays
    let result = []
    cache.set(value, result) // Cache to avoid circular references
    for (let i = 0; i < value.length; i++) {
      result.push(deepMap(value[i], mapFn, thisArg, i, cache))
    }
    return result
  } else if (value != null && !value instanceof Date && /object|function/.test(typeof value)) { // non array
    let result = {}
    cache.set(value, result) // Cache to avoid circular references
    for (let key of Object.keys(value)) {
      if (!isSafe(key)) {
        throw 'some pipeline stages are not supported (anything which lets you look up other records), contact Data Ventures if you need to do this (' + key + ')'
      }
      result[key] = deepMap(value[key], mapFn, thisArg, key, cache)
    }
    return result
  } else { // If value is a primitive:
    return mapFn.call(thisArg, value, key)
  }
}
