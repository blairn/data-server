const DO_NOTHING = (req, res, next) => {
  next()
}

export const streamUpdates = DO_NOTHING
export const any = DO_NOTHING
export const readCollection = DO_NOTHING
export const listCollections = DO_NOTHING
export const updateSchema = DO_NOTHING
export const updateObject = DO_NOTHING
export const createCollection = DO_NOTHING
export const addObject = DO_NOTHING
export const bulkWrite = DO_NOTHING
export const deleteIndex = DO_NOTHING
export const deleteObject = DO_NOTHING
export const deleteCollection = DO_NOTHING
