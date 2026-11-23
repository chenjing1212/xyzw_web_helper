import assert from "node:assert/strict";
import { test } from "node:test";
import { bon } from "../src/utils/bonProtocol.js";
import {
  decodeCocosUuid,
  getClaimablePointRewards,
  getDailyTaskConfigBinaryUrl,
  getDailyTaskConfigUrl,
  getDailyTaskStates,
  loadDailyTaskConfig,
  validateDailyTaskConfig,
} from "../src/utils/dailyTaskState.js";

const CONFIG_UUID = "ffrEZCeQdEDaF8CLPFWVY0";
const DECODED_CONFIG_UUID = "ffac4642-7907-440d-a17c-08b3c5595634";

function bundleManifest() {
  return {
    paths: { 5: ["configc", 1] },
    uuids: [null, null, null, null, null, CONFIG_UUID],
    versions: { native: [5, "17431"] },
  };
}

function configFetch(config = officialConfig()) {
  return async (url) => {
    if (url.includes("/config."))
      return { ok: true, json: async () => bundleManifest() };
    const bytes = bon.encode(config);
    return {
      ok: true,
      arrayBuffer: async () =>
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ),
    };
  };
}

function officialConfig() {
  return {
    DailyTaskConf: {
      1: { id: 1, completeCondition: 6, completeValue: 3 },
      8: { id: 8, completeCondition: 13, completeValue: 1 },
      9: { id: 9, completeCondition: 12, completeValue: 1 },
    },
    DayLimitConf: { 1: { id: 1, limit: 20 }, 2: { id: 2, limit: 40 } },
    WeekLimitConf: { 1: { id: 1, limit: 100 }, 2: { id: 2, limit: 200 } },
  };
}
function role(complete = {}) {
  return { dailyTask: { dailyTime: 1700000000, complete } };
}

test("server counters distinguish unfinished, completed-unclaimed and claimed", () => {
  const config = validateDailyTaskConfig(officialConfig());
  const states = getDailyTaskStates(role({ 6: 2, 13: 1, 12: -1 }), config);
  assert.equal(states[0].status, "pending");
  assert.equal(states[0].remaining, 1);
  assert.equal(states[1].status, "claimable");
  assert.equal(states[1].id, 8);
  assert.equal(states[2].status, "claimed");
  assert.equal(states[2].id, 9);
});

test("progress above target requires claiming, not repeating the action", () => {
  const states = getDailyTaskStates(
    role({ 6: 20 }),
    validateDailyTaskConfig(officialConfig()),
  );
  assert.equal(states[0].status, "claimable");
  assert.equal(states[0].remaining, 0);
});

test("an absent counter in a valid server map means zero; null does not", () => {
  const config = validateDailyTaskConfig(officialConfig());
  assert.equal(getDailyTaskStates(role(), config)[0].remaining, 3);
  assert.throws(
    () => getDailyTaskStates(role({ 6: null }), config),
    /进度无效/,
  );
});

test("missing or malformed server task data cannot be treated as completed", () => {
  const config = validateDailyTaskConfig(officialConfig());
  for (const input of [
    {},
    { dailyTask: {} },
    { dailyTask: { dailyTime: 1, complete: [] } },
  ]) {
    assert.throws(() => getDailyTaskStates(input, config), /列表不完整/);
  }
  for (const count of [-2, "3", 1.5])
    assert.throws(
      () => getDailyTaskStates(role({ 6: count }), config),
      /进度无效/,
    );
});

test("official targets are used instead of client hardcoded thresholds", () => {
  const raw = officialConfig();
  raw.DailyTaskConf[1].completeValue = 5;
  assert.equal(
    getDailyTaskStates(role({ 6: 3 }), validateDailyTaskConfig(raw))[0]
      .remaining,
    2,
  );
});

test("invalid or duplicate configuration stops execution", () => {
  const raw = officialConfig();
  raw.DailyTaskConf[8].completeCondition = 6;
  assert.throws(() => validateDailyTaskConfig(raw), /配置无效/);
  assert.throws(() => validateDailyTaskConfig({}), /配置无效/);
});

test("config URL is same-origin and rejects unsafe versions", () => {
  assert.equal(
    getDailyTaskConfigUrl("release-20261123"),
    "/api/game-config/remote/config/config.release-20261123.json",
  );
  for (const version of ["../invalid", "with/slash", "", null]) {
    assert.throws(() => getDailyTaskConfigUrl(version), /有效/);
  }
});

test("Cocos bundle manifest resolves the immutable configc binary", () => {
  assert.equal(decodeCocosUuid(CONFIG_UUID), DECODED_CONFIG_UUID);
  assert.equal(
    getDailyTaskConfigBinaryUrl(bundleManifest()),
    `/api/game-config/remote/config/native/ff/${DECODED_CONFIG_UUID}.17431.bin`,
  );
  assert.throws(
    () => getDailyTaskConfigBinaryUrl({ paths: {}, uuids: [] }),
    /configc/,
  );
});

