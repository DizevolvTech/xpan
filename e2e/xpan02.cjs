// Mutativo: cria e libera UM pedido pela interface. Não limpa dados nem força liberações.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const base = process.env.E2E_BASE || 'http://localhost:3000';
const deliveryDate = process.env.E2E_DELIVERY_DATE;
const output = process.env.E2E_OUTPUT || '.next/xpan-02-validation';
assert.match(deliveryDate || '', /^\d{4}-\d{2}-\d{2}$/, 'Informe E2E_DELIVERY_DATE de um slot livre do lote.');
const deliveryLabel = deliveryDate.split('-').reverse().join('/');
fs.mkdirSync(output, { recursive: true });
const result = { base, deliveryDate, checks: [], startedAt: new Date().toISOString() };
const check = (message) => { result.checks.push(message); console.log('PASS', message); };
const save = () => fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2));

async function login(browser, who, password) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  page.setDefaultNavigationTimeout(90000);
  await page.goto(`${base}/login`);
  await page.locator('#email').waitFor();
  // O ambiente dev pode mostrar o formulário antes da hidratação.
  await page.waitForTimeout(1500);
  await page.locator('#email').fill(process.env[`E2E_${who.toUpperCase()}_EMAIL`] || `${who}@danielaugusto.com`);
  await page.locator('#password').fill(process.env[`E2E_${who.toUpperCase()}_PASSWORD`] || password);
  await page.locator('button[type=submit]').click();
  await page.waitForURL(/\/(loja|gestor-fabrica)(\/|$)/);
  page.on('pageerror', (error) => { (result.pageErrors ||= []).push(error.message); });
  return { context, page };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  let activePage;
  try {
    const store = await login(browser, 'loja', 'Loja@123');
    const page = activePage = store.page;
    await page.goto(`${base}/loja/pedidos`);
    await page.getByRole('listitem').filter({ hasText: deliveryLabel })
      .getByRole('button', { name: 'Montar pedido', exact: true }).click();
    const row = page.locator('tr').filter({ has: page.locator('input:not([disabled])') }).first();
    await row.waitFor();
    const productText = await row.innerText();
    result.productCode = productText.match(/PR-[\w-]+/)?.[0];
    assert(result.productCode, `Código do produto não encontrado: ${productText}`);
    result.productName = productText.split('\n')[0];
    result.quantity = 6;
    await row.locator('input:not([disabled])').first().fill(String(result.quantity));
    await page.locator('#order-note').fill('XPAN-02 — validação completa pela interface');
    await page.getByText('Após confirmar, o pedido fica aguardando', { exact: false }).waitFor();
    check('Produto existente selecionado e pré-requisito de liberação informado');
    await page.getByRole('button', { name: 'Revisar Pedido', exact: true }).click();
    await page.getByRole('dialog').last().getByText(result.productName, { exact: true }).waitFor();
    await page.screenshot({ path: path.join(output, '01-review.png'), fullPage: true });
    const createdResponse = page.waitForResponse(r => r.url().endsWith('/api/store-orders') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Confirmar pedido', exact: true }).click();
    const response = await createdResponse;
    const created = await response.json();
    assert.equal(response.status(), 201, JSON.stringify(created));
    result.order = created;
    save(); // Registra o pedido imediatamente para permitir auditoria mesmo se outra etapa falhar.
    await page.getByText(created.code, { exact: true }).first().waitFor();
    await page.reload();
    await page.getByText(created.code, { exact: true }).first().waitFor();
    await page.screenshot({ path: path.join(output, '02-saved.png'), fullPage: true });
    check(`Pedido ${created.code} criado, salvo e localizado após recarregar`);

    const factory = await login(browser, 'fabrica', 'Fabrica@123');
    const fab = activePage = factory.page;
    await factory.context.addInitScript(() => {
      window.__printCalls = 0;
      window.print = () => { window.__printCalls++; };
    });
    await fab.goto(`${base}/gestor-fabrica/pedidos`);
    await fab.getByRole('row').filter({ hasText: created.code }).getByRole('link', { name: 'Detalhe', exact: true }).click();
    await fab.waitForURL(/\/pedidos\/.+/);
    await fab.getByText('Nenhuma OP gerada. Libere o pedido para produção.', { exact: true }).waitFor();
    const releasedResponse = fab.waitForResponse(r => r.url().includes('/api/factory-planning/workflow') && r.request().method() === 'PATCH');
    await fab.getByRole('button', { name: 'Liberar para produção', exact: true }).click();
    const released = await releasedResponse;
    assert.equal(released.status(), 200, await released.text());
    await fab.getByRole('button', { name: 'Pedido liberado', exact: true }).waitFor();
    await fab.getByRole('link', { name: 'Abrir', exact: true }).first().waitFor();
    await fab.screenshot({ path: path.join(output, '03-released.png'), fullPage: true });
    check('Liberação normal gerou OP vinculada, sem exceção forçada');
    await fab.getByRole('link', { name: 'Abrir', exact: true }).first().click();
    await fab.waitForURL(/\/ordens-producao\/.+/);
    const sourceRow = () => fab.getByRole('row').filter({ hasText: created.code }).filter({ hasText: result.productCode });
    await sourceRow().waitFor();
    const sourceText = await sourceRow().innerText();
    assert(sourceText.includes(result.productName));
    assert.match(sourceText, /\t6 (Kg|Un|L)\t/);
    assert(sourceText.includes(deliveryLabel));
    result.opUrl = fab.url();
    result.opCode = (await fab.locator('h1').innerText()).split(' · ')[0];
    result.source = sourceText;
    await fab.reload();
    await sourceRow().waitFor();
    assert.equal(await sourceRow().innerText(), sourceText);
    await fab.screenshot({ path: path.join(output, '04-op.png'), fullPage: true });
    check('OP abre e mantém produto, quantidade, entrega e pedido após recarregar');

    const popup = factory.context.waitForEvent('page');
    await fab.getByRole('button', { name: 'Produção', exact: true }).click();
    const print = await popup;
    print.on('pageerror', error => { (result.pageErrors ||= []).push(error.message); });
    await print.waitForFunction(() => window.__printCalls === 1, {}, { timeout: 90000 });
    const printText = await print.locator('body').innerText();
    assert(printText.includes(result.opCode));
    assert(printText.includes(result.productName));
    assert(printText.includes(deliveryLabel));
    await print.pdf({ path: path.join(output, 'op.pdf'), format: 'A4', printBackground: true });
    await print.screenshot({ path: path.join(output, '05-print.png'), fullPage: true });
    await print.getByRole('button', { name: 'Imprimir', exact: true }).click();
    assert.equal(await print.evaluate(() => window.__printCalls), 2);
    check('Impressão automática e manual acionadas; PDF gerado com a OP correta');

    await sourceRow().getByRole('link', { name: created.code, exact: true }).click();
    await fab.waitForURL(/\/pedidos\/.+/);
    await fab.getByRole('button', { name: 'Pedido liberado', exact: true }).waitFor();
    check('Link de origem retorna ao pedido liberado');
    await fab.getByRole('link', { name: 'Ver OPs', exact: true }).click();
    await fab.waitForURL('**/ordens-producao');
    await fab.getByPlaceholder('Buscar por OP, pedido, produto, categoria ou linha de produção...').fill(created.code);
    await fab.getByRole('button', { name: 'Abrir ações da OP', exact: true }).first().waitFor();
    await fab.screenshot({ path: path.join(output, '06-search.png'), fullPage: true });
    await fab.getByRole('button', { name: 'Abrir ações da OP', exact: true }).first().click();
    await fab.getByRole('menuitem', { name: 'Abrir OP', exact: true }).click();
    await sourceRow().waitFor();
    assert.equal(fab.url(), result.opUrl);
    check('OP localizada pelo código do pedido na lista e reaberta pela interface');
    assert.deepEqual(result.pageErrors || [], []);
    result.status = 'PASS';
  } catch (error) {
    result.status = 'FAIL';
    result.error = error.stack;
    if (activePage) await activePage.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
    process.exitCode = 1;
    console.error(error);
  } finally {
    result.finishedAt = new Date().toISOString();
    save();
    await browser.close();
  }
})();
