// Vexx AI Debate Arena — Command Security Validator

export function isTerminalCommandSafe(command) {
  if (!command) return false;
  const cmd = command.trim().toLowerCase();
  
  // 1. Check for redirection operators (which write files)
  if (/>|>>/.test(cmd)) {
    return false;
  }
  
  // 2. Define whitelist of safe starting commands (read-only / diagnostic)
  const safeStarts = [
    // File listing
    'dir', 'ls', 'gci', 'get-childitem', 'tree',
    // File reading
    'cat', 'type', 'gc', 'get-content', 'head', 'tail',
    // Text search
    'findstr', 'grep', 'sls', 'select-string', 'find', 'where',
    // System info
    'pwd', 'get-location', 'whoami', 'hostname', 'systeminfo', 'ver',
    'wmic os get', 'wmic cpu get', 'wmic memorychip get', 'wmic diskdrive get',
    'wmic logicaldisk get', 'wmic process get',
    // Process listing (read-only)
    'tasklist', 'get-process', 'get-service',
    // Network diagnostics (read-only)
    'ipconfig', 'netstat', 'ping', 'nslookup', 'tracert', 'arp',
    'get-netadapter', 'get-netipaddress', 'get-dnsclientcache',
    // Disk and environment
    'diskpart list', 'get-psdrive', 'get-volume',
    'echo', 'set', 'env', 'get-childitem env:',
    '$env:', 'get-item env:',
    // Package/dependency info (read-only)
    'npm list', 'npm ls', 'npm outdated', 'npm audit', 'npm view', 'npm info',
    'pip list', 'pip show', 'pip check', 'pip freeze',
    'node --version', 'node -v', 'npm --version', 'npm -v',
    'python --version', 'python -v', 'py --version',
    'dotnet --list-sdks', 'dotnet --list-runtimes', 'dotnet --info',
    'java -version', 'javac -version',
    'git --version', 'git remote', 'git config',
    // Git read-only
    'git status', 'git diff', 'git log', 'git show', 'git branch', 'git tag', 'git stash list',
    // Windows event logs / health (read-only)
    'get-eventlog', 'get-winevent', 'get-computerinfo',
    'get-hotfix', 'get-windowsoptionalfeature',
    // Powershell object inspection
    'get-command', 'get-module', 'get-installedmodule',
    'get-executionpolicy', 'get-host',
    'test-path', 'test-connection', 'resolve-path',
    'measure-object', 'select-object', 'where-object', 'format-table', 'format-list',
    'get-date', 'get-history', 'get-clipboard',
    'get-acl', 'get-filehash',
    // Docker read-only
    'docker ps', 'docker images', 'docker info', 'docker version',
    'docker-compose ps', 'docker-compose config'
  ];
  
  // Check if it starts with one of the safe starts
  let startsWithSafe = false;
  for (const safeStart of safeStarts) {
    if (cmd.startsWith(safeStart + ' ') || cmd === safeStart) {
      startsWithSafe = true;
      break;
    }
  }
  
  if (!startsWithSafe) {
    return false; // Does not start with a safe command
  }
  
  // 3. Define absolute blacklist of unsafe words/operators to prevent command chaining or subshells
  const unsafeBlacklist = [
    'del', 'rm', 'erase', 'rmdir', 'rd', 'remove-item',
    'mkdir', 'md', 'new-item',
    'mv', 'move', 'ren', 'rename', 'move-item', 'rename-item',
    'cp', 'copy', 'copy-item',
    'set-content', 'add-content', 'out-file',
    'npm', 'node', 'python', 'py', 'pip', 'cargo', 'go', 'gcc', 'g++', 'make', 'bash', 'sh', 'cmd', 'powershell', 'pwsh',
    'kill', 'stop-process',
    'commit', 'push', 'pull', 'checkout', 'clone', 'reset', 'merge', 'rebase',
    '&', ';', '&&', '||', '`', '$('
  ];
  
  // Check for unsafe substrings or tokens
  for (const unsafe of unsafeBlacklist) {
    if (cmd.includes(unsafe)) {
      // Exception: allow safe npm/node commands if they are exactly the ones listed in safeStarts
      if ((unsafe === 'npm' || unsafe === 'node' || unsafe === 'python' || unsafe === 'py' || unsafe === 'pip') && 
          (cmd.startsWith('npm list') || cmd.startsWith('npm ls') || cmd.startsWith('npm outdated') || cmd.startsWith('npm audit') ||
           cmd.startsWith('npm view') || cmd.startsWith('npm info') || cmd.startsWith('pip list') || cmd.startsWith('pip show') ||
           cmd.startsWith('pip check') || cmd.startsWith('pip freeze') || cmd.startsWith('node --version') || cmd.startsWith('node -v') ||
           cmd.startsWith('npm --version') || cmd.startsWith('npm -v') || cmd.startsWith('python --version') || cmd.startsWith('python -v') ||
           cmd.startsWith('py --version'))) {
        continue; // Permit these exceptions
      }
      return false; // Found blacklisted word/operator
    }
  }
  
  return true; // Command passed all checks
}

export function hasUnsafeActions(text) {
  // Check for file modifications or deletions
  if (/<file_write|<file_delete|<file_move|<file_copy/i.test(text)) {
    return true;
  }
  
  // Check for terminal_execute commands
  const termRegex = /<terminal_execute>([\s\S]*?)<\/terminal_execute>/gi;
  let match;
  termRegex.lastIndex = 0;
  while ((match = termRegex.exec(text)) !== null) {
    const command = match[1];
    if (!isTerminalCommandSafe(command)) {
      return true;
    }
  }
  
  return false;
}

// Expose globally for backward compatibility
window.isTerminalCommandSafe = isTerminalCommandSafe;
window.hasUnsafeActions = hasUnsafeActions;
