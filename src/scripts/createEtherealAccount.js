const nodemailer = require('nodemailer');

async function createEtherealAccount() {
  const testAccount = await nodemailer.createTestAccount();
  console.log('Copy these into your .env:');
  console.log(`ETHEREAL_USER=${testAccount.user}`);
  console.log(`ETHEREAL_PASS=${testAccount.pass}`);
}

createEtherealAccount();
