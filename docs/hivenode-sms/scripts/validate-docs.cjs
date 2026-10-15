'use strict';

// Validação somente de documentação/contratos. Não conecta banco, modem ou gateway.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const errors = [];
const checks = [];
function check(name, fn) {
  try { fn(); checks.push(name); }
  catch (error) { errors.push(`${name}: ${error.message}`); }
}
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? files(full) : [full];
  });
}
function read(relative) { return fs.readFileSync(path.join(root, relative), 'utf8'); }
function json(relative) { return JSON.parse(read(relative)); }
const all = files(root);
const markdown = all.filter(file => file.endsWith('.md'));
for (const file of all.filter(file => file.endsWith('.json'))) {
  check(`JSON ${path.relative(root, file)}`, () => JSON.parse(fs.readFileSync(file, 'utf8')));
}
for (const file of markdown) {
  check(`Links ${path.relative(root, file)}`, () => {
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(/\[[^\]\n]+\]\(([^)]+)\)/g)) {
      let target = match[1];
      if (/^(https?:|mailto:|codex:|#)/.test(target)) continue;
      target = target.replace(/^<|>$/g, '').split('#')[0];
      if (!target) continue;
      const resolved = path.resolve(path.dirname(file), decodeURIComponent(target));
      const relative = path.relative(root, resolved);
      assert(!relative.startsWith('..') && !path.isAbsolute(relative), `link fora do pacote: ${target}`);
      assert(fs.existsSync(resolved), `link ausente: ${target}`);
    }
    const fences = text.split('\n').filter(line => /^```/.test(line)).length;
    assert.equal(fences % 2, 0, 'fence de código sem fechamento');
  });
}
const issues = json('issues/index.json');
const prd = read('01-prd.md');
const testPlan = read('11-testes.md');
const requirementIds = [...new Set([...prd.matchAll(/\| (R\d{2}) \|/g)].map(m => m[1]))];
const testIds = [...new Set([...testPlan.matchAll(/\| (T\d{2}) \|/g)].map(m => m[1]))];
const byId = new Map(issues.map(issue => [issue.id, issue]));
check('34 issues únicas', () => {
  assert.equal(issues.length, 34);
  assert.equal(byId.size, 34);
});
check('22 requisitos e 54 casos de teste', () => {
  assert.equal(requirementIds.length, 22);
  assert.equal(testIds.length, 54);
});
for (const issue of issues) {
  check(`Issue ${issue.id}`, () => {
    const text = read(`issues/${issue.id}.md`);
    assert(text.includes(issue.title), 'título divergente');
    for (const heading of ['Dependências', 'Requisitos e leitura obrigatória', 'Onde trabalhar',
      'Passos de implementação', 'Critérios de aceite', 'Testes e evidências', 'Como revisar e entregar']) {
      assert(text.includes(`## ${heading}`), `seção ausente: ${heading}`);
    }
    assert(issue.tasks.length >= 4 && issue.acceptance.length >= 3, 'issue pouco detalhada');
    for (const id of issue.dependencies) assert(byId.has(id), `dependência ausente: ${id}`);
    for (const id of issue.requirements) assert(requirementIds.includes(id), `requisito ausente: ${id}`);
    for (const id of issue.tests) assert(testIds.includes(id), `teste ausente: ${id}`);
    for (const spec of issue.specifications) assert(fs.existsSync(path.join(root, spec)), `spec ausente: ${spec}`);
  });
}
check('Grafo de dependências sem ciclos', () => {
  const done = new Set();
  const visiting = new Set();
  function visit(id) {
    if (done.has(id)) return;
    assert(!visiting.has(id), `ciclo em ${id}`);
    visiting.add(id);
    for (const dependency of byId.get(id).dependencies) visit(dependency);
    visiting.delete(id);
    done.add(id);
  }
  for (const id of byId.keys()) visit(id);
});
check('Requisitos cobertos por issues e testes', () => {
  for (const id of requirementIds) {
    assert(issues.some(issue => issue.requirements.includes(id)), `${id} sem issue`);
    assert(new RegExp(`\\| T\\d{2} \\|[^\\n]+\\|[^\\n]*\\b${id}\\b`).test(testPlan), `${id} sem teste`);
  }
});
const api = json('contracts/openapi.json');
check('OpenAPI estrutura e refs internos', () => {
  assert.equal(api.openapi, '3.1.0');
  const operations = new Set();
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    if (value.$ref) {
      assert(value.$ref.startsWith('#/'), `ref externa não verificada: ${value.$ref}`);
      let target = api;
      for (const piece of value.$ref.slice(2).split('/')) target = target?.[piece.replace(/~1/g, '/').replace(/~0/g, '~')];
      assert(target, `ref inexistente: ${value.$ref}`);
    }
    if (value.type === 'object' && value.properties && value.required) {
      for (const key of value.required) assert(Object.hasOwn(value.properties, key), `required inexistente: ${key}`);
    }
    for (const child of Object.values(value)) walk(child);
  }
  walk(api);
  for (const [route, methods] of Object.entries(api.paths)) {
    assert(route.startsWith('/'), `path inválido: ${route}`);
    for (const [method, operation] of Object.entries(methods)) {
      assert(['get', 'post', 'put', 'patch', 'delete'].includes(method), `method inválido: ${method}`);
      assert(!operations.has(operation.operationId), `operationId repetido: ${operation.operationId}`);
      operations.add(operation.operationId);
      assert(Object.keys(operation.responses).some(code => /^2/.test(code)), 'resposta de sucesso ausente');
      assert(Array.isArray(operation.security), 'security ausente');
      for (const match of route.matchAll(/\{([^}]+)\}/g)) {
        assert(operation.parameters.some(p => p.name === match[1] && p.in === 'path' && p.required), `parâmetro ausente: ${match[1]}`);
      }
      if (['sendSms', 'sendSmsBatch', 'resendSms', 'changeBilling'].includes(operation.operationId)) {
        assert(operation.parameters.some(p => p.name === 'Idempotency-Key' && p.required), 'idempotência ausente');
      }
    }
  }
  assert.equal(operations.size, 52);
});
const graph = json('contracts/sms-state-machine.json');
check('Estados alinhados ao OpenAPI e invariantes de execução', () => {
  assert.deepEqual([...graph.states].sort(), [...api.components.schemas.Message.properties.state.enum].sort());
  for (const [state, destinations] of Object.entries(graph.transitions)) {
    assert(graph.states.includes(state), `estado ausente: ${state}`);
    for (const destination of destinations) assert(graph.states.includes(destination), `destino ausente: ${destination}`);
  }
  for (const state of ['AUTHORIZED', 'SENDING', 'SENT', 'UNKNOWN', 'PARTIAL']) {
    assert(!graph.transitions[state].includes('CANCELED'), `cancelamento inseguro em ${state}`);
  }
  assert(!graph.transitions.UNKNOWN.includes('QUEUED'));
  assert(!graph.transitions.PARTIAL.includes('QUEUED'));
});
check('Cenários simulados válidos, sem modem real', () => {
  const scenarios = json('contracts/simulator-scenarios.json').scenarios;
  assert.equal(new Set(scenarios.map(s => s.id)).size, scenarios.length);
  assert(scenarios.length >= 18);
  for (const scenario of scenarios) {
    assert(graph.states.includes(scenario.expectedState), `estado inválido: ${scenario.id}`);
    assert.equal(scenario.realSendAllowed, false);
    for (const test of scenario.tests) assert(testIds.includes(test), `teste desconhecido: ${test}`);
  }
  assert.equal(scenarios.find(s => s.id === 'crash_after_modem').expectedFakeModemCalls, 1);
  assert.equal(scenarios.find(s => s.id === 'crash_after_modem').expectedState, 'UNKNOWN');
});
check('Gates físicos e produto não são declarados prontos', () => {
  const status = json('validation-status.json');
  assert.equal(status.productImplemented, false);
  assert.equal(status.productionRealSendAllowed, false);
  assert.equal(status.gates.find(gate => gate.id === 'P').status, 'NAO_EXECUTADO');
});
const result = {
  documentationOnly: true,
  files: all.length,
  markdown: markdown.length,
  issues: issues.length,
  requirements: requirementIds.length,
  testCases: testIds.length,
  apiPaths: Object.keys(api.paths).length,
  apiOperations: Object.values(api.paths).reduce((count, value) => count + Object.keys(value).length, 0),
  passedChecks: checks.length,
  errors,
};
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exitCode = 1;
