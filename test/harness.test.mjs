import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MockLanguageModelV3 } from "ai/test";
mock.method(console, "log", () => {
});
async function runAgent(options, task) {
  const { runAgent: runAgent2 } = await import("../src/harness.ts");
  return runAgent2(options, task);
}
async function agent(options) {
  const { billing } = await import("../src/billing/agent.ts");
  return { ...billing, ...options };
}
function reply(content) {
  return {
    content,
    finishReason: {
      unified: content.some((c) => c.type === "tool-call") ? "tool-calls" : "stop",
      raw: ""
    },
    usage: {
      inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 0, text: 0, reasoning: 0 }
    },
    warnings: []
  };
}
const final = reply([{ type: "text", text: "\u0413\u043E\u0442\u043E\u0432\u043E." }]);
const call = (name, input, id = "call_1") => ({
  type: "tool-call",
  toolCallId: id,
  toolName: name,
  input: JSON.stringify(input)
});
test("01 \u0417\u0430\u043F\u0438\u0442: \u0422\u0435\u043A\u0441\u0442\u043E\u0432\u0430 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u044C \u0437\u0430\u0432\u0435\u0440\u0448\u0443\u0454 \u0440\u043E\u0431\u043E\u0442\u0443 \u043F\u0456\u0441\u043B\u044F \u043E\u0434\u043D\u043E\u0433\u043E \u0437\u0430\u043F\u0438\u0442\u0443", async () => {
  const model = new MockLanguageModelV3({ doGenerate: final });
  const result = await runAgent({ model, system: "\u0412\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0439 \u0443\u043A\u0440\u0430\u0457\u043D\u0441\u044C\u043A\u043E\u044E." }, "\u041F\u0440\u0438\u0432\u0456\u0442");
  assert.equal(result.text, "\u0413\u043E\u0442\u043E\u0432\u043E.");
  assert.equal(result.reason, "final");
  assert.equal(model.doGenerateCalls.length, 1);
  assert.equal(model.doGenerateCalls[0].prompt.at(-1)?.role, "user");
});
test("02 \u041E\u043F\u0438\u0441\u0438: \u043C\u043E\u0434\u0435\u043B\u044C \u043E\u0442\u0440\u0438\u043C\u0443\u0454 \u0441\u0445\u0435\u043C\u0443 getCharges", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: [reply([call("getCharges", { customerId: 42 })]), final]
  });
  await runAgent(await agent({ model }), "\u041F\u0435\u0440\u0435\u0432\u0456\u0440");
  const tool = model.doGenerateCalls[0].tools.find((tool2) => tool2.name === "getCharges");
  assert.ok(tool);
  assert.equal(tool.inputSchema.properties.customerId.type, "integer");
});
test("03 \u0412\u0438\u043A\u043E\u043D\u0430\u043D\u043D\u044F: getCharges \u0447\u0438\u0442\u0430\u0454 \u0434\u0430\u043D\u0456, \u0430\u0440\u0433\u0443\u043C\u0435\u043D\u0442\u0438 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u044F\u044E\u0442\u044C\u0441\u044F", async () => {
  const { billing } = await import("../src/billing/agent.ts");
  const charges = await billing.runTool("getCharges", { customerId: 42 });
  assert.deepEqual(charges.map((charge) => charge.id), ["ch_01", "ch_02"]);
  await assert.rejects(() => billing.runTool("getCharges", { customerId: "42" }));
});
test("04 \u0406\u0441\u0442\u043E\u0440\u0456\u044F: \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043F\u043E\u0432\u0435\u0440\u0442\u0430\u0454\u0442\u044C\u0441\u044F \u0437 id \u0432\u0438\u043A\u043B\u0438\u043A\u0443", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: [reply([call("getCharges", { customerId: 42 }, "id-42")]), final]
  });
  const result = await runAgent(await agent({ model }), "\u041F\u0435\u0440\u0435\u0432\u0456\u0440");
  const message = result.messages.find((message2) => message2.role === "tool");
  assert.ok(message);
  assert.equal(message.content[0].toolCallId, "id-42");
  assert.match(JSON.stringify(message), /ch_02/);
});
test("05 \u0426\u0438\u043A\u043B: \u0414\u0432\u0430 \u0442\u0443\u043B\u0438: \u0456\u0441\u0442\u043E\u0440\u0456\u044F 1 \u2192 3 \u2192 5, \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u044C \u0437\u0430\u043F\u0438\u0441\u0430\u043D\u0430 \u0440\u0456\u0432\u043D\u043E \u043E\u0434\u0438\u043D \u0440\u0430\u0437", async (t) => {
  const originalDirectory = process.cwd();
  const directory = await mkdtemp(join(tmpdir(), "harness-"));
  process.chdir(directory);
  t.after(() => process.chdir(originalDirectory));
  const model = new MockLanguageModelV3({
    doGenerate: [
      reply([call("getCharges", { customerId: 42 })]),
      reply([
        call("sendReply", { customerId: 42, text: "\u0414\u0432\u0430 \u0441\u043F\u0438\u0441\u0430\u043D\u043D\u044F \u043F\u043E $49." }, "call_2")
      ]),
      final
    ]
  });
  const result = await runAgent(
    await agent({ model, beforeTool: () => null }),
    "\u041F\u0435\u0440\u0435\u0432\u0456\u0440 \u0441\u043F\u0438\u0441\u0430\u043D\u043D\u044F"
  );
  assert.equal(result.reason, "final");
  const histories = model.doGenerateCalls.map(
    (request) => request.prompt.filter((m) => m.role !== "system")
  );
  assert.deepEqual(
    histories.map((messages) => messages.length),
    [1, 3, 5]
  );
  assert.equal(JSON.stringify(histories[1]).includes("call_1"), true);
  const lines = (await readFile(".data/outbox.jsonl", "utf8")).trim().split("\n");
  assert.equal(lines.length, 1);
  assert.equal(JSON.parse(lines[0]).customerId, 42);
});
test("06 \u041A\u0456\u043B\u044C\u043A\u0430 \u0442\u0443\u043B\u0456\u0432: \u041A\u0456\u043B\u044C\u043A\u0430 \u0432\u0438\u043A\u043B\u0438\u043A\u0456\u0432 \u043E\u0442\u0440\u0438\u043C\u0443\u044E\u0442\u044C \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0438 \u0437\u0456 \u0441\u0432\u043E\u0457\u043C\u0438 id", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: [
      reply([
        call("getCharges", { customerId: 42 }, "a"),
        call("getCharges", { customerId: 7 }, "b")
      ]),
      final
    ]
  });
  await runAgent(await agent({ model }), "\u0414\u0432\u0430 \u043A\u043B\u0456\u0454\u043D\u0442\u0438");
  const results = model.doGenerateCalls[1].prompt.filter(
    (message) => message.role === "tool"
  );
  assert.deepEqual(
    results.flatMap(
      (message) => message.content.filter((part) => part.type === "tool-result").map((part) => part.toolCallId)
    ),
    ["a", "b"]
  );
});
test("07 \u041B\u0456\u043C\u0456\u0442: \u041B\u0456\u043C\u0456\u0442 \u0437\u0443\u043F\u0438\u043D\u044F\u0454 \u043C\u043E\u0434\u0435\u043B\u044C, \u044F\u043A\u0430 \u0437\u043D\u043E\u0432\u0443 \u043F\u0440\u043E\u0441\u0438\u0442\u044C \u0442\u043E\u0439 \u0441\u0430\u043C\u0438\u0439 \u0442\u0443\u043B", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: reply([call("getCharges", { customerId: 42 })])
  });
  const result = await runAgent(await agent({ model, maxSteps: 2 }), "\u041F\u043E\u0432\u0442\u043E\u0440\u044E\u0439");
  assert.equal(result.reason, "limit");
  assert.equal(model.doGenerateCalls.length, 2);
});
test("08 \u041F\u043E\u043C\u0438\u043B\u043A\u0430: \u041D\u0435\u043A\u043E\u0440\u0435\u043A\u0442\u043D\u0456 \u0430\u0440\u0433\u0443\u043C\u0435\u043D\u0442\u0438 \u0439 \u043D\u0435\u0432\u0456\u0434\u043E\u043C\u0438\u0439 \u0442\u0443\u043B \u043F\u043E\u0432\u0435\u0440\u0442\u0430\u044E\u0442\u044C \u043F\u043E\u043C\u0438\u043B\u043A\u0443 \u0432 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442", async () => {
  for (const toolCall of [
    call("getCharges", { customerId: "42" }),
    call("unknown", {})
  ]) {
    const model = new MockLanguageModelV3({ doGenerate: [reply([toolCall]), final] });
    await runAgent(await agent({ model }), "\u041D\u0435\u043A\u043E\u0440\u0435\u043A\u0442\u043D\u0438\u0439 \u0432\u0438\u043A\u043B\u0438\u043A");
    const next = model.doGenerateCalls[1].prompt;
    assert.equal(next.filter((message) => message.role === "tool").length, 1);
    const nextRequest = JSON.stringify(next);
    assert.match(nextRequest, /error/);
  }
});
test("09 \u041E\u0431\u0440\u0456\u0437\u0430\u043D\u043D\u044F: \u041E\u0431\u0440\u0456\u0437\u0430\u043D\u0456 \u0430\u0440\u0433\u0443\u043C\u0435\u043D\u0442\u0438 \u043D\u0435 \u0434\u043E\u0445\u043E\u0434\u044F\u0442\u044C \u0434\u043E \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043D\u044F", async () => {
  const truncated = reply([call("getCharges", { customerId: 42 })]);
  truncated.finishReason = { unified: "length", raw: "length" };
  const model = new MockLanguageModelV3({ doGenerate: truncated });
  await assert.rejects(async () => runAgent(await agent({ model }), "\u041F\u0435\u0440\u0435\u0432\u0456\u0440"), /обрізано/);
});
test("10 \u041A\u043E\u043D\u0442\u0435\u043A\u0441\u0442: AGENTS.md \u0437\u02BC\u044F\u0432\u043B\u044F\u0454\u0442\u044C\u0441\u044F \u0432 \u043F\u0435\u0440\u0448\u043E\u043C\u0443 \u043F\u043E\u0432\u0456\u0434\u043E\u043C\u043B\u0435\u043D\u043D\u0456", async () => {
  const model = new MockLanguageModelV3({ doGenerate: final });
  await runAgent(await agent({ model }), "\u041F\u0435\u0440\u0435\u0432\u0456\u0440");
  assert.match(JSON.stringify(model.doGenerateCalls[0].prompt), /Дякуємо за звернення/);
});
test("11 Skills: \u0421\u043F\u0435\u0440\u0448\u0443 \u043E\u043F\u0438\u0441 skill, \u043F\u043E\u0432\u043D\u0438\u0439 \u0442\u0435\u043A\u0441\u0442 \u043B\u0438\u0448\u0435 \u043F\u0456\u0441\u043B\u044F readSkill", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: [reply([call("readSkill", { name: "billing" })]), final]
  });
  await runAgent(await agent({ model }), "\u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0439 billing");
  assert.doesNotMatch(
    JSON.stringify(model.doGenerateCalls[0].prompt),
    /Перевір дати, суми/
  );
  assert.match(JSON.stringify(model.doGenerateCalls[1].prompt), /Перевір дати, суми/);
  const { readSkill } = await import("../src/skills.ts");
  assert.throws(() => readSkill("../../.env"), /Невідомий skill/);
});
test("12 \u0414\u043E\u0437\u0432\u0456\u043B: \u0411\u0435\u0437 \u0434\u043E\u0437\u0432\u043E\u043B\u0443 sendReply \u043D\u0435 \u0441\u0442\u0432\u043E\u0440\u044E\u0454 outbox, \u043C\u043E\u0434\u0435\u043B\u044C \u0431\u0430\u0447\u0438\u0442\u044C \u0431\u043B\u043E\u043A\u0443\u0432\u0430\u043D\u043D\u044F", async (t) => {
  const originalDirectory = process.cwd();
  const approved = process.env.APPROVED;
  process.chdir(await mkdtemp(join(tmpdir(), "harness-blocked-")));
  process.env.APPROVED = "0";
  t.after(() => {
    process.chdir(originalDirectory);
    if (approved === void 0) delete process.env.APPROVED;
    else process.env.APPROVED = approved;
  });
  const model = new MockLanguageModelV3({
    doGenerate: [
      reply([call("sendReply", { customerId: 42, text: "\u0412\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u044C" })]),
      final
    ]
  });
  await runAgent(await agent({ model }), "\u041D\u0430\u0434\u0456\u0448\u043B\u0438");
  await assert.rejects(() => readFile(".data/outbox.jsonl"), { code: "ENOENT" });
  assert.match(JSON.stringify(model.doGenerateCalls[1].prompt), /blocked, ask the user/);
});
