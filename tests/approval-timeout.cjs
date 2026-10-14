const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the actual reconciliation module with no RPC, disk writes or funds.
const source = ts.transpileModule(fs.readFileSync('lib/reconcile.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
let record;
let reason;
const exportsObject = {};
const dependencies = {
  './chain': { publicClient: { getTransactionReceipt: async () => ({ status: 'success' }) } },
  './hyperliquidMock': { isHyperliquidCredited: () => true },
  './pull': { attemptPull: async () => ({ ok: false, reason, deposit: record }) },
  './store': { depositStore: {
    get: () => record,
    update: (_id, patch) => (record = { ...record, ...patch }),
  } },
};
vm.runInNewContext(source, { exports: exportsObject, require: (id) => {
  assert.ok(id in dependencies, `Unexpected dependency: ${id}`);
  return dependencies[id];
}, Date });
function seed(age, status = 'SIGNED') {
  record = { id: 'test', status, createdAt: new Date(Date.now() - age).toISOString(),
    approveTxHash: 'approval', txHash: null, failureReason: null,
    reconciliation: { onchainConfirmed: false, onchainConfirmedAt: null,
      hyperliquidCredited: false, lastCheckedAt: null, ambiguousSince: null } };
}
(async () => {
  reason = 'APPROVAL_NOT_CONFIRMED';
  seed(6 * 60_000);
  await exportsObject.reconcileDeposit('test');
  assert.equal(record.status, 'STALLED_TIMEOUT');
  assert.match(record.failureReason, /approval transaction/);
  assert.ok(record.reconciliation.lastCheckedAt);
  seed(60_000);
  await exportsObject.reconcileDeposit('test');
  assert.equal(record.status, 'SIGNED');
  reason = 'RELAYER_FAILED';
  seed(6 * 60_000, 'STALLED_NO_GAS');
  await exportsObject.reconcileDeposit('test');
  assert.equal(record.status, 'STALLED_NO_GAS');
  record.txHash = 'confirmed-transfer';
  await exportsObject.reconcileDeposit('test');
  assert.equal(record.status, 'CREDITED');
  console.log('PASS: stale approval timeout, recent approval, gas failure, later recovery');
})().catch((error) => { console.error(error); process.exitCode = 1; });
