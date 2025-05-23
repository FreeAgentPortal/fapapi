/**
 * @description takes in a string and returns an object that can be used to sort objects from the database
 * @param {string} sortString - the string to be parsed
 * @param {object} defaultSort - the default sort object to be used if no sort string is provided
 *
 * @returns {object} - the parsed sort string
 * @author Austin Howard
 * @since 1.2.0
 * @version 1.2.1
 * @lastModifiedBy Austin Howard
 * @lastModified 2023-07-19T12:49:40.000-05:00
 */
export default (sortString: string, defaultSort: string) => {
  const sortObject = {} as any;

  if (sortString) {
    const [key, value] = sortString.split(";");
    sortObject[key] = value === "1" ? 1 : -1;
  } else {
    // we need to parse the default value if it is provided
    // if its not provided throw an error
    if (!defaultSort) {
      throw new Error("No sort string provided");
    }
    const [key, value] = defaultSort.split(";");
    sortObject[key] = value === "1" ? 1 : -1;
  }

  return sortObject;
};
