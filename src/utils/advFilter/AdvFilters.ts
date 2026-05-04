import moment from 'moment';
import mongoose from 'mongoose';

export class AdvFilters {
  /**
   * Parses a filter options object (e.g. from query params) into MongoDB-compatible operators.
   */
  public static filter(filters: string): Record<string, any>[] {
    const filterOptionsObject: Record<string, any> = {};
    //if feature string is empty or undefined return empty object
    if (filters === undefined || filters?.length === 0) return [{}];
    // split and remove empty strings
    const filterOptionsArray = filters.split('|').filter((option: any) => option !== '');

    filterOptionsArray.forEach((filterOption: any) => {
      const [key, value] = filterOption.split(';');
      if (value === 'true') {
        filterOptionsObject[key] = true;
      } else if (value === 'false') {
        filterOptionsObject[key] = false;
      } else {
        try {
          // Use JSON.parse to safely convert the value to an object
          const parsedValue = JSON.parse(value)
          // Recursively parse the parsedValue if it contains nested objects
          const filteredValue = this.parseValueRecursively(parsedValue);

          // If key already exists, merge the parsed value
          filterOptionsObject[key] = {
            ...filterOptionsObject[key],
            ...filteredValue,
          };
        } catch (error) {
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
    return [filterOptionsObject];
  }

  /**
   * Converts a simple sort string (e.g. "-createdAt,name") into a Mongo sort object.
   */
  public static sort(sortStr: string): Record<string, 1 | -1> {
    if (!sortStr) return {};
    return sortStr.split(';').reduce<Record<string, 1 | -1>>((acc, field) => {
      if (field.startsWith('-')) {
        acc[field.slice(1)] = -1;
      } else {
        acc[field] = 1;
      }
      return acc;
    }, {});
  }

  /**
   * Parses an array of field names and a keyword string into MongoDB regex query conditions.
   * Supports nested $elemMatch syntax when field names are wrapped in brackets.
   */
  public static query(array: string[], keyword: string): Record<string, any>[] {
    const parsed: Record<string, any>[] = [];

    if (!keyword || !array.length) return [{}];

    for (const value of array) {
      try {
        if (value.includes('[') && value.includes(']')) {
          if (value.includes('.')) {
            const [fieldName, subField] = value.split('.');
            const elemMatchField = fieldName.replace('[', '');
            const subFieldFinal = subField.replace(']', '');
            parsed.push({
              [elemMatchField]: {
                $elemMatch: {
                  [subFieldFinal]: { $regex: keyword.trim(), $options: 'i' },
                },
              },
            });
          } else {
            const elemMatchField = value.replace('[', '').replace(']', '');
            parsed.push({
              [elemMatchField]: { $regex: keyword.trim(), $options: 'i' },
            });
          }
        } else {
          parsed.push({ [value]: { $regex: keyword.trim(), $options: 'i' } });
        }
      } catch (error) {
        console.error(error);
        throw new Error('Invalid field format passed to query');
      }
    }

    return parsed;
  }

  //util function checks if a string is a valid mongo object id, if it is, it returns the value with the ObjectId constructor
  //if it is not a valid mongo object id, it returns the value as is
  static checkObjectId = (value: string) => {
    if (mongoose.Types.ObjectId.isValid(value)) {
      return new mongoose.Types.ObjectId(value);
    }
    return value;
  };
  // Helper function for recursive parsing
  static parseValueRecursively = (parsedValue: any) => {
    if (typeof parsedValue === 'object' && parsedValue !== null) {
      const allowedOperators = ['$gte', '$lte', '$gt', '$lt', '$eq', '$elemMatch', '$in', '$ne', '$exists'];
      return Object.entries(parsedValue).reduce((acc: any, [opKey, opValue]) => {
        if (allowedOperators.includes(opKey)) {
          // If opValue is a nested object, recursively parse it
          if (typeof opValue === 'object' && opValue !== null) {
            acc[opKey] = this.parseValueRecursively(opValue);
          } else {
            const isValidDate = moment(opValue as string, true).isValid();
            const isNumber = !isNaN(Number(opValue));
            if (opKey === '$elemMatch' && typeof opValue === 'string') {
              return (acc[opKey] = { $eq: this.checkObjectId(opValue) }); // Handle simple string equality for $elemMatch
            } else if (opKey === '$in') {
              if (typeof opValue === 'string' && opValue.includes(',')) {
                acc[opKey] = opValue.split(',').map((v) => this.checkObjectId(v.trim()));
              } else if (Array.isArray(opValue)) {
                acc[opKey] = opValue.map((v) => this.checkObjectId(v));
              } else {
                acc[opKey] = [this.checkObjectId(opValue as string)];
              }
            } else if (isValidDate) {
              acc[opKey] = moment(opValue as any).toDate();
            } else if (isNumber) {
              acc[opKey] = Number(opValue);
            } else if (opKey === null) {
              acc[opKey] = null;
            } else {
              acc[opKey] = this.checkObjectId(opValue as string);
            }
          }
        }
        return acc;
      }, {});
    }
    return parsedValue;
  };
}
