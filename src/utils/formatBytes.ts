export default (bytes: string): string => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === '0') return '0 Bytes';
  const i = Math.floor(Math.log(parseInt(bytes, 10)) / Math.log(1024));
  return `${parseFloat((parseInt(bytes, 10) / Math.pow(1024, i)).toFixed(2))} ${
    sizes[i]
  }`;
};
