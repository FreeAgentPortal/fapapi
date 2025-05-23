import moment from 'moment';
import mongoose from 'mongoose';

/**
 * @description Takes in a string argument and returns an object that can be used to filter objects from the MySQL database using Sequelize operators
 * @param {string} filterOptionsString - the string to be parsed, i.e, 'isLivePro=1;name;like;John;createdAt;>=;2023-01-01'
 * @returns {object} - the parsed filter options string
 *
 * @author Austin Howard
 * @since 1.2.8
 * @version 1.2.8
 * @lastModifiedBy Austin Howard
 * @lastModified 2023-07-19T12:45:31.000-05:00
 */
export default (filterOptionsString: string) => {
  if (!filterOptionsString) return [{}];

  const filterOptionsObject = {} as { [key: string]: any };
  // split and remove empty strings
  const filterOptionsArray = filterOptionsString.split('|').filter((option) => option !== '');
  // console.log(filterOptionsArray);

  filterOptionsArray.forEach((filterOption) => {
    const [key, value] = filterOption.split(';');
    // console.log(`key: ${key}, value: ${value}`);
    if (value === 'true') {
      // console.log(`key is a boolean: ${key} and is true`);
      filterOptionsObject[key] = true;
    } else if (value === 'false') {
      // console.log(`key is a boolean: ${key} and is false`);
      filterOptionsObject[key] = false;
    } else {
      try {
        // Use JSON.parse to safely convert the value to an object
        const parsedValue = JSON.parse(value);
        // console.log(`parsedValue: ${JSON.stringify(parsedValue)}`);

        // Recursively parse the parsedValue if it contains nested objects
        const filteredValue = parseValueRecursively(parsedValue);
        // console.log(`filteredValue: ${JSON.stringify(filteredValue)}`);

        // If key already exists, merge the parsed value
        filterOptionsObject[key] = {
          ...filterOptionsObject[key],
          ...filteredValue,
        };
      } catch (error) {
        // console.log(`error parsing: ${value}`);
        // console.log(`error: ${error}`);
        // If JSON.parse fails, check for valid ObjectId
        if (mongoose.Types.ObjectId.isValid(value)) {
          filterOptionsObject[key] = new mongoose.Types.ObjectId(value);
        } else {
          // If not a valid ObjectId, treat the value as a regular string or number
          filterOptionsObject[key] = isNaN(Number(value)) ? value : Number(value);
        }
      }
    }
  });
  // console.log(filterOptionsObject);
  return [filterOptionsObject];
};
// Helper function for recursive parsing
const parseValueRecursively = (parsedValue: any) => {
  if (typeof parsedValue === 'object' && parsedValue !== null) {
    const allowedOperators = [
      '$gte',
      '$lte',
      '$gt',
      '$lt',
      '$eq',
      '$elemMatch',
      '$in',
      '$ne',
      '$exists',
    ];
    return Object.entries(parsedValue).reduce((acc: any, [opKey, opValue]) => {
      if (allowedOperators.includes(opKey)) {
        // If opValue is a nested object, recursively parse it
        if (typeof opValue === 'object' && opValue !== null) {
          acc[opKey] = parseValueRecursively(opValue);
        } else {
          const isValidDate = moment(opValue as string, true).isValid();
          const isNumber = !isNaN(Number(opValue));
          // console.log(opKey);
          if (opKey === '$elemMatch' && typeof opValue === 'string') {
            return (acc[opKey] = { $eq: checkObjectId(opValue) }); // Handle simple string equality for $elemMatch
          } else if (opKey === '$in') {
            acc[opKey] = Array.isArray(opValue) ? opValue : [checkObjectId(opValue as string)];
          } else if (isValidDate) {
            acc[opKey] = moment(opValue as any).toDate();
          } else if (isNumber) {
            acc[opKey] = Number(opValue);
          } else if (opKey === null) {
            acc[opKey] = null;
          } else {
            acc[opKey] = checkObjectId(opValue as string);
          }
        }
      }
      return acc;
    }, {});
  }
  return parsedValue;
};

//util function checks if a string is a valid mongo object id, if it is, it returns the value with the ObjectId constructor
//if it is not a valid mongo object id, it returns the value as is
export const checkObjectId = (value: string) => {
  if (mongoose.Types.ObjectId.isValid(value)) {
    return new mongoose.Types.ObjectId(value);
  }
  return value;
};
