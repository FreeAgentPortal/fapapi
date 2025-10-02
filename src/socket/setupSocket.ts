const userObject = require('../utils/userObject');
const colors = require('colors');

/**
 * @description Setup socket is used on the users first connection to the socket server
 *              This function will take the user data from whats passed in, and check it against the database
 *              and see if there is any difference between the two documents, if there is
 *              we emit a socket event to the client to update the user data
 * @param {Object} socket - Socket.io socket instance
 * @param {Object} userData - User data from the client
 * @returns {void}
 *
 * @author Austin Howard
 * @since 1.0
 * @version 1.0
 *
 */
export default async (socket: any, userData: any) => {
  try {
    if (userData && userData._id) {
      // Find the user in the database
      const user = await userObject(userData._id);
      // If the user is not found, disconnect the socket
      if (!user) {
        return socket.disconnect();
      }
      // If the user is found, check if the user data from the client is different from the user data in the database
      // to do this we will need to loop through the user data from the client, and check that against the database document
      for (const key in userData) {
        // console.info(`checking ${key}`.yellow);
        // if the key is an object, just skip it
        if (typeof userData[key] === 'object') {
          continue;
        }
        // if the key is in the database document, check if the value is the same
        // skip boolean values, as making them strings will return false
        if (typeof userData[key] === 'boolean') {
          // check it against the database document and see if the value is the same
          if (user[key] && user[key] !== userData[key]) {
            // console.info(`Boolean: ${key} is different`.bgYellow);
            console.info(colors.bgBlue(`database: ${user[key]} client: ${userData[key]}`));
            return socket.emit('updateUser', await userObject(user._id));
          }
        }
        if (
          typeof userData[key] !== 'boolean' &&
          // dont check the token, as it will always be different
          key !== 'token' &&
          user[key].toString() !== userData[key]
        ) {
          // console.info(`${key} is different`.bgYellow);
          // if the value is not the same, emit a socket event to the client to update the user data
          // essentialy we are re-authenticating the user on the client side
          // using the userObject function to return the user data in the correct format
          return socket.emit('updateUser', await userObject(user._id));
        } else {
          continue;
        }
      }
    }
    // otherwise, if the user data is the same, emit a socket event connected to the client
    socket.emit('connected');
  } catch (error) {
    console.info(error);
  }
};
