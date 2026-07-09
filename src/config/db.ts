import logger from "../utils/logger";

const mongoose = require('mongoose');
const colors = require('colors');

export default async () => {
  try {
    const uri = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@${process.env.CLUSTER_STRING}/?retryWrites=true&w=majority`;
    await mongoose.connect(uri, {
      dbName: process.env.MONGO_DBNAME,
    });
    logger.info('[DB] Database Connected');
  } catch (error) {
    logger.error({ error }, '[DB] Failed to connect to MongoDB'); 
    process.exit(1);
  }
};
