export const MONGO_URI =
  process.env.MONGO_URI ??
  (() => {
    console.warn('MONGO_URI is not set, using default: mongodb://localhost:27017/fapapi');
    return 'mongodb://localhost:27017/fapapi';
  })();
