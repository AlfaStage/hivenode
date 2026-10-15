const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const ts = require(path.join(root, 'web/node_modules/typescript'));
for (const app of ['hivenode-app', 'hiveminer-app']) {
  const source = fs.readFileSync(path.join(root, app, 'src/lib/hostValidator.ts'), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const context = { exports: {} }; vm.runInNewContext(js, context);
  const { isHostSafe, parseHostPort } = context.exports;
  for (const ip of ['127.0.0.1','10.0.0.1','100.64.0.1','0.0.0.1','::1','0:0:0:0:0:0:0:1','::ffff:127.0.0.1','::ffff:7f00:1','fd00::1','fe80::1','224.0.0.1','localhost']) assert.equal(isHostSafe(ip), false, app + ':' + ip);
  for (const ip of ['8.8.8.8','2606:4700:4700::1111','example.org']) assert.equal(isHostSafe(ip), true, app + ':' + ip);
  assert.equal(parseHostPort('[2606:4700:4700::1111]:443').host, '2606:4700:4700::1111');
  for (const target of ['example.org:0','example.org:65536','example.org:443oops','::1:443']) assert.throws(() => parseHostPort(target));
  console.log('PASS: ' + app + ' destination policies');
}