test("point reward selection uses server points and claimed map for daily and weekly rewards", () => {
  const config = validateDailyTaskConfig(officialConfig());
  const daily = {
    dailyPoint: 40,
    dailyReward: { 1: true },
    weekPoint: 150,
    weekReward: {},
  };
  assert.deepEqual(getClaimablePointRewards(daily, config.dailyRewards), [2]);
  assert.deepEqual(
    getClaimablePointRewards(daily, config.weeklyRewards, true),
    [1],
  );
  assert.throws(
    () => getClaimablePointRewards({ dailyPoint: 40 }, config.dailyRewards),
    /不完整/,
  );
  assert.throws(
    () =>
      getClaimablePointRewards(
        { dailyPoint: 40, dailyReward: { 1: "true" } },
        config.dailyRewards,
      ),
    /不完整/,
  );
});

test("config version is verified each run while immutable configuration requests are merged", async () => {
  let reads = 0;
  let versions = 0;
  const requestedUrls = [];
  const store = {
    async sendMessageWithPromise() {
      versions++;
      return { dataBundleVer: "test-config-merge" };
    },
  };
  const fetchConfig = async (url) => {
    reads++;
    requestedUrls.push(url);
    return configFetch()(url);
  };
  const [a, b] = await Promise.all([
    loadDailyTaskConfig(store, "a", fetchConfig),
    loadDailyTaskConfig(store, "b", fetchConfig),
  ]);
  assert.equal(a, b);
  assert.equal(reads, 2);
  assert.equal(versions, 2);
  assert.deepEqual(requestedUrls, [
    "/api/game-config/remote/config/config.test-config-merge.json",
    `/api/game-config/remote/config/native/ff/${DECODED_CONFIG_UUID}.17431.bin`,
  ]);
});

test("failed config reads can be retried and unsafe versions are rejected", async () => {
  let attempt = 0;
  const store = {
    async sendMessageWithPromise() {
      return { dataBundleVer: "test-config-retry" };
    },
  };
  const successfulFetch = configFetch();
  const fetchConfig = async (url) => {
    attempt++;
    if (attempt === 1) return { ok: false, status: 503 };
    return successfulFetch(url);
  };
  await assert.rejects(
    loadDailyTaskConfig(store, "a", fetchConfig),
    /读取失败/,
  );
  await loadDailyTaskConfig(store, "a", fetchConfig);
  assert.equal(attempt, 3);
  await assert.rejects(
    loadDailyTaskConfig(
      {
        async sendMessageWithPromise() {
          return { dataBundleVer: "../invalid" };
        },
      },
      "a",
      fetchConfig,
    ),
    /有效/,
  );
});

test("config failures identify HTTP, network, JSON, and validation stages", async () => {
  const store = (version) => ({
    sendMessageWithPromise: async () => ({ dataBundleVer: version }),
  });
  await assert.rejects(
    loadDailyTaskConfig(store("stage-http-403"), "a", async () => ({
      ok: false,
      status: 403,
    })),
    /HTTP 403，上游拒绝访问/,
  );
  await assert.rejects(
    loadDailyTaskConfig(store("stage-http-404"), "a", async () => ({
      ok: false,
      status: 404,
    })),
    /HTTP 404，该版本配置不存在/,
  );
  await assert.rejects(
    loadDailyTaskConfig(store("stage-network"), "a", async () => {
      throw new Error("offline");
    }),
    /网络请求失败.*offline/,
  );
  await assert.rejects(
    loadDailyTaskConfig(store("stage-json"), "a", async () => ({
      ok: true,
      json: async () => {
        throw new Error("bad json");
      },
    })),
    /清单解析失败.*bad json/,
  );
  await assert.rejects(
    loadDailyTaskConfig(store("stage-validation"), "a", configFetch({})),
    /配置校验失败.*配置无效/,
  );
  const validFetch = configFetch();
  await assert.rejects(
    loadDailyTaskConfig(store("stage-binary-404"), "a", async (url) =>
      url.includes("/config.") ? validFetch(url) : { ok: false, status: 404 },
    ),
    /二进制读取失败.*HTTP 404/,
  );
});

test("duplicate point-reward IDs are rejected before duplicate claims can be scheduled", () => {
  for (const name of ["DayLimitConf", "WeekLimitConf"]) {
    const config = officialConfig();
    config[name][2].id = config[name][1].id;
    assert.throws(() => validateDailyTaskConfig(config), /无效/);
  }
});

test("an evicted failed config request cannot remove a newer cached request for the same version", async () => {
  let rejectFirst;
  let entered;
  const started = new Promise((resolve) => {
    entered = resolve;
  });
  let readsA = 0;
  const store = {
    sendMessageWithPromise: async (id) => ({ dataBundleVer: id }),
  };
  const successfulFetch = configFetch();
  const fetchConfig = async (url) => {
    if (url.includes("config.cache-race-a") && ++readsA === 1) {
      entered();
      return new Promise((resolve, reject) => {
        rejectFirst = reject;
      });
    }
    return successfulFetch(url);
  };
  const first = loadDailyTaskConfig(store, "cache-race-a", fetchConfig);
  const rejected = assert.rejects(first, /first request failed/);
  await started;
  await loadDailyTaskConfig(store, "cache-race-b", fetchConfig);
  await loadDailyTaskConfig(store, "cache-race-a", fetchConfig);
  rejectFirst(new Error("first request failed"));
  await rejected;
  await loadDailyTaskConfig(store, "cache-race-a", fetchConfig);
  assert.equal(readsA, 2);
});
