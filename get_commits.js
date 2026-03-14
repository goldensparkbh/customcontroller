const cp = require('child_process');
const fs = require('fs');
fs.writeFileSync('git_commits.txt', cp.execSync('git log --oneline -n 10').toString());
