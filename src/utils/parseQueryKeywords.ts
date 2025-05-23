/**
 * @description takes in an array string of values and returns a an object of key value pairs for regex searching in mongoDb
 *              example: ['fullName'] => { fullName: { $regex: 'value', $options: 'i' } }
 *              if no key is passed in, an empty object is returned
 * @param {string[]} array - the array of values to be parsed
 * @param {string} key - the key to be used for the object
 *
 * @returns {object} - the parsed array of values
 *
 * @author Austin Howard
 * @since 1.0.0
 * @version 1.0.2
 * @lastModifiedBy Austin Howard
 * @lastModified 2024-07-25 10:18:22
 *
 */
export default (array: string[], key: string) => {
  const parsed = [] as any;

  if (!key) return [{}];

  // each value in the array needs to be returned as an object: [{ key: { $regex: value, $options: 'i' } }, { key: { $regex: value, $options: 'i' } }}]
  array.forEach((value) => {
    if (value.includes('[') && value.includes(']')) {
      try {
        // check if the value has a '.' in it, if it does, we need to parse it, otherwise we can just use the value in the array
        if (value.includes('.')) {
          const [fieldName, subField] = value.split('.');
          // remove the square brackets from the fieldName
          const elemMatchField = fieldName.replace('[', '');
          // remove the square brackets from the subField
          const subFieldFinal = subField.replace(']', '');
          parsed.push({
            [elemMatchField]: {
              $elemMatch: {
                [subFieldFinal]: { $regex: key.trim(), $options: 'i' },
              },
            },
          });
        } else {
          // if the value does not have a '.' in it, we can just use the value as is
          const elemMatchField = value.replace('[', '').replace(']', '');
          parsed.push({
            [elemMatchField]: { $regex: key.trim(), $options: 'i' },
          });
        }
      } catch (error) {
        console.log(error);
        throw new Error('Invalid array value');
      }
    } else {
      parsed.push({ [value]: { $regex: key.trim(), $options: 'i' } });
    }
  });
  return parsed;
};
