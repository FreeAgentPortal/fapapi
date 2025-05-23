const { exec } = require('child_process');

export default function executeGitPull() {
  exec('git pull origin master', (err: any, stdout: any, stderr: any) => {
    if (err) {
      console.error(`Error executing Git pull: ${err}`);
      return;
    }
    console.log(`Git pull successful: ${stdout}`);
  });
}
