const methodNotAllowed = (req, res, next) => res.status(405).send('not implemented YET');

export const headSchema = methodNotAllowed
export const getSchema = methodNotAllowed
export const updateSchema = methodNotAllowed
export const patchSchema = methodNotAllowed
