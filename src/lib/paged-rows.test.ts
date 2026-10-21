import assert from "node:assert/strict";
import test from "node:test";

import { fetchAllRows } from "@/lib/paged-rows";

function fakeTable(total: number) {
  const rows = Array.from({ length: total }, (_, index) => ({ id: index }));
  const calls: Array<[number, number]> = [];
  return {
    calls,
    fetchPage: async (from: number, to: number) => {
      calls.push([from, to]);
      return { data: rows.slice(from, to + 1), error: null };
    },
  };
}

test("tabela maior que a página vem inteira, sem repetir nem perder linha", async () => {
  const table = fakeTable(2505);
  const result = await fetchAllRows(table.fetchPage, 1000);
  assert.equal(result.error, null);
  assert.equal(result.data?.length, 2505);
  assert.deepEqual(result.data?.slice(998, 1002).map((row) => row.id), [998, 999, 1000, 1001]);
  assert.equal(new Set(result.data?.map((row) => row.id)).size, 2505);
  assert.deepEqual(table.calls, [[0, 999], [1000, 1999], [2000, 2999]]);
});

test("tabela pequena e vazia leem uma página só; múltiplo exato pede uma extra", async () => {
  const small = fakeTable(10);
  assert.equal((await fetchAllRows(small.fetchPage, 1000)).data?.length, 10);
  assert.equal(small.calls.length, 1);

  const empty = fakeTable(0);
  assert.deepEqual((await fetchAllRows(empty.fetchPage, 1000)).data, []);

  const exact = fakeTable(2000);
  assert.equal((await fetchAllRows(exact.fetchPage, 1000)).data?.length, 2000);
  assert.equal(exact.calls.length, 3);
});

test("erro em qualquer página aborta e devolve o erro", async () => {
  let call = 0;
  const result = await fetchAllRows(async () => {
    call += 1;
    return call === 1
      ? { data: Array.from({ length: 1000 }, () => ({})), error: null }
      : { data: null, error: { message: "boom" } };
  }, 1000);
  assert.equal(result.data, null);
  assert.equal(result.error?.message, "boom");
});
