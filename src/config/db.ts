const mongoose = require('mongoose');
const colors = require('colors');

export default async () => {
  try {
    const uri = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@${process.env.CLUSTER_STRING}/?retryWrites=true&w=majority`;
    await mongoose.connect(uri, {
      dbName: process.env.MONGO_DBNAME,
    });
    console.log(colors.bgGreen.white('MongoDB Connected'));
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};
