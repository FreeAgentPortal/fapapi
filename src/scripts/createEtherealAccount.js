const nodemailer = require('nodemailer');

async function createEtherealAccount() {
  const testAccount = await nodemailer.createTestAccount();
  console.info('Copy these into your .env:');
  console.info(`ETHEREAL_USER=${testAccount.user}`);
  console.info(`ETHEREAL_PASS=${testAccount.pass}`);
}

createEtherealAccount();
