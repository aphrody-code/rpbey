var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toESMCache_node;
var __toESMCache_esm;
var __toESM = (mod, isNodeMode, target) => {
  var canCache = mod != null && typeof mod === "object";
  if (canCache) {
    var cache = isNodeMode ? __toESMCache_node ??= new WeakMap : __toESMCache_esm ??= new WeakMap;
    var cached = cache.get(mod);
    if (cached)
      return cached;
  }
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: __accessProp.bind(mod, key),
        enumerable: true
      });
  if (canCache)
    cache.set(mod, to);
  return to;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};

// ../../../../node_modules/rfdc/index.js
var require_rfdc = __commonJS((exports, module) => {
  module.exports = rfdc;
  function copyBuffer(cur) {
    if (cur instanceof Buffer) {
      return Buffer.from(cur);
    }
    return new cur.constructor(cur.buffer.slice(), cur.byteOffset, cur.length);
  }
  function rfdc(opts) {
    opts = opts || {};
    if (opts.circles)
      return rfdcCircles(opts);
    const constructorHandlers = new Map;
    constructorHandlers.set(Date, (o) => new Date(o));
    constructorHandlers.set(Map, (o, fn) => new Map(cloneArray(Array.from(o), fn)));
    constructorHandlers.set(Set, (o, fn) => new Set(cloneArray(Array.from(o), fn)));
    if (opts.constructorHandlers) {
      for (const handler2 of opts.constructorHandlers) {
        constructorHandlers.set(handler2[0], handler2[1]);
      }
    }
    let handler = null;
    return opts.proto ? cloneProto : clone;
    function cloneArray(a, fn) {
      const keys = Object.keys(a);
      const a2 = new Array(keys.length);
      for (let i = 0;i < keys.length; i++) {
        const k = keys[i];
        const cur = a[k];
        if (typeof cur !== "object" || cur === null) {
          a2[k] = cur;
        } else if (cur.constructor !== Object && (handler = constructorHandlers.get(cur.constructor))) {
          a2[k] = handler(cur, fn);
        } else if (ArrayBuffer.isView(cur)) {
          a2[k] = copyBuffer(cur);
        } else {
          a2[k] = fn(cur);
        }
      }
      return a2;
    }
    function clone(o) {
      if (typeof o !== "object" || o === null)
        return o;
      if (Array.isArray(o))
        return cloneArray(o, clone);
      if (o.constructor !== Object && (handler = constructorHandlers.get(o.constructor))) {
        return handler(o, clone);
      }
      const o2 = {};
      for (const k in o) {
        if (Object.hasOwnProperty.call(o, k) === false)
          continue;
        const cur = o[k];
        if (typeof cur !== "object" || cur === null) {
          o2[k] = cur;
        } else if (cur.constructor !== Object && (handler = constructorHandlers.get(cur.constructor))) {
          o2[k] = handler(cur, clone);
        } else if (ArrayBuffer.isView(cur)) {
          o2[k] = copyBuffer(cur);
        } else {
          o2[k] = clone(cur);
        }
      }
      return o2;
    }
    function cloneProto(o) {
      if (typeof o !== "object" || o === null)
        return o;
      if (Array.isArray(o))
        return cloneArray(o, cloneProto);
      if (o.constructor !== Object && (handler = constructorHandlers.get(o.constructor))) {
        return handler(o, cloneProto);
      }
      const o2 = {};
      for (const k in o) {
        const cur = o[k];
        if (typeof cur !== "object" || cur === null) {
          o2[k] = cur;
        } else if (cur.constructor !== Object && (handler = constructorHandlers.get(cur.constructor))) {
          o2[k] = handler(cur, cloneProto);
        } else if (ArrayBuffer.isView(cur)) {
          o2[k] = copyBuffer(cur);
        } else {
          o2[k] = cloneProto(cur);
        }
      }
      return o2;
    }
  }
  function rfdcCircles(opts) {
    const refs = [];
    const refsNew = [];
    const constructorHandlers = new Map;
    constructorHandlers.set(Date, (o) => new Date(o));
    constructorHandlers.set(Map, (o, fn) => new Map(cloneArray(Array.from(o), fn)));
    constructorHandlers.set(Set, (o, fn) => new Set(cloneArray(Array.from(o), fn)));
    if (opts.constructorHandlers) {
      for (const handler2 of opts.constructorHandlers) {
        constructorHandlers.set(handler2[0], handler2[1]);
      }
    }
    let handler = null;
    return opts.proto ? cloneProto : clone;
    function cloneArray(a, fn) {
      const keys = Object.keys(a);
      const a2 = new Array(keys.length);
      for (let i = 0;i < keys.length; i++) {
        const k = keys[i];
        const cur = a[k];
        if (typeof cur !== "object" || cur === null) {
          a2[k] = cur;
        } else if (cur.constructor !== Object && (handler = constructorHandlers.get(cur.constructor))) {
          a2[k] = handler(cur, fn);
        } else if (ArrayBuffer.isView(cur)) {
          a2[k] = copyBuffer(cur);
        } else {
          const index = refs.indexOf(cur);
          if (index !== -1) {
            a2[k] = refsNew[index];
          } else {
            a2[k] = fn(cur);
          }
        }
      }
      return a2;
    }
    function clone(o) {
      if (typeof o !== "object" || o === null)
        return o;
      if (Array.isArray(o))
        return cloneArray(o, clone);
      if (o.constructor !== Object && (handler = constructorHandlers.get(o.constructor))) {
        return handler(o, clone);
      }
      const o2 = {};
      refs.push(o);
      refsNew.push(o2);
      for (const k in o) {
        if (Object.hasOwnProperty.call(o, k) === false)
          continue;
        const cur = o[k];
        if (typeof cur !== "object" || cur === null) {
          o2[k] = cur;
        } else if (cur.constructor !== Object && (handler = constructorHandlers.get(cur.constructor))) {
          o2[k] = handler(cur, clone);
        } else if (ArrayBuffer.isView(cur)) {
          o2[k] = copyBuffer(cur);
        } else {
          const i = refs.indexOf(cur);
          if (i !== -1) {
            o2[k] = refsNew[i];
          } else {
            o2[k] = clone(cur);
          }
        }
      }
      refs.pop();
      refsNew.pop();
      return o2;
    }
    function cloneProto(o) {
      if (typeof o !== "object" || o === null)
        return o;
      if (Array.isArray(o))
        return cloneArray(o, cloneProto);
      if (o.constructor !== Object && (handler = constructorHandlers.get(o.constructor))) {
        return handler(o, cloneProto);
      }
      const o2 = {};
      refs.push(o);
      refsNew.push(o2);
      for (const k in o) {
        const cur = o[k];
        if (typeof cur !== "object" || cur === null) {
          o2[k] = cur;
        } else if (cur.constructor !== Object && (handler = constructorHandlers.get(cur.constructor))) {
          o2[k] = handler(cur, cloneProto);
        } else if (ArrayBuffer.isView(cur)) {
          o2[k] = copyBuffer(cur);
        } else {
          const i = refs.indexOf(cur);
          if (i !== -1) {
            o2[k] = refsNew[i];
          } else {
            o2[k] = cloneProto(cur);
          }
        }
      }
      refs.pop();
      refsNew.pop();
      return o2;
    }
  }
});

// ../../../../node_modules/brackets-memory-db/dist/index.js
var require_dist = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.InMemoryDatabase = undefined;
  var rfdc = require_rfdc();
  var clone = rfdc();

  class InMemoryDatabase {
    data = {
      participant: [],
      stage: [],
      group: [],
      round: [],
      match: [],
      match_game: []
    };
    setData(data) {
      this.data = data;
    }
    makeFilter(partial) {
      return (entry) => {
        let result = true;
        for (const key of Object.keys(partial))
          result = result && entry[key] === partial[key];
        return result;
      };
    }
    reset() {
      this.data = {
        participant: [],
        stage: [],
        group: [],
        round: [],
        match: [],
        match_game: []
      };
    }
    insert(table, values) {
      let id = this.data[table].length > 0 ? Math.max(...this.data[table].map((d) => d.id)) + 1 : 0;
      if (!Array.isArray(values)) {
        try {
          this.data[table].push({ id, ...values });
        } catch (error) {
          return new Promise((resolve) => {
            resolve(-1);
          });
        }
        return new Promise((resolve) => {
          resolve(id);
        });
      }
      try {
        values.map((object) => {
          this.data[table].push({ id: id++, ...object });
        });
      } catch (error) {
        return new Promise((resolve) => {
          resolve(false);
        });
      }
      return new Promise((resolve) => {
        resolve(true);
      });
    }
    select(table, arg) {
      try {
        if (arg === undefined) {
          return new Promise((resolve) => {
            resolve(this.data[table].map(clone));
          });
        }
        if (typeof arg === "number") {
          return new Promise((resolve) => {
            resolve(clone(this.data[table].find((d) => d.id === arg)));
          });
        }
        return new Promise((resolve) => {
          resolve(this.data[table].filter(this.makeFilter(arg)).map(clone));
        });
      } catch (error) {
        return new Promise((resolve) => {
          resolve(null);
        });
      }
    }
    update(table, arg, value) {
      if (typeof arg === "number") {
        try {
          const index = this.getEntityIndexById(table, arg);
          this.setEntityByIndex(table, index, value);
          return new Promise((resolve) => {
            resolve(true);
          });
        } catch (error) {
          return new Promise((resolve) => {
            resolve(false);
          });
        }
      }
      const values = this.data[table].filter(this.makeFilter(arg));
      if (!values) {
        return new Promise((resolve) => {
          resolve(false);
        });
      }
      values.forEach((v) => {
        const index = this.getEntityIndexById(table, v.id);
        const existing = this.data[table][index];
        for (const key in value) {
          if (existing[key] && typeof existing[key] === "object" && typeof value[key] === "object") {
            Object.assign(existing[key], value[key]);
          } else {
            existing[key] = value[key];
          }
        }
        this.setEntityByIndex(table, index, existing);
      });
      return new Promise((resolve) => {
        resolve(true);
      });
    }
    delete(table, filter) {
      const values = this.data[table];
      if (!values) {
        return new Promise((resolve) => {
          resolve(false);
        });
      }
      if (!filter) {
        this.data[table] = [];
        return new Promise((resolve) => {
          resolve(true);
        });
      }
      const predicate = this.makeFilter(filter);
      const negativeFilter = (value) => !predicate(value);
      this.data[table] = values.filter(negativeFilter);
      return new Promise((resolve) => {
        resolve(true);
      });
    }
    getEntityIndexById(table, id) {
      const index = this.data[table].findIndex((e) => e.id === id);
      if (index === -1) {
        throw new Error(`Entity in ${table} with id ${id} not found.`);
      }
      return index;
    }
    setEntityByIndex(table, index, value) {
      this.data[table][index] = value;
    }
  }
  exports.InMemoryDatabase = InMemoryDatabase;
});

// src/brackets-viewer/index.ts
var import_brackets_memory_db = __toESM(require_dist(), 1);
// src/brackets-manager/ordering.ts
var ordering = {
  natural: (array) => [...array],
  reverse: (array) => [...array].reverse(),
  half_shift: (array) => [...array.slice(array.length / 2), ...array.slice(0, array.length / 2)],
  reverse_half_shift: (array) => [...array.slice(0, array.length / 2).reverse(), ...array.slice(array.length / 2).reverse()],
  pair_flip: (array) => {
    const result = [];
    for (let i = 0;i < array.length; i += 2)
      result.push(array[i + 1], array[i]);
    return result;
  },
  inner_outer: (array) => {
    if (array.length === 2)
      return array;
    const participantCount = array.length;
    let positions = [1, 2];
    while (positions.length < participantCount) {
      const size = positions.length * 2;
      const next = [];
      for (const pos of positions)
        next.push(pos, size + 1 - pos);
      positions = next;
    }
    const result = [];
    for (const pos of positions)
      result.push(array[pos - 1]);
    return result;
  },
  "groups.effort_balanced": (array, groupCount) => {
    const result = [];
    let i = 0, j = 0;
    while (result.length < array.length) {
      result.push(array[i]);
      i += groupCount;
      if (i >= array.length)
        i = ++j;
    }
    return result;
  },
  "groups.seed_optimized": (array, groupCount) => {
    const groups = Array.from({ length: groupCount }, (_) => []);
    for (let run = 0;run < array.length / groupCount; run++) {
      if (run % 2 === 0) {
        for (let group = 0;group < groupCount; group++)
          groups[group].push(array[run * groupCount + group]);
      } else {
        for (let group = 0;group < groupCount; group++)
          groups[groupCount - group - 1].push(array[run * groupCount + group]);
      }
    }
    return groups.flat();
  },
  "groups.bracket_optimized": (array, groupCount) => {
    if (groupCount < 2)
      return [...array];
    if (groupCount % 2 === 1)
      return ordering["groups.seed_optimized"](array, groupCount);
    const participantCount = array.length;
    const halfGroupCount = groupCount / 2;
    let positions = [1, 2];
    while (positions.length < participantCount) {
      const size = positions.length * 2;
      const next = [];
      for (const pos of positions)
        next.push(pos, size + 1 - pos);
      positions = next;
    }
    const baseGroupForPair = (i) => {
      const t = i % halfGroupCount;
      const r = Math.floor(i / halfGroupCount);
      const inverted = Math.floor(r / 2) % 2 === 1;
      if (r % 2 === 0) {
        return inverted ? halfGroupCount - 1 - t : t;
      }
      return inverted ? halfGroupCount + t : groupCount - 1 - t;
    };
    const groups = Array.from({ length: groupCount }, () => []);
    const pairCount = Math.floor(positions.length / 2);
    for (let i = 0;i < pairCount; i++) {
      const base = baseGroupForPair(i);
      const aIndex = positions[2 * i] - 1;
      groups[base].push(array[aIndex]);
    }
    for (let i = 0;i < pairCount; i++) {
      const base = baseGroupForPair(i);
      const bIndex = positions[2 * i + 1] - 1;
      groups[(base + halfGroupCount) % groupCount].push(array[bIndex]);
    }
    const indexByItem = new Map(array.map((v, i) => [v, i]));
    for (const g of groups)
      g.sort((a, b) => indexByItem.get(a) - indexByItem.get(b));
    return groups.flat();
  }
};
var defaultMinorOrdering = {
  4: ["natural", "reverse"],
  8: ["natural", "reverse", "natural"],
  16: ["natural", "reverse_half_shift", "reverse", "natural"],
  32: ["natural", "reverse", "half_shift", "natural", "natural"],
  64: ["natural", "reverse", "half_shift", "reverse", "natural", "natural"],
  128: ["natural", "reverse", "half_shift", "pair_flip", "pair_flip", "pair_flip", "natural"]
};

// src/brackets-manager/helpers.ts
var exports_helpers = {};
__export(exports_helpers, {
  uniqueBy: () => uniqueBy,
  transitionToMinor: () => transitionToMinor,
  transitionToMajor: () => transitionToMajor,
  toResultWithPosition: () => toResultWithPosition,
  toResult: () => toResult,
  splitByParity: () => splitByParity,
  splitBy: () => splitBy,
  sortSeeding: () => sortSeeding,
  setScores: () => setScores,
  setResults: () => setResults,
  setParentMatchCompleted: () => setParentMatchCompleted,
  setNextOpponent: () => setNextOpponent,
  setMatchResults: () => setMatchResults,
  setForfeits: () => setForfeits,
  setExtraFields: () => setExtraFields,
  setCompleted: () => setCompleted,
  setArraySize: () => setArraySize,
  resetNextOpponent: () => resetNextOpponent,
  resetMatchResults: () => resetMatchResults,
  normalizeParticipant: () => normalizeParticipant,
  normalizeIds: () => normalizeIds,
  minScoreToWinBestOfX: () => minScoreToWinBestOfX,
  mapParticipantsToDatabase: () => mapParticipantsToDatabase,
  mapParticipantsNamesToDatabase: () => mapParticipantsNamesToDatabase,
  mapParticipantsIdsToDatabase: () => mapParticipantsIdsToDatabase,
  makeRoundRobinMatches: () => makeRoundRobinMatches,
  makeRoundRobinDistribution: () => makeRoundRobinDistribution,
  makePairs: () => makePairs,
  makeNormalizedIdMapping: () => makeNormalizedIdMapping,
  makeGroups: () => makeGroups,
  makeFinalStandings: () => makeFinalStandings,
  isWinnerBracket: () => isWinnerBracket,
  isSeedingWithIds: () => isSeedingWithIds,
  isRoundRobin: () => isRoundRobin,
  isRoundCompleted: () => isRoundCompleted,
  isPowerOfTwo: () => isPowerOfTwo,
  isParticipantInMatch: () => isParticipantInMatch,
  isOrderingSupportedUpperBracket: () => isOrderingSupportedUpperBracket,
  isOrderingSupportedLoserBracket: () => isOrderingSupportedLoserBracket,
  isMinorRound: () => isMinorRound,
  isMatchWinCompleted: () => isMatchWinCompleted,
  isMatchUpdateLocked: () => isMatchUpdateLocked,
  isMatchStarted: () => isMatchStarted,
  isMatchStale: () => isMatchStale,
  isMatchResultCompleted: () => isMatchResultCompleted,
  isMatchPending: () => isMatchPending,
  isMatchParticipantLocked: () => isMatchParticipantLocked,
  isMatchOngoing: () => isMatchOngoing,
  isMatchForfeitCompleted: () => isMatchForfeitCompleted,
  isMatchDrawCompleted: () => isMatchDrawCompleted,
  isMatchCompleted: () => isMatchCompleted,
  isMatchByeCompleted: () => isMatchByeCompleted,
  isMajorRound: () => isMajorRound,
  isLoserBracket: () => isLoserBracket,
  isFinalGroup: () => isFinalGroup,
  isDoubleEliminationNecessary: () => isDoubleEliminationNecessary,
  isDefined: () => isDefined,
  invertOpponents: () => invertOpponents,
  hasBye: () => hasBye,
  handleOpponentsInversion: () => handleOpponentsInversion,
  handleGivenStatus: () => handleGivenStatus,
  getWinner: () => getWinner,
  getUpperBracketRoundCount: () => getUpperBracketRoundCount,
  getUpdatedMatchResults: () => getUpdatedMatchResults,
  getSide: () => getSide,
  getSeeds: () => getSeeds,
  getSeedCount: () => getSeedCount,
  getRoundPairCount: () => getRoundPairCount,
  getRanking: () => getRanking,
  getParentMatchResults: () => getParentMatchResults,
  getOtherSide: () => getOtherSide,
  getOriginPosition: () => getOriginPosition,
  getOpponentId: () => getOpponentId,
  getNonNull: () => getNonNull,
  getNextSideLoserBracket: () => getNextSideLoserBracket,
  getNextSideConsolationFinalDoubleElimination: () => getNextSideConsolationFinalDoubleElimination,
  getNextSide: () => getNextSide,
  getNearestPowerOfTwo: () => getNearestPowerOfTwo,
  getMatchStatus: () => getMatchStatus,
  getMatchResult: () => getMatchResult,
  getMatchLocation: () => getMatchLocation,
  getLowerBracketRoundCount: () => getLowerBracketRoundCount,
  getLosers: () => getLosers,
  getLoserRoundMatchCount: () => getLoserRoundMatchCount,
  getLoserOrdering: () => getLoserOrdering,
  getLoserCountFromWbForLbRound: () => getLoserCountFromWbForLbRound,
  getLoser: () => getLoser,
  getInferredResult: () => getInferredResult,
  getGrandFinalDecisiveMatch: () => getGrandFinalDecisiveMatch,
  getFractionOfFinal: () => getFractionOfFinal,
  getDiagonalMatchNumber: () => getDiagonalMatchNumber,
  getChildGamesResults: () => getChildGamesResults,
  fixSeeding: () => fixSeeding,
  findPosition: () => findPosition,
  findParticipant: () => findParticipant,
  findLoserMatchNumber: () => findLoserMatchNumber,
  extractParticipantsFromSeeding: () => extractParticipantsFromSeeding,
  ensureValidSize: () => ensureValidSize,
  ensureOrderingSupported: () => ensureOrderingSupported,
  ensureNotTied: () => ensureNotTied,
  ensureNotRoundRobin: () => ensureNotRoundRobin,
  ensureNoDuplicates: () => ensureNoDuplicates,
  ensureEvenSized: () => ensureEvenSized,
  ensureEquallySized: () => ensureEquallySized,
  convertTBDtoBYE: () => convertTBDtoBYE,
  convertSlotsToSeeding: () => convertSlotsToSeeding,
  convertMatchesToSeeding: () => convertMatchesToSeeding,
  byeWinnerToGrandFinal: () => byeWinnerToGrandFinal,
  byeWinner: () => byeWinner,
  byeLoser: () => byeLoser,
  balanceByes: () => balanceByes,
  assertRoundRobin: () => assertRoundRobin
});
function isDefined(value) {
  return value !== null && value !== undefined;
}
function splitBy(objects, key) {
  const map = {};
  for (const obj of objects) {
    const commonValue = obj[key];
    if (!map[commonValue])
      map[commonValue] = [];
    map[commonValue].push(obj);
  }
  return Object.values(map);
}
function splitByParity(array) {
  return {
    even: array.filter((_, i) => i % 2 === 0),
    odd: array.filter((_, i) => i % 2 === 1)
  };
}
function makeRoundRobinMatches(participants, mode = "simple") {
  const distribution = makeRoundRobinDistribution(participants);
  if (mode === "simple")
    return distribution;
  const symmetry = distribution.map((round) => [...round].reverse()).reverse();
  return [...distribution, ...symmetry];
}
function makeRoundRobinDistribution(participants) {
  const n = participants.length;
  const n1 = n % 2 === 0 ? n : n + 1;
  const roundCount = n1 - 1;
  const matchPerRound = n1 / 2;
  const rounds = [];
  for (let roundId = 0;roundId < roundCount; roundId++) {
    const matches = [];
    for (let matchId = 0;matchId < matchPerRound; matchId++) {
      if (matchId === 0 && n % 2 === 1)
        continue;
      const opponentsIds = [
        (roundId - matchId - 1 + n1) % (n1 - 1),
        matchId === 0 ? n1 - 1 : (roundId + matchId) % (n1 - 1)
      ];
      matches.push([
        participants[opponentsIds[0]],
        participants[opponentsIds[1]]
      ]);
    }
    rounds.push(matches);
  }
  return rounds;
}
function assertRoundRobin(input2, output) {
  const n = input2.length;
  const matchPerRound = Math.floor(n / 2);
  const roundCount = n % 2 === 0 ? n - 1 : n;
  if (output.length !== roundCount)
    throw Error("Round count is wrong");
  if (!output.every((round) => round.length === matchPerRound))
    throw Error("Not every round has the good number of matches");
  const checkAllOpponents = Object.fromEntries(input2.map((element) => [element, new Set]));
  for (const round of output) {
    const checkUnique = new Set;
    for (const match of round) {
      if (match.length !== 2)
        throw Error("One match is not a pair");
      if (checkUnique.has(match[0]))
        throw Error("This team is already playing");
      checkUnique.add(match[0]);
      if (checkUnique.has(match[1]))
        throw Error("This team is already playing");
      checkUnique.add(match[1]);
      if (checkAllOpponents[match[0]].has(match[1]))
        throw Error("The team has already matched this team");
      checkAllOpponents[match[0]].add(match[1]);
      if (checkAllOpponents[match[1]].has(match[0]))
        throw Error("The team has already matched this team");
      checkAllOpponents[match[1]].add(match[0]);
    }
  }
}
function makeGroups(elements, groupCount) {
  const groupSize = Math.ceil(elements.length / groupCount);
  const result = [];
  for (let i = 0;i < elements.length; i++) {
    if (i % groupSize === 0)
      result.push([]);
    result[result.length - 1].push(elements[i]);
  }
  return result;
}
function balanceByes(seeding, participantCount) {
  seeding = seeding.filter((v) => v !== null);
  participantCount = participantCount || getNearestPowerOfTwo(seeding.length);
  if (seeding.length < participantCount / 2) {
    const flat2 = seeding.flatMap((v) => [v, null]);
    return setArraySize(flat2, participantCount, null);
  }
  const nonNullCount = seeding.length;
  const nullCount = participantCount - nonNullCount;
  const againstEachOther = seeding.slice(0, nonNullCount - nullCount).filter((_, i) => i % 2 === 0).map((_, i) => [seeding[2 * i], seeding[2 * i + 1]]);
  const againstNull = seeding.slice(nonNullCount - nullCount, nonNullCount).map((v) => [v, null]);
  const flat = [...againstEachOther.flat(), ...againstNull.flat()];
  return setArraySize(flat, participantCount, null);
}
function normalizeIds(data) {
  const mappings = {
    participant: makeNormalizedIdMapping(data.participant),
    stage: makeNormalizedIdMapping(data.stage),
    group: makeNormalizedIdMapping(data.group),
    round: makeNormalizedIdMapping(data.round),
    match: makeNormalizedIdMapping(data.match),
    match_game: makeNormalizedIdMapping(data.match_game)
  };
  return {
    participant: data.participant.map((value) => ({
      ...value,
      id: mappings.participant[value.id]
    })),
    stage: data.stage.map((value) => ({
      ...value,
      id: mappings.stage[value.id]
    })),
    group: data.group.map((value) => ({
      ...value,
      id: mappings.group[value.id],
      stage_id: mappings.stage[value.stage_id]
    })),
    round: data.round.map((value) => ({
      ...value,
      id: mappings.round[value.id],
      stage_id: mappings.stage[value.stage_id],
      group_id: mappings.group[value.group_id]
    })),
    match: data.match.map((value) => ({
      ...value,
      id: mappings.match[value.id],
      stage_id: mappings.stage[value.stage_id],
      group_id: mappings.group[value.group_id],
      round_id: mappings.round[value.round_id],
      opponent1: normalizeParticipant(value.opponent1, mappings.participant),
      opponent2: normalizeParticipant(value.opponent2, mappings.participant)
    })),
    match_game: data.match_game.map((value) => ({
      ...value,
      id: mappings.match_game[value.id],
      stage_id: mappings.stage[value.stage_id],
      parent_id: mappings.match[value.parent_id],
      opponent1: normalizeParticipant(value.opponent1, mappings.participant),
      opponent2: normalizeParticipant(value.opponent2, mappings.participant)
    }))
  };
}
function makeNormalizedIdMapping(elements) {
  let currentId = 0;
  return elements.reduce((acc, current) => ({
    ...acc,
    [current.id]: currentId++
  }), {});
}
function normalizeParticipant(participant, mapping) {
  if (participant === null)
    return null;
  return {
    ...participant,
    id: participant.id !== null ? mapping[participant.id] : null
  };
}
function setArraySize(array, length, placeholder) {
  return Array.from({ length }, (_, i) => array[i] ?? placeholder);
}
function makePairs(array) {
  return array.map((_, i) => i % 2 === 0 ? [array[i], array[i + 1]] : []).filter((v) => v.length === 2);
}
function ensureEvenSized(array) {
  if (array.length % 2 === 1)
    throw Error("Array size must be even.");
}
function ensureNoDuplicates(array) {
  const nonNull = getNonNull(array);
  const unique = nonNull.filter((item, index) => {
    const stringifiedItem = JSON.stringify(item);
    return nonNull.findIndex((obj) => JSON.stringify(obj) === stringifiedItem) === index;
  });
  if (unique.length < nonNull.length)
    throw new Error("The seeding has a duplicate participant.");
}
function ensureEquallySized(left, right) {
  if (left.length !== right.length)
    throw Error("Arrays' size must be equal.");
}
function fixSeeding(seeding, participantCount) {
  if (seeding.length > participantCount)
    throw Error("The seeding has more participants than the size of the stage.");
  if (seeding.length < participantCount)
    return setArraySize(seeding, participantCount, null);
  return seeding;
}
function isPowerOfTwo(number) {
  return Number.isInteger(Math.log2(number));
}
function ensureValidSize(stageType, participantCount) {
  if (participantCount === 0)
    throw Error("Impossible to create an empty stage. If you want an empty seeding, just set the size of the stage.");
  if (participantCount < 2)
    throw Error("Impossible to create a stage with less than 2 participants.");
  if (stageType === "round_robin") {
    return;
  }
  if (!isPowerOfTwo(participantCount))
    throw Error("The library only supports a participant count which is a power of two.");
}
function ensureNotTied(scores) {
  if (scores[0] === scores[1])
    throw Error(`${scores[0]} and ${scores[1]} are tied. It cannot be.`);
}
function convertTBDtoBYE(slot) {
  if (slot === null)
    return null;
  if (slot?.id === null)
    return null;
  return slot;
}
function toResult(slot) {
  return slot && {
    id: slot.id
  };
}
function toResultWithPosition(slot) {
  return slot && {
    id: slot.id,
    position: slot.position
  };
}
function getWinner(match) {
  const winnerSide = getMatchResult(match);
  if (!winnerSide)
    return null;
  return match[winnerSide];
}
function getLoser(match) {
  const winnerSide = getMatchResult(match);
  if (!winnerSide)
    return null;
  return match[getOtherSide(winnerSide)];
}
function byeWinner(opponents) {
  if (opponents[0] === null && opponents[1] === null)
    return null;
  if (opponents[0] === null && opponents[1] !== null)
    return { id: opponents[1].id };
  if (opponents[0] !== null && opponents[1] === null)
    return { id: opponents[0].id };
  return { id: null };
}
function byeWinnerToGrandFinal(opponents) {
  const winner = byeWinner(opponents);
  if (winner)
    winner.position = 1;
  return winner;
}
function byeLoser(opponents, index) {
  if (opponents[0] === null || opponents[1] === null)
    return null;
  return { id: null, position: index + 1 };
}
function getMatchResult(match) {
  if (!isMatchCompleted(match))
    return null;
  if (isMatchDrawCompleted(match))
    return null;
  if (match.opponent1 === null && match.opponent2 === null)
    return null;
  let winner = null;
  if (match.opponent1?.result === "win" || match.opponent2 === null || match.opponent2.forfeit)
    winner = "opponent1";
  if (match.opponent2?.result === "win" || match.opponent1 === null || match.opponent1.forfeit) {
    if (winner !== null)
      throw Error("There are two winners.");
    winner = "opponent2";
  }
  return winner;
}
function findPosition(matches, position) {
  for (const match of matches) {
    if (match.opponent1?.position === position)
      return match.opponent1;
    if (match.opponent2?.position === position)
      return match.opponent2;
  }
  return null;
}
function isParticipantInMatch(match, participantId) {
  return [match.opponent1, match.opponent2].some((m) => m?.id === participantId);
}
function getSide(matchNumber) {
  return matchNumber % 2 === 1 ? "opponent1" : "opponent2";
}
function getOtherSide(side) {
  return side === "opponent1" ? "opponent2" : "opponent1";
}
function isMatchPending(match) {
  return !match.opponent1?.id || !match.opponent2?.id;
}
function isMatchStarted(match) {
  return match.opponent1?.score !== undefined || match.opponent2?.score !== undefined;
}
function isMatchCompleted(match) {
  return isMatchByeCompleted(match) || isMatchForfeitCompleted(match) || isMatchResultCompleted(match);
}
function isMatchOngoing(match) {
  return [2 /* Ready */, 3 /* Running */].includes(match.status);
}
function isMatchStale(match) {
  return match.status >= 4 /* Completed */ || isMatchByeCompleted(match);
}
function isMatchForfeitCompleted(match) {
  return match.opponent1?.forfeit !== undefined || match.opponent2?.forfeit !== undefined;
}
function isMatchResultCompleted(match) {
  return isMatchDrawCompleted(match) || isMatchWinCompleted(match);
}
function isMatchDrawCompleted(match) {
  return match.opponent1?.result === "draw" && match.opponent2?.result === "draw";
}
function isMatchWinCompleted(match) {
  return match.opponent1?.result === "win" || match.opponent2?.result === "win" || match.opponent1?.result === "loss" || match.opponent2?.result === "loss";
}
function isMatchByeCompleted(match) {
  return match.opponent1 === null && match.opponent2?.id !== null || match.opponent2 === null && match.opponent1?.id !== null || match.opponent1 === null && match.opponent2 === null;
}
function isMatchUpdateLocked(match) {
  return match.status === 0 /* Locked */ || match.status === 1 /* Waiting */ || match.status === 5 /* Archived */ || isMatchByeCompleted(match);
}
function isMatchParticipantLocked(match) {
  return match.status >= 3 /* Running */;
}
function hasBye(match) {
  return match.opponent1 === null || match.opponent2 === null;
}
function getMatchStatus(arg) {
  const match = Array.isArray(arg) ? {
    opponent1: arg[0],
    opponent2: arg[1]
  } : arg;
  if (hasBye(match))
    return 0 /* Locked */;
  if (match.opponent1?.id === null && match.opponent2?.id === null)
    return 0 /* Locked */;
  if (match.opponent1?.id === null || match.opponent2?.id === null)
    return 1 /* Waiting */;
  if (isMatchCompleted(match))
    return 4 /* Completed */;
  if (isMatchStarted(match))
    return 3 /* Running */;
  return 2 /* Ready */;
}
function setMatchResults(stored, match, inRoundRobin) {
  handleGivenStatus(stored, match);
  if (!inRoundRobin && (match.opponent1?.result === "draw" || match.opponent2?.result === "draw"))
    throw Error("Having a draw is forbidden in an elimination tournament.");
  const completed = isMatchCompleted(match);
  const currentlyCompleted = isMatchCompleted(stored);
  setExtraFields(stored, match);
  handleOpponentsInversion(stored, match);
  const statusChanged = setScores(stored, match);
  if (completed && currentlyCompleted) {
    setCompleted(stored, match, inRoundRobin);
    return { statusChanged: false, resultChanged: true };
  }
  if (completed && !currentlyCompleted) {
    setCompleted(stored, match, inRoundRobin);
    return { statusChanged: true, resultChanged: true };
  }
  if (!completed && currentlyCompleted) {
    resetMatchResults(stored);
    return { statusChanged: true, resultChanged: true };
  }
  return { statusChanged, resultChanged: false };
}
function resetMatchResults(stored) {
  if (stored.opponent1) {
    stored.opponent1.forfeit = undefined;
    stored.opponent1.result = undefined;
  }
  if (stored.opponent2) {
    stored.opponent2.forfeit = undefined;
    stored.opponent2.result = undefined;
  }
  stored.status = getMatchStatus(stored);
}
function setExtraFields(stored, match) {
  const partialAssign = (target, update, ignoredKeys2) => {
    if (!target || !update)
      return;
    const retainedKeys = Object.keys(update).filter((key) => !ignoredKeys2.includes(key));
    retainedKeys.forEach((key) => {
      target[key] = update[key];
    });
  };
  const ignoredKeys = [
    "id",
    "number",
    "stage_id",
    "group_id",
    "round_id",
    "status",
    "opponent1",
    "opponent2",
    "child_count",
    "parent_id"
  ];
  const ignoredOpponentKeys = [
    "id",
    "score",
    "position",
    "forfeit",
    "result"
  ];
  partialAssign(stored, match, ignoredKeys);
  partialAssign(stored.opponent1, match.opponent1, ignoredOpponentKeys);
  partialAssign(stored.opponent2, match.opponent2, ignoredOpponentKeys);
}
function getOpponentId(match, side) {
  const opponent = match[side];
  return opponent && opponent.id;
}
function getOriginPosition(match, side) {
  const matchNumber = match[side]?.position;
  if (matchNumber === undefined)
    throw Error("Position is undefined.");
  return matchNumber;
}
function getLosers(participants, matches) {
  const losers = [];
  let currentRound = null;
  let roundIndex = -1;
  for (const match of matches) {
    if (match.round_id !== currentRound) {
      currentRound = match.round_id;
      roundIndex++;
      losers[roundIndex] = [];
    }
    const loser = getLoser(match);
    if (loser === null)
      continue;
    losers[roundIndex].push(findParticipant(participants, loser));
  }
  return losers;
}
function makeFinalStandings(grouped) {
  const standings = [];
  let rank = 1;
  for (const group of grouped) {
    for (const participant of group) {
      standings.push({
        id: participant.id,
        name: participant.name,
        rank
      });
    }
    rank++;
  }
  return standings;
}
function getGrandFinalDecisiveMatch(type, matches) {
  if (type === "simple")
    return matches[0];
  if (type === "double") {
    const result = getMatchResult(matches[0]);
    if (result === "opponent2")
      return matches[1];
    return matches[0];
  }
  throw Error("The Grand Final is disabled.");
}
function findParticipant(participants, slot) {
  if (!slot)
    throw Error("Cannot find a BYE participant.");
  const participant = participants.find((participant2) => participant2.id === slot?.id);
  if (!participant)
    throw Error("Participant not found.");
  return participant;
}
function getNextSide(matchNumber, roundNumber, roundCount, matchLocation) {
  if (matchLocation === "loser_bracket" && roundNumber % 2 === 1)
    return "opponent2";
  if (matchLocation === "loser_bracket" && roundNumber === roundCount)
    return "opponent2";
  return getSide(matchNumber);
}
function getNextSideLoserBracket(matchNumber, nextMatch, roundNumber) {
  if (roundNumber > 1)
    return "opponent1";
  if (nextMatch.opponent1?.position === matchNumber)
    return "opponent1";
  return "opponent2";
}
function getNextSideConsolationFinalDoubleElimination(roundNumber) {
  return isMajorRound(roundNumber) ? "opponent1" : "opponent2";
}
function setNextOpponent(nextMatch, nextSide, match, currentSide) {
  nextMatch[nextSide] = match[currentSide] && {
    id: getOpponentId(match, currentSide),
    position: nextMatch[nextSide]?.position
  };
  nextMatch.status = getMatchStatus(nextMatch);
}
function resetNextOpponent(nextMatch, nextSide) {
  nextMatch[nextSide] = nextMatch[nextSide] && {
    id: null,
    position: nextMatch[nextSide]?.position
  };
  nextMatch.status = 0 /* Locked */;
}
function handleOpponentsInversion(stored, match) {
  const id1 = match.opponent1?.id;
  const id2 = match.opponent2?.id;
  const storedId1 = stored.opponent1?.id;
  const storedId2 = stored.opponent2?.id;
  if (isDefined(id1) && id1 !== storedId1 && id1 !== storedId2)
    throw Error("The given opponent1 ID does not exist in this match.");
  if (isDefined(id2) && id2 !== storedId1 && id2 !== storedId2)
    throw Error("The given opponent2 ID does not exist in this match.");
  if (isDefined(id1) && id1 === storedId2 || isDefined(id2) && id2 === storedId1)
    invertOpponents(match);
}
function handleGivenStatus(stored, match) {
  if (match.status === 3 /* Running */) {
    delete stored.opponent1?.result;
    delete stored.opponent2?.result;
    stored.status = 3 /* Running */;
  } else if (match.status === 4 /* Completed */) {
    if (match.opponent1?.score === undefined || match.opponent2?.score === undefined)
      return;
    if (match.opponent1.score > match.opponent2.score)
      match.opponent1.result = "win";
    else if (match.opponent2.score > match.opponent1.score)
      match.opponent2.result = "win";
    else {
      match.opponent1.result = "draw";
      match.opponent2.result = "draw";
    }
    stored.status = 4 /* Completed */;
  }
}
function invertOpponents(match) {
  [match.opponent1, match.opponent2] = [match.opponent2, match.opponent1];
}
function setScores(stored, match) {
  if (match.opponent1?.score === stored.opponent1?.score && match.opponent2?.score === stored.opponent2?.score)
    return false;
  const oldStatus = stored.status;
  stored.status = 3 /* Running */;
  if (match.opponent1 && stored.opponent1)
    stored.opponent1.score = match.opponent1.score;
  if (match.opponent2 && stored.opponent2)
    stored.opponent2.score = match.opponent2.score;
  return stored.status !== oldStatus;
}
function getInferredResult(opponent1, opponent2) {
  if (opponent1 && !opponent2)
    return { opponent1: { ...opponent1, result: "win" }, opponent2: null };
  if (!opponent1 && opponent2)
    return { opponent1: null, opponent2: { ...opponent2, result: "win" } };
  return { opponent1, opponent2 };
}
function setCompleted(stored, match, inRoundRobin) {
  stored.status = 4 /* Completed */;
  setResults(stored, match, "win", "loss", inRoundRobin);
  setResults(stored, match, "loss", "win", inRoundRobin);
  setResults(stored, match, "draw", "draw", inRoundRobin);
  const { opponent1, opponent2 } = getInferredResult(stored.opponent1, stored.opponent2);
  stored.opponent1 = opponent1;
  stored.opponent2 = opponent2;
  setForfeits(stored, match);
}
function setResults(stored, match, check, change, inRoundRobin) {
  if (match.opponent1 && match.opponent2) {
    if (match.opponent1.result === "win" && match.opponent2.result === "win")
      throw Error("There are two winners.");
    if (match.opponent1.result === "loss" && match.opponent2.result === "loss")
      throw Error("There are two losers.");
    if (!inRoundRobin && match.opponent1.forfeit === true && match.opponent2.forfeit === true)
      throw Error("There are two forfeits.");
  }
  if (match.opponent1?.result === check) {
    if (stored.opponent1)
      stored.opponent1.result = check;
    else
      stored.opponent1 = { id: null, result: check };
    if (stored.opponent2)
      stored.opponent2.result = change;
    else
      stored.opponent2 = { id: null, result: change };
  }
  if (match.opponent2?.result === check) {
    if (stored.opponent2)
      stored.opponent2.result = check;
    else
      stored.opponent2 = { id: null, result: check };
    if (stored.opponent1)
      stored.opponent1.result = change;
    else
      stored.opponent1 = { id: null, result: change };
  }
}
function setForfeits(stored, match) {
  if (match.opponent1?.forfeit === true && match.opponent2?.forfeit === true) {
    if (stored.opponent1)
      stored.opponent1.forfeit = true;
    if (stored.opponent2)
      stored.opponent2.forfeit = true;
    return;
  }
  if (match.opponent1?.forfeit === true) {
    if (stored.opponent1)
      stored.opponent1.forfeit = true;
    if (stored.opponent2)
      stored.opponent2.result = "win";
    else
      stored.opponent2 = { id: null, result: "win" };
  }
  if (match.opponent2?.forfeit === true) {
    if (stored.opponent2)
      stored.opponent2.forfeit = true;
    if (stored.opponent1)
      stored.opponent1.result = "win";
    else
      stored.opponent1 = { id: null, result: "win" };
  }
}
function isSeedingWithIds(seeding) {
  return seeding.some((value) => typeof value === "number");
}
function extractParticipantsFromSeeding(tournamentId, seeding) {
  const withoutByes = seeding.filter((name) => name !== null);
  const participants = withoutByes.map((item) => {
    if (typeof item === "string") {
      return {
        tournament_id: tournamentId,
        name: item
      };
    }
    return {
      ...item,
      tournament_id: tournamentId,
      name: item.name
    };
  });
  return participants;
}
function mapParticipantsNamesToDatabase(seeding, database, positions) {
  return mapParticipantsToDatabase("name", seeding, database, positions);
}
function mapParticipantsIdsToDatabase(seeding, database, positions) {
  return mapParticipantsToDatabase("id", seeding, database, positions);
}
function mapParticipantsToDatabase(prop, seeding, database, positions) {
  const slots = seeding.map((slot, i) => {
    if (slot === null)
      return null;
    const found = database.find((participant) => typeof slot === "object" ? participant[prop] === slot[prop] : participant[prop] === slot);
    if (!found)
      throw Error(`Participant ${prop} not found in database.`);
    return { id: found.id, position: i + 1 };
  });
  if (!positions)
    return slots;
  return positions.map((position) => position === null ? null : slots[position - 1]);
}
function convertMatchesToSeeding(matches) {
  const flattened = [].concat(...matches.map((match) => [match.opponent1, match.opponent2]));
  return sortSeeding(flattened);
}
function convertSlotsToSeeding(slots) {
  return slots.map((slot) => {
    if (slot === null || slot.id === null)
      return null;
    return slot.id;
  });
}
function sortSeeding(slots) {
  const withoutByes = slots.filter((v) => v !== null);
  withoutByes.sort((a, b) => a.position - b.position);
  if (withoutByes.length === slots.length)
    return withoutByes;
  const placed = Object.fromEntries(withoutByes.map((v) => [v.position - 1, v]));
  const sortedWithByes = Array.from({ length: slots.length }, (_, i) => placed[i] || null);
  return sortedWithByes;
}
function getNonNull(array) {
  const nonNull = array.filter((element) => element !== null);
  return nonNull;
}
function uniqueBy(array, key) {
  const seen = new Set;
  return array.filter((item) => {
    const value = key(item);
    if (!value)
      return true;
    if (seen.has(value))
      return false;
    seen.add(value);
    return true;
  });
}
function isMajorRound(roundNumber) {
  return roundNumber % 2 === 1;
}
function isMinorRound(roundNumber) {
  return !isMajorRound(roundNumber);
}
function transitionToMajor(previousDuels) {
  const currentDuelCount = previousDuels.length / 2;
  const currentDuels = [];
  for (let duelIndex = 0;duelIndex < currentDuelCount; duelIndex++) {
    const prevDuelId = duelIndex * 2;
    currentDuels.push([
      byeWinner(previousDuels[prevDuelId]),
      byeWinner(previousDuels[prevDuelId + 1])
    ]);
  }
  return currentDuels;
}
function transitionToMinor(previousDuels, losers, method) {
  const orderedLosers = method ? ordering[method](losers) : losers;
  const currentDuelCount = previousDuels.length;
  const currentDuels = [];
  for (let duelIndex = 0;duelIndex < currentDuelCount; duelIndex++) {
    const prevDuelId = duelIndex;
    currentDuels.push([
      orderedLosers[prevDuelId],
      byeWinner(previousDuels[prevDuelId])
    ]);
  }
  return currentDuels;
}
function setParentMatchCompleted(parent, childCount, inRoundRobin) {
  if (parent.opponent1?.score === undefined || parent.opponent2?.score === undefined)
    throw Error("Either opponent1, opponent2 or their scores are falsy.");
  const minToWin = minScoreToWinBestOfX(childCount);
  if (parent.opponent1.score >= minToWin) {
    parent.opponent1.result = "win";
    return;
  }
  if (parent.opponent2.score >= minToWin) {
    parent.opponent2.result = "win";
    return;
  }
  if (parent.opponent1.score === parent.opponent2.score && parent.opponent1.score + parent.opponent2.score > childCount - 1) {
    if (inRoundRobin) {
      parent.opponent1.result = "draw";
      parent.opponent2.result = "draw";
      return;
    }
    throw Error("Match games result in a tie for the parent match.");
  }
}
function getParentMatchResults(storedParent, scores) {
  return {
    opponent1: {
      id: storedParent.opponent1 && storedParent.opponent1.id,
      score: scores.opponent1
    },
    opponent2: {
      id: storedParent.opponent2 && storedParent.opponent2.id,
      score: scores.opponent2
    }
  };
}
function getUpdatedMatchResults(match, existing, enableByes) {
  const mergeOpponent = (currentOpponent, existingOpponent) => {
    if (currentOpponent === null)
      return enableByes ? null : { id: null };
    if (hasBye(existing))
      return currentOpponent;
    return { ...existingOpponent, ...currentOpponent };
  };
  return {
    ...existing,
    ...match,
    opponent1: mergeOpponent(match.opponent1, existing.opponent1),
    opponent2: mergeOpponent(match.opponent2, existing.opponent2)
  };
}
function getChildGamesResults(games) {
  const scores = {
    opponent1: 0,
    opponent2: 0
  };
  for (const game of games) {
    const result = getMatchResult(game);
    if (result === "opponent1")
      scores.opponent1++;
    else if (result === "opponent2")
      scores.opponent2++;
  }
  return scores;
}
function getSeeds(inLoserBracket, roundNumber, roundCountLB, matchCount) {
  const seedCount = getSeedCount(inLoserBracket, roundNumber, roundCountLB, matchCount);
  return Array.from({ length: seedCount }, (_, i) => i + 1);
}
function getSeedCount(inLoserBracket, roundNumber, roundCountLB, matchCount) {
  ensureOrderingSupported(inLoserBracket, roundNumber, roundCountLB);
  return roundNumber === 1 ? matchCount * 2 : matchCount;
}
function ensureOrderingSupported(inLoserBracket, roundNumber, roundCountLB) {
  if (inLoserBracket && !isOrderingSupportedLoserBracket(roundNumber, roundCountLB))
    throw Error("This round does not support ordering.");
  if (!inLoserBracket && !isOrderingSupportedUpperBracket(roundNumber))
    throw Error("This round does not support ordering.");
}
function isOrderingSupportedUpperBracket(roundNumber) {
  return roundNumber === 1;
}
function isOrderingSupportedLoserBracket(roundNumber, roundCount) {
  return roundNumber === 1 || isMinorRound(roundNumber) && roundNumber < roundCount;
}
function getUpperBracketRoundCount(participantCount) {
  return Math.log2(participantCount);
}
function getRoundPairCount(participantCount) {
  return getUpperBracketRoundCount(participantCount) - 1;
}
function isDoubleEliminationNecessary(participantCount) {
  return participantCount > 2;
}
function findLoserMatchNumber(participantCount, roundNumber, matchNumber, method) {
  const loserCount = getLoserCountFromWbForLbRound(participantCount, roundNumber);
  const losers = Array.from({ length: loserCount }, (_, i) => i + 1);
  const ordered = method ? ordering[method](losers) : losers;
  const matchNumberLB = ordered.indexOf(matchNumber) + 1;
  if (roundNumber === 1)
    return Math.ceil(matchNumberLB / 2);
  return matchNumberLB;
}
function getLoserRoundMatchCount(participantCount, roundNumber) {
  const roundPairIndex = Math.ceil(roundNumber / 2) - 1;
  const roundPairCount = getRoundPairCount(participantCount);
  const matchCount = Math.pow(2, roundPairCount - roundPairIndex - 1);
  if (roundNumber === 0)
    throw Error("Round number must start at 1.");
  if (matchCount < 1)
    throw Error(`Round number ${roundNumber} is too big for a loser bracket in a stage of ${participantCount} participants.`);
  return matchCount;
}
function getLoserCountFromWbForLbRound(participantCount, roundNumber) {
  const matchCount = getLoserRoundMatchCount(participantCount, roundNumber);
  if (roundNumber === 1)
    return matchCount * 2;
  return matchCount;
}
function getLoserOrdering(seedOrdering, roundNumber) {
  const orderingIndex = 1 + Math.floor(roundNumber / 2);
  return seedOrdering[orderingIndex];
}
function getLowerBracketRoundCount(participantCount) {
  const roundPairCount = getRoundPairCount(participantCount);
  return roundPairCount * 2;
}
function getDiagonalMatchNumber(matchNumber) {
  return Math.ceil(matchNumber / 2);
}
function getNearestPowerOfTwo(input2) {
  return Math.pow(2, Math.ceil(Math.log2(input2)));
}
function minScoreToWinBestOfX(x) {
  return (x + 1) / 2;
}
function isRoundRobin(stage) {
  return stage.type === "round_robin";
}
function ensureNotRoundRobin(stage) {
  const inRoundRobin = isRoundRobin(stage);
  if (inRoundRobin)
    throw Error("Impossible to update ordering in a round-robin stage.");
}
function isRoundCompleted(roundMatches) {
  return roundMatches.every((match) => match.status >= 4 /* Completed */);
}
function isWinnerBracket(stageType, groupNumber) {
  return stageType === "double_elimination" && groupNumber === 1;
}
function isLoserBracket(stageType, groupNumber) {
  return stageType === "double_elimination" && groupNumber === 2;
}
function isFinalGroup(stageType, groupNumber) {
  return stageType === "single_elimination" && groupNumber === 2 || stageType === "double_elimination" && groupNumber === 3;
}
function getMatchLocation(stageType, groupNumber) {
  if (isWinnerBracket(stageType, groupNumber))
    return "winner_bracket";
  if (isLoserBracket(stageType, groupNumber))
    return "loser_bracket";
  if (isFinalGroup(stageType, groupNumber))
    return "final_group";
  return "single_bracket";
}
function getFractionOfFinal(roundNumber, roundCount) {
  if (roundNumber > roundCount)
    throw Error(`There are more rounds than possible. ${JSON.stringify({ roundNumber, roundCount })}`);
  const denominator = Math.pow(2, roundCount - roundNumber);
  return 1 / denominator;
}
function getRanking(matches, formula) {
  const rankingMap = {};
  for (const match of matches) {
    updateRankingMap(rankingMap, formula, match.opponent1, match.opponent2);
    updateRankingMap(rankingMap, formula, match.opponent2, match.opponent1);
  }
  return createRanking(rankingMap);
}
function updateRankingMap(rankingMap, formula, current, opponent) {
  if (!current || current.id === null)
    return;
  const item = rankingMap[current.id] || {
    rank: 0,
    id: 0,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    forfeits: 0,
    scoreFor: 0,
    scoreAgainst: 0,
    scoreDifference: 0,
    points: 0
  };
  item.id = current.id;
  if (current.forfeit || current.result)
    item.played++;
  if (current.result === "win")
    item.wins++;
  if (current.result === "draw")
    item.draws++;
  if (current.result === "loss")
    item.losses++;
  if (current.forfeit)
    item.forfeits++;
  item.scoreFor += current.score || 0;
  item.scoreAgainst += opponent && opponent.score || 0;
  item.scoreDifference = item.scoreFor - item.scoreAgainst;
  item.points = formula(item);
  rankingMap[current.id] = item;
}
function createRanking(rankingMap) {
  const ranking = Object.values(rankingMap).sort((a, b) => a.points !== b.points ? b.points - a.points : a.played !== b.played ? b.played - a.played : b.scoreDifference - a.scoreDifference);
  const rank = {
    value: 0,
    lastPoints: -1
  };
  for (const item of ranking) {
    item.rank = rank.lastPoints !== item.points ? ++rank.value : rank.value;
    rank.lastPoints = item.points;
  }
  return ranking;
}

// src/brackets-manager/base/stage/creator.ts
class StageCreator {
  storage;
  stage;
  seedOrdering;
  updateMode;
  enableByesInUpdate;
  currentStageId;
  constructor(storage2, stage) {
    this.storage = storage2;
    this.stage = stage;
    this.stage.settings = this.stage.settings || {};
    this.seedOrdering = [...this.stage.settings.seedOrdering || []];
    this.updateMode = false;
    this.enableByesInUpdate = false;
    if (!this.stage.name)
      throw Error("You must provide a name for the stage.");
    if (this.stage.tournamentId === undefined)
      throw Error("You must provide a tournament id for the stage.");
    if (stage.type === "round_robin")
      this.stage.settings.roundRobinMode = this.stage.settings.roundRobinMode || "simple";
    if (stage.type === "single_elimination")
      this.stage.settings.consolationFinal = this.stage.settings.consolationFinal || false;
    if (stage.type === "double_elimination")
      this.stage.settings.grandFinal = this.stage.settings.grandFinal || "none";
    this.stage.settings.matchesChildCount = this.stage.settings.matchesChildCount || 0;
  }
  async run() {
    let stage;
    switch (this.stage.type) {
      case "round_robin":
        stage = await this.roundRobin();
        break;
      case "single_elimination":
        stage = await this.singleElimination();
        break;
      case "double_elimination":
        stage = await this.doubleElimination();
        break;
      default:
        throw Error("Unknown stage type.");
    }
    if (stage.id === -1)
      throw Error("Something went wrong when creating the stage.");
    await this.ensureSeedOrdering(stage.id);
    return stage;
  }
  setExisting(stageId, enableByes) {
    this.updateMode = true;
    this.currentStageId = stageId;
    this.enableByesInUpdate = enableByes;
  }
  async roundRobin() {
    const groups = await this.getRoundRobinGroups();
    const stage = await this.createStage();
    for (let i = 0;i < groups.length; i++)
      await this.createRoundRobinGroup(stage.id, i + 1, groups[i]);
    return stage;
  }
  async singleElimination() {
    if (!this.stage.settings?.manualOrdering && Array.isArray(this.stage.settings?.seedOrdering) && this.stage.settings?.seedOrdering.length !== 1)
      throw Error("You must specify one seed ordering method.");
    let ordered;
    if (this.stage.settings?.manualOrdering) {
      if (this.stage.settings.manualOrdering.length !== 1)
        throw Error("Manual ordering for an elimination stage must have exactly one group.");
      ordered = await this.getSlots(this.stage.settings.manualOrdering[0]);
    } else {
      const slots = await this.getSlots();
      const method = this.getStandardBracketFirstRoundOrdering();
      ordered = ordering[method](slots);
    }
    const stage = await this.createStage();
    const { losers } = await this.createStandardBracket(stage.id, 1, ordered);
    await this.createConsolationFinal(stage.id, losers);
    return stage;
  }
  async doubleElimination() {
    if (!this.stage.settings?.manualOrdering && this.stage.settings && Array.isArray(this.stage.settings.seedOrdering) && this.stage.settings.seedOrdering.length < 1)
      throw Error("You must specify at least one seed ordering method.");
    let ordered;
    if (this.stage.settings?.manualOrdering) {
      if (this.stage.settings.manualOrdering.length !== 1)
        throw Error("Manual ordering for an elimination stage must have exactly one group.");
      ordered = await this.getSlots(this.stage.settings.manualOrdering[0]);
    } else {
      const slots = await this.getSlots();
      const method = this.getStandardBracketFirstRoundOrdering();
      ordered = ordering[method](slots);
    }
    const stage = await this.createStage();
    if (this.stage.settings?.skipFirstRound)
      await this.createDoubleEliminationSkipFirstRound(stage.id, ordered);
    else
      await this.createDoubleElimination(stage.id, ordered);
    return stage;
  }
  async createDoubleEliminationSkipFirstRound(stageId, slots) {
    const { even: directInWb, odd: directInLb } = splitByParity(slots);
    const { losers: losersWb, winner: winnerWb } = await this.createStandardBracket(stageId, 1, directInWb);
    if (isDoubleEliminationNecessary(this.stage.settings?.size)) {
      const winnerLb = await this.createLowerBracket(stageId, 2, [directInLb, ...losersWb]);
      await this.createGrandFinal(stageId, winnerWb, winnerLb);
    }
  }
  async createDoubleElimination(stageId, slots) {
    const { losers: losersWb, winner: winnerWb } = await this.createStandardBracket(stageId, 1, slots);
    if (isDoubleEliminationNecessary(this.stage.settings?.size)) {
      const winnerLb = await this.createLowerBracket(stageId, 2, losersWb);
      const finalGroupId = await this.createGrandFinal(stageId, winnerWb, winnerLb);
      await this.createConsolationFinal(stageId, losersWb, {
        existingGroupId: finalGroupId,
        matchNumberStart: 2
      });
    }
  }
  async createRoundRobinGroup(stageId, groupNumber, slots) {
    const groupId = await this.insertGroup({
      stage_id: stageId,
      number: groupNumber
    });
    if (groupId === -1)
      throw Error("Could not insert the group.");
    const rounds = makeRoundRobinMatches(slots, this.stage.settings?.roundRobinMode);
    for (let i = 0;i < rounds.length; i++)
      await this.createRound(stageId, groupId, i + 1, rounds[0].length, rounds[i]);
  }
  async createStandardBracket(stageId, groupNumber, slots) {
    const roundCount = getUpperBracketRoundCount(slots.length);
    const groupId = await this.insertGroup({
      stage_id: stageId,
      number: groupNumber
    });
    if (groupId === -1)
      throw Error("Could not insert the group.");
    let duels = makePairs(slots);
    let roundNumber = 1;
    const losers = [];
    for (let i = roundCount - 1;i >= 0; i--) {
      const matchCount = Math.pow(2, i);
      duels = this.getCurrentDuels(duels, matchCount);
      losers.push(duels.map(byeLoser));
      await this.createRound(stageId, groupId, roundNumber++, matchCount, duels);
    }
    return { losers, winner: byeWinner(duels[0]) };
  }
  async createLowerBracket(stageId, groupNumber, losers) {
    const participantCount = this.stage.settings?.size;
    const roundPairCount = getRoundPairCount(participantCount);
    let losersId = 0;
    const method = this.getMajorOrdering(participantCount);
    const ordered = ordering[method](losers[losersId++]);
    const groupId = await this.insertGroup({
      stage_id: stageId,
      number: groupNumber
    });
    if (groupId === -1)
      throw Error("Could not insert the group.");
    let duels = makePairs(ordered);
    let roundNumber = 1;
    for (let i = 0;i < roundPairCount; i++) {
      const matchCount = Math.pow(2, roundPairCount - i - 1);
      duels = this.getCurrentDuels(duels, matchCount, true);
      await this.createRound(stageId, groupId, roundNumber++, matchCount, duels);
      const minorOrdering = this.getMinorOrdering(participantCount, i, roundPairCount);
      duels = this.getCurrentDuels(duels, matchCount, false, losers[losersId++], minorOrdering);
      await this.createRound(stageId, groupId, roundNumber++, matchCount, duels);
    }
    return byeWinnerToGrandFinal(duels[0]);
  }
  async createUniqueMatchBracket(stageId, groupNumber, duels, overrides = {}) {
    let groupId = overrides.existingGroupId;
    let roundNumberStart = 1;
    if (groupId !== undefined) {
      const rounds = await this.storage.select("round", { group_id: groupId });
      if (!rounds)
        throw Error("Error getting rounds.");
      roundNumberStart = rounds.length + 1;
    } else {
      groupId = await this.insertGroup({
        stage_id: stageId,
        number: groupNumber
      });
      if (groupId === -1)
        throw Error("Could not insert the group.");
    }
    for (let i = 0;i < duels.length; i++)
      await this.createRound(stageId, groupId, roundNumberStart + i, 1, [duels[i]], overrides.matchNumberStart);
    return groupId;
  }
  async createRound(stageId, groupId, roundNumber, matchCount, duels, matchNumberStart = 1) {
    const matchesChildCount = this.getMatchesChildCount();
    const roundId = await this.insertRound({
      number: roundNumber,
      stage_id: stageId,
      group_id: groupId
    });
    if (roundId === -1)
      throw Error("Could not insert the round.");
    for (let i = 0;i < matchCount; i++)
      await this.createMatch(stageId, groupId, roundId, matchNumberStart + i, duels[i], matchesChildCount);
  }
  async createMatch(stageId, groupId, roundId, matchNumber, opponents, childCount) {
    const opponent1 = toResultWithPosition(opponents[0]);
    const opponent2 = toResultWithPosition(opponents[1]);
    if (this.stage.type === "round_robin" && opponent1 === null && opponent2 === null)
      return;
    let existing = null;
    let status = getMatchStatus(opponents);
    if (this.updateMode) {
      existing = await this.storage.selectFirst("match", {
        round_id: roundId,
        number: matchNumber
      });
      const currentChildCount = existing?.child_count;
      childCount = currentChildCount === undefined ? childCount : currentChildCount;
      if (existing) {
        const existingStatus = getMatchStatus(existing);
        if (existingStatus > status && existingStatus >= 3 /* Running */)
          status = existingStatus;
      }
    }
    const parentId = await this.insertMatch({
      number: matchNumber,
      stage_id: stageId,
      group_id: groupId,
      round_id: roundId,
      child_count: childCount,
      status,
      ...getInferredResult(opponent1, opponent2)
    }, existing);
    if (parentId === -1)
      throw Error("Could not insert the match.");
    for (let i = 0;i < childCount; i++) {
      const id = await this.insertMatchGame({
        number: i + 1,
        stage_id: stageId,
        parent_id: parentId,
        status,
        ...getInferredResult(toResult(opponents[0]), toResult(opponents[1]))
      });
      if (id === -1)
        throw Error("Could not insert the match game.");
    }
  }
  getCurrentDuels(previousDuels, currentDuelCount, major, losers, method) {
    if ((major === undefined || major) && previousDuels.length === currentDuelCount) {
      return previousDuels;
    }
    if (major === undefined || major) {
      return transitionToMajor(previousDuels);
    }
    return transitionToMinor(previousDuels, losers, method);
  }
  async getSlots(positions) {
    let seeding = this.stage.seedingIds || this.stage.seeding;
    const size = this.stage.settings?.size || seeding?.length || 0;
    ensureValidSize(this.stage.type, size);
    if (size && !seeding)
      return Array.from({ length: size }, (_, i) => ({ id: null, position: i + 1 }));
    if (!seeding)
      throw Error("Either size or seeding must be given.");
    this.stage.settings = {
      ...this.stage.settings,
      size
    };
    if (positions && positions.length !== size)
      throw Error("Manual ordering does not have the same length as the seeding.");
    ensureNoDuplicates(seeding);
    seeding = fixSeeding(seeding, size);
    if (this.stage.type !== "round_robin" && this.stage.settings.balanceByes)
      seeding = balanceByes(seeding, this.stage.settings.size);
    this.stage.seeding = seeding;
    const slots = this.stage.seedingIds !== undefined || isSeedingWithIds(seeding) ? await this.getSlotsUsingIds(seeding, positions) : await this.getSlotsUsingNames(seeding, positions);
    if (this.updateMode && !this.enableByesInUpdate)
      return slots.map((slot) => slot === null ? { id: null } : slot);
    return slots;
  }
  async getSlotsUsingNames(seeding, positions) {
    const participants = extractParticipantsFromSeeding(this.stage.tournamentId, seeding);
    if (!await this.registerParticipants(participants))
      throw Error("Error registering the participants.");
    const added = await this.storage.select("participant", { tournament_id: this.stage.tournamentId });
    if (!added)
      throw Error("Error getting registered participant.");
    return mapParticipantsNamesToDatabase(seeding, added, positions);
  }
  async getSlotsUsingIds(seeding, positions) {
    const participants = await this.storage.select("participant", { tournament_id: this.stage.tournamentId });
    if (!participants)
      throw Error("No available participants.");
    return mapParticipantsIdsToDatabase(seeding, participants, positions);
  }
  async getStageNumber() {
    const stages = await this.storage.select("stage", { tournament_id: this.stage.tournamentId });
    const stageNumbers = stages?.map((stage) => stage.number ?? 0);
    if (this.stage.number !== undefined) {
      if (stageNumbers?.includes(this.stage.number))
        throw Error("The given stage number already exists.");
      return this.stage.number;
    }
    if (!stageNumbers?.length)
      return 1;
    const maxNumber = Math.max(...stageNumbers);
    return maxNumber + 1;
  }
  getMatchesChildCount() {
    if (!this.stage.settings?.matchesChildCount)
      return 0;
    return this.stage.settings.matchesChildCount;
  }
  getOrdering(orderingIndex, stageType, defaultMethod) {
    if (!this.stage.settings?.seedOrdering) {
      this.seedOrdering.push(defaultMethod);
      return defaultMethod;
    }
    const method = this.stage.settings.seedOrdering[orderingIndex];
    if (!method) {
      this.seedOrdering.push(defaultMethod);
      return defaultMethod;
    }
    if (stageType === "elimination" && method.match(/^groups\./))
      throw Error("You must specify a seed ordering method without a 'groups' prefix");
    if (stageType === "groups" && method !== "natural" && !method.match(/^groups\./))
      throw Error("You must specify a seed ordering method with a 'groups' prefix");
    return method;
  }
  async getRoundRobinGroups() {
    if (this.stage.settings?.groupCount === undefined || !Number.isInteger(this.stage.settings.groupCount))
      throw Error("You must specify a group count for round-robin stages.");
    if (this.stage.settings.groupCount <= 0)
      throw Error("You must provide a strictly positive group count.");
    if (this.stage.settings?.manualOrdering) {
      if (this.stage.settings?.manualOrdering.length !== this.stage.settings?.groupCount)
        throw Error("Group count in the manual ordering does not correspond to the given group count.");
      const positions = this.stage.settings?.manualOrdering.flat();
      const slots2 = await this.getSlots(positions);
      return makeGroups(slots2, this.stage.settings.groupCount);
    }
    if (Array.isArray(this.stage.settings.seedOrdering) && this.stage.settings.seedOrdering.length !== 1)
      throw Error("You must specify one seed ordering method.");
    const method = this.getRoundRobinOrdering();
    const slots = await this.getSlots();
    const ordered = ordering[method](slots, this.stage.settings.groupCount);
    return makeGroups(ordered, this.stage.settings.groupCount);
  }
  getRoundRobinOrdering() {
    return this.getOrdering(0, "groups", "groups.effort_balanced");
  }
  getStandardBracketFirstRoundOrdering() {
    return this.getOrdering(0, "elimination", "inner_outer");
  }
  getMajorOrdering(participantCount) {
    return this.getOrdering(1, "elimination", defaultMinorOrdering[participantCount]?.[0] || "natural");
  }
  getMinorOrdering(participantCount, index, minorRoundCount) {
    if (index === minorRoundCount - 1)
      return;
    return this.getOrdering(2 + index, "elimination", defaultMinorOrdering[participantCount]?.[1 + index] || "natural");
  }
  async insertStage(stage) {
    let existing = null;
    if (this.updateMode) {
      existing = await this.storage.select("stage", this.currentStageId);
      if (!existing)
        throw Error("Stage not found.");
      const update = {
        ...existing,
        ...stage,
        settings: {
          ...existing.settings,
          ...stage.settings
        }
      };
      if (!await this.storage.update("stage", this.currentStageId, update))
        throw Error("Could not update the stage.");
    }
    if (!existing)
      return this.storage.insert("stage", stage);
    return existing.id;
  }
  async insertGroup(group) {
    let existing = null;
    if (this.updateMode) {
      existing = await this.storage.selectFirst("group", {
        stage_id: group.stage_id,
        number: group.number
      });
    }
    if (!existing)
      return this.storage.insert("group", group);
    return existing.id;
  }
  async insertRound(round) {
    let existing = null;
    if (this.updateMode) {
      existing = await this.storage.selectFirst("round", {
        group_id: round.group_id,
        number: round.number
      });
    }
    if (!existing)
      return this.storage.insert("round", round);
    return existing.id;
  }
  async insertMatch(match, existing) {
    if (!existing)
      return this.storage.insert("match", match);
    const updated = getUpdatedMatchResults(match, existing, this.enableByesInUpdate);
    if (!await this.storage.update("match", existing.id, updated))
      throw Error("Could not update the match.");
    return existing.id;
  }
  async insertMatchGame(matchGame) {
    let existing = null;
    if (this.updateMode) {
      existing = await this.storage.selectFirst("match_game", {
        parent_id: matchGame.parent_id,
        number: matchGame.number
      });
    }
    if (!existing)
      return this.storage.insert("match_game", matchGame);
    const updated = getUpdatedMatchResults(matchGame, existing, this.enableByesInUpdate);
    if (!await this.storage.update("match_game", existing.id, updated))
      throw Error("Could not update the match game.");
    return existing.id;
  }
  async registerParticipants(participants) {
    const existing = await this.storage.select("participant", { tournament_id: this.stage.tournamentId });
    if (!existing || existing.length === 0)
      return this.storage.insert("participant", participants);
    for (const participant of participants) {
      if (existing.some((value) => value.name === participant.name))
        continue;
      const result = await this.storage.insert("participant", participant);
      if (result === -1)
        return false;
    }
    return true;
  }
  async createStage() {
    const stageNumber = await this.getStageNumber();
    const stage = {
      tournament_id: this.stage.tournamentId,
      name: this.stage.name,
      type: this.stage.type,
      number: stageNumber,
      settings: this.stage.settings || {}
    };
    const stageId = await this.insertStage(stage);
    if (stageId === -1)
      throw Error("Could not insert the stage.");
    return { ...stage, id: stageId };
  }
  async createConsolationFinal(stageId, losers, overrides = {}) {
    if (!this.stage.settings?.consolationFinal)
      return;
    const semiFinalLosers = losers[losers.length - 2];
    await this.createUniqueMatchBracket(stageId, 2, [semiFinalLosers], overrides);
  }
  async createGrandFinal(stageId, winnerWb, winnerLb) {
    const grandFinal = this.stage.settings?.grandFinal;
    if (grandFinal === "none")
      return;
    const finalDuels = [[winnerWb, winnerLb]];
    if (grandFinal === "double")
      finalDuels.push([{ id: null }, { id: null }]);
    const groupId = await this.createUniqueMatchBracket(stageId, 3, finalDuels);
    return groupId;
  }
  async ensureSeedOrdering(stageId) {
    if (this.stage.settings?.seedOrdering?.length === this.seedOrdering.length)
      return;
    const existing = await this.storage.select("stage", stageId);
    if (!existing)
      throw Error("Stage not found.");
    const update = {
      ...existing,
      settings: {
        ...existing.settings,
        seedOrdering: this.seedOrdering
      }
    };
    if (!await this.storage.update("stage", stageId, update))
      throw Error("Could not update the stage.");
  }
}

// src/brackets-manager/create.ts
class Create {
  storage;
  constructor(storage2) {
    this.storage = storage2;
  }
  async stage(data) {
    const creator = new StageCreator(this.storage, data);
    return creator.run();
  }
}

// src/brackets-manager/base/getter.ts
class BaseGetter {
  storage;
  constructor(storage2) {
    this.storage = storage2;
  }
  async getOrderedRounds(stage) {
    if (!stage?.settings.size)
      throw Error("The stage has no size.");
    if (stage.type === "single_elimination")
      return this.getOrderedRoundsSingleElimination(stage.id);
    return this.getOrderedRoundsDoubleElimination(stage.id);
  }
  async getOrderedRoundsSingleElimination(stageId) {
    return [await this.getUpperBracketFirstRound(stageId)];
  }
  async getOrderedRoundsDoubleElimination(stageId) {
    const rounds = await this.storage.select("round", { stage_id: stageId });
    if (!rounds)
      throw Error("Error getting rounds.");
    const loserBracket = await this.getLoserBracket(stageId);
    if (!loserBracket)
      throw Error("Loser bracket not found.");
    const firstRoundWB = rounds[0];
    const roundsLB = rounds.filter((r) => r.group_id === loserBracket.id);
    const orderedRoundsLB = roundsLB.filter((r) => isOrderingSupportedLoserBracket(r.number, roundsLB.length));
    return [firstRoundWB, ...orderedRoundsLB];
  }
  async getRoundPositionalInfo(roundId) {
    const round = await this.storage.select("round", roundId);
    if (!round)
      throw Error("Round not found.");
    const rounds = await this.storage.select("round", { group_id: round.group_id });
    if (!rounds)
      throw Error("Error getting rounds.");
    return {
      roundNumber: round.number,
      roundCount: rounds.length
    };
  }
  async getPreviousMatches(match, matchLocation, stage, roundNumber) {
    if (matchLocation === "loser_bracket")
      return this.getPreviousMatchesLB(match, stage, roundNumber);
    if (matchLocation === "final_group")
      return this.getPreviousMatchesFinal(match, stage, roundNumber);
    if (roundNumber === 1)
      return [];
    return this.getMatchesBeforeMajorRound(match, roundNumber);
  }
  async getPreviousMatchesFinal(match, stage, roundNumber) {
    if (stage.type === "single_elimination")
      return this.getPreviousMatchesFinalSingleElimination(match, stage);
    return this.getPreviousMatchesFinalDoubleElimination(match, roundNumber);
  }
  async getPreviousMatchesFinalSingleElimination(match, stage) {
    const upperBracket = await this.getUpperBracket(match.stage_id);
    const upperBracketRoundCount = getUpperBracketRoundCount(stage.settings.size);
    const semiFinalsRound = await this.storage.selectFirst("round", {
      group_id: upperBracket.id,
      number: upperBracketRoundCount - 1
    });
    if (!semiFinalsRound)
      throw Error("Semi finals round not found.");
    const semiFinalMatches = await this.storage.select("match", {
      round_id: semiFinalsRound.id
    });
    if (!semiFinalMatches)
      throw Error("Error getting semi final matches.");
    return semiFinalMatches;
  }
  async getPreviousMatchesFinalDoubleElimination(match, roundNumber) {
    if (roundNumber > 1)
      return [await this.findMatch(match.group_id, roundNumber - 1, 1)];
    const winnerBracket = await this.getUpperBracket(match.stage_id);
    const lastRoundWB = await this.getLastRound(winnerBracket.id);
    const winnerBracketFinalMatch = await this.storage.selectFirst("match", {
      round_id: lastRoundWB.id,
      number: 1
    });
    if (!winnerBracketFinalMatch)
      throw Error("Match not found.");
    const loserBracket = await this.getLoserBracket(match.stage_id);
    if (!loserBracket)
      throw Error("Loser bracket not found.");
    const lastRoundLB = await this.getLastRound(loserBracket.id);
    const loserBracketFinalMatch = await this.storage.selectFirst("match", {
      round_id: lastRoundLB.id,
      number: 1
    });
    if (!loserBracketFinalMatch)
      throw Error("Match not found.");
    return [winnerBracketFinalMatch, loserBracketFinalMatch];
  }
  async getPreviousMatchesLB(match, stage, roundNumber) {
    if (stage.settings.skipFirstRound && roundNumber === 1)
      return [];
    if (hasBye(match))
      return [];
    const winnerBracket = await this.getUpperBracket(match.stage_id);
    const actualRoundNumberWB = Math.ceil((roundNumber + 1) / 2);
    const roundNumberWB = stage.settings.skipFirstRound ? actualRoundNumberWB - 1 : actualRoundNumberWB;
    if (roundNumber === 1)
      return this.getMatchesBeforeFirstRoundLB(match, winnerBracket.id, roundNumberWB);
    if (isMajorRound(roundNumber))
      return this.getMatchesBeforeMajorRound(match, roundNumber);
    return this.getMatchesBeforeMinorRoundLB(match, winnerBracket.id, roundNumber, roundNumberWB);
  }
  async getMatchesBeforeMajorRound(match, roundNumber) {
    return [
      await this.findMatch(match.group_id, roundNumber - 1, match.number * 2 - 1),
      await this.findMatch(match.group_id, roundNumber - 1, match.number * 2)
    ];
  }
  async getMatchesBeforeFirstRoundLB(match, winnerBracketId, roundNumberWB) {
    return [
      await this.findMatch(winnerBracketId, roundNumberWB, getOriginPosition(match, "opponent1")),
      await this.findMatch(winnerBracketId, roundNumberWB, getOriginPosition(match, "opponent2"))
    ];
  }
  async getMatchesBeforeMinorRoundLB(match, winnerBracketId, roundNumber, roundNumberWB) {
    const matchNumber = getOriginPosition(match, "opponent1");
    return [
      await this.findMatch(winnerBracketId, roundNumberWB, matchNumber),
      await this.findMatch(match.group_id, roundNumber - 1, match.number)
    ];
  }
  async getNextMatches(match, matchLocation, stage, roundNumber, roundCount) {
    switch (matchLocation) {
      case "single_bracket":
        return this.getNextMatchesUpperBracket(match, stage, roundNumber, roundCount);
      case "winner_bracket":
        return this.getNextMatchesWB(match, stage, roundNumber, roundCount);
      case "loser_bracket":
        return this.getNextMatchesLB(match, stage, roundNumber, roundCount);
      case "final_group":
        return this.getNextMatchesFinal(match, stage, roundNumber, roundCount);
      default:
        throw Error("Unknown bracket kind.");
    }
  }
  async getNextMatchesWB(match, stage, roundNumber, roundCount) {
    const loserBracket = await this.getLoserBracket(match.stage_id);
    if (loserBracket === null)
      return [];
    const actualRoundNumber = stage.settings.skipFirstRound ? roundNumber + 1 : roundNumber;
    const roundNumberLB = actualRoundNumber > 1 ? (actualRoundNumber - 1) * 2 : 1;
    const participantCount = stage.settings.size;
    const method = getLoserOrdering(stage.settings.seedOrdering, roundNumberLB);
    const actualMatchNumberLB = findLoserMatchNumber(participantCount, roundNumberLB, match.number, method);
    return [
      ...await this.getNextMatchesUpperBracket(match, stage, roundNumber, roundCount),
      await this.findMatch(loserBracket.id, roundNumberLB, actualMatchNumberLB)
    ];
  }
  async getNextMatchesUpperBracket(match, stage, roundNumber, roundCount) {
    if (stage.type === "single_elimination")
      return this.getNextMatchesUpperBracketSingleElimination(match, stage.type, roundNumber, roundCount);
    return this.getNextMatchesUpperBracketDoubleElimination(match, stage.type, roundNumber, roundCount);
  }
  async getNextMatchesUpperBracketSingleElimination(match, stageType, roundNumber, roundCount) {
    if (roundNumber === roundCount - 1) {
      const finalGroupId = await this.getFinalGroupId(match.stage_id, stageType);
      const consolationFinal = await this.getFinalGroupFirstMatch(finalGroupId);
      return [
        await this.getDiagonalMatch(match.group_id, roundNumber, match.number),
        ...consolationFinal ? [consolationFinal] : []
      ];
    }
    if (roundNumber === roundCount)
      return [];
    return [await this.getDiagonalMatch(match.group_id, roundNumber, match.number)];
  }
  async getNextMatchesUpperBracketDoubleElimination(match, stageType, roundNumber, roundCount) {
    if (roundNumber === roundCount) {
      const finalGroupId = await this.getFinalGroupId(match.stage_id, stageType);
      return [await this.getFinalGroupFirstMatch(finalGroupId)];
    }
    return [await this.getDiagonalMatch(match.group_id, roundNumber, match.number)];
  }
  async getNextMatchesLB(match, stage, roundNumber, roundCount) {
    if (roundNumber === roundCount - 1) {
      const finalGroupId = await this.getFinalGroupId(match.stage_id, stage.type);
      const consolationFinal = await this.getConsolationFinalMatchDoubleElimination(finalGroupId);
      return [
        ...await this.getMatchAfterMajorRoundLB(match, roundNumber),
        ...consolationFinal ? [consolationFinal] : []
      ];
    }
    if (roundNumber === roundCount) {
      const finalGroupId = await this.getFinalGroupId(match.stage_id, stage.type);
      const grandFinal = await this.getFinalGroupFirstMatch(finalGroupId);
      const consolationFinal = await this.getConsolationFinalMatchDoubleElimination(finalGroupId);
      return [
        grandFinal,
        ...consolationFinal ? [consolationFinal] : []
      ];
    }
    if (isMajorRound(roundNumber))
      return this.getMatchAfterMajorRoundLB(match, roundNumber);
    return this.getMatchAfterMinorRoundLB(match, roundNumber);
  }
  async getFinalGroupFirstMatch(finalGroupId) {
    if (finalGroupId === null)
      return null;
    return this.findMatch(finalGroupId, 1, 1);
  }
  async getConsolationFinalMatchDoubleElimination(finalGroupId) {
    if (finalGroupId === null)
      return null;
    return this.storage.selectFirst("match", {
      group_id: finalGroupId,
      number: 2
    });
  }
  async getNextMatchesFinal(match, stage, roundNumber, roundCount) {
    if (roundNumber === roundCount)
      return [];
    if (stage.settings.consolationFinal && match.number === 1 && roundNumber === roundCount - 1)
      return [];
    return [await this.findMatch(match.group_id, roundNumber + 1, 1)];
  }
  async getMatchAfterMajorRoundLB(match, roundNumber) {
    return [await this.getParallelMatch(match.group_id, roundNumber, match.number)];
  }
  async getMatchAfterMinorRoundLB(match, roundNumber) {
    return [await this.getDiagonalMatch(match.group_id, roundNumber, match.number)];
  }
  static getSeedingOrdering(stageType, create) {
    return stageType === "round_robin" ? create.getRoundRobinOrdering() : create.getStandardBracketFirstRoundOrdering();
  }
  async getSeedingMatches(stageId, stageType) {
    if (stageType === "round_robin")
      return this.storage.select("match", { stage_id: stageId });
    try {
      const firstRound = await this.getUpperBracketFirstRound(stageId);
      return this.storage.select("match", { round_id: firstRound.id });
    } catch {
      return [];
    }
  }
  async getUpperBracketFirstRound(stageId) {
    const firstRound = await this.storage.selectFirst("round", { stage_id: stageId, number: 1 }, false);
    if (!firstRound)
      throw Error("Round not found.");
    return firstRound;
  }
  async getLastRound(groupId) {
    const round = await this.storage.selectLast("round", { group_id: groupId }, false);
    if (!round)
      throw Error("Error getting rounds.");
    return round;
  }
  async getFinalGroupId(stageId, stageType) {
    const groupNumber = stageType === "single_elimination" ? 2 : 3;
    const finalGroup = await this.storage.selectFirst("group", { stage_id: stageId, number: groupNumber });
    if (!finalGroup)
      return null;
    return finalGroup.id;
  }
  async getUpperBracket(stageId) {
    const winnerBracket = await this.storage.selectFirst("group", { stage_id: stageId, number: 1 });
    if (!winnerBracket)
      throw Error("Winner bracket not found.");
    return winnerBracket;
  }
  async getLoserBracket(stageId) {
    return this.storage.selectFirst("group", { stage_id: stageId, number: 2 });
  }
  async getDiagonalMatch(groupId, roundNumber, matchNumber) {
    return this.findMatch(groupId, roundNumber + 1, getDiagonalMatchNumber(matchNumber));
  }
  async getParallelMatch(groupId, roundNumber, matchNumber) {
    return this.findMatch(groupId, roundNumber + 1, matchNumber);
  }
  async findMatch(groupId, roundNumber, matchNumber) {
    const round = await this.storage.selectFirst("round", {
      group_id: groupId,
      number: roundNumber
    });
    if (!round)
      throw Error("Round not found.");
    const match = await this.storage.selectFirst("match", {
      round_id: round.id,
      number: matchNumber
    });
    if (!match)
      throw Error("Match not found.");
    return match;
  }
  async findMatchGame(game) {
    if (game.id !== undefined) {
      const stored = await this.storage.select("match_game", game.id);
      if (!stored)
        throw Error("Match game not found.");
      return stored;
    }
    if (game.parent_id !== undefined && game.number) {
      const stored = await this.storage.selectFirst("match_game", {
        parent_id: game.parent_id,
        number: game.number
      });
      if (!stored)
        throw Error("Match game not found.");
      return stored;
    }
    throw Error("No match game id nor parent id and number given.");
  }
}

// src/brackets-manager/get.ts
class Get extends BaseGetter {
  async stageData(stageId) {
    const stage = await this.storage.select("stage", stageId);
    if (!stage)
      throw Error("Stage not found.");
    const stageData = await this.getStageSpecificData(stage.id);
    const participants = await this.storage.select("participant", { tournament_id: stage.tournament_id });
    if (!participants)
      throw Error("Error getting participants.");
    return {
      stage: [stage],
      group: stageData.groups,
      round: stageData.rounds,
      match: stageData.matches,
      match_game: stageData.matchGames,
      participant: participants
    };
  }
  async tournamentData(tournamentId) {
    const stages = await this.storage.select("stage", { tournament_id: tournamentId });
    if (!stages)
      throw Error("Error getting stages.");
    const stagesData = await Promise.all(stages.map((stage) => this.getStageSpecificData(stage.id)));
    const participants = await this.storage.select("participant", { tournament_id: tournamentId });
    if (!participants)
      throw Error("Error getting participants.");
    return {
      stage: stages,
      group: stagesData.reduce((acc, data) => [...acc, ...data.groups], []),
      round: stagesData.reduce((acc, data) => [...acc, ...data.rounds], []),
      match: stagesData.reduce((acc, data) => [...acc, ...data.matches], []),
      match_game: stagesData.reduce((acc, data) => [...acc, ...data.matchGames], []),
      participant: participants
    };
  }
  async matchGames(matches) {
    const parentMatches = matches.filter((match) => match.child_count > 0);
    const matchGamesQueries = await Promise.all(parentMatches.map((match) => this.storage.select("match_game", { parent_id: match.id })));
    if (matchGamesQueries.some((game) => game === null))
      throw Error("Error getting match games.");
    return getNonNull(matchGamesQueries).flat();
  }
  async currentStage(tournamentId) {
    const stages = await this.storage.select("stage", { tournament_id: tournamentId });
    if (!stages)
      throw Error("Error getting stages.");
    for (const stage of stages) {
      const matches = await this.storage.select("match", { stage_id: stage.id });
      if (!matches)
        throw Error("Error getting matches.");
      if (matches.every((match) => match.status >= 4 /* Completed */))
        continue;
      return stage;
    }
    return null;
  }
  async currentRound(stageId) {
    const matches = await this.storage.select("match", { stage_id: stageId });
    if (!matches)
      throw Error("Error getting matches.");
    const matchesByRound = splitBy(matches, "round_id");
    for (const roundMatches of matchesByRound) {
      if (roundMatches.every((match) => match.status >= 4 /* Completed */))
        continue;
      const round = await this.storage.select("round", roundMatches[0].round_id);
      if (!round)
        throw Error("Round not found.");
      return round;
    }
    return null;
  }
  async currentMatches(stageId) {
    const stage = await this.storage.select("stage", stageId);
    if (!stage)
      throw Error("Stage not found.");
    if (stage.type !== "single_elimination")
      throw Error("Not implemented for round robin and double elimination. Ask if needed.");
    const matches = await this.storage.select("match", { stage_id: stageId });
    if (!matches)
      throw Error("Error getting matches.");
    const matchesByRound = splitBy(matches, "round_id");
    const roundCount = getUpperBracketRoundCount(stage.settings.size);
    let currentRoundIndex = -1;
    const currentMatches = [];
    for (const roundMatches of matchesByRound) {
      currentRoundIndex++;
      if (stage.settings.consolationFinal && currentRoundIndex === roundCount - 1) {
        const [final] = roundMatches;
        const [consolationFinal] = matchesByRound[currentRoundIndex + 1];
        const finals = [final, consolationFinal];
        if (finals.every((match) => !isMatchOngoing(match)))
          return currentMatches;
        return finals.filter((match) => isMatchOngoing(match));
      }
      if (roundMatches.every((match) => !isMatchOngoing(match)))
        continue;
      currentMatches.push(...roundMatches.filter((match) => isMatchOngoing(match)));
    }
    return currentMatches;
  }
  async seeding(stageId) {
    const stage = await this.storage.select("stage", stageId);
    if (!stage)
      throw Error("Stage not found.");
    const pickRelevantProps = (slot) => {
      if (slot === null)
        return null;
      const { id, position } = slot;
      return { id, position };
    };
    if (stage.type === "round_robin")
      return (await this.roundRobinSeeding(stage)).map(pickRelevantProps);
    return (await this.eliminationSeeding(stage)).map(pickRelevantProps);
  }
  async finalStandings(stageId, roundRobinOptions) {
    const stage = await this.storage.select("stage", stageId);
    if (!stage)
      throw Error("Stage not found.");
    switch (stage.type) {
      case "round_robin": {
        if (!roundRobinOptions)
          throw Error("Round-robin options are required for round-robin stages.");
        return this.roundRobinStandings(stage, roundRobinOptions);
      }
      case "single_elimination": {
        if (roundRobinOptions)
          throw Error("Round-robin options are not supported for elimination stages.");
        return this.singleEliminationStandings(stage);
      }
      case "double_elimination": {
        if (roundRobinOptions)
          throw Error("Round-robin options are not supported for elimination stages.");
        return this.doubleEliminationStandings(stage);
      }
      default:
        throw Error("Unknown stage type.");
    }
  }
  async roundRobinSeeding(stage) {
    if (stage.settings.size === undefined)
      throw Error("The size of the seeding is undefined.");
    const matches = await this.storage.select("match", { stage_id: stage.id });
    if (!matches)
      throw Error("Error getting matches.");
    const slots = convertMatchesToSeeding(matches);
    if (slots.length < stage.settings.size) {
      const diff = stage.settings.size - slots.length;
      for (let i = 0;i < diff; i++)
        slots.push(null);
    }
    const unique = uniqueBy(slots, (item) => item && item.position);
    const seeding = setArraySize(unique, stage.settings.size, null);
    return seeding;
  }
  async eliminationSeeding(stage) {
    const firstRound = await this.storage.selectFirst("round", { stage_id: stage.id, number: 1 }, false);
    if (!firstRound)
      throw Error("Error getting the first round.");
    const matches = await this.storage.select("match", { round_id: firstRound.id });
    if (!matches)
      throw Error("Error getting matches.");
    return convertMatchesToSeeding(matches);
  }
  async roundRobinStandings(stage, roundRobinOptions) {
    const participants = await this.storage.select("participant", { tournament_id: stage.tournament_id });
    if (!participants)
      throw Error("Error getting participants.");
    const matches = await this.storage.select("match", { stage_id: stage.id });
    if (!matches)
      throw Error("Error getting matches.");
    const matchesByGroup = splitBy(matches, "group_id");
    const unsortedRanking = matchesByGroup.flatMap((groupMatches) => {
      const groupRanking = getRanking(groupMatches, roundRobinOptions.rankingFormula);
      const qualifiedOnly = groupRanking.slice(0, roundRobinOptions.maxQualifiedParticipantsPerGroup);
      return qualifiedOnly.map((item) => ({
        ...item,
        groupId: groupMatches[0].group_id,
        name: findParticipant(participants, item).name
      }));
    });
    return unsortedRanking.sort((a, b) => {
      if (a.rank === b.rank)
        return b.points - a.points;
      return a.rank - b.rank;
    });
  }
  async singleEliminationStandings(stage) {
    const grouped = [];
    const { group: groups, match: matches, participant: participants } = await this.stageData(stage.id);
    const [singleBracket, finalGroup] = groups;
    const final = matches.filter((match) => match.group_id === singleBracket.id).pop();
    if (!final)
      throw Error("Final not found.");
    grouped[0] = [findParticipant(participants, getFinalWinnerIfDefined(final))];
    const losers = getLosers(participants, matches.filter((match) => match.group_id === singleBracket.id));
    grouped.push(...losers.reverse());
    if (stage.settings?.consolationFinal) {
      const consolationFinal = matches.filter((match) => match.group_id === finalGroup.id).pop();
      if (!consolationFinal)
        throw Error("Consolation final not found.");
      const consolationFinalWinner = findParticipant(participants, getFinalWinnerIfDefined(consolationFinal));
      const consolationFinalLoser = findParticipant(participants, getLoser(consolationFinal));
      grouped.splice(2, 1, [consolationFinalWinner], [consolationFinalLoser]);
    }
    return makeFinalStandings(grouped);
  }
  async doubleEliminationStandings(stage) {
    const grouped = [];
    const { group: groups, match: matches, participant: participants } = await this.stageData(stage.id);
    const [winnerBracket, loserBracket, finalGroup] = groups;
    if (stage.settings?.grandFinal === "none") {
      const finalWB = matches.filter((match) => match.group_id === winnerBracket.id).pop();
      if (!finalWB)
        throw Error("WB final not found.");
      const finalLB = matches.filter((match) => match.group_id === loserBracket.id).pop();
      if (!finalLB)
        throw Error("LB final not found.");
      grouped[0] = [findParticipant(participants, getFinalWinnerIfDefined(finalWB))];
      grouped[1] = [findParticipant(participants, getFinalWinnerIfDefined(finalLB))];
    } else {
      const grandFinalMatches = matches.filter((match) => match.group_id === finalGroup.id);
      const decisiveMatch = getGrandFinalDecisiveMatch(stage.settings?.grandFinal || "none", grandFinalMatches);
      grouped[0] = [findParticipant(participants, getFinalWinnerIfDefined(decisiveMatch))];
      grouped[1] = [findParticipant(participants, getLoser(decisiveMatch))];
    }
    const losers = getLosers(participants, matches.filter((match) => match.group_id === loserBracket.id));
    grouped.push(...losers.reverse());
    return makeFinalStandings(grouped);
  }
  async getStageSpecificData(stageId) {
    const groups = await this.storage.select("group", { stage_id: stageId });
    if (!groups)
      throw Error("Error getting groups.");
    const rounds = await this.storage.select("round", { stage_id: stageId });
    if (!rounds)
      throw Error("Error getting rounds.");
    const matches = await this.storage.select("match", { stage_id: stageId });
    if (!matches)
      throw Error("Error getting matches.");
    const matchGames = await this.matchGames(matches);
    return {
      groups,
      rounds,
      matches,
      matchGames
    };
  }
}
var getFinalWinnerIfDefined = (match) => {
  const winner = getWinner(match);
  if (!winner)
    throw Error("The final match does not have a winner.");
  return winner;
};

// src/brackets-manager/base/updater.ts
class BaseUpdater extends BaseGetter {
  async updateSeeding(stageId, { seeding, seedingIds }, keepSameSize) {
    const stage = await this.storage.select("stage", stageId);
    if (!stage)
      throw Error("Stage not found.");
    const newSize = keepSameSize ? stage.settings.size : (seedingIds || seeding)?.length ?? 0;
    const creator = new StageCreator(this.storage, {
      name: stage.name,
      tournamentId: stage.tournament_id,
      type: stage.type,
      settings: {
        ...stage.settings,
        ...newSize === 0 ? {} : { size: newSize }
      },
      ...seedingIds ? { seedingIds } : { seeding: seeding ?? undefined }
    });
    creator.setExisting(stageId, false);
    const method = BaseGetter.getSeedingOrdering(stage.type, creator);
    const slots = await creator.getSlots();
    const matches = await this.getSeedingMatches(stage.id, stage.type);
    if (!matches)
      throw Error("Error getting matches associated to the seeding.");
    const ordered = ordering[method](slots);
    BaseUpdater.assertCanUpdateSeeding(matches, ordered);
    await creator.run();
  }
  async confirmCurrentSeeding(stageId) {
    const stage = await this.storage.select("stage", stageId);
    if (!stage)
      throw Error("Stage not found.");
    const get = new Get(this.storage);
    const currentSeeding = await get.seeding(stageId);
    const newSeeding = convertSlotsToSeeding(currentSeeding.map(convertTBDtoBYE));
    const creator = new StageCreator(this.storage, {
      name: stage.name,
      tournamentId: stage.tournament_id,
      type: stage.type,
      settings: stage.settings,
      seeding: newSeeding
    });
    creator.setExisting(stageId, true);
    await creator.run();
  }
  async updateParentMatch(parentId, inRoundRobin) {
    const storedParent = await this.storage.select("match", parentId);
    if (!storedParent)
      throw Error("Parent not found.");
    const games = await this.storage.select("match_game", { parent_id: parentId });
    if (!games)
      throw Error("No match games.");
    const parentScores = getChildGamesResults(games);
    const parent = getParentMatchResults(storedParent, parentScores);
    setParentMatchCompleted(parent, storedParent.child_count, inRoundRobin);
    await this.updateMatch(storedParent, parent, true);
  }
  static assertCanUpdateSeeding(matches, slots) {
    let index = 0;
    for (const match of matches) {
      if (match.status === 5 /* Archived */)
        throw Error("A match of round 1 is archived, which means round 2 was started.");
      const opponent1 = slots[index++];
      const opponent2 = slots[index++];
      const isParticipantLocked = isMatchParticipantLocked(match);
      if (isParticipantLocked && (match.opponent1?.id !== opponent1?.id || match.opponent2?.id !== opponent2?.id))
        throw Error("A match is locked.");
    }
  }
  async updateRelatedMatches(match, updatePrevious, updateNext) {
    if (match.round_id === undefined)
      return;
    const { roundNumber, roundCount } = await this.getRoundPositionalInfo(match.round_id);
    const stage = await this.storage.select("stage", match.stage_id);
    if (!stage)
      throw Error("Stage not found.");
    const group = await this.storage.select("group", match.group_id);
    if (!group)
      throw Error("Group not found.");
    const matchLocation = getMatchLocation(stage.type, group.number);
    updatePrevious && await this.updatePrevious(match, matchLocation, stage, roundNumber);
    updateNext && await this.updateNext(match, matchLocation, stage, roundNumber, roundCount);
  }
  async updateMatch(stored, match, force) {
    if (!force && isMatchUpdateLocked(stored))
      throw Error("The match is locked.");
    const stage = await this.storage.select("stage", stored.stage_id);
    if (!stage)
      throw Error("Stage not found.");
    const inRoundRobin = isRoundRobin(stage);
    const { statusChanged, resultChanged } = setMatchResults(stored, match, inRoundRobin);
    await this.applyMatchUpdate(stored);
    if (!statusChanged && !resultChanged)
      return;
    if (!isRoundRobin(stage))
      await this.updateRelatedMatches(stored, statusChanged, resultChanged);
  }
  async updateMatchGame(stored, game) {
    if (isMatchUpdateLocked(stored))
      throw Error("The match game is locked.");
    const stage = await this.storage.select("stage", stored.stage_id);
    if (!stage)
      throw Error("Stage not found.");
    const inRoundRobin = isRoundRobin(stage);
    setMatchResults(stored, game, inRoundRobin);
    if (!await this.storage.update("match_game", stored.id, stored))
      throw Error("Could not update the match game.");
    await this.updateParentMatch(stored.parent_id, inRoundRobin);
  }
  async applyMatchUpdate(match) {
    if (!await this.storage.update("match", match.id, match))
      throw Error("Could not update the match.");
    if (match.child_count === 0)
      return;
    const updatedMatchGame = {
      opponent1: toResult(match.opponent1),
      opponent2: toResult(match.opponent2)
    };
    if (match.status <= 2 /* Ready */ || match.status === 5 /* Archived */)
      updatedMatchGame.status = match.status;
    if (!await this.storage.update("match_game", { parent_id: match.id }, updatedMatchGame))
      throw Error("Could not update the match game.");
  }
  async updatePrevious(match, matchLocation, stage, roundNumber) {
    const previousMatches = await this.getPreviousMatches(match, matchLocation, stage, roundNumber);
    if (previousMatches.length === 0)
      return;
    if (match.status >= 3 /* Running */)
      await this.archiveMatches(previousMatches);
    else
      await this.resetMatchesStatus(previousMatches);
  }
  async archiveMatches(matches) {
    for (const match of matches) {
      if (match.status === 5 /* Archived */)
        continue;
      match.status = 5 /* Archived */;
      await this.applyMatchUpdate(match);
    }
  }
  async resetMatchesStatus(matches) {
    for (const match of matches) {
      match.status = getMatchStatus(match);
      await this.applyMatchUpdate(match);
    }
  }
  async updateNext(match, matchLocation, stage, roundNumber, roundCount) {
    const nextMatches = await this.getNextMatches(match, matchLocation, stage, roundNumber, roundCount);
    if (nextMatches.length === 0) {
      if (match.status === 4 /* Completed */)
        await this.archiveMatches([match]);
      return;
    }
    const winnerSide = getMatchResult(match);
    const actualRoundNumber = stage.settings.skipFirstRound && matchLocation === "winner_bracket" ? roundNumber + 1 : roundNumber;
    if (winnerSide)
      await this.applyToNextMatches(setNextOpponent, match, matchLocation, actualRoundNumber, roundCount, nextMatches, winnerSide);
    else
      await this.applyToNextMatches(resetNextOpponent, match, matchLocation, actualRoundNumber, roundCount, nextMatches);
  }
  async applyToNextMatches(setNextOpponent2, match, matchLocation, roundNumber, roundCount, nextMatches, winnerSide) {
    if (matchLocation === "final_group") {
      if (!nextMatches[0])
        throw Error("First next match is null.");
      setNextOpponent2(nextMatches[0], "opponent1", match, "opponent1");
      setNextOpponent2(nextMatches[0], "opponent2", match, "opponent2");
      await this.applyMatchUpdate(nextMatches[0]);
      return;
    }
    const nextSide = getNextSide(match.number, roundNumber, roundCount, matchLocation);
    if (nextMatches[0]) {
      setNextOpponent2(nextMatches[0], nextSide, match, winnerSide);
      await this.propagateByeWinners(nextMatches[0]);
    }
    if (nextMatches.length !== 2)
      return;
    if (!nextMatches[1])
      throw Error("Second next match is null.");
    if (matchLocation === "single_bracket") {
      setNextOpponent2(nextMatches[1], nextSide, match, winnerSide && getOtherSide(winnerSide));
      await this.applyMatchUpdate(nextMatches[1]);
    } else if (matchLocation === "winner_bracket") {
      const nextSideIntoLB = getNextSideLoserBracket(match.number, nextMatches[1], roundNumber);
      setNextOpponent2(nextMatches[1], nextSideIntoLB, match, winnerSide && getOtherSide(winnerSide));
      await this.propagateByeWinners(nextMatches[1]);
    } else if (matchLocation === "loser_bracket") {
      const nextSideIntoConsolationFinal = getNextSideConsolationFinalDoubleElimination(roundNumber);
      setNextOpponent2(nextMatches[1], nextSideIntoConsolationFinal, match, winnerSide && getOtherSide(winnerSide));
      await this.propagateByeWinners(nextMatches[1]);
    }
  }
  async propagateByeWinners(match) {
    setMatchResults(match, match, false);
    await this.applyMatchUpdate(match);
    if (hasBye(match))
      await this.updateRelatedMatches(match, true, true);
  }
}

// src/brackets-manager/update.ts
class Update extends BaseUpdater {
  async match(match) {
    if (match.id === undefined)
      throw Error("No match id given.");
    const stored = await this.storage.select("match", match.id);
    if (!stored)
      throw Error("Match not found.");
    await this.updateMatch(stored, match);
  }
  async matchGame(game) {
    const stored = await this.findMatchGame(game);
    await this.updateMatchGame(stored, game);
  }
  async ordering(stageId, seedOrdering) {
    const stage = await this.storage.select("stage", stageId);
    if (!stage)
      throw Error("Stage not found.");
    ensureNotRoundRobin(stage);
    const roundsToOrder = await this.getOrderedRounds(stage);
    if (seedOrdering.length !== roundsToOrder.length)
      throw Error("The count of seed orderings is incorrect.");
    for (let i = 0;i < roundsToOrder.length; i++)
      await this.updateRoundOrdering(roundsToOrder[i], seedOrdering[i]);
  }
  async roundOrdering(roundId, method) {
    const round = await this.storage.select("round", roundId);
    if (!round)
      throw Error("This round does not exist.");
    const stage = await this.storage.select("stage", round.stage_id);
    if (!stage)
      throw Error("Stage not found.");
    ensureNotRoundRobin(stage);
    await this.updateRoundOrdering(round, method);
  }
  async matchChildCount(level, id, childCount) {
    switch (level) {
      case "stage":
        await this.updateStageMatchChildCount(id, childCount);
        break;
      case "group":
        await this.updateGroupMatchChildCount(id, childCount);
        break;
      case "round":
        await this.updateRoundMatchChildCount(id, childCount);
        break;
      case "match":
        const match = await this.storage.select("match", id);
        if (!match)
          throw Error("Match not found.");
        await this.adjustMatchChildGames(match, childCount);
        break;
      default:
        throw Error("Unknown child count level.");
    }
  }
  async seeding(stageId, seeding, keepSameSize = false) {
    await this.updateSeeding(stageId, { seeding }, keepSameSize);
  }
  async seedingIds(stageId, seedingIds, keepSameSize = false) {
    await this.updateSeeding(stageId, { seedingIds }, keepSameSize);
  }
  async confirmSeeding(stageId) {
    await this.confirmCurrentSeeding(stageId);
  }
  async updateRoundOrdering(round, method) {
    const matches = await this.storage.select("match", { round_id: round.id });
    if (!matches)
      throw Error("This round has no match.");
    if (matches.some((match) => match.status > 2 /* Ready */))
      throw Error("At least one match has started or is completed.");
    const stage = await this.storage.select("stage", round.stage_id);
    if (!stage)
      throw Error("Stage not found.");
    if (stage.settings.size === undefined)
      throw Error("Undefined stage size.");
    const group = await this.storage.select("group", round.group_id);
    if (!group)
      throw Error("Group not found.");
    const inLoserBracket = isLoserBracket(stage.type, group.number);
    const roundCountLB = getLowerBracketRoundCount(stage.settings.size);
    const seeds = getSeeds(inLoserBracket, round.number, roundCountLB, matches.length);
    const positions = ordering[method](seeds);
    await this.applyRoundOrdering(round.number, matches, positions);
  }
  async updateStageMatchChildCount(stageId, childCount) {
    if (!await this.storage.update("match", { stage_id: stageId }, { child_count: childCount }))
      throw Error("Could not update the match.");
    const matches = await this.storage.select("match", { stage_id: stageId });
    if (!matches)
      throw Error("This stage has no match.");
    for (const match of matches)
      await this.adjustMatchChildGames(match, childCount);
  }
  async updateGroupMatchChildCount(groupId, childCount) {
    if (!await this.storage.update("match", { group_id: groupId }, { child_count: childCount }))
      throw Error("Could not update the match.");
    const matches = await this.storage.select("match", { group_id: groupId });
    if (!matches)
      throw Error("This group has no match.");
    for (const match of matches)
      await this.adjustMatchChildGames(match, childCount);
  }
  async updateRoundMatchChildCount(roundId, childCount) {
    if (!await this.storage.update("match", { round_id: roundId }, { child_count: childCount }))
      throw Error("Could not update the match.");
    const matches = await this.storage.select("match", { round_id: roundId });
    if (!matches)
      throw Error("This round has no match.");
    for (const match of matches)
      await this.adjustMatchChildGames(match, childCount);
  }
  async applyRoundOrdering(roundNumber, matches, positions) {
    for (const match of matches) {
      const updated = { ...match };
      updated.opponent1 = findPosition(matches, positions.shift());
      if (roundNumber === 1)
        updated.opponent2 = findPosition(matches, positions.shift());
      if (!await this.storage.update("match", updated.id, updated))
        throw Error("Could not update the match.");
    }
  }
  async adjustMatchChildGames(match, targetChildCount) {
    const games = await this.storage.select("match_game", { parent_id: match.id });
    let childCount = games ? games.length : 0;
    while (childCount < targetChildCount) {
      const id = await this.storage.insert("match_game", {
        number: childCount + 1,
        stage_id: match.stage_id,
        parent_id: match.id,
        status: match.status,
        opponent1: { id: null },
        opponent2: { id: null }
      });
      if (id === -1)
        throw Error("Could not adjust the match games when inserting.");
      childCount++;
    }
    while (childCount > targetChildCount) {
      const deleted = await this.storage.delete("match_game", {
        parent_id: match.id,
        number: childCount
      });
      if (!deleted)
        throw Error("Could not adjust the match games when deleting.");
      childCount--;
    }
    if (!await this.storage.update("match", match.id, { ...match, child_count: targetChildCount }))
      throw Error("Could not update the match.");
  }
}

// src/brackets-manager/delete.ts
class Delete {
  storage;
  constructor(storage2) {
    this.storage = storage2;
  }
  async stage(stageId) {
    if (!await this.storage.delete("match_game", { stage_id: stageId }))
      throw Error("Could not delete match games.");
    if (!await this.storage.delete("match", { stage_id: stageId }))
      throw Error("Could not delete matches.");
    if (!await this.storage.delete("round", { stage_id: stageId }))
      throw Error("Could not delete rounds.");
    if (!await this.storage.delete("group", { stage_id: stageId }))
      throw Error("Could not delete groups.");
    if (!await this.storage.delete("stage", { id: stageId }))
      throw Error("Could not delete the stage.");
  }
  async tournament(tournamentId) {
    const stages = await this.storage.select("stage", { tournament_id: tournamentId });
    if (!stages)
      throw Error("Error getting the stages.");
    for (const stage of stages)
      await this.stage(stage.id);
  }
}

// src/brackets-manager/find.ts
class Find extends BaseGetter {
  async upperBracket(stageId) {
    const stage = await this.storage.select("stage", stageId);
    if (!stage)
      throw Error("Stage not found.");
    switch (stage.type) {
      case "round_robin":
        throw Error("Round-robin stages do not have an upper bracket.");
      case "single_elimination":
      case "double_elimination":
        return this.getUpperBracket(stageId);
      default:
        throw Error("Unknown stage type.");
    }
  }
  async loserBracket(stageId) {
    const stage = await this.storage.select("stage", stageId);
    if (!stage)
      throw Error("Stage not found.");
    switch (stage.type) {
      case "round_robin":
        throw Error("Round-robin stages do not have a loser bracket.");
      case "single_elimination":
        throw Error("Single elimination stages do not have a loser bracket.");
      case "double_elimination":
        const group = await this.getLoserBracket(stageId);
        if (!group)
          throw Error("Loser bracket not found.");
        return group;
      default:
        throw Error("Unknown stage type.");
    }
  }
  async previousMatches(matchId, participantId) {
    const match = await this.storage.select("match", matchId);
    if (!match)
      throw Error("Match not found.");
    const stage = await this.storage.select("stage", match.stage_id);
    if (!stage)
      throw Error("Stage not found.");
    const group = await this.storage.select("group", match.group_id);
    if (!group)
      throw Error("Group not found.");
    const round = await this.storage.select("round", match.round_id);
    if (!round)
      throw Error("Round not found.");
    const matchLocation = getMatchLocation(stage.type, group.number);
    const previousMatches = await this.getPreviousMatches(match, matchLocation, stage, round.number);
    if (participantId !== undefined)
      return previousMatches.filter((m) => isParticipantInMatch(m, participantId));
    return previousMatches;
  }
  async nextMatches(matchId, participantId) {
    const match = await this.storage.select("match", matchId);
    if (!match)
      throw Error("Match not found.");
    const stage = await this.storage.select("stage", match.stage_id);
    if (!stage)
      throw Error("Stage not found.");
    const group = await this.storage.select("group", match.group_id);
    if (!group)
      throw Error("Group not found.");
    const { roundNumber, roundCount } = await this.getRoundPositionalInfo(match.round_id);
    const matchLocation = getMatchLocation(stage.type, group.number);
    const nextMatches = getNonNull(await this.getNextMatches(match, matchLocation, stage, roundNumber, roundCount));
    if (participantId !== undefined) {
      if (!isParticipantInMatch(match, participantId))
        throw Error("The participant does not belong to this match.");
      if (!isMatchStale(match))
        throw Error("The match is not stale yet, so it is not possible to conclude the next matches for this participant.");
      const loser = getLoser(match);
      if (stage.type === "single_elimination" && loser?.id === participantId)
        return [];
      if (stage.type === "double_elimination") {
        const { winnerBracketMatch, loserBracketMatch, finalGroupMatch } = await this.getMatchesByGroupDoubleElimination(nextMatches, new Map([[group.id, group]]));
        const winner = getWinner(match);
        if (matchLocation === "loser_bracket") {
          if (participantId === loser?.id)
            return [];
          if (participantId === winner?.id)
            return loserBracketMatch ? [loserBracketMatch] : [];
        } else if (matchLocation === "winner_bracket") {
          if (!loserBracketMatch)
            throw Error("All matches of winner bracket should lead to loser bracket.");
          if (participantId === loser?.id)
            return [loserBracketMatch];
          if (participantId === winner?.id)
            return winnerBracketMatch ? [winnerBracketMatch] : [];
        } else if (matchLocation === "final_group") {
          if (!finalGroupMatch)
            throw Error("All matches of a final group should also lead to the final group.");
          return [finalGroupMatch];
        }
      }
    }
    return nextMatches;
  }
  async match(groupId, roundNumber, matchNumber) {
    return this.findMatch(groupId, roundNumber, matchNumber);
  }
  async matchGame(game) {
    return this.findMatchGame(game);
  }
  async getMatchesByGroupDoubleElimination(matches, fetchedGroups) {
    const getGroup = async (groupId) => {
      const existing = fetchedGroups.get(groupId);
      if (existing)
        return existing;
      const group = await this.storage.select("group", groupId);
      if (!group)
        throw Error("Group not found.");
      fetchedGroups.set(groupId, group);
      return group;
    };
    let matchByGroupType = {};
    for (const match of matches) {
      const group = await getGroup(match.group_id);
      matchByGroupType = {
        winnerBracketMatch: matchByGroupType["winnerBracketMatch"] ?? (isWinnerBracket("double_elimination", group.number) ? match : undefined),
        loserBracketMatch: matchByGroupType["loserBracketMatch"] ?? (isLoserBracket("double_elimination", group.number) ? match : undefined),
        finalGroupMatch: matchByGroupType["finalGroupMatch"] ?? (isFinalGroup("double_elimination", group.number) ? match : undefined)
      };
    }
    return matchByGroupType;
  }
}

// src/brackets-manager/reset.ts
class Reset extends BaseUpdater {
  async matchResults(matchId) {
    const stored = await this.storage.select("match", matchId);
    if (!stored)
      throw Error("Match not found.");
    if (!isMatchForfeitCompleted(stored) && stored.child_count > 0)
      throw Error("The parent match is controlled by its child games and its result cannot be reset.");
    const stage = await this.storage.select("stage", stored.stage_id);
    if (!stage)
      throw Error("Stage not found.");
    const group = await this.storage.select("group", stored.group_id);
    if (!group)
      throw Error("Group not found.");
    const { roundNumber, roundCount } = await this.getRoundPositionalInfo(stored.round_id);
    const matchLocation = getMatchLocation(stage.type, group.number);
    const nextMatches = await this.getNextMatches(stored, matchLocation, stage, roundNumber, roundCount);
    if (nextMatches.some((match) => match && match.status >= 3 /* Running */ && !isMatchByeCompleted(match)))
      throw Error("The match is locked.");
    resetMatchResults(stored);
    await this.applyMatchUpdate(stored);
    if (!isRoundRobin(stage))
      await this.updateRelatedMatches(stored, true, true);
  }
  async matchGameResults(gameId) {
    const stored = await this.storage.select("match_game", gameId);
    if (!stored)
      throw Error("Match game not found.");
    const stage = await this.storage.select("stage", stored.stage_id);
    if (!stage)
      throw Error("Stage not found.");
    const inRoundRobin = isRoundRobin(stage);
    resetMatchResults(stored);
    if (!await this.storage.update("match_game", stored.id, stored))
      throw Error("Could not update the match game.");
    await this.updateParentMatch(stored.parent_id, inRoundRobin);
  }
  async seeding(stageId) {
    await this.updateSeeding(stageId, { seeding: null }, false);
  }
}

// src/brackets-manager/manager.ts
class BracketsManager {
  verbose = false;
  storage;
  get;
  update;
  delete;
  find;
  reset;
  create;
  constructor(storageInterface, verbose) {
    this.verbose = verbose ?? false;
    this.storage = storageInterface;
    this.instrumentStorage();
    this.storage.selectFirst = async (table, filter, assertUnique = true) => {
      const results = await this.storage.select(table, filter);
      if (!results || results.length === 0)
        return null;
      if (assertUnique && results.length > 1)
        throw Error(`Selecting ${JSON.stringify(filter)} on table "${table}" must return a unique value.`);
      return results[0] ?? null;
    };
    this.storage.selectLast = async (table, filter, assertUnique = true) => {
      const results = await this.storage.select(table, filter);
      if (!results || results.length === 0)
        return null;
      if (assertUnique && results.length > 1)
        throw Error(`Selecting ${JSON.stringify(filter)} on table "${table}" must return a unique value.`);
      return results[results.length - 1] ?? null;
    };
    const create = new Create(this.storage);
    const createStageFunction = create.stage.bind(this);
    this.create = Object.assign(createStageFunction, {
      stage: createStageFunction
    });
    this.get = new Get(this.storage);
    this.update = new Update(this.storage);
    this.delete = new Delete(this.storage);
    this.find = new Find(this.storage);
    this.reset = new Reset(this.storage);
  }
  async import(data, normalizeIds2 = false) {
    if (normalizeIds2)
      data = normalizeIds(data);
    if (!await this.storage.delete("participant"))
      throw Error("Could not empty the participant table.");
    if (!await this.storage.insert("participant", data.participant))
      throw Error("Could not import participants.");
    if (!await this.storage.delete("stage"))
      throw Error("Could not empty the stage table.");
    if (!await this.storage.insert("stage", data.stage))
      throw Error("Could not import stages.");
    if (!await this.storage.delete("group"))
      throw Error("Could not empty the group table.");
    if (!await this.storage.insert("group", data.group))
      throw Error("Could not import groups.");
    if (!await this.storage.delete("round"))
      throw Error("Could not empty the round table.");
    if (!await this.storage.insert("round", data.round))
      throw Error("Could not import rounds.");
    if (!await this.storage.delete("match"))
      throw Error("Could not empty the match table.");
    if (!await this.storage.insert("match", data.match))
      throw Error("Could not import matches.");
    if (!await this.storage.delete("match_game"))
      throw Error("Could not empty the match_game table.");
    if (!await this.storage.insert("match_game", data.match_game))
      throw Error("Could not import match games.");
  }
  async export() {
    const participants = await this.storage.select("participant");
    if (!participants)
      throw Error("Error getting participants.");
    const stages = await this.storage.select("stage");
    if (!stages)
      throw Error("Error getting stages.");
    const groups = await this.storage.select("group");
    if (!groups)
      throw Error("Error getting groups.");
    const rounds = await this.storage.select("round");
    if (!rounds)
      throw Error("Error getting rounds.");
    const matches = await this.storage.select("match");
    if (!matches)
      throw Error("Error getting matches.");
    const matchGames = await this.get.matchGames(matches);
    return {
      participant: participants,
      stage: stages,
      group: groups,
      round: rounds,
      match: matches,
      match_game: matchGames
    };
  }
  instrumentStorage() {
    const storage2 = this.storage;
    const instrumentedMethods = [
      "insert",
      "select",
      "update",
      "delete"
    ];
    for (const method of Object.getOwnPropertyNames(Object.getPrototypeOf(storage2))) {
      if (!instrumentedMethods.includes(method))
        continue;
      const originalMethod = storage2[method].bind(storage2);
      storage2[method] = async (table, ...args) => {
        const verbose = this.verbose;
        let id;
        let start;
        if (verbose) {
          id = crypto.randomUUID();
          start = Date.now();
          console.log(`${id} ${method.toUpperCase()} "${table}" args: ${JSON.stringify(args)}`);
        }
        const result = await originalMethod(table, ...args);
        if (verbose) {
          const duration = Date.now() - start;
          console.log(`${id} ${duration}ms - Returned ${JSON.stringify(result)}`);
        }
        return result;
      };
    }
  }
}
// ../../../../node_modules/@babel/runtime/helpers/esm/typeof.js
function _typeof(o) {
  "@babel/helpers - typeof";
  return _typeof = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(o2) {
    return typeof o2;
  } : function(o2) {
    return o2 && typeof Symbol == "function" && o2.constructor === Symbol && o2 !== Symbol.prototype ? "symbol" : typeof o2;
  }, _typeof(o);
}

// ../../../../node_modules/@babel/runtime/helpers/esm/classCallCheck.js
function _classCallCheck(a, n) {
  if (!(a instanceof n))
    throw new TypeError("Cannot call a class as a function");
}

// ../../../../node_modules/@babel/runtime/helpers/esm/toPrimitive.js
function toPrimitive(t, r) {
  if (_typeof(t) != "object" || !t)
    return t;
  var e = t[Symbol.toPrimitive];
  if (e !== undefined) {
    var i = e.call(t, r || "default");
    if (_typeof(i) != "object")
      return i;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return (r === "string" ? String : Number)(t);
}

// ../../../../node_modules/@babel/runtime/helpers/esm/toPropertyKey.js
function toPropertyKey(t) {
  var i = toPrimitive(t, "string");
  return _typeof(i) == "symbol" ? i : i + "";
}

// ../../../../node_modules/@babel/runtime/helpers/esm/createClass.js
function _defineProperties(e, r) {
  for (var t = 0;t < r.length; t++) {
    var o = r[t];
    o.enumerable = o.enumerable || false, o.configurable = true, "value" in o && (o.writable = true), Object.defineProperty(e, toPropertyKey(o.key), o);
  }
}
function _createClass(e, r, t) {
  return r && _defineProperties(e.prototype, r), t && _defineProperties(e, t), Object.defineProperty(e, "prototype", {
    writable: false
  }), e;
}

// ../../../../node_modules/@babel/runtime/helpers/esm/assertThisInitialized.js
function _assertThisInitialized(e) {
  if (e === undefined)
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  return e;
}

// ../../../../node_modules/@babel/runtime/helpers/esm/setPrototypeOf.js
function _setPrototypeOf(t, e) {
  return _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(t2, e2) {
    return t2.__proto__ = e2, t2;
  }, _setPrototypeOf(t, e);
}

// ../../../../node_modules/@babel/runtime/helpers/esm/inherits.js
function _inherits(t, e) {
  if (typeof e != "function" && e !== null)
    throw new TypeError("Super expression must either be null or a function");
  t.prototype = Object.create(e && e.prototype, {
    constructor: {
      value: t,
      writable: true,
      configurable: true
    }
  }), Object.defineProperty(t, "prototype", {
    writable: false
  }), e && _setPrototypeOf(t, e);
}

// ../../../../node_modules/@babel/runtime/helpers/esm/possibleConstructorReturn.js
function _possibleConstructorReturn(t, e) {
  if (e && (_typeof(e) == "object" || typeof e == "function"))
    return e;
  if (e !== undefined)
    throw new TypeError("Derived constructors may only return object or undefined");
  return _assertThisInitialized(t);
}

// ../../../../node_modules/@babel/runtime/helpers/esm/getPrototypeOf.js
function _getPrototypeOf(t) {
  return _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function(t2) {
    return t2.__proto__ || Object.getPrototypeOf(t2);
  }, _getPrototypeOf(t);
}

// ../../../../node_modules/@babel/runtime/helpers/esm/defineProperty.js
function _defineProperty(e, r, t) {
  return (r = toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
    value: t,
    enumerable: true,
    configurable: true,
    writable: true
  }) : e[r] = t, e;
}

// ../../../../node_modules/@babel/runtime/helpers/esm/arrayWithHoles.js
function _arrayWithHoles(r) {
  if (Array.isArray(r))
    return r;
}

// ../../../../node_modules/@babel/runtime/helpers/esm/iterableToArray.js
function _iterableToArray(r) {
  if (typeof Symbol != "undefined" && r[Symbol.iterator] != null || r["@@iterator"] != null)
    return Array.from(r);
}

// ../../../../node_modules/@babel/runtime/helpers/esm/arrayLikeToArray.js
function _arrayLikeToArray(r, a) {
  (a == null || a > r.length) && (a = r.length);
  for (var e = 0, n = Array(a);e < a; e++)
    n[e] = r[e];
  return n;
}

// ../../../../node_modules/@babel/runtime/helpers/esm/unsupportedIterableToArray.js
function _unsupportedIterableToArray(r, a) {
  if (r) {
    if (typeof r == "string")
      return _arrayLikeToArray(r, a);
    var t = {}.toString.call(r).slice(8, -1);
    return t === "Object" && r.constructor && (t = r.constructor.name), t === "Map" || t === "Set" ? Array.from(r) : t === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : undefined;
  }
}

// ../../../../node_modules/@babel/runtime/helpers/esm/nonIterableRest.js
function _nonIterableRest() {
  throw new TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
}

// ../../../../node_modules/@babel/runtime/helpers/esm/toArray.js
function _toArray(r) {
  return _arrayWithHoles(r) || _iterableToArray(r) || _unsupportedIterableToArray(r) || _nonIterableRest();
}

// ../../../../node_modules/i18next/dist/esm/i18next.js
function ownKeys(object, enumerableOnly) {
  var keys = Object.keys(object);
  if (Object.getOwnPropertySymbols) {
    var symbols = Object.getOwnPropertySymbols(object);
    if (enumerableOnly) {
      symbols = symbols.filter(function(sym) {
        return Object.getOwnPropertyDescriptor(object, sym).enumerable;
      });
    }
    keys.push.apply(keys, symbols);
  }
  return keys;
}
function _objectSpread(target) {
  for (var i = 1;i < arguments.length; i++) {
    var source = arguments[i] != null ? arguments[i] : {};
    if (i % 2) {
      ownKeys(Object(source), true).forEach(function(key) {
        _defineProperty(target, key, source[key]);
      });
    } else if (Object.getOwnPropertyDescriptors) {
      Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    } else {
      ownKeys(Object(source)).forEach(function(key) {
        Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
      });
    }
  }
  return target;
}
var consoleLogger = {
  type: "logger",
  log: function log(args) {
    this.output("log", args);
  },
  warn: function warn(args) {
    this.output("warn", args);
  },
  error: function error(args) {
    this.output("error", args);
  },
  output: function output(type, args) {
    if (console && console[type])
      console[type].apply(console, args);
  }
};
var Logger = function() {
  function Logger2(concreteLogger) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    _classCallCheck(this, Logger2);
    this.init(concreteLogger, options);
  }
  _createClass(Logger2, [{
    key: "init",
    value: function init(concreteLogger) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      this.prefix = options.prefix || "i18next:";
      this.logger = concreteLogger || consoleLogger;
      this.options = options;
      this.debug = options.debug;
    }
  }, {
    key: "setDebug",
    value: function setDebug(bool) {
      this.debug = bool;
    }
  }, {
    key: "log",
    value: function log2() {
      for (var _len = arguments.length, args = new Array(_len), _key = 0;_key < _len; _key++) {
        args[_key] = arguments[_key];
      }
      return this.forward(args, "log", "", true);
    }
  }, {
    key: "warn",
    value: function warn2() {
      for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0;_key2 < _len2; _key2++) {
        args[_key2] = arguments[_key2];
      }
      return this.forward(args, "warn", "", true);
    }
  }, {
    key: "error",
    value: function error2() {
      for (var _len3 = arguments.length, args = new Array(_len3), _key3 = 0;_key3 < _len3; _key3++) {
        args[_key3] = arguments[_key3];
      }
      return this.forward(args, "error", "");
    }
  }, {
    key: "deprecate",
    value: function deprecate() {
      for (var _len4 = arguments.length, args = new Array(_len4), _key4 = 0;_key4 < _len4; _key4++) {
        args[_key4] = arguments[_key4];
      }
      return this.forward(args, "warn", "WARNING DEPRECATED: ", true);
    }
  }, {
    key: "forward",
    value: function forward(args, lvl, prefix, debugOnly) {
      if (debugOnly && !this.debug)
        return null;
      if (typeof args[0] === "string")
        args[0] = "".concat(prefix).concat(this.prefix, " ").concat(args[0]);
      return this.logger[lvl](args);
    }
  }, {
    key: "create",
    value: function create(moduleName) {
      return new Logger2(this.logger, _objectSpread(_objectSpread({}, {
        prefix: "".concat(this.prefix, ":").concat(moduleName, ":")
      }), this.options));
    }
  }, {
    key: "clone",
    value: function clone(options) {
      options = options || this.options;
      options.prefix = options.prefix || this.prefix;
      return new Logger2(this.logger, options);
    }
  }]);
  return Logger2;
}();
var baseLogger = new Logger;
var EventEmitter = function() {
  function EventEmitter2() {
    _classCallCheck(this, EventEmitter2);
    this.observers = {};
  }
  _createClass(EventEmitter2, [{
    key: "on",
    value: function on(events, listener) {
      var _this = this;
      events.split(" ").forEach(function(event) {
        _this.observers[event] = _this.observers[event] || [];
        _this.observers[event].push(listener);
      });
      return this;
    }
  }, {
    key: "off",
    value: function off(event, listener) {
      if (!this.observers[event])
        return;
      if (!listener) {
        delete this.observers[event];
        return;
      }
      this.observers[event] = this.observers[event].filter(function(l) {
        return l !== listener;
      });
    }
  }, {
    key: "emit",
    value: function emit(event) {
      for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1;_key < _len; _key++) {
        args[_key - 1] = arguments[_key];
      }
      if (this.observers[event]) {
        var cloned = [].concat(this.observers[event]);
        cloned.forEach(function(observer) {
          observer.apply(undefined, args);
        });
      }
      if (this.observers["*"]) {
        var _cloned = [].concat(this.observers["*"]);
        _cloned.forEach(function(observer) {
          observer.apply(observer, [event].concat(args));
        });
      }
    }
  }]);
  return EventEmitter2;
}();
function defer() {
  var res;
  var rej;
  var promise = new Promise(function(resolve, reject) {
    res = resolve;
    rej = reject;
  });
  promise.resolve = res;
  promise.reject = rej;
  return promise;
}
function makeString(object) {
  if (object == null)
    return "";
  return "" + object;
}
function copy(a, s, t) {
  a.forEach(function(m) {
    if (s[m])
      t[m] = s[m];
  });
}
function getLastOfPath(object, path, Empty) {
  function cleanKey(key2) {
    return key2 && key2.indexOf("###") > -1 ? key2.replace(/###/g, ".") : key2;
  }
  function canNotTraverseDeeper() {
    return !object || typeof object === "string";
  }
  var stack = typeof path !== "string" ? [].concat(path) : path.split(".");
  while (stack.length > 1) {
    if (canNotTraverseDeeper())
      return {};
    var key = cleanKey(stack.shift());
    if (!object[key] && Empty)
      object[key] = new Empty;
    if (Object.prototype.hasOwnProperty.call(object, key)) {
      object = object[key];
    } else {
      object = {};
    }
  }
  if (canNotTraverseDeeper())
    return {};
  return {
    obj: object,
    k: cleanKey(stack.shift())
  };
}
function setPath(object, path, newValue) {
  var _getLastOfPath = getLastOfPath(object, path, Object), obj = _getLastOfPath.obj, k = _getLastOfPath.k;
  obj[k] = newValue;
}
function pushPath(object, path, newValue, concat) {
  var _getLastOfPath2 = getLastOfPath(object, path, Object), obj = _getLastOfPath2.obj, k = _getLastOfPath2.k;
  obj[k] = obj[k] || [];
  if (concat)
    obj[k] = obj[k].concat(newValue);
  if (!concat)
    obj[k].push(newValue);
}
function getPath(object, path) {
  var _getLastOfPath3 = getLastOfPath(object, path), obj = _getLastOfPath3.obj, k = _getLastOfPath3.k;
  if (!obj)
    return;
  return obj[k];
}
function getPathWithDefaults(data, defaultData, key) {
  var value = getPath(data, key);
  if (value !== undefined) {
    return value;
  }
  return getPath(defaultData, key);
}
function deepExtend(target, source, overwrite) {
  for (var prop in source) {
    if (prop !== "__proto__" && prop !== "constructor") {
      if (prop in target) {
        if (typeof target[prop] === "string" || target[prop] instanceof String || typeof source[prop] === "string" || source[prop] instanceof String) {
          if (overwrite)
            target[prop] = source[prop];
        } else {
          deepExtend(target[prop], source[prop], overwrite);
        }
      } else {
        target[prop] = source[prop];
      }
    }
  }
  return target;
}
function regexEscape(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}
var _entityMap = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
  "/": "&#x2F;"
};
function escape(data) {
  if (typeof data === "string") {
    return data.replace(/[&<>"'\/]/g, function(s) {
      return _entityMap[s];
    });
  }
  return data;
}
var isIE10 = typeof window !== "undefined" && window.navigator && typeof window.navigator.userAgentData === "undefined" && window.navigator.userAgent && window.navigator.userAgent.indexOf("MSIE") > -1;
var chars = [" ", ",", "?", "!", ";"];
function looksLikeObjectPath(key, nsSeparator, keySeparator) {
  nsSeparator = nsSeparator || "";
  keySeparator = keySeparator || "";
  var possibleChars = chars.filter(function(c) {
    return nsSeparator.indexOf(c) < 0 && keySeparator.indexOf(c) < 0;
  });
  if (possibleChars.length === 0)
    return true;
  var r = new RegExp("(".concat(possibleChars.map(function(c) {
    return c === "?" ? "\\?" : c;
  }).join("|"), ")"));
  var matched = !r.test(key);
  if (!matched) {
    var ki = key.indexOf(keySeparator);
    if (ki > 0 && !r.test(key.substring(0, ki))) {
      matched = true;
    }
  }
  return matched;
}
function ownKeys$1(object, enumerableOnly) {
  var keys = Object.keys(object);
  if (Object.getOwnPropertySymbols) {
    var symbols = Object.getOwnPropertySymbols(object);
    if (enumerableOnly) {
      symbols = symbols.filter(function(sym) {
        return Object.getOwnPropertyDescriptor(object, sym).enumerable;
      });
    }
    keys.push.apply(keys, symbols);
  }
  return keys;
}
function _objectSpread$1(target) {
  for (var i = 1;i < arguments.length; i++) {
    var source = arguments[i] != null ? arguments[i] : {};
    if (i % 2) {
      ownKeys$1(Object(source), true).forEach(function(key) {
        _defineProperty(target, key, source[key]);
      });
    } else if (Object.getOwnPropertyDescriptors) {
      Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    } else {
      ownKeys$1(Object(source)).forEach(function(key) {
        Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
      });
    }
  }
  return target;
}
function _createSuper(Derived) {
  var hasNativeReflectConstruct = _isNativeReflectConstruct();
  return function _createSuperInternal() {
    var Super = _getPrototypeOf(Derived), result;
    if (hasNativeReflectConstruct) {
      var NewTarget = _getPrototypeOf(this).constructor;
      result = Reflect.construct(Super, arguments, NewTarget);
    } else {
      result = Super.apply(this, arguments);
    }
    return _possibleConstructorReturn(this, result);
  };
}
function _isNativeReflectConstruct() {
  if (typeof Reflect === "undefined" || !Reflect.construct)
    return false;
  if (Reflect.construct.sham)
    return false;
  if (typeof Proxy === "function")
    return true;
  try {
    Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {}));
    return true;
  } catch (e) {
    return false;
  }
}
function deepFind(obj, path) {
  var keySeparator = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : ".";
  if (!obj)
    return;
  if (obj[path])
    return obj[path];
  var paths = path.split(keySeparator);
  var current = obj;
  for (var i = 0;i < paths.length; ++i) {
    if (!current)
      return;
    if (typeof current[paths[i]] === "string" && i + 1 < paths.length) {
      return;
    }
    if (current[paths[i]] === undefined) {
      var j = 2;
      var p = paths.slice(i, i + j).join(keySeparator);
      var mix = current[p];
      while (mix === undefined && paths.length > i + j) {
        j++;
        p = paths.slice(i, i + j).join(keySeparator);
        mix = current[p];
      }
      if (mix === undefined)
        return;
      if (mix === null)
        return null;
      if (path.endsWith(p)) {
        if (typeof mix === "string")
          return mix;
        if (p && typeof mix[p] === "string")
          return mix[p];
      }
      var joinedPath = paths.slice(i + j).join(keySeparator);
      if (joinedPath)
        return deepFind(mix, joinedPath, keySeparator);
      return;
    }
    current = current[paths[i]];
  }
  return current;
}
var ResourceStore = function(_EventEmitter) {
  _inherits(ResourceStore2, _EventEmitter);
  var _super = _createSuper(ResourceStore2);
  function ResourceStore2(data) {
    var _this;
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {
      ns: ["translation"],
      defaultNS: "translation"
    };
    _classCallCheck(this, ResourceStore2);
    _this = _super.call(this);
    if (isIE10) {
      EventEmitter.call(_assertThisInitialized(_this));
    }
    _this.data = data || {};
    _this.options = options;
    if (_this.options.keySeparator === undefined) {
      _this.options.keySeparator = ".";
    }
    if (_this.options.ignoreJSONStructure === undefined) {
      _this.options.ignoreJSONStructure = true;
    }
    return _this;
  }
  _createClass(ResourceStore2, [{
    key: "addNamespaces",
    value: function addNamespaces(ns) {
      if (this.options.ns.indexOf(ns) < 0) {
        this.options.ns.push(ns);
      }
    }
  }, {
    key: "removeNamespaces",
    value: function removeNamespaces(ns) {
      var index = this.options.ns.indexOf(ns);
      if (index > -1) {
        this.options.ns.splice(index, 1);
      }
    }
  }, {
    key: "getResource",
    value: function getResource(lng, ns, key) {
      var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
      var keySeparator = options.keySeparator !== undefined ? options.keySeparator : this.options.keySeparator;
      var ignoreJSONStructure = options.ignoreJSONStructure !== undefined ? options.ignoreJSONStructure : this.options.ignoreJSONStructure;
      var path = [lng, ns];
      if (key && typeof key !== "string")
        path = path.concat(key);
      if (key && typeof key === "string")
        path = path.concat(keySeparator ? key.split(keySeparator) : key);
      if (lng.indexOf(".") > -1) {
        path = lng.split(".");
      }
      var result = getPath(this.data, path);
      if (result || !ignoreJSONStructure || typeof key !== "string")
        return result;
      return deepFind(this.data && this.data[lng] && this.data[lng][ns], key, keySeparator);
    }
  }, {
    key: "addResource",
    value: function addResource(lng, ns, key, value) {
      var options = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {
        silent: false
      };
      var keySeparator = this.options.keySeparator;
      if (keySeparator === undefined)
        keySeparator = ".";
      var path = [lng, ns];
      if (key)
        path = path.concat(keySeparator ? key.split(keySeparator) : key);
      if (lng.indexOf(".") > -1) {
        path = lng.split(".");
        value = ns;
        ns = path[1];
      }
      this.addNamespaces(ns);
      setPath(this.data, path, value);
      if (!options.silent)
        this.emit("added", lng, ns, key, value);
    }
  }, {
    key: "addResources",
    value: function addResources(lng, ns, resources) {
      var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {
        silent: false
      };
      for (var m in resources) {
        if (typeof resources[m] === "string" || Object.prototype.toString.apply(resources[m]) === "[object Array]")
          this.addResource(lng, ns, m, resources[m], {
            silent: true
          });
      }
      if (!options.silent)
        this.emit("added", lng, ns, resources);
    }
  }, {
    key: "addResourceBundle",
    value: function addResourceBundle(lng, ns, resources, deep, overwrite) {
      var options = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : {
        silent: false
      };
      var path = [lng, ns];
      if (lng.indexOf(".") > -1) {
        path = lng.split(".");
        deep = resources;
        resources = ns;
        ns = path[1];
      }
      this.addNamespaces(ns);
      var pack = getPath(this.data, path) || {};
      if (deep) {
        deepExtend(pack, resources, overwrite);
      } else {
        pack = _objectSpread$1(_objectSpread$1({}, pack), resources);
      }
      setPath(this.data, path, pack);
      if (!options.silent)
        this.emit("added", lng, ns, resources);
    }
  }, {
    key: "removeResourceBundle",
    value: function removeResourceBundle(lng, ns) {
      if (this.hasResourceBundle(lng, ns)) {
        delete this.data[lng][ns];
      }
      this.removeNamespaces(ns);
      this.emit("removed", lng, ns);
    }
  }, {
    key: "hasResourceBundle",
    value: function hasResourceBundle(lng, ns) {
      return this.getResource(lng, ns) !== undefined;
    }
  }, {
    key: "getResourceBundle",
    value: function getResourceBundle(lng, ns) {
      if (!ns)
        ns = this.options.defaultNS;
      if (this.options.compatibilityAPI === "v1")
        return _objectSpread$1(_objectSpread$1({}, {}), this.getResource(lng, ns));
      return this.getResource(lng, ns);
    }
  }, {
    key: "getDataByLanguage",
    value: function getDataByLanguage(lng) {
      return this.data[lng];
    }
  }, {
    key: "hasLanguageSomeTranslations",
    value: function hasLanguageSomeTranslations(lng) {
      var data = this.getDataByLanguage(lng);
      var n = data && Object.keys(data) || [];
      return !!n.find(function(v) {
        return data[v] && Object.keys(data[v]).length > 0;
      });
    }
  }, {
    key: "toJSON",
    value: function toJSON() {
      return this.data;
    }
  }]);
  return ResourceStore2;
}(EventEmitter);
var postProcessor = {
  processors: {},
  addPostProcessor: function addPostProcessor(module) {
    this.processors[module.name] = module;
  },
  handle: function handle(processors, value, key, options, translator) {
    var _this = this;
    processors.forEach(function(processor) {
      if (_this.processors[processor])
        value = _this.processors[processor].process(value, key, options, translator);
    });
    return value;
  }
};
function ownKeys$2(object, enumerableOnly) {
  var keys = Object.keys(object);
  if (Object.getOwnPropertySymbols) {
    var symbols = Object.getOwnPropertySymbols(object);
    if (enumerableOnly) {
      symbols = symbols.filter(function(sym) {
        return Object.getOwnPropertyDescriptor(object, sym).enumerable;
      });
    }
    keys.push.apply(keys, symbols);
  }
  return keys;
}
function _objectSpread$2(target) {
  for (var i = 1;i < arguments.length; i++) {
    var source = arguments[i] != null ? arguments[i] : {};
    if (i % 2) {
      ownKeys$2(Object(source), true).forEach(function(key) {
        _defineProperty(target, key, source[key]);
      });
    } else if (Object.getOwnPropertyDescriptors) {
      Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    } else {
      ownKeys$2(Object(source)).forEach(function(key) {
        Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
      });
    }
  }
  return target;
}
function _createSuper$1(Derived) {
  var hasNativeReflectConstruct = _isNativeReflectConstruct$1();
  return function _createSuperInternal() {
    var Super = _getPrototypeOf(Derived), result;
    if (hasNativeReflectConstruct) {
      var NewTarget = _getPrototypeOf(this).constructor;
      result = Reflect.construct(Super, arguments, NewTarget);
    } else {
      result = Super.apply(this, arguments);
    }
    return _possibleConstructorReturn(this, result);
  };
}
function _isNativeReflectConstruct$1() {
  if (typeof Reflect === "undefined" || !Reflect.construct)
    return false;
  if (Reflect.construct.sham)
    return false;
  if (typeof Proxy === "function")
    return true;
  try {
    Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {}));
    return true;
  } catch (e) {
    return false;
  }
}
var checkedLoadedFor = {};
var Translator = function(_EventEmitter) {
  _inherits(Translator2, _EventEmitter);
  var _super = _createSuper$1(Translator2);
  function Translator2(services) {
    var _this;
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    _classCallCheck(this, Translator2);
    _this = _super.call(this);
    if (isIE10) {
      EventEmitter.call(_assertThisInitialized(_this));
    }
    copy(["resourceStore", "languageUtils", "pluralResolver", "interpolator", "backendConnector", "i18nFormat", "utils"], services, _assertThisInitialized(_this));
    _this.options = options;
    if (_this.options.keySeparator === undefined) {
      _this.options.keySeparator = ".";
    }
    _this.logger = baseLogger.create("translator");
    return _this;
  }
  _createClass(Translator2, [{
    key: "changeLanguage",
    value: function changeLanguage(lng) {
      if (lng)
        this.language = lng;
    }
  }, {
    key: "exists",
    value: function exists(key) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {
        interpolation: {}
      };
      if (key === undefined || key === null) {
        return false;
      }
      var resolved = this.resolve(key, options);
      return resolved && resolved.res !== undefined;
    }
  }, {
    key: "extractFromKey",
    value: function extractFromKey(key, options) {
      var nsSeparator = options.nsSeparator !== undefined ? options.nsSeparator : this.options.nsSeparator;
      if (nsSeparator === undefined)
        nsSeparator = ":";
      var keySeparator = options.keySeparator !== undefined ? options.keySeparator : this.options.keySeparator;
      var namespaces = options.ns || this.options.defaultNS || [];
      var wouldCheckForNsInKey = nsSeparator && key.indexOf(nsSeparator) > -1;
      var seemsNaturalLanguage = !this.options.userDefinedKeySeparator && !options.keySeparator && !this.options.userDefinedNsSeparator && !options.nsSeparator && !looksLikeObjectPath(key, nsSeparator, keySeparator);
      if (wouldCheckForNsInKey && !seemsNaturalLanguage) {
        var m = key.match(this.interpolator.nestingRegexp);
        if (m && m.length > 0) {
          return {
            key,
            namespaces
          };
        }
        var parts = key.split(nsSeparator);
        if (nsSeparator !== keySeparator || nsSeparator === keySeparator && this.options.ns.indexOf(parts[0]) > -1)
          namespaces = parts.shift();
        key = parts.join(keySeparator);
      }
      if (typeof namespaces === "string")
        namespaces = [namespaces];
      return {
        key,
        namespaces
      };
    }
  }, {
    key: "translate",
    value: function translate(keys, options, lastKey) {
      var _this2 = this;
      if (_typeof(options) !== "object" && this.options.overloadTranslationOptionHandler) {
        options = this.options.overloadTranslationOptionHandler(arguments);
      }
      if (!options)
        options = {};
      if (keys === undefined || keys === null)
        return "";
      if (!Array.isArray(keys))
        keys = [String(keys)];
      var returnDetails = options.returnDetails !== undefined ? options.returnDetails : this.options.returnDetails;
      var keySeparator = options.keySeparator !== undefined ? options.keySeparator : this.options.keySeparator;
      var _this$extractFromKey = this.extractFromKey(keys[keys.length - 1], options), key = _this$extractFromKey.key, namespaces = _this$extractFromKey.namespaces;
      var namespace = namespaces[namespaces.length - 1];
      var lng = options.lng || this.language;
      var appendNamespaceToCIMode = options.appendNamespaceToCIMode || this.options.appendNamespaceToCIMode;
      if (lng && lng.toLowerCase() === "cimode") {
        if (appendNamespaceToCIMode) {
          var nsSeparator = options.nsSeparator || this.options.nsSeparator;
          if (returnDetails) {
            resolved.res = "".concat(namespace).concat(nsSeparator).concat(key);
            return resolved;
          }
          return "".concat(namespace).concat(nsSeparator).concat(key);
        }
        if (returnDetails) {
          resolved.res = key;
          return resolved;
        }
        return key;
      }
      var resolved = this.resolve(keys, options);
      var res = resolved && resolved.res;
      var resUsedKey = resolved && resolved.usedKey || key;
      var resExactUsedKey = resolved && resolved.exactUsedKey || key;
      var resType = Object.prototype.toString.apply(res);
      var noObject = ["[object Number]", "[object Function]", "[object RegExp]"];
      var joinArrays = options.joinArrays !== undefined ? options.joinArrays : this.options.joinArrays;
      var handleAsObjectInI18nFormat = !this.i18nFormat || this.i18nFormat.handleAsObject;
      var handleAsObject = typeof res !== "string" && typeof res !== "boolean" && typeof res !== "number";
      if (handleAsObjectInI18nFormat && res && handleAsObject && noObject.indexOf(resType) < 0 && !(typeof joinArrays === "string" && resType === "[object Array]")) {
        if (!options.returnObjects && !this.options.returnObjects) {
          if (!this.options.returnedObjectHandler) {
            this.logger.warn("accessing an object - but returnObjects options is not enabled!");
          }
          var r = this.options.returnedObjectHandler ? this.options.returnedObjectHandler(resUsedKey, res, _objectSpread$2(_objectSpread$2({}, options), {}, {
            ns: namespaces
          })) : "key '".concat(key, " (").concat(this.language, ")' returned an object instead of string.");
          if (returnDetails) {
            resolved.res = r;
            return resolved;
          }
          return r;
        }
        if (keySeparator) {
          var resTypeIsArray = resType === "[object Array]";
          var copy2 = resTypeIsArray ? [] : {};
          var newKeyToUse = resTypeIsArray ? resExactUsedKey : resUsedKey;
          for (var m in res) {
            if (Object.prototype.hasOwnProperty.call(res, m)) {
              var deepKey = "".concat(newKeyToUse).concat(keySeparator).concat(m);
              copy2[m] = this.translate(deepKey, _objectSpread$2(_objectSpread$2({}, options), {
                joinArrays: false,
                ns: namespaces
              }));
              if (copy2[m] === deepKey)
                copy2[m] = res[m];
            }
          }
          res = copy2;
        }
      } else if (handleAsObjectInI18nFormat && typeof joinArrays === "string" && resType === "[object Array]") {
        res = res.join(joinArrays);
        if (res)
          res = this.extendTranslation(res, keys, options, lastKey);
      } else {
        var usedDefault = false;
        var usedKey = false;
        var needsPluralHandling = options.count !== undefined && typeof options.count !== "string";
        var hasDefaultValue = Translator2.hasDefaultValue(options);
        var defaultValueSuffix = needsPluralHandling ? this.pluralResolver.getSuffix(lng, options.count, options) : "";
        var defaultValue = options["defaultValue".concat(defaultValueSuffix)] || options.defaultValue;
        if (!this.isValidLookup(res) && hasDefaultValue) {
          usedDefault = true;
          res = defaultValue;
        }
        if (!this.isValidLookup(res)) {
          usedKey = true;
          res = key;
        }
        var missingKeyNoValueFallbackToKey = options.missingKeyNoValueFallbackToKey || this.options.missingKeyNoValueFallbackToKey;
        var resForMissing = missingKeyNoValueFallbackToKey && usedKey ? undefined : res;
        var updateMissing = hasDefaultValue && defaultValue !== res && this.options.updateMissing;
        if (usedKey || usedDefault || updateMissing) {
          this.logger.log(updateMissing ? "updateKey" : "missingKey", lng, namespace, key, updateMissing ? defaultValue : res);
          if (keySeparator) {
            var fk = this.resolve(key, _objectSpread$2(_objectSpread$2({}, options), {}, {
              keySeparator: false
            }));
            if (fk && fk.res)
              this.logger.warn("Seems the loaded translations were in flat JSON format instead of nested. Either set keySeparator: false on init or make sure your translations are published in nested format.");
          }
          var lngs = [];
          var fallbackLngs = this.languageUtils.getFallbackCodes(this.options.fallbackLng, options.lng || this.language);
          if (this.options.saveMissingTo === "fallback" && fallbackLngs && fallbackLngs[0]) {
            for (var i = 0;i < fallbackLngs.length; i++) {
              lngs.push(fallbackLngs[i]);
            }
          } else if (this.options.saveMissingTo === "all") {
            lngs = this.languageUtils.toResolveHierarchy(options.lng || this.language);
          } else {
            lngs.push(options.lng || this.language);
          }
          var send = function send2(l, k, specificDefaultValue) {
            var defaultForMissing = hasDefaultValue && specificDefaultValue !== res ? specificDefaultValue : resForMissing;
            if (_this2.options.missingKeyHandler) {
              _this2.options.missingKeyHandler(l, namespace, k, defaultForMissing, updateMissing, options);
            } else if (_this2.backendConnector && _this2.backendConnector.saveMissing) {
              _this2.backendConnector.saveMissing(l, namespace, k, defaultForMissing, updateMissing, options);
            }
            _this2.emit("missingKey", l, namespace, k, res);
          };
          if (this.options.saveMissing) {
            if (this.options.saveMissingPlurals && needsPluralHandling) {
              lngs.forEach(function(language) {
                _this2.pluralResolver.getSuffixes(language, options).forEach(function(suffix) {
                  send([language], key + suffix, options["defaultValue".concat(suffix)] || defaultValue);
                });
              });
            } else {
              send(lngs, key, defaultValue);
            }
          }
        }
        res = this.extendTranslation(res, keys, options, resolved, lastKey);
        if (usedKey && res === key && this.options.appendNamespaceToMissingKey)
          res = "".concat(namespace, ":").concat(key);
        if ((usedKey || usedDefault) && this.options.parseMissingKeyHandler) {
          if (this.options.compatibilityAPI !== "v1") {
            res = this.options.parseMissingKeyHandler(this.options.appendNamespaceToMissingKey ? "".concat(namespace, ":").concat(key) : key, usedDefault ? res : undefined);
          } else {
            res = this.options.parseMissingKeyHandler(res);
          }
        }
      }
      if (returnDetails) {
        resolved.res = res;
        return resolved;
      }
      return res;
    }
  }, {
    key: "extendTranslation",
    value: function extendTranslation(res, key, options, resolved, lastKey) {
      var _this3 = this;
      if (this.i18nFormat && this.i18nFormat.parse) {
        res = this.i18nFormat.parse(res, _objectSpread$2(_objectSpread$2({}, this.options.interpolation.defaultVariables), options), resolved.usedLng, resolved.usedNS, resolved.usedKey, {
          resolved
        });
      } else if (!options.skipInterpolation) {
        if (options.interpolation)
          this.interpolator.init(_objectSpread$2(_objectSpread$2({}, options), {
            interpolation: _objectSpread$2(_objectSpread$2({}, this.options.interpolation), options.interpolation)
          }));
        var skipOnVariables = typeof res === "string" && (options && options.interpolation && options.interpolation.skipOnVariables !== undefined ? options.interpolation.skipOnVariables : this.options.interpolation.skipOnVariables);
        var nestBef;
        if (skipOnVariables) {
          var nb = res.match(this.interpolator.nestingRegexp);
          nestBef = nb && nb.length;
        }
        var data = options.replace && typeof options.replace !== "string" ? options.replace : options;
        if (this.options.interpolation.defaultVariables)
          data = _objectSpread$2(_objectSpread$2({}, this.options.interpolation.defaultVariables), data);
        res = this.interpolator.interpolate(res, data, options.lng || this.language, options);
        if (skipOnVariables) {
          var na = res.match(this.interpolator.nestingRegexp);
          var nestAft = na && na.length;
          if (nestBef < nestAft)
            options.nest = false;
        }
        if (options.nest !== false)
          res = this.interpolator.nest(res, function() {
            for (var _len = arguments.length, args = new Array(_len), _key = 0;_key < _len; _key++) {
              args[_key] = arguments[_key];
            }
            if (lastKey && lastKey[0] === args[0] && !options.context) {
              _this3.logger.warn("It seems you are nesting recursively key: ".concat(args[0], " in key: ").concat(key[0]));
              return null;
            }
            return _this3.translate.apply(_this3, args.concat([key]));
          }, options);
        if (options.interpolation)
          this.interpolator.reset();
      }
      var postProcess = options.postProcess || this.options.postProcess;
      var postProcessorNames = typeof postProcess === "string" ? [postProcess] : postProcess;
      if (res !== undefined && res !== null && postProcessorNames && postProcessorNames.length && options.applyPostProcessor !== false) {
        res = postProcessor.handle(postProcessorNames, res, key, this.options && this.options.postProcessPassResolved ? _objectSpread$2({
          i18nResolved: resolved
        }, options) : options, this);
      }
      return res;
    }
  }, {
    key: "resolve",
    value: function resolve(keys) {
      var _this4 = this;
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      var found;
      var usedKey;
      var exactUsedKey;
      var usedLng;
      var usedNS;
      if (typeof keys === "string")
        keys = [keys];
      keys.forEach(function(k) {
        if (_this4.isValidLookup(found))
          return;
        var extracted = _this4.extractFromKey(k, options);
        var key = extracted.key;
        usedKey = key;
        var namespaces = extracted.namespaces;
        if (_this4.options.fallbackNS)
          namespaces = namespaces.concat(_this4.options.fallbackNS);
        var needsPluralHandling = options.count !== undefined && typeof options.count !== "string";
        var needsZeroSuffixLookup = needsPluralHandling && !options.ordinal && options.count === 0 && _this4.pluralResolver.shouldUseIntlApi();
        var needsContextHandling = options.context !== undefined && (typeof options.context === "string" || typeof options.context === "number") && options.context !== "";
        var codes = options.lngs ? options.lngs : _this4.languageUtils.toResolveHierarchy(options.lng || _this4.language, options.fallbackLng);
        namespaces.forEach(function(ns) {
          if (_this4.isValidLookup(found))
            return;
          usedNS = ns;
          if (!checkedLoadedFor["".concat(codes[0], "-").concat(ns)] && _this4.utils && _this4.utils.hasLoadedNamespace && !_this4.utils.hasLoadedNamespace(usedNS)) {
            checkedLoadedFor["".concat(codes[0], "-").concat(ns)] = true;
            _this4.logger.warn('key "'.concat(usedKey, '" for languages "').concat(codes.join(", "), `" won't get resolved as namespace "`).concat(usedNS, '" was not yet loaded'), "This means something IS WRONG in your setup. You access the t function before i18next.init / i18next.loadNamespace / i18next.changeLanguage was done. Wait for the callback or Promise to resolve before accessing it!!!");
          }
          codes.forEach(function(code) {
            if (_this4.isValidLookup(found))
              return;
            usedLng = code;
            var finalKeys = [key];
            if (_this4.i18nFormat && _this4.i18nFormat.addLookupKeys) {
              _this4.i18nFormat.addLookupKeys(finalKeys, key, code, ns, options);
            } else {
              var pluralSuffix;
              if (needsPluralHandling)
                pluralSuffix = _this4.pluralResolver.getSuffix(code, options.count, options);
              var zeroSuffix = "".concat(_this4.options.pluralSeparator, "zero");
              if (needsPluralHandling) {
                finalKeys.push(key + pluralSuffix);
                if (needsZeroSuffixLookup) {
                  finalKeys.push(key + zeroSuffix);
                }
              }
              if (needsContextHandling) {
                var contextKey = "".concat(key).concat(_this4.options.contextSeparator).concat(options.context);
                finalKeys.push(contextKey);
                if (needsPluralHandling) {
                  finalKeys.push(contextKey + pluralSuffix);
                  if (needsZeroSuffixLookup) {
                    finalKeys.push(contextKey + zeroSuffix);
                  }
                }
              }
            }
            var possibleKey;
            while (possibleKey = finalKeys.pop()) {
              if (!_this4.isValidLookup(found)) {
                exactUsedKey = possibleKey;
                found = _this4.getResource(code, ns, possibleKey, options);
              }
            }
          });
        });
      });
      return {
        res: found,
        usedKey,
        exactUsedKey,
        usedLng,
        usedNS
      };
    }
  }, {
    key: "isValidLookup",
    value: function isValidLookup(res) {
      return res !== undefined && !(!this.options.returnNull && res === null) && !(!this.options.returnEmptyString && res === "");
    }
  }, {
    key: "getResource",
    value: function getResource(code, ns, key) {
      var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
      if (this.i18nFormat && this.i18nFormat.getResource)
        return this.i18nFormat.getResource(code, ns, key, options);
      return this.resourceStore.getResource(code, ns, key, options);
    }
  }], [{
    key: "hasDefaultValue",
    value: function hasDefaultValue(options) {
      var prefix = "defaultValue";
      for (var option in options) {
        if (Object.prototype.hasOwnProperty.call(options, option) && prefix === option.substring(0, prefix.length) && options[option] !== undefined) {
          return true;
        }
      }
      return false;
    }
  }]);
  return Translator2;
}(EventEmitter);
function capitalize(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}
var LanguageUtil = function() {
  function LanguageUtil2(options) {
    _classCallCheck(this, LanguageUtil2);
    this.options = options;
    this.supportedLngs = this.options.supportedLngs || false;
    this.logger = baseLogger.create("languageUtils");
  }
  _createClass(LanguageUtil2, [{
    key: "getScriptPartFromCode",
    value: function getScriptPartFromCode(code) {
      if (!code || code.indexOf("-") < 0)
        return null;
      var p = code.split("-");
      if (p.length === 2)
        return null;
      p.pop();
      if (p[p.length - 1].toLowerCase() === "x")
        return null;
      return this.formatLanguageCode(p.join("-"));
    }
  }, {
    key: "getLanguagePartFromCode",
    value: function getLanguagePartFromCode(code) {
      if (!code || code.indexOf("-") < 0)
        return code;
      var p = code.split("-");
      return this.formatLanguageCode(p[0]);
    }
  }, {
    key: "formatLanguageCode",
    value: function formatLanguageCode(code) {
      if (typeof code === "string" && code.indexOf("-") > -1) {
        var specialCases = ["hans", "hant", "latn", "cyrl", "cans", "mong", "arab"];
        var p = code.split("-");
        if (this.options.lowerCaseLng) {
          p = p.map(function(part) {
            return part.toLowerCase();
          });
        } else if (p.length === 2) {
          p[0] = p[0].toLowerCase();
          p[1] = p[1].toUpperCase();
          if (specialCases.indexOf(p[1].toLowerCase()) > -1)
            p[1] = capitalize(p[1].toLowerCase());
        } else if (p.length === 3) {
          p[0] = p[0].toLowerCase();
          if (p[1].length === 2)
            p[1] = p[1].toUpperCase();
          if (p[0] !== "sgn" && p[2].length === 2)
            p[2] = p[2].toUpperCase();
          if (specialCases.indexOf(p[1].toLowerCase()) > -1)
            p[1] = capitalize(p[1].toLowerCase());
          if (specialCases.indexOf(p[2].toLowerCase()) > -1)
            p[2] = capitalize(p[2].toLowerCase());
        }
        return p.join("-");
      }
      return this.options.cleanCode || this.options.lowerCaseLng ? code.toLowerCase() : code;
    }
  }, {
    key: "isSupportedCode",
    value: function isSupportedCode(code) {
      if (this.options.load === "languageOnly" || this.options.nonExplicitSupportedLngs) {
        code = this.getLanguagePartFromCode(code);
      }
      return !this.supportedLngs || !this.supportedLngs.length || this.supportedLngs.indexOf(code) > -1;
    }
  }, {
    key: "getBestMatchFromCodes",
    value: function getBestMatchFromCodes(codes) {
      var _this = this;
      if (!codes)
        return null;
      var found;
      codes.forEach(function(code) {
        if (found)
          return;
        var cleanedLng = _this.formatLanguageCode(code);
        if (!_this.options.supportedLngs || _this.isSupportedCode(cleanedLng))
          found = cleanedLng;
      });
      if (!found && this.options.supportedLngs) {
        codes.forEach(function(code) {
          if (found)
            return;
          var lngOnly = _this.getLanguagePartFromCode(code);
          if (_this.isSupportedCode(lngOnly))
            return found = lngOnly;
          found = _this.options.supportedLngs.find(function(supportedLng) {
            if (supportedLng.indexOf(lngOnly) === 0)
              return supportedLng;
          });
        });
      }
      if (!found)
        found = this.getFallbackCodes(this.options.fallbackLng)[0];
      return found;
    }
  }, {
    key: "getFallbackCodes",
    value: function getFallbackCodes(fallbacks, code) {
      if (!fallbacks)
        return [];
      if (typeof fallbacks === "function")
        fallbacks = fallbacks(code);
      if (typeof fallbacks === "string")
        fallbacks = [fallbacks];
      if (Object.prototype.toString.apply(fallbacks) === "[object Array]")
        return fallbacks;
      if (!code)
        return fallbacks["default"] || [];
      var found = fallbacks[code];
      if (!found)
        found = fallbacks[this.getScriptPartFromCode(code)];
      if (!found)
        found = fallbacks[this.formatLanguageCode(code)];
      if (!found)
        found = fallbacks[this.getLanguagePartFromCode(code)];
      if (!found)
        found = fallbacks["default"];
      return found || [];
    }
  }, {
    key: "toResolveHierarchy",
    value: function toResolveHierarchy(code, fallbackCode) {
      var _this2 = this;
      var fallbackCodes = this.getFallbackCodes(fallbackCode || this.options.fallbackLng || [], code);
      var codes = [];
      var addCode = function addCode2(c) {
        if (!c)
          return;
        if (_this2.isSupportedCode(c)) {
          codes.push(c);
        } else {
          _this2.logger.warn("rejecting language code not found in supportedLngs: ".concat(c));
        }
      };
      if (typeof code === "string" && code.indexOf("-") > -1) {
        if (this.options.load !== "languageOnly")
          addCode(this.formatLanguageCode(code));
        if (this.options.load !== "languageOnly" && this.options.load !== "currentOnly")
          addCode(this.getScriptPartFromCode(code));
        if (this.options.load !== "currentOnly")
          addCode(this.getLanguagePartFromCode(code));
      } else if (typeof code === "string") {
        addCode(this.formatLanguageCode(code));
      }
      fallbackCodes.forEach(function(fc) {
        if (codes.indexOf(fc) < 0)
          addCode(_this2.formatLanguageCode(fc));
      });
      return codes;
    }
  }]);
  return LanguageUtil2;
}();
var sets = [{
  lngs: ["ach", "ak", "am", "arn", "br", "fil", "gun", "ln", "mfe", "mg", "mi", "oc", "pt", "pt-BR", "tg", "tl", "ti", "tr", "uz", "wa"],
  nr: [1, 2],
  fc: 1
}, {
  lngs: ["af", "an", "ast", "az", "bg", "bn", "ca", "da", "de", "dev", "el", "en", "eo", "es", "et", "eu", "fi", "fo", "fur", "fy", "gl", "gu", "ha", "hi", "hu", "hy", "ia", "it", "kk", "kn", "ku", "lb", "mai", "ml", "mn", "mr", "nah", "nap", "nb", "ne", "nl", "nn", "no", "nso", "pa", "pap", "pms", "ps", "pt-PT", "rm", "sco", "se", "si", "so", "son", "sq", "sv", "sw", "ta", "te", "tk", "ur", "yo"],
  nr: [1, 2],
  fc: 2
}, {
  lngs: ["ay", "bo", "cgg", "fa", "ht", "id", "ja", "jbo", "ka", "km", "ko", "ky", "lo", "ms", "sah", "su", "th", "tt", "ug", "vi", "wo", "zh"],
  nr: [1],
  fc: 3
}, {
  lngs: ["be", "bs", "cnr", "dz", "hr", "ru", "sr", "uk"],
  nr: [1, 2, 5],
  fc: 4
}, {
  lngs: ["ar"],
  nr: [0, 1, 2, 3, 11, 100],
  fc: 5
}, {
  lngs: ["cs", "sk"],
  nr: [1, 2, 5],
  fc: 6
}, {
  lngs: ["csb", "pl"],
  nr: [1, 2, 5],
  fc: 7
}, {
  lngs: ["cy"],
  nr: [1, 2, 3, 8],
  fc: 8
}, {
  lngs: ["fr"],
  nr: [1, 2],
  fc: 9
}, {
  lngs: ["ga"],
  nr: [1, 2, 3, 7, 11],
  fc: 10
}, {
  lngs: ["gd"],
  nr: [1, 2, 3, 20],
  fc: 11
}, {
  lngs: ["is"],
  nr: [1, 2],
  fc: 12
}, {
  lngs: ["jv"],
  nr: [0, 1],
  fc: 13
}, {
  lngs: ["kw"],
  nr: [1, 2, 3, 4],
  fc: 14
}, {
  lngs: ["lt"],
  nr: [1, 2, 10],
  fc: 15
}, {
  lngs: ["lv"],
  nr: [1, 2, 0],
  fc: 16
}, {
  lngs: ["mk"],
  nr: [1, 2],
  fc: 17
}, {
  lngs: ["mnk"],
  nr: [0, 1, 2],
  fc: 18
}, {
  lngs: ["mt"],
  nr: [1, 2, 11, 20],
  fc: 19
}, {
  lngs: ["or"],
  nr: [2, 1],
  fc: 2
}, {
  lngs: ["ro"],
  nr: [1, 2, 20],
  fc: 20
}, {
  lngs: ["sl"],
  nr: [5, 1, 2, 3],
  fc: 21
}, {
  lngs: ["he", "iw"],
  nr: [1, 2, 20, 21],
  fc: 22
}];
var _rulesPluralsTypes = {
  1: function _(n) {
    return Number(n > 1);
  },
  2: function _2(n) {
    return Number(n != 1);
  },
  3: function _3(n) {
    return 0;
  },
  4: function _4(n) {
    return Number(n % 10 == 1 && n % 100 != 11 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2);
  },
  5: function _5(n) {
    return Number(n == 0 ? 0 : n == 1 ? 1 : n == 2 ? 2 : n % 100 >= 3 && n % 100 <= 10 ? 3 : n % 100 >= 11 ? 4 : 5);
  },
  6: function _6(n) {
    return Number(n == 1 ? 0 : n >= 2 && n <= 4 ? 1 : 2);
  },
  7: function _7(n) {
    return Number(n == 1 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2);
  },
  8: function _8(n) {
    return Number(n == 1 ? 0 : n == 2 ? 1 : n != 8 && n != 11 ? 2 : 3);
  },
  9: function _9(n) {
    return Number(n >= 2);
  },
  10: function _10(n) {
    return Number(n == 1 ? 0 : n == 2 ? 1 : n < 7 ? 2 : n < 11 ? 3 : 4);
  },
  11: function _11(n) {
    return Number(n == 1 || n == 11 ? 0 : n == 2 || n == 12 ? 1 : n > 2 && n < 20 ? 2 : 3);
  },
  12: function _12(n) {
    return Number(n % 10 != 1 || n % 100 == 11);
  },
  13: function _13(n) {
    return Number(n !== 0);
  },
  14: function _14(n) {
    return Number(n == 1 ? 0 : n == 2 ? 1 : n == 3 ? 2 : 3);
  },
  15: function _15(n) {
    return Number(n % 10 == 1 && n % 100 != 11 ? 0 : n % 10 >= 2 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2);
  },
  16: function _16(n) {
    return Number(n % 10 == 1 && n % 100 != 11 ? 0 : n !== 0 ? 1 : 2);
  },
  17: function _17(n) {
    return Number(n == 1 || n % 10 == 1 && n % 100 != 11 ? 0 : 1);
  },
  18: function _18(n) {
    return Number(n == 0 ? 0 : n == 1 ? 1 : 2);
  },
  19: function _19(n) {
    return Number(n == 1 ? 0 : n == 0 || n % 100 > 1 && n % 100 < 11 ? 1 : n % 100 > 10 && n % 100 < 20 ? 2 : 3);
  },
  20: function _20(n) {
    return Number(n == 1 ? 0 : n == 0 || n % 100 > 0 && n % 100 < 20 ? 1 : 2);
  },
  21: function _21(n) {
    return Number(n % 100 == 1 ? 1 : n % 100 == 2 ? 2 : n % 100 == 3 || n % 100 == 4 ? 3 : 0);
  },
  22: function _22(n) {
    return Number(n == 1 ? 0 : n == 2 ? 1 : (n < 0 || n > 10) && n % 10 == 0 ? 2 : 3);
  }
};
var deprecatedJsonVersions = ["v1", "v2", "v3"];
var suffixesOrder = {
  zero: 0,
  one: 1,
  two: 2,
  few: 3,
  many: 4,
  other: 5
};
function createRules() {
  var rules = {};
  sets.forEach(function(set) {
    set.lngs.forEach(function(l) {
      rules[l] = {
        numbers: set.nr,
        plurals: _rulesPluralsTypes[set.fc]
      };
    });
  });
  return rules;
}
var PluralResolver = function() {
  function PluralResolver2(languageUtils) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    _classCallCheck(this, PluralResolver2);
    this.languageUtils = languageUtils;
    this.options = options;
    this.logger = baseLogger.create("pluralResolver");
    if ((!this.options.compatibilityJSON || this.options.compatibilityJSON === "v4") && (typeof Intl === "undefined" || !Intl.PluralRules)) {
      this.options.compatibilityJSON = "v3";
      this.logger.error("Your environment seems not to be Intl API compatible, use an Intl.PluralRules polyfill. Will fallback to the compatibilityJSON v3 format handling.");
    }
    this.rules = createRules();
  }
  _createClass(PluralResolver2, [{
    key: "addRule",
    value: function addRule(lng, obj) {
      this.rules[lng] = obj;
    }
  }, {
    key: "getRule",
    value: function getRule(code) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      if (this.shouldUseIntlApi()) {
        try {
          return new Intl.PluralRules(code, {
            type: options.ordinal ? "ordinal" : "cardinal"
          });
        } catch (_unused) {
          return;
        }
      }
      return this.rules[code] || this.rules[this.languageUtils.getLanguagePartFromCode(code)];
    }
  }, {
    key: "needsPlural",
    value: function needsPlural(code) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      var rule = this.getRule(code, options);
      if (this.shouldUseIntlApi()) {
        return rule && rule.resolvedOptions().pluralCategories.length > 1;
      }
      return rule && rule.numbers.length > 1;
    }
  }, {
    key: "getPluralFormsOfKey",
    value: function getPluralFormsOfKey(code, key) {
      var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
      return this.getSuffixes(code, options).map(function(suffix) {
        return "".concat(key).concat(suffix);
      });
    }
  }, {
    key: "getSuffixes",
    value: function getSuffixes(code) {
      var _this = this;
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      var rule = this.getRule(code, options);
      if (!rule) {
        return [];
      }
      if (this.shouldUseIntlApi()) {
        return rule.resolvedOptions().pluralCategories.sort(function(pluralCategory1, pluralCategory2) {
          return suffixesOrder[pluralCategory1] - suffixesOrder[pluralCategory2];
        }).map(function(pluralCategory) {
          return "".concat(_this.options.prepend).concat(pluralCategory);
        });
      }
      return rule.numbers.map(function(number) {
        return _this.getSuffix(code, number, options);
      });
    }
  }, {
    key: "getSuffix",
    value: function getSuffix(code, count) {
      var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
      var rule = this.getRule(code, options);
      if (rule) {
        if (this.shouldUseIntlApi()) {
          return "".concat(this.options.prepend).concat(rule.select(count));
        }
        return this.getSuffixRetroCompatible(rule, count);
      }
      this.logger.warn("no plural rule found for: ".concat(code));
      return "";
    }
  }, {
    key: "getSuffixRetroCompatible",
    value: function getSuffixRetroCompatible(rule, count) {
      var _this2 = this;
      var idx = rule.noAbs ? rule.plurals(count) : rule.plurals(Math.abs(count));
      var suffix = rule.numbers[idx];
      if (this.options.simplifyPluralSuffix && rule.numbers.length === 2 && rule.numbers[0] === 1) {
        if (suffix === 2) {
          suffix = "plural";
        } else if (suffix === 1) {
          suffix = "";
        }
      }
      var returnSuffix = function returnSuffix2() {
        return _this2.options.prepend && suffix.toString() ? _this2.options.prepend + suffix.toString() : suffix.toString();
      };
      if (this.options.compatibilityJSON === "v1") {
        if (suffix === 1)
          return "";
        if (typeof suffix === "number")
          return "_plural_".concat(suffix.toString());
        return returnSuffix();
      } else if (this.options.compatibilityJSON === "v2") {
        return returnSuffix();
      } else if (this.options.simplifyPluralSuffix && rule.numbers.length === 2 && rule.numbers[0] === 1) {
        return returnSuffix();
      }
      return this.options.prepend && idx.toString() ? this.options.prepend + idx.toString() : idx.toString();
    }
  }, {
    key: "shouldUseIntlApi",
    value: function shouldUseIntlApi() {
      return !deprecatedJsonVersions.includes(this.options.compatibilityJSON);
    }
  }]);
  return PluralResolver2;
}();
function ownKeys$3(object, enumerableOnly) {
  var keys = Object.keys(object);
  if (Object.getOwnPropertySymbols) {
    var symbols = Object.getOwnPropertySymbols(object);
    if (enumerableOnly) {
      symbols = symbols.filter(function(sym) {
        return Object.getOwnPropertyDescriptor(object, sym).enumerable;
      });
    }
    keys.push.apply(keys, symbols);
  }
  return keys;
}
function _objectSpread$3(target) {
  for (var i = 1;i < arguments.length; i++) {
    var source = arguments[i] != null ? arguments[i] : {};
    if (i % 2) {
      ownKeys$3(Object(source), true).forEach(function(key) {
        _defineProperty(target, key, source[key]);
      });
    } else if (Object.getOwnPropertyDescriptors) {
      Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    } else {
      ownKeys$3(Object(source)).forEach(function(key) {
        Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
      });
    }
  }
  return target;
}
var Interpolator = function() {
  function Interpolator2() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    _classCallCheck(this, Interpolator2);
    this.logger = baseLogger.create("interpolator");
    this.options = options;
    this.format = options.interpolation && options.interpolation.format || function(value) {
      return value;
    };
    this.init(options);
  }
  _createClass(Interpolator2, [{
    key: "init",
    value: function init() {
      var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      if (!options.interpolation)
        options.interpolation = {
          escapeValue: true
        };
      var iOpts = options.interpolation;
      this.escape = iOpts.escape !== undefined ? iOpts.escape : escape;
      this.escapeValue = iOpts.escapeValue !== undefined ? iOpts.escapeValue : true;
      this.useRawValueToEscape = iOpts.useRawValueToEscape !== undefined ? iOpts.useRawValueToEscape : false;
      this.prefix = iOpts.prefix ? regexEscape(iOpts.prefix) : iOpts.prefixEscaped || "{{";
      this.suffix = iOpts.suffix ? regexEscape(iOpts.suffix) : iOpts.suffixEscaped || "}}";
      this.formatSeparator = iOpts.formatSeparator ? iOpts.formatSeparator : iOpts.formatSeparator || ",";
      this.unescapePrefix = iOpts.unescapeSuffix ? "" : iOpts.unescapePrefix || "-";
      this.unescapeSuffix = this.unescapePrefix ? "" : iOpts.unescapeSuffix || "";
      this.nestingPrefix = iOpts.nestingPrefix ? regexEscape(iOpts.nestingPrefix) : iOpts.nestingPrefixEscaped || regexEscape("$t(");
      this.nestingSuffix = iOpts.nestingSuffix ? regexEscape(iOpts.nestingSuffix) : iOpts.nestingSuffixEscaped || regexEscape(")");
      this.nestingOptionsSeparator = iOpts.nestingOptionsSeparator ? iOpts.nestingOptionsSeparator : iOpts.nestingOptionsSeparator || ",";
      this.maxReplaces = iOpts.maxReplaces ? iOpts.maxReplaces : 1000;
      this.alwaysFormat = iOpts.alwaysFormat !== undefined ? iOpts.alwaysFormat : false;
      this.resetRegExp();
    }
  }, {
    key: "reset",
    value: function reset() {
      if (this.options)
        this.init(this.options);
    }
  }, {
    key: "resetRegExp",
    value: function resetRegExp() {
      var regexpStr = "".concat(this.prefix, "(.+?)").concat(this.suffix);
      this.regexp = new RegExp(regexpStr, "g");
      var regexpUnescapeStr = "".concat(this.prefix).concat(this.unescapePrefix, "(.+?)").concat(this.unescapeSuffix).concat(this.suffix);
      this.regexpUnescape = new RegExp(regexpUnescapeStr, "g");
      var nestingRegexpStr = "".concat(this.nestingPrefix, "(.+?)").concat(this.nestingSuffix);
      this.nestingRegexp = new RegExp(nestingRegexpStr, "g");
    }
  }, {
    key: "interpolate",
    value: function interpolate(str, data, lng, options) {
      var _this = this;
      var match;
      var value;
      var replaces;
      var defaultData = this.options && this.options.interpolation && this.options.interpolation.defaultVariables || {};
      function regexSafe(val) {
        return val.replace(/\$/g, "$$$$");
      }
      var handleFormat = function handleFormat2(key) {
        if (key.indexOf(_this.formatSeparator) < 0) {
          var path = getPathWithDefaults(data, defaultData, key);
          return _this.alwaysFormat ? _this.format(path, undefined, lng, _objectSpread$3(_objectSpread$3(_objectSpread$3({}, options), data), {}, {
            interpolationkey: key
          })) : path;
        }
        var p = key.split(_this.formatSeparator);
        var k = p.shift().trim();
        var f = p.join(_this.formatSeparator).trim();
        return _this.format(getPathWithDefaults(data, defaultData, k), f, lng, _objectSpread$3(_objectSpread$3(_objectSpread$3({}, options), data), {}, {
          interpolationkey: k
        }));
      };
      this.resetRegExp();
      var missingInterpolationHandler = options && options.missingInterpolationHandler || this.options.missingInterpolationHandler;
      var skipOnVariables = options && options.interpolation && options.interpolation.skipOnVariables !== undefined ? options.interpolation.skipOnVariables : this.options.interpolation.skipOnVariables;
      var todos = [{
        regex: this.regexpUnescape,
        safeValue: function safeValue(val) {
          return regexSafe(val);
        }
      }, {
        regex: this.regexp,
        safeValue: function safeValue(val) {
          return _this.escapeValue ? regexSafe(_this.escape(val)) : regexSafe(val);
        }
      }];
      todos.forEach(function(todo) {
        replaces = 0;
        while (match = todo.regex.exec(str)) {
          var matchedVar = match[1].trim();
          value = handleFormat(matchedVar);
          if (value === undefined) {
            if (typeof missingInterpolationHandler === "function") {
              var temp = missingInterpolationHandler(str, match, options);
              value = typeof temp === "string" ? temp : "";
            } else if (options && options.hasOwnProperty(matchedVar)) {
              value = "";
            } else if (skipOnVariables) {
              value = match[0];
              continue;
            } else {
              _this.logger.warn("missed to pass in variable ".concat(matchedVar, " for interpolating ").concat(str));
              value = "";
            }
          } else if (typeof value !== "string" && !_this.useRawValueToEscape) {
            value = makeString(value);
          }
          var safeValue = todo.safeValue(value);
          str = str.replace(match[0], safeValue);
          if (skipOnVariables) {
            todo.regex.lastIndex += value.length;
            todo.regex.lastIndex -= match[0].length;
          } else {
            todo.regex.lastIndex = 0;
          }
          replaces++;
          if (replaces >= _this.maxReplaces) {
            break;
          }
        }
      });
      return str;
    }
  }, {
    key: "nest",
    value: function nest(str, fc) {
      var _this2 = this;
      var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
      var match;
      var value;
      var clonedOptions = _objectSpread$3({}, options);
      clonedOptions.applyPostProcessor = false;
      delete clonedOptions.defaultValue;
      function handleHasOptions(key, inheritedOptions) {
        var sep = this.nestingOptionsSeparator;
        if (key.indexOf(sep) < 0)
          return key;
        var c = key.split(new RegExp("".concat(sep, "[ ]*{")));
        var optionsString = "{".concat(c[1]);
        key = c[0];
        optionsString = this.interpolate(optionsString, clonedOptions);
        var matchedSingleQuotes = optionsString.match(/'/g);
        var matchedDoubleQuotes = optionsString.match(/"/g);
        if (matchedSingleQuotes && matchedSingleQuotes.length % 2 === 0 && !matchedDoubleQuotes || matchedDoubleQuotes.length % 2 !== 0) {
          optionsString = optionsString.replace(/'/g, '"');
        }
        try {
          clonedOptions = JSON.parse(optionsString);
          if (inheritedOptions)
            clonedOptions = _objectSpread$3(_objectSpread$3({}, inheritedOptions), clonedOptions);
        } catch (e) {
          this.logger.warn("failed parsing options string in nesting for key ".concat(key), e);
          return "".concat(key).concat(sep).concat(optionsString);
        }
        delete clonedOptions.defaultValue;
        return key;
      }
      while (match = this.nestingRegexp.exec(str)) {
        var formatters = [];
        var doReduce = false;
        if (match[0].indexOf(this.formatSeparator) !== -1 && !/{.*}/.test(match[1])) {
          var r = match[1].split(this.formatSeparator).map(function(elem) {
            return elem.trim();
          });
          match[1] = r.shift();
          formatters = r;
          doReduce = true;
        }
        value = fc(handleHasOptions.call(this, match[1].trim(), clonedOptions), clonedOptions);
        if (value && match[0] === str && typeof value !== "string")
          return value;
        if (typeof value !== "string")
          value = makeString(value);
        if (!value) {
          this.logger.warn("missed to resolve ".concat(match[1], " for nesting ").concat(str));
          value = "";
        }
        if (doReduce) {
          value = formatters.reduce(function(v, f) {
            return _this2.format(v, f, options.lng, _objectSpread$3(_objectSpread$3({}, options), {}, {
              interpolationkey: match[1].trim()
            }));
          }, value.trim());
        }
        str = str.replace(match[0], value);
        this.regexp.lastIndex = 0;
      }
      return str;
    }
  }]);
  return Interpolator2;
}();
function ownKeys$4(object, enumerableOnly) {
  var keys = Object.keys(object);
  if (Object.getOwnPropertySymbols) {
    var symbols = Object.getOwnPropertySymbols(object);
    if (enumerableOnly) {
      symbols = symbols.filter(function(sym) {
        return Object.getOwnPropertyDescriptor(object, sym).enumerable;
      });
    }
    keys.push.apply(keys, symbols);
  }
  return keys;
}
function _objectSpread$4(target) {
  for (var i = 1;i < arguments.length; i++) {
    var source = arguments[i] != null ? arguments[i] : {};
    if (i % 2) {
      ownKeys$4(Object(source), true).forEach(function(key) {
        _defineProperty(target, key, source[key]);
      });
    } else if (Object.getOwnPropertyDescriptors) {
      Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    } else {
      ownKeys$4(Object(source)).forEach(function(key) {
        Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
      });
    }
  }
  return target;
}
function parseFormatStr(formatStr) {
  var formatName = formatStr.toLowerCase().trim();
  var formatOptions = {};
  if (formatStr.indexOf("(") > -1) {
    var p = formatStr.split("(");
    formatName = p[0].toLowerCase().trim();
    var optStr = p[1].substring(0, p[1].length - 1);
    if (formatName === "currency" && optStr.indexOf(":") < 0) {
      if (!formatOptions.currency)
        formatOptions.currency = optStr.trim();
    } else if (formatName === "relativetime" && optStr.indexOf(":") < 0) {
      if (!formatOptions.range)
        formatOptions.range = optStr.trim();
    } else {
      var opts = optStr.split(";");
      opts.forEach(function(opt) {
        if (!opt)
          return;
        var _opt$split = opt.split(":"), _opt$split2 = _toArray(_opt$split), key = _opt$split2[0], rest = _opt$split2.slice(1);
        var val = rest.join(":").trim().replace(/^'+|'+$/g, "");
        if (!formatOptions[key.trim()])
          formatOptions[key.trim()] = val;
        if (val === "false")
          formatOptions[key.trim()] = false;
        if (val === "true")
          formatOptions[key.trim()] = true;
        if (!isNaN(val))
          formatOptions[key.trim()] = parseInt(val, 10);
      });
    }
  }
  return {
    formatName,
    formatOptions
  };
}
function createCachedFormatter(fn) {
  var cache = {};
  return function invokeFormatter(val, lng, options) {
    var key = lng + JSON.stringify(options);
    var formatter = cache[key];
    if (!formatter) {
      formatter = fn(lng, options);
      cache[key] = formatter;
    }
    return formatter(val);
  };
}
var Formatter = function() {
  function Formatter2() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    _classCallCheck(this, Formatter2);
    this.logger = baseLogger.create("formatter");
    this.options = options;
    this.formats = {
      number: createCachedFormatter(function(lng, options2) {
        var formatter = new Intl.NumberFormat(lng, options2);
        return function(val) {
          return formatter.format(val);
        };
      }),
      currency: createCachedFormatter(function(lng, options2) {
        var formatter = new Intl.NumberFormat(lng, _objectSpread$4(_objectSpread$4({}, options2), {}, {
          style: "currency"
        }));
        return function(val) {
          return formatter.format(val);
        };
      }),
      datetime: createCachedFormatter(function(lng, options2) {
        var formatter = new Intl.DateTimeFormat(lng, _objectSpread$4({}, options2));
        return function(val) {
          return formatter.format(val);
        };
      }),
      relativetime: createCachedFormatter(function(lng, options2) {
        var formatter = new Intl.RelativeTimeFormat(lng, _objectSpread$4({}, options2));
        return function(val) {
          return formatter.format(val, options2.range || "day");
        };
      }),
      list: createCachedFormatter(function(lng, options2) {
        var formatter = new Intl.ListFormat(lng, _objectSpread$4({}, options2));
        return function(val) {
          return formatter.format(val);
        };
      })
    };
    this.init(options);
  }
  _createClass(Formatter2, [{
    key: "init",
    value: function init(services) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {
        interpolation: {}
      };
      var iOpts = options.interpolation;
      this.formatSeparator = iOpts.formatSeparator ? iOpts.formatSeparator : iOpts.formatSeparator || ",";
    }
  }, {
    key: "add",
    value: function add(name, fc) {
      this.formats[name.toLowerCase().trim()] = fc;
    }
  }, {
    key: "addCached",
    value: function addCached(name, fc) {
      this.formats[name.toLowerCase().trim()] = createCachedFormatter(fc);
    }
  }, {
    key: "format",
    value: function format(value, _format, lng, options) {
      var _this = this;
      var formats = _format.split(this.formatSeparator);
      var result = formats.reduce(function(mem, f) {
        var _parseFormatStr = parseFormatStr(f), formatName = _parseFormatStr.formatName, formatOptions = _parseFormatStr.formatOptions;
        if (_this.formats[formatName]) {
          var formatted = mem;
          try {
            var valOptions = options && options.formatParams && options.formatParams[options.interpolationkey] || {};
            var l = valOptions.locale || valOptions.lng || options.locale || options.lng || lng;
            formatted = _this.formats[formatName](mem, l, _objectSpread$4(_objectSpread$4(_objectSpread$4({}, formatOptions), options), valOptions));
          } catch (error2) {
            _this.logger.warn(error2);
          }
          return formatted;
        } else {
          _this.logger.warn("there was no format function for ".concat(formatName));
        }
        return mem;
      }, value);
      return result;
    }
  }]);
  return Formatter2;
}();
function ownKeys$5(object, enumerableOnly) {
  var keys = Object.keys(object);
  if (Object.getOwnPropertySymbols) {
    var symbols = Object.getOwnPropertySymbols(object);
    if (enumerableOnly) {
      symbols = symbols.filter(function(sym) {
        return Object.getOwnPropertyDescriptor(object, sym).enumerable;
      });
    }
    keys.push.apply(keys, symbols);
  }
  return keys;
}
function _objectSpread$5(target) {
  for (var i = 1;i < arguments.length; i++) {
    var source = arguments[i] != null ? arguments[i] : {};
    if (i % 2) {
      ownKeys$5(Object(source), true).forEach(function(key) {
        _defineProperty(target, key, source[key]);
      });
    } else if (Object.getOwnPropertyDescriptors) {
      Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    } else {
      ownKeys$5(Object(source)).forEach(function(key) {
        Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
      });
    }
  }
  return target;
}
function _createSuper$2(Derived) {
  var hasNativeReflectConstruct = _isNativeReflectConstruct$2();
  return function _createSuperInternal() {
    var Super = _getPrototypeOf(Derived), result;
    if (hasNativeReflectConstruct) {
      var NewTarget = _getPrototypeOf(this).constructor;
      result = Reflect.construct(Super, arguments, NewTarget);
    } else {
      result = Super.apply(this, arguments);
    }
    return _possibleConstructorReturn(this, result);
  };
}
function _isNativeReflectConstruct$2() {
  if (typeof Reflect === "undefined" || !Reflect.construct)
    return false;
  if (Reflect.construct.sham)
    return false;
  if (typeof Proxy === "function")
    return true;
  try {
    Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {}));
    return true;
  } catch (e) {
    return false;
  }
}
function removePending(q, name) {
  if (q.pending[name] !== undefined) {
    delete q.pending[name];
    q.pendingCount--;
  }
}
var Connector = function(_EventEmitter) {
  _inherits(Connector2, _EventEmitter);
  var _super = _createSuper$2(Connector2);
  function Connector2(backend, store, services) {
    var _this;
    var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
    _classCallCheck(this, Connector2);
    _this = _super.call(this);
    if (isIE10) {
      EventEmitter.call(_assertThisInitialized(_this));
    }
    _this.backend = backend;
    _this.store = store;
    _this.services = services;
    _this.languageUtils = services.languageUtils;
    _this.options = options;
    _this.logger = baseLogger.create("backendConnector");
    _this.waitingReads = [];
    _this.maxParallelReads = options.maxParallelReads || 10;
    _this.readingCalls = 0;
    _this.maxRetries = options.maxRetries >= 0 ? options.maxRetries : 5;
    _this.retryTimeout = options.retryTimeout >= 1 ? options.retryTimeout : 350;
    _this.state = {};
    _this.queue = [];
    if (_this.backend && _this.backend.init) {
      _this.backend.init(services, options.backend, options);
    }
    return _this;
  }
  _createClass(Connector2, [{
    key: "queueLoad",
    value: function queueLoad(languages, namespaces, options, callback) {
      var _this2 = this;
      var toLoad = {};
      var pending = {};
      var toLoadLanguages = {};
      var toLoadNamespaces = {};
      languages.forEach(function(lng) {
        var hasAllNamespaces = true;
        namespaces.forEach(function(ns) {
          var name = "".concat(lng, "|").concat(ns);
          if (!options.reload && _this2.store.hasResourceBundle(lng, ns)) {
            _this2.state[name] = 2;
          } else if (_this2.state[name] < 0)
            ;
          else if (_this2.state[name] === 1) {
            if (pending[name] === undefined)
              pending[name] = true;
          } else {
            _this2.state[name] = 1;
            hasAllNamespaces = false;
            if (pending[name] === undefined)
              pending[name] = true;
            if (toLoad[name] === undefined)
              toLoad[name] = true;
            if (toLoadNamespaces[ns] === undefined)
              toLoadNamespaces[ns] = true;
          }
        });
        if (!hasAllNamespaces)
          toLoadLanguages[lng] = true;
      });
      if (Object.keys(toLoad).length || Object.keys(pending).length) {
        this.queue.push({
          pending,
          pendingCount: Object.keys(pending).length,
          loaded: {},
          errors: [],
          callback
        });
      }
      return {
        toLoad: Object.keys(toLoad),
        pending: Object.keys(pending),
        toLoadLanguages: Object.keys(toLoadLanguages),
        toLoadNamespaces: Object.keys(toLoadNamespaces)
      };
    }
  }, {
    key: "loaded",
    value: function loaded(name, err, data) {
      var s = name.split("|");
      var lng = s[0];
      var ns = s[1];
      if (err)
        this.emit("failedLoading", lng, ns, err);
      if (data) {
        this.store.addResourceBundle(lng, ns, data);
      }
      this.state[name] = err ? -1 : 2;
      var loaded2 = {};
      this.queue.forEach(function(q) {
        pushPath(q.loaded, [lng], ns);
        removePending(q, name);
        if (err)
          q.errors.push(err);
        if (q.pendingCount === 0 && !q.done) {
          Object.keys(q.loaded).forEach(function(l) {
            if (!loaded2[l])
              loaded2[l] = {};
            var loadedKeys = q.loaded[l];
            if (loadedKeys.length) {
              loadedKeys.forEach(function(ns2) {
                if (loaded2[l][ns2] === undefined)
                  loaded2[l][ns2] = true;
              });
            }
          });
          q.done = true;
          if (q.errors.length) {
            q.callback(q.errors);
          } else {
            q.callback();
          }
        }
      });
      this.emit("loaded", loaded2);
      this.queue = this.queue.filter(function(q) {
        return !q.done;
      });
    }
  }, {
    key: "read",
    value: function read(lng, ns, fcName) {
      var _this3 = this;
      var tried = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;
      var wait = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : this.retryTimeout;
      var callback = arguments.length > 5 ? arguments[5] : undefined;
      if (!lng.length)
        return callback(null, {});
      if (this.readingCalls >= this.maxParallelReads) {
        this.waitingReads.push({
          lng,
          ns,
          fcName,
          tried,
          wait,
          callback
        });
        return;
      }
      this.readingCalls++;
      return this.backend[fcName](lng, ns, function(err, data) {
        _this3.readingCalls--;
        if (_this3.waitingReads.length > 0) {
          var next = _this3.waitingReads.shift();
          _this3.read(next.lng, next.ns, next.fcName, next.tried, next.wait, next.callback);
        }
        if (err && data && tried < _this3.maxRetries) {
          setTimeout(function() {
            _this3.read.call(_this3, lng, ns, fcName, tried + 1, wait * 2, callback);
          }, wait);
          return;
        }
        callback(err, data);
      });
    }
  }, {
    key: "prepareLoading",
    value: function prepareLoading(languages, namespaces) {
      var _this4 = this;
      var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
      var callback = arguments.length > 3 ? arguments[3] : undefined;
      if (!this.backend) {
        this.logger.warn("No backend was added via i18next.use. Will not load resources.");
        return callback && callback();
      }
      if (typeof languages === "string")
        languages = this.languageUtils.toResolveHierarchy(languages);
      if (typeof namespaces === "string")
        namespaces = [namespaces];
      var toLoad = this.queueLoad(languages, namespaces, options, callback);
      if (!toLoad.toLoad.length) {
        if (!toLoad.pending.length)
          callback();
        return null;
      }
      toLoad.toLoad.forEach(function(name) {
        _this4.loadOne(name);
      });
    }
  }, {
    key: "load",
    value: function load(languages, namespaces, callback) {
      this.prepareLoading(languages, namespaces, {}, callback);
    }
  }, {
    key: "reload",
    value: function reload(languages, namespaces, callback) {
      this.prepareLoading(languages, namespaces, {
        reload: true
      }, callback);
    }
  }, {
    key: "loadOne",
    value: function loadOne(name) {
      var _this5 = this;
      var prefix = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "";
      var s = name.split("|");
      var lng = s[0];
      var ns = s[1];
      this.read(lng, ns, "read", undefined, undefined, function(err, data) {
        if (err)
          _this5.logger.warn("".concat(prefix, "loading namespace ").concat(ns, " for language ").concat(lng, " failed"), err);
        if (!err && data)
          _this5.logger.log("".concat(prefix, "loaded namespace ").concat(ns, " for language ").concat(lng), data);
        _this5.loaded(name, err, data);
      });
    }
  }, {
    key: "saveMissing",
    value: function saveMissing(languages, namespace, key, fallbackValue, isUpdate) {
      var options = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : {};
      if (this.services.utils && this.services.utils.hasLoadedNamespace && !this.services.utils.hasLoadedNamespace(namespace)) {
        this.logger.warn('did not save key "'.concat(key, '" as the namespace "').concat(namespace, '" was not yet loaded'), "This means something IS WRONG in your setup. You access the t function before i18next.init / i18next.loadNamespace / i18next.changeLanguage was done. Wait for the callback or Promise to resolve before accessing it!!!");
        return;
      }
      if (key === undefined || key === null || key === "")
        return;
      if (this.backend && this.backend.create) {
        this.backend.create(languages, namespace, key, fallbackValue, null, _objectSpread$5(_objectSpread$5({}, options), {}, {
          isUpdate
        }));
      }
      if (!languages || !languages[0])
        return;
      this.store.addResource(languages[0], namespace, key, fallbackValue);
    }
  }]);
  return Connector2;
}(EventEmitter);
function get() {
  return {
    debug: false,
    initImmediate: true,
    ns: ["translation"],
    defaultNS: ["translation"],
    fallbackLng: ["dev"],
    fallbackNS: false,
    supportedLngs: false,
    nonExplicitSupportedLngs: false,
    load: "all",
    preload: false,
    simplifyPluralSuffix: true,
    keySeparator: ".",
    nsSeparator: ":",
    pluralSeparator: "_",
    contextSeparator: "_",
    partialBundledLanguages: false,
    saveMissing: false,
    updateMissing: false,
    saveMissingTo: "fallback",
    saveMissingPlurals: true,
    missingKeyHandler: false,
    missingInterpolationHandler: false,
    postProcess: false,
    postProcessPassResolved: false,
    returnNull: true,
    returnEmptyString: true,
    returnObjects: false,
    joinArrays: false,
    returnedObjectHandler: false,
    parseMissingKeyHandler: false,
    appendNamespaceToMissingKey: false,
    appendNamespaceToCIMode: false,
    overloadTranslationOptionHandler: function handle2(args) {
      var ret = {};
      if (_typeof(args[1]) === "object")
        ret = args[1];
      if (typeof args[1] === "string")
        ret.defaultValue = args[1];
      if (typeof args[2] === "string")
        ret.tDescription = args[2];
      if (_typeof(args[2]) === "object" || _typeof(args[3]) === "object") {
        var options = args[3] || args[2];
        Object.keys(options).forEach(function(key) {
          ret[key] = options[key];
        });
      }
      return ret;
    },
    interpolation: {
      escapeValue: true,
      format: function format(value, _format, lng, options) {
        return value;
      },
      prefix: "{{",
      suffix: "}}",
      formatSeparator: ",",
      unescapePrefix: "-",
      nestingPrefix: "$t(",
      nestingSuffix: ")",
      nestingOptionsSeparator: ",",
      maxReplaces: 1000,
      skipOnVariables: true
    }
  };
}
function transformOptions(options) {
  if (typeof options.ns === "string")
    options.ns = [options.ns];
  if (typeof options.fallbackLng === "string")
    options.fallbackLng = [options.fallbackLng];
  if (typeof options.fallbackNS === "string")
    options.fallbackNS = [options.fallbackNS];
  if (options.supportedLngs && options.supportedLngs.indexOf("cimode") < 0) {
    options.supportedLngs = options.supportedLngs.concat(["cimode"]);
  }
  return options;
}
function ownKeys$6(object, enumerableOnly) {
  var keys = Object.keys(object);
  if (Object.getOwnPropertySymbols) {
    var symbols = Object.getOwnPropertySymbols(object);
    if (enumerableOnly) {
      symbols = symbols.filter(function(sym) {
        return Object.getOwnPropertyDescriptor(object, sym).enumerable;
      });
    }
    keys.push.apply(keys, symbols);
  }
  return keys;
}
function _objectSpread$6(target) {
  for (var i = 1;i < arguments.length; i++) {
    var source = arguments[i] != null ? arguments[i] : {};
    if (i % 2) {
      ownKeys$6(Object(source), true).forEach(function(key) {
        _defineProperty(target, key, source[key]);
      });
    } else if (Object.getOwnPropertyDescriptors) {
      Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    } else {
      ownKeys$6(Object(source)).forEach(function(key) {
        Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
      });
    }
  }
  return target;
}
function _createSuper$3(Derived) {
  var hasNativeReflectConstruct = _isNativeReflectConstruct$3();
  return function _createSuperInternal() {
    var Super = _getPrototypeOf(Derived), result;
    if (hasNativeReflectConstruct) {
      var NewTarget = _getPrototypeOf(this).constructor;
      result = Reflect.construct(Super, arguments, NewTarget);
    } else {
      result = Super.apply(this, arguments);
    }
    return _possibleConstructorReturn(this, result);
  };
}
function _isNativeReflectConstruct$3() {
  if (typeof Reflect === "undefined" || !Reflect.construct)
    return false;
  if (Reflect.construct.sham)
    return false;
  if (typeof Proxy === "function")
    return true;
  try {
    Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {}));
    return true;
  } catch (e) {
    return false;
  }
}
function noop() {}
function bindMemberFunctions(inst) {
  var mems = Object.getOwnPropertyNames(Object.getPrototypeOf(inst));
  mems.forEach(function(mem) {
    if (typeof inst[mem] === "function") {
      inst[mem] = inst[mem].bind(inst);
    }
  });
}
var I18n = function(_EventEmitter) {
  _inherits(I18n2, _EventEmitter);
  var _super = _createSuper$3(I18n2);
  function I18n2() {
    var _this;
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    var callback = arguments.length > 1 ? arguments[1] : undefined;
    _classCallCheck(this, I18n2);
    _this = _super.call(this);
    if (isIE10) {
      EventEmitter.call(_assertThisInitialized(_this));
    }
    _this.options = transformOptions(options);
    _this.services = {};
    _this.logger = baseLogger;
    _this.modules = {
      external: []
    };
    bindMemberFunctions(_assertThisInitialized(_this));
    if (callback && !_this.isInitialized && !options.isClone) {
      if (!_this.options.initImmediate) {
        _this.init(options, callback);
        return _possibleConstructorReturn(_this, _assertThisInitialized(_this));
      }
      setTimeout(function() {
        _this.init(options, callback);
      }, 0);
    }
    return _this;
  }
  _createClass(I18n2, [{
    key: "init",
    value: function init() {
      var _this2 = this;
      var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      var callback = arguments.length > 1 ? arguments[1] : undefined;
      if (typeof options === "function") {
        callback = options;
        options = {};
      }
      if (!options.defaultNS && options.defaultNS !== false && options.ns) {
        if (typeof options.ns === "string") {
          options.defaultNS = options.ns;
        } else if (options.ns.indexOf("translation") < 0) {
          options.defaultNS = options.ns[0];
        }
      }
      var defOpts = get();
      this.options = _objectSpread$6(_objectSpread$6(_objectSpread$6({}, defOpts), this.options), transformOptions(options));
      if (this.options.compatibilityAPI !== "v1") {
        this.options.interpolation = _objectSpread$6(_objectSpread$6({}, defOpts.interpolation), this.options.interpolation);
      }
      if (options.keySeparator !== undefined) {
        this.options.userDefinedKeySeparator = options.keySeparator;
      }
      if (options.nsSeparator !== undefined) {
        this.options.userDefinedNsSeparator = options.nsSeparator;
      }
      function createClassOnDemand(ClassOrObject) {
        if (!ClassOrObject)
          return null;
        if (typeof ClassOrObject === "function")
          return new ClassOrObject;
        return ClassOrObject;
      }
      if (!this.options.isClone) {
        if (this.modules.logger) {
          baseLogger.init(createClassOnDemand(this.modules.logger), this.options);
        } else {
          baseLogger.init(null, this.options);
        }
        var formatter;
        if (this.modules.formatter) {
          formatter = this.modules.formatter;
        } else if (typeof Intl !== "undefined") {
          formatter = Formatter;
        }
        var lu = new LanguageUtil(this.options);
        this.store = new ResourceStore(this.options.resources, this.options);
        var s = this.services;
        s.logger = baseLogger;
        s.resourceStore = this.store;
        s.languageUtils = lu;
        s.pluralResolver = new PluralResolver(lu, {
          prepend: this.options.pluralSeparator,
          compatibilityJSON: this.options.compatibilityJSON,
          simplifyPluralSuffix: this.options.simplifyPluralSuffix
        });
        if (formatter && (!this.options.interpolation.format || this.options.interpolation.format === defOpts.interpolation.format)) {
          s.formatter = createClassOnDemand(formatter);
          s.formatter.init(s, this.options);
          this.options.interpolation.format = s.formatter.format.bind(s.formatter);
        }
        s.interpolator = new Interpolator(this.options);
        s.utils = {
          hasLoadedNamespace: this.hasLoadedNamespace.bind(this)
        };
        s.backendConnector = new Connector(createClassOnDemand(this.modules.backend), s.resourceStore, s, this.options);
        s.backendConnector.on("*", function(event) {
          for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1;_key < _len; _key++) {
            args[_key - 1] = arguments[_key];
          }
          _this2.emit.apply(_this2, [event].concat(args));
        });
        if (this.modules.languageDetector) {
          s.languageDetector = createClassOnDemand(this.modules.languageDetector);
          s.languageDetector.init(s, this.options.detection, this.options);
        }
        if (this.modules.i18nFormat) {
          s.i18nFormat = createClassOnDemand(this.modules.i18nFormat);
          if (s.i18nFormat.init)
            s.i18nFormat.init(this);
        }
        this.translator = new Translator(this.services, this.options);
        this.translator.on("*", function(event) {
          for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1;_key2 < _len2; _key2++) {
            args[_key2 - 1] = arguments[_key2];
          }
          _this2.emit.apply(_this2, [event].concat(args));
        });
        this.modules.external.forEach(function(m) {
          if (m.init)
            m.init(_this2);
        });
      }
      this.format = this.options.interpolation.format;
      if (!callback)
        callback = noop;
      if (this.options.fallbackLng && !this.services.languageDetector && !this.options.lng) {
        var codes = this.services.languageUtils.getFallbackCodes(this.options.fallbackLng);
        if (codes.length > 0 && codes[0] !== "dev")
          this.options.lng = codes[0];
      }
      if (!this.services.languageDetector && !this.options.lng) {
        this.logger.warn("init: no languageDetector is used and no lng is defined");
      }
      var storeApi = ["getResource", "hasResourceBundle", "getResourceBundle", "getDataByLanguage"];
      storeApi.forEach(function(fcName) {
        _this2[fcName] = function() {
          var _this2$store;
          return (_this2$store = _this2.store)[fcName].apply(_this2$store, arguments);
        };
      });
      var storeApiChained = ["addResource", "addResources", "addResourceBundle", "removeResourceBundle"];
      storeApiChained.forEach(function(fcName) {
        _this2[fcName] = function() {
          var _this2$store2;
          (_this2$store2 = _this2.store)[fcName].apply(_this2$store2, arguments);
          return _this2;
        };
      });
      var deferred = defer();
      var load = function load2() {
        var finish = function finish2(err, t) {
          if (_this2.isInitialized && !_this2.initializedStoreOnce)
            _this2.logger.warn("init: i18next is already initialized. You should call init just once!");
          _this2.isInitialized = true;
          if (!_this2.options.isClone)
            _this2.logger.log("initialized", _this2.options);
          _this2.emit("initialized", _this2.options);
          deferred.resolve(t);
          callback(err, t);
        };
        if (_this2.languages && _this2.options.compatibilityAPI !== "v1" && !_this2.isInitialized)
          return finish(null, _this2.t.bind(_this2));
        _this2.changeLanguage(_this2.options.lng, finish);
      };
      if (this.options.resources || !this.options.initImmediate) {
        load();
      } else {
        setTimeout(load, 0);
      }
      return deferred;
    }
  }, {
    key: "loadResources",
    value: function loadResources(language) {
      var _this3 = this;
      var callback = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : noop;
      var usedCallback = callback;
      var usedLng = typeof language === "string" ? language : this.language;
      if (typeof language === "function")
        usedCallback = language;
      if (!this.options.resources || this.options.partialBundledLanguages) {
        if (usedLng && usedLng.toLowerCase() === "cimode")
          return usedCallback();
        var toLoad = [];
        var append = function append2(lng) {
          if (!lng)
            return;
          var lngs = _this3.services.languageUtils.toResolveHierarchy(lng);
          lngs.forEach(function(l) {
            if (toLoad.indexOf(l) < 0)
              toLoad.push(l);
          });
        };
        if (!usedLng) {
          var fallbacks = this.services.languageUtils.getFallbackCodes(this.options.fallbackLng);
          fallbacks.forEach(function(l) {
            return append(l);
          });
        } else {
          append(usedLng);
        }
        if (this.options.preload) {
          this.options.preload.forEach(function(l) {
            return append(l);
          });
        }
        this.services.backendConnector.load(toLoad, this.options.ns, function(e) {
          if (!e && !_this3.resolvedLanguage && _this3.language)
            _this3.setResolvedLanguage(_this3.language);
          usedCallback(e);
        });
      } else {
        usedCallback(null);
      }
    }
  }, {
    key: "reloadResources",
    value: function reloadResources(lngs, ns, callback) {
      var deferred = defer();
      if (!lngs)
        lngs = this.languages;
      if (!ns)
        ns = this.options.ns;
      if (!callback)
        callback = noop;
      this.services.backendConnector.reload(lngs, ns, function(err) {
        deferred.resolve();
        callback(err);
      });
      return deferred;
    }
  }, {
    key: "use",
    value: function use(module) {
      if (!module)
        throw new Error("You are passing an undefined module! Please check the object you are passing to i18next.use()");
      if (!module.type)
        throw new Error("You are passing a wrong module! Please check the object you are passing to i18next.use()");
      if (module.type === "backend") {
        this.modules.backend = module;
      }
      if (module.type === "logger" || module.log && module.warn && module.error) {
        this.modules.logger = module;
      }
      if (module.type === "languageDetector") {
        this.modules.languageDetector = module;
      }
      if (module.type === "i18nFormat") {
        this.modules.i18nFormat = module;
      }
      if (module.type === "postProcessor") {
        postProcessor.addPostProcessor(module);
      }
      if (module.type === "formatter") {
        this.modules.formatter = module;
      }
      if (module.type === "3rdParty") {
        this.modules.external.push(module);
      }
      return this;
    }
  }, {
    key: "setResolvedLanguage",
    value: function setResolvedLanguage(l) {
      if (!l || !this.languages)
        return;
      if (["cimode", "dev"].indexOf(l) > -1)
        return;
      for (var li = 0;li < this.languages.length; li++) {
        var lngInLngs = this.languages[li];
        if (["cimode", "dev"].indexOf(lngInLngs) > -1)
          continue;
        if (this.store.hasLanguageSomeTranslations(lngInLngs)) {
          this.resolvedLanguage = lngInLngs;
          break;
        }
      }
    }
  }, {
    key: "changeLanguage",
    value: function changeLanguage(lng, callback) {
      var _this4 = this;
      this.isLanguageChangingTo = lng;
      var deferred = defer();
      this.emit("languageChanging", lng);
      var setLngProps = function setLngProps2(l) {
        _this4.language = l;
        _this4.languages = _this4.services.languageUtils.toResolveHierarchy(l);
        _this4.resolvedLanguage = undefined;
        _this4.setResolvedLanguage(l);
      };
      var done = function done2(err, l) {
        if (l) {
          setLngProps(l);
          _this4.translator.changeLanguage(l);
          _this4.isLanguageChangingTo = undefined;
          _this4.emit("languageChanged", l);
          _this4.logger.log("languageChanged", l);
        } else {
          _this4.isLanguageChangingTo = undefined;
        }
        deferred.resolve(function() {
          return _this4.t.apply(_this4, arguments);
        });
        if (callback)
          callback(err, function() {
            return _this4.t.apply(_this4, arguments);
          });
      };
      var setLng = function setLng2(lngs) {
        if (!lng && !lngs && _this4.services.languageDetector)
          lngs = [];
        var l = typeof lngs === "string" ? lngs : _this4.services.languageUtils.getBestMatchFromCodes(lngs);
        if (l) {
          if (!_this4.language) {
            setLngProps(l);
          }
          if (!_this4.translator.language)
            _this4.translator.changeLanguage(l);
          if (_this4.services.languageDetector)
            _this4.services.languageDetector.cacheUserLanguage(l);
        }
        _this4.loadResources(l, function(err) {
          done(err, l);
        });
      };
      if (!lng && this.services.languageDetector && !this.services.languageDetector.async) {
        setLng(this.services.languageDetector.detect());
      } else if (!lng && this.services.languageDetector && this.services.languageDetector.async) {
        this.services.languageDetector.detect(setLng);
      } else {
        setLng(lng);
      }
      return deferred;
    }
  }, {
    key: "getFixedT",
    value: function getFixedT(lng, ns, keyPrefix) {
      var _this5 = this;
      var fixedT = function fixedT2(key, opts) {
        var options;
        if (_typeof(opts) !== "object") {
          for (var _len3 = arguments.length, rest = new Array(_len3 > 2 ? _len3 - 2 : 0), _key3 = 2;_key3 < _len3; _key3++) {
            rest[_key3 - 2] = arguments[_key3];
          }
          options = _this5.options.overloadTranslationOptionHandler([key, opts].concat(rest));
        } else {
          options = _objectSpread$6({}, opts);
        }
        options.lng = options.lng || fixedT2.lng;
        options.lngs = options.lngs || fixedT2.lngs;
        options.ns = options.ns || fixedT2.ns;
        options.keyPrefix = options.keyPrefix || keyPrefix || fixedT2.keyPrefix;
        var keySeparator = _this5.options.keySeparator || ".";
        var resultKey = options.keyPrefix ? "".concat(options.keyPrefix).concat(keySeparator).concat(key) : key;
        return _this5.t(resultKey, options);
      };
      if (typeof lng === "string") {
        fixedT.lng = lng;
      } else {
        fixedT.lngs = lng;
      }
      fixedT.ns = ns;
      fixedT.keyPrefix = keyPrefix;
      return fixedT;
    }
  }, {
    key: "t",
    value: function t() {
      var _this$translator;
      return this.translator && (_this$translator = this.translator).translate.apply(_this$translator, arguments);
    }
  }, {
    key: "exists",
    value: function exists() {
      var _this$translator2;
      return this.translator && (_this$translator2 = this.translator).exists.apply(_this$translator2, arguments);
    }
  }, {
    key: "setDefaultNamespace",
    value: function setDefaultNamespace(ns) {
      this.options.defaultNS = ns;
    }
  }, {
    key: "hasLoadedNamespace",
    value: function hasLoadedNamespace(ns) {
      var _this6 = this;
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      if (!this.isInitialized) {
        this.logger.warn("hasLoadedNamespace: i18next was not initialized", this.languages);
        return false;
      }
      if (!this.languages || !this.languages.length) {
        this.logger.warn("hasLoadedNamespace: i18n.languages were undefined or empty", this.languages);
        return false;
      }
      var lng = this.resolvedLanguage || this.languages[0];
      var fallbackLng = this.options ? this.options.fallbackLng : false;
      var lastLng = this.languages[this.languages.length - 1];
      if (lng.toLowerCase() === "cimode")
        return true;
      var loadNotPending = function loadNotPending2(l, n) {
        var loadState = _this6.services.backendConnector.state["".concat(l, "|").concat(n)];
        return loadState === -1 || loadState === 2;
      };
      if (options.precheck) {
        var preResult = options.precheck(this, loadNotPending);
        if (preResult !== undefined)
          return preResult;
      }
      if (this.hasResourceBundle(lng, ns))
        return true;
      if (!this.services.backendConnector.backend || this.options.resources && !this.options.partialBundledLanguages)
        return true;
      if (loadNotPending(lng, ns) && (!fallbackLng || loadNotPending(lastLng, ns)))
        return true;
      return false;
    }
  }, {
    key: "loadNamespaces",
    value: function loadNamespaces(ns, callback) {
      var _this7 = this;
      var deferred = defer();
      if (!this.options.ns) {
        callback && callback();
        return Promise.resolve();
      }
      if (typeof ns === "string")
        ns = [ns];
      ns.forEach(function(n) {
        if (_this7.options.ns.indexOf(n) < 0)
          _this7.options.ns.push(n);
      });
      this.loadResources(function(err) {
        deferred.resolve();
        if (callback)
          callback(err);
      });
      return deferred;
    }
  }, {
    key: "loadLanguages",
    value: function loadLanguages(lngs, callback) {
      var deferred = defer();
      if (typeof lngs === "string")
        lngs = [lngs];
      var preloaded = this.options.preload || [];
      var newLngs = lngs.filter(function(lng) {
        return preloaded.indexOf(lng) < 0;
      });
      if (!newLngs.length) {
        if (callback)
          callback();
        return Promise.resolve();
      }
      this.options.preload = preloaded.concat(newLngs);
      this.loadResources(function(err) {
        deferred.resolve();
        if (callback)
          callback(err);
      });
      return deferred;
    }
  }, {
    key: "dir",
    value: function dir(lng) {
      if (!lng)
        lng = this.resolvedLanguage || (this.languages && this.languages.length > 0 ? this.languages[0] : this.language);
      if (!lng)
        return "rtl";
      var rtlLngs = ["ar", "shu", "sqr", "ssh", "xaa", "yhd", "yud", "aao", "abh", "abv", "acm", "acq", "acw", "acx", "acy", "adf", "ads", "aeb", "aec", "afb", "ajp", "apc", "apd", "arb", "arq", "ars", "ary", "arz", "auz", "avl", "ayh", "ayl", "ayn", "ayp", "bbz", "pga", "he", "iw", "ps", "pbt", "pbu", "pst", "prp", "prd", "ug", "ur", "ydd", "yds", "yih", "ji", "yi", "hbo", "men", "xmn", "fa", "jpr", "peo", "pes", "prs", "dv", "sam", "ckb"];
      return rtlLngs.indexOf(this.services.languageUtils.getLanguagePartFromCode(lng)) > -1 || lng.toLowerCase().indexOf("-arab") > 1 ? "rtl" : "ltr";
    }
  }, {
    key: "cloneInstance",
    value: function cloneInstance() {
      var _this8 = this;
      var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      var callback = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : noop;
      var mergedOptions = _objectSpread$6(_objectSpread$6(_objectSpread$6({}, this.options), options), {
        isClone: true
      });
      var clone = new I18n2(mergedOptions);
      if (options.debug !== undefined || options.prefix !== undefined) {
        clone.logger = clone.logger.clone(options);
      }
      var membersToCopy = ["store", "services", "language"];
      membersToCopy.forEach(function(m) {
        clone[m] = _this8[m];
      });
      clone.services = _objectSpread$6({}, this.services);
      clone.services.utils = {
        hasLoadedNamespace: clone.hasLoadedNamespace.bind(clone)
      };
      clone.translator = new Translator(clone.services, clone.options);
      clone.translator.on("*", function(event) {
        for (var _len4 = arguments.length, args = new Array(_len4 > 1 ? _len4 - 1 : 0), _key4 = 1;_key4 < _len4; _key4++) {
          args[_key4 - 1] = arguments[_key4];
        }
        clone.emit.apply(clone, [event].concat(args));
      });
      clone.init(mergedOptions, callback);
      clone.translator.options = clone.options;
      clone.translator.backendConnector.services.utils = {
        hasLoadedNamespace: clone.hasLoadedNamespace.bind(clone)
      };
      return clone;
    }
  }, {
    key: "toJSON",
    value: function toJSON() {
      return {
        options: this.options,
        store: this.store,
        language: this.language,
        languages: this.languages,
        resolvedLanguage: this.resolvedLanguage
      };
    }
  }]);
  return I18n2;
}(EventEmitter);
_defineProperty(I18n, "createInstance", function() {
  var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var callback = arguments.length > 1 ? arguments[1] : undefined;
  return new I18n(options, callback);
});
var instance = I18n.createInstance();
instance.createInstance = I18n.createInstance;
var createInstance = instance.createInstance;
var init = instance.init;
var loadResources = instance.loadResources;
var reloadResources = instance.reloadResources;
var use = instance.use;
var changeLanguage = instance.changeLanguage;
var getFixedT = instance.getFixedT;
var t = instance.t;
var exists = instance.exists;
var setDefaultNamespace = instance.setDefaultNamespace;
var hasLoadedNamespace = instance.hasLoadedNamespace;
var loadNamespaces = instance.loadNamespaces;
var loadLanguages = instance.loadLanguages;
var i18next_default = instance;

// ../../../../node_modules/i18next-browser-languagedetector/dist/esm/i18nextBrowserLanguageDetector.js
var arr = [];
var each = arr.forEach;
var slice = arr.slice;
function defaults(obj) {
  each.call(slice.call(arguments, 1), function(source) {
    if (source) {
      for (var prop in source) {
        if (obj[prop] === undefined)
          obj[prop] = source[prop];
      }
    }
  });
  return obj;
}
var fieldContentRegExp = /^[\u0009\u0020-\u007e\u0080-\u00ff]+$/;
var serializeCookie = function serializeCookie2(name, val, options) {
  var opt = options || {};
  opt.path = opt.path || "/";
  var value = encodeURIComponent(val);
  var str = "".concat(name, "=").concat(value);
  if (opt.maxAge > 0) {
    var maxAge = opt.maxAge - 0;
    if (Number.isNaN(maxAge))
      throw new Error("maxAge should be a Number");
    str += "; Max-Age=".concat(Math.floor(maxAge));
  }
  if (opt.domain) {
    if (!fieldContentRegExp.test(opt.domain)) {
      throw new TypeError("option domain is invalid");
    }
    str += "; Domain=".concat(opt.domain);
  }
  if (opt.path) {
    if (!fieldContentRegExp.test(opt.path)) {
      throw new TypeError("option path is invalid");
    }
    str += "; Path=".concat(opt.path);
  }
  if (opt.expires) {
    if (typeof opt.expires.toUTCString !== "function") {
      throw new TypeError("option expires is invalid");
    }
    str += "; Expires=".concat(opt.expires.toUTCString());
  }
  if (opt.httpOnly)
    str += "; HttpOnly";
  if (opt.secure)
    str += "; Secure";
  if (opt.sameSite) {
    var sameSite = typeof opt.sameSite === "string" ? opt.sameSite.toLowerCase() : opt.sameSite;
    switch (sameSite) {
      case true:
        str += "; SameSite=Strict";
        break;
      case "lax":
        str += "; SameSite=Lax";
        break;
      case "strict":
        str += "; SameSite=Strict";
        break;
      case "none":
        str += "; SameSite=None";
        break;
      default:
        throw new TypeError("option sameSite is invalid");
    }
  }
  return str;
};
var cookie = {
  create: function create(name, value, minutes, domain) {
    var cookieOptions = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {
      path: "/",
      sameSite: "strict"
    };
    if (minutes) {
      cookieOptions.expires = new Date;
      cookieOptions.expires.setTime(cookieOptions.expires.getTime() + minutes * 60 * 1000);
    }
    if (domain)
      cookieOptions.domain = domain;
    document.cookie = serializeCookie(name, encodeURIComponent(value), cookieOptions);
  },
  read: function read(name) {
    var nameEQ = "".concat(name, "=");
    var ca = document.cookie.split(";");
    for (var i = 0;i < ca.length; i++) {
      var c = ca[i];
      while (c.charAt(0) === " ") {
        c = c.substring(1, c.length);
      }
      if (c.indexOf(nameEQ) === 0)
        return c.substring(nameEQ.length, c.length);
    }
    return null;
  },
  remove: function remove(name) {
    this.create(name, "", -1);
  }
};
var cookie$1 = {
  name: "cookie",
  lookup: function lookup(options) {
    var found;
    if (options.lookupCookie && typeof document !== "undefined") {
      var c = cookie.read(options.lookupCookie);
      if (c)
        found = c;
    }
    return found;
  },
  cacheUserLanguage: function cacheUserLanguage(lng, options) {
    if (options.lookupCookie && typeof document !== "undefined") {
      cookie.create(options.lookupCookie, lng, options.cookieMinutes, options.cookieDomain, options.cookieOptions);
    }
  }
};
var querystring = {
  name: "querystring",
  lookup: function lookup2(options) {
    var found;
    if (typeof window !== "undefined") {
      var search = window.location.search;
      if (!window.location.search && window.location.hash && window.location.hash.indexOf("?") > -1) {
        search = window.location.hash.substring(window.location.hash.indexOf("?"));
      }
      var query = search.substring(1);
      var params = query.split("&");
      for (var i = 0;i < params.length; i++) {
        var pos = params[i].indexOf("=");
        if (pos > 0) {
          var key = params[i].substring(0, pos);
          if (key === options.lookupQuerystring) {
            found = params[i].substring(pos + 1);
          }
        }
      }
    }
    return found;
  }
};
var hasLocalStorageSupport = null;
var localStorageAvailable = function localStorageAvailable2() {
  if (hasLocalStorageSupport !== null)
    return hasLocalStorageSupport;
  try {
    hasLocalStorageSupport = window !== "undefined" && window.localStorage !== null;
    var testKey = "i18next.translate.boo";
    window.localStorage.setItem(testKey, "foo");
    window.localStorage.removeItem(testKey);
  } catch (e) {
    hasLocalStorageSupport = false;
  }
  return hasLocalStorageSupport;
};
var localStorage = {
  name: "localStorage",
  lookup: function lookup3(options) {
    var found;
    if (options.lookupLocalStorage && localStorageAvailable()) {
      var lng = window.localStorage.getItem(options.lookupLocalStorage);
      if (lng)
        found = lng;
    }
    return found;
  },
  cacheUserLanguage: function cacheUserLanguage2(lng, options) {
    if (options.lookupLocalStorage && localStorageAvailable()) {
      window.localStorage.setItem(options.lookupLocalStorage, lng);
    }
  }
};
var hasSessionStorageSupport = null;
var sessionStorageAvailable = function sessionStorageAvailable2() {
  if (hasSessionStorageSupport !== null)
    return hasSessionStorageSupport;
  try {
    hasSessionStorageSupport = window !== "undefined" && window.sessionStorage !== null;
    var testKey = "i18next.translate.boo";
    window.sessionStorage.setItem(testKey, "foo");
    window.sessionStorage.removeItem(testKey);
  } catch (e) {
    hasSessionStorageSupport = false;
  }
  return hasSessionStorageSupport;
};
var sessionStorage = {
  name: "sessionStorage",
  lookup: function lookup4(options) {
    var found;
    if (options.lookupSessionStorage && sessionStorageAvailable()) {
      var lng = window.sessionStorage.getItem(options.lookupSessionStorage);
      if (lng)
        found = lng;
    }
    return found;
  },
  cacheUserLanguage: function cacheUserLanguage3(lng, options) {
    if (options.lookupSessionStorage && sessionStorageAvailable()) {
      window.sessionStorage.setItem(options.lookupSessionStorage, lng);
    }
  }
};
var navigator$1 = {
  name: "navigator",
  lookup: function lookup5(options) {
    var found = [];
    if (typeof navigator !== "undefined") {
      if (navigator.languages) {
        for (var i = 0;i < navigator.languages.length; i++) {
          found.push(navigator.languages[i]);
        }
      }
      if (navigator.userLanguage) {
        found.push(navigator.userLanguage);
      }
      if (navigator.language) {
        found.push(navigator.language);
      }
    }
    return found.length > 0 ? found : undefined;
  }
};
var htmlTag = {
  name: "htmlTag",
  lookup: function lookup6(options) {
    var found;
    var htmlTag2 = options.htmlTag || (typeof document !== "undefined" ? document.documentElement : null);
    if (htmlTag2 && typeof htmlTag2.getAttribute === "function") {
      found = htmlTag2.getAttribute("lang");
    }
    return found;
  }
};
var path = {
  name: "path",
  lookup: function lookup7(options) {
    var found;
    if (typeof window !== "undefined") {
      var language = window.location.pathname.match(/\/([a-zA-Z-]*)/g);
      if (language instanceof Array) {
        if (typeof options.lookupFromPathIndex === "number") {
          if (typeof language[options.lookupFromPathIndex] !== "string") {
            return;
          }
          found = language[options.lookupFromPathIndex].replace("/", "");
        } else {
          found = language[0].replace("/", "");
        }
      }
    }
    return found;
  }
};
var subdomain = {
  name: "subdomain",
  lookup: function lookup8(options) {
    var lookupFromSubdomainIndex = typeof options.lookupFromSubdomainIndex === "number" ? options.lookupFromSubdomainIndex + 1 : 1;
    var language = typeof window !== "undefined" && window.location && window.location.hostname && window.location.hostname.match(/^(\w{2,5})\.(([a-z0-9-]{1,63}\.[a-z]{2,6})|localhost)/i);
    if (!language)
      return;
    return language[lookupFromSubdomainIndex];
  }
};
function getDefaults() {
  return {
    order: ["querystring", "cookie", "localStorage", "sessionStorage", "navigator", "htmlTag"],
    lookupQuerystring: "lng",
    lookupCookie: "i18next",
    lookupLocalStorage: "i18nextLng",
    lookupSessionStorage: "i18nextLng",
    caches: ["localStorage"],
    excludeCacheFor: ["cimode"]
  };
}
var Browser = /* @__PURE__ */ function() {
  function Browser2(services) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    _classCallCheck(this, Browser2);
    this.type = "languageDetector";
    this.detectors = {};
    this.init(services, options);
  }
  _createClass(Browser2, [{
    key: "init",
    value: function init2(services) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      var i18nOptions = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
      this.services = services;
      this.options = defaults(options, this.options || {}, getDefaults());
      if (this.options.lookupFromUrlIndex)
        this.options.lookupFromPathIndex = this.options.lookupFromUrlIndex;
      this.i18nOptions = i18nOptions;
      this.addDetector(cookie$1);
      this.addDetector(querystring);
      this.addDetector(localStorage);
      this.addDetector(sessionStorage);
      this.addDetector(navigator$1);
      this.addDetector(htmlTag);
      this.addDetector(path);
      this.addDetector(subdomain);
    }
  }, {
    key: "addDetector",
    value: function addDetector(detector) {
      this.detectors[detector.name] = detector;
    }
  }, {
    key: "detect",
    value: function detect(detectionOrder) {
      var _this = this;
      if (!detectionOrder)
        detectionOrder = this.options.order;
      var detected = [];
      detectionOrder.forEach(function(detectorName) {
        if (_this.detectors[detectorName]) {
          var lookup9 = _this.detectors[detectorName].lookup(_this.options);
          if (lookup9 && typeof lookup9 === "string")
            lookup9 = [lookup9];
          if (lookup9)
            detected = detected.concat(lookup9);
        }
      });
      if (this.services.languageUtils.getBestMatchFromCodes)
        return detected;
      return detected.length > 0 ? detected[0] : null;
    }
  }, {
    key: "cacheUserLanguage",
    value: function cacheUserLanguage4(lng, caches) {
      var _this2 = this;
      if (!caches)
        caches = this.options.caches;
      if (!caches)
        return;
      if (this.options.excludeCacheFor && this.options.excludeCacheFor.indexOf(lng) > -1)
        return;
      caches.forEach(function(cacheName) {
        if (_this2.detectors[cacheName])
          _this2.detectors[cacheName].cacheUserLanguage(lng, _this2.options);
      });
    }
  }]);
  return Browser2;
}();
Browser.type = "languageDetector";
// src/brackets-viewer/i18n/en/translation.json
var translation_default = {
  "origin-hint": {
    seed: "Seed {{position}}",
    "winner-bracket": "Loser of $t(abbreviations.winner-bracket) {{round}}.{{position}}",
    "winner-bracket-semi-final": "Loser of $t(abbreviations.winner-bracket) Semi {{position}}",
    "winner-bracket-final": "Loser of $t(abbreviations.winner-bracket) Final",
    "consolation-final": "Loser of Semi {{position}}",
    "grand-final": "Winner of $t(abbreviations.loser-bracket) Final",
    "double-elimination-consolation-final-opponent-1": "Loser of $t(abbreviations.loser-bracket) Semi 1",
    "double-elimination-consolation-final-opponent-2": "Loser of $t(abbreviations.loser-bracket) Final"
  },
  "match-label": {
    default: "Match {{matchNumber}}",
    "winner-bracket": "$t(abbreviations.winner-bracket)",
    "loser-bracket": "$t(abbreviations.loser-bracket)",
    "standard-bracket": "$t(abbreviations.match)",
    "standard-bracket-semi-final": "Semi {{matchNumber}}",
    "standard-bracket-final": "Final",
    "double-elimination": "{{matchPrefix}} {{roundNumber}}.{{matchNumber}}",
    "double-elimination-semi-final": "{{matchPrefix}} Semi {{matchNumber}}",
    "double-elimination-final": "{{matchPrefix}} Final",
    "consolation-final": "Consolation Final",
    "grand-final-single": "Grand Final",
    "grand-final": "$t(abbreviations.grand-final) Round {{roundNumber}}",
    "match-game": "Game {{gameNumber}}"
  },
  "match-status": {
    locked: "Locked",
    waiting: "Waiting",
    ready: "Ready",
    running: "Running",
    completed: "Completed",
    archived: "Archived"
  },
  abbreviations: {
    win: "W",
    loss: "L",
    forfeit: "F",
    position: "P",
    seed: "#",
    "winner-bracket": "WB",
    "loser-bracket": "LB",
    match: "M",
    "grand-final": "GF"
  },
  ranking: {
    rank: {
      text: "#",
      tooltip: "Rank"
    },
    id: {
      text: "Name",
      tooltip: "Name"
    },
    played: {
      text: "P",
      tooltip: "Played"
    },
    wins: {
      text: "$t(abbreviations.win)",
      tooltip: "Wins"
    },
    draws: {
      text: "D",
      tooltip: "Draws"
    },
    losses: {
      text: "$t(abbreviations.loss)",
      tooltip: "Losses"
    },
    forfeits: {
      text: "$t(abbreviations.forfeit)",
      tooltip: "Forfeits"
    },
    scoreFor: {
      text: "SF",
      tooltip: "Score For"
    },
    scoreAgainst: {
      text: "SA",
      tooltip: "Score Against"
    },
    scoreDifference: {
      text: "+/-",
      tooltip: "Score Difference"
    },
    points: {
      text: "Pts",
      tooltip: "Points"
    }
  },
  common: {
    bye: "BYE",
    "best-of-x": "Bo{{x}}",
    consolation: "Consolation",
    "group-name": "Group {{groupNumber}}",
    "group-name-winner-bracket": "Winner Bracket",
    "group-name-loser-bracket": "Loser Bracket",
    "round-name": "Round {{roundNumber}}",
    "round-name-final": "Final Round",
    "round-name-winner-bracket": "$t(abbreviations.winner-bracket) Round {{roundNumber}}",
    "round-name-winner-bracket-final": "$t(abbreviations.winner-bracket) Final Round",
    "round-name-loser-bracket": "$t(abbreviations.loser-bracket) Round {{roundNumber}}",
    "round-name-loser-bracket-final": "$t(abbreviations.loser-bracket) Final Round"
  },
  "form-creator": {
    "stage-name-label": "Name your stage",
    "stage-name-placeholder": "Give a name for your stage",
    "stage-selector-label": "Select a stage",
    "team-label": "Name your teams",
    "team-label-placeholder": "Comma separated List of Team Names (must be 2^n)",
    "team-count": "Or a team count",
    "team-count-placeholder": "How many teams do you want?",
    "group-label": "How many groups?",
    "group-placeholder": "How many groups do you want?",
    "seed-order-label": "How would you like to order your seeds?",
    "double-elimination-seed-order-placeholder": "Seed order for double elimination comma separated",
    "round-robin-mode-label": "Which round robin mode do you like?",
    "consolation-final-label": "Consolation Final",
    "skip-first-round-label": "Skip first round",
    "grand-final-type-label": "Grand final type",
    submit: "Create"
  }
};
// src/brackets-viewer/i18n/fr/translation.json
var translation_default2 = {
  "origin-hint": {
    seed: "Seed {{position}}",
    "winner-bracket": "Perdant $t(abbreviations.winner-bracket) {{round}}.{{position}}",
    "winner-bracket-semi-final": "Perdant $t(abbreviations.winner-bracket) Semi {{position}}",
    "winner-bracket-final": "Perdant Finale $t(abbreviations.winner-bracket)",
    "consolation-final": "Perdant Semi {{position}}",
    "grand-final": "Gagnant Finale $t(abbreviations.loser-bracket)",
    "double-elimination-consolation-final-opponent-1": "Perdant $t(abbreviations.loser-bracket) Semi 1",
    "double-elimination-consolation-final-opponent-2": "Perdant $t(abbreviations.loser-bracket) Final"
  },
  "match-label": {
    default: "Match {{matchNumber}}",
    "winner-bracket": "$t(abbreviations.winner-bracket)",
    "loser-bracket": "$t(abbreviations.loser-bracket)",
    "standard-bracket": "$t(abbreviations.match)",
    "standard-bracket-semi-final": "Semi {{matchNumber}}",
    "standard-bracket-final": "Finale",
    "double-elimination": "{{matchPrefix}} {{roundNumber}}.{{matchNumber}}",
    "double-elimination-semi-final": "{{matchPrefix}} Semi {{matchNumber}}",
    "double-elimination-final": "Finale {{matchPrefix}}",
    "consolation-final": "Petite finale",
    "grand-final-single": "Grande finale",
    "grand-final": "$t(abbreviations.grand-final) Round {{roundNumber}}",
    "match-game": "Game {{gameNumber}}"
  },
  "match-status": {
    locked: "Verrouillé",
    waiting: "En attente",
    ready: "Prêt",
    running: "En cours",
    completed: "Terminé",
    archived: "Archivé"
  },
  abbreviations: {
    win: "V",
    loss: "D",
    forfeit: "F",
    position: "P",
    seed: "#",
    "winner-bracket": "WB",
    "loser-bracket": "LB",
    match: "M",
    "grand-final": "GF"
  },
  ranking: {
    rank: {
      text: "#",
      tooltip: "Rang"
    },
    id: {
      text: "Name",
      tooltip: "Nom"
    },
    played: {
      text: "J",
      tooltip: "Joué"
    },
    wins: {
      text: "$t(abbreviations.win)",
      tooltip: "Victoires"
    },
    draws: {
      text: "N",
      tooltip: "Match nul"
    },
    losses: {
      text: "$t(abbreviations.loss)",
      tooltip: "Défaites"
    },
    forfeits: {
      text: "$t(abbreviations.forfeit)",
      tooltip: "Forfaits"
    },
    scoreFor: {
      text: "SF",
      tooltip: "Score pour"
    },
    scoreAgainst: {
      text: "SA",
      tooltip: "Score contre"
    },
    scoreDifference: {
      text: "+/-",
      tooltip: "Différence de score"
    },
    points: {
      text: "Pts",
      tooltip: "Points"
    }
  },
  common: {
    bye: "BYE",
    "best-of-x": "Bo{{x}}",
    consolation: "Consolation",
    "group-name": "Groupe {{groupNumber}}",
    "group-name-winner-bracket": "Winner Bracket",
    "group-name-loser-bracket": "Loser Bracket",
    "round-name": "Round {{roundNumber}}",
    "round-name-final": "Round final",
    "round-name-winner-bracket": "$t(abbreviations.winner-bracket) Round {{roundNumber}}",
    "round-name-winner-bracket-final": "$t(abbreviations.winner-bracket) Round final",
    "round-name-loser-bracket": "$t(abbreviations.loser-bracket) Round {{roundNumber}}",
    "round-name-loser-bracket-final": "$t(abbreviations.loser-bracket) Round final"
  },
  "form-creator": {
    "stage-name-label": "Name your stage",
    "stage-name-placeholder": "Give a name for your stage",
    "stage-selector-label": "Select a stage",
    "team-label": "Name your teams",
    "team-placeholder": "Comma separated List of Team Names (must be 2^n)",
    "team-count": "Or a team count",
    "team-count-placeholder": "How many teams do you want?",
    "group-label": "How many groups?",
    "group-placeholder": "How many groups do you want?",
    "seed-order-label": "How would you like to order your seeds?",
    "double-elimination-seed-order-placeholder": "Seed order for double elimination comma separated",
    "round-robin-mode-label": "Which round robin mode do you like?",
    "consolation-final-label": "Consolation Final",
    "skip-first-round-label": "Skip first round",
    "grand-final-type-label": "Grand final type",
    submit: "Create"
  }
};

// src/brackets-viewer/lang.ts
var locales = {
  en: translation_default,
  fr: translation_default2
};
i18next_default.use(Browser).init({
  fallbackLng: "en",
  debug: false,
  resources: {
    en: {
      translation: locales.en
    },
    fr: {
      translation: locales.fr
    }
  }
});
async function addLocale(name, locale) {
  i18next_default.addResourceBundle(name, "translation", locale, true, true);
  await i18next_default.changeLanguage();
}
function t2(key, options) {
  return i18next_default.t(key, options);
}
function toI18nKey(key) {
  return key.replace("_", "-");
}
function getOriginHint(roundNumber, roundCount, skipFirstRound, matchLocation) {
  if (roundNumber === 1) {
    if (matchLocation === "single_bracket")
      return (position) => t2("origin-hint.seed", { position });
    if (matchLocation === "winner_bracket")
      return (position) => t2("origin-hint.seed", { position });
    if (matchLocation === "loser_bracket" && skipFirstRound)
      return (position) => t2("origin-hint.seed", { position });
  }
  if (isMajorRound2(roundNumber) && matchLocation === "loser_bracket") {
    if (roundNumber === roundCount - 2)
      return (position) => t2("origin-hint.winner-bracket-semi-final", { position });
    if (roundNumber === roundCount)
      return () => t2("origin-hint.winner-bracket-final");
    const roundNumberWB = Math.ceil((roundNumber + 1) / 2);
    if (skipFirstRound)
      return (position) => t2("origin-hint.winner-bracket", { round: roundNumberWB - 1, position });
    return (position) => t2("origin-hint.winner-bracket", { round: roundNumberWB, position });
  }
  return;
}
function getFinalOriginHint(stageType, finalType, roundNumber) {
  if (stageType === "single_elimination")
    return (position) => t2("origin-hint.consolation-final", { position });
  if (finalType === "grand_final") {
    return roundNumber === 1 ? () => t2("origin-hint.grand-final") : undefined;
  }
  return (position) => position === 1 ? t2("origin-hint.double-elimination-consolation-final-opponent-1") : t2("origin-hint.double-elimination-consolation-final-opponent-2");
}
function getMatchLabel(matchNumber, roundNumber, roundCount, matchLocation) {
  if (roundNumber === undefined || roundCount === undefined || matchLocation === undefined)
    return t2("match-label.default", { matchNumber });
  const matchPrefix = matchLocation === "winner_bracket" ? t2("match-label.winner-bracket") : matchLocation === "loser_bracket" ? t2("match-label.loser-bracket") : t2("match-label.standard-bracket");
  const inSemiFinalRound = roundNumber === roundCount - 1;
  const inFinalRound = roundNumber === roundCount;
  if (matchLocation === "single_bracket") {
    if (inSemiFinalRound)
      return t2("match-label.standard-bracket-semi-final", { matchNumber });
    if (inFinalRound)
      return t2("match-label.standard-bracket-final");
  }
  if (inSemiFinalRound)
    return t2("match-label.double-elimination-semi-final", { matchPrefix, matchNumber });
  if (inFinalRound)
    return t2("match-label.double-elimination-final", { matchPrefix });
  return t2("match-label.double-elimination", { matchPrefix, roundNumber, matchNumber });
}
function getFinalMatchLabel(finalType, roundNumber, roundCount) {
  if (finalType === "consolation_final")
    return t2("match-label.consolation-final");
  if (roundCount === 1)
    return t2("match-label.grand-final-single");
  return t2("match-label.grand-final", { roundNumber });
}
function getMatchStatus2(status) {
  switch (status) {
    case 0 /* Locked */:
      return t2("match-status.locked");
    case 1 /* Waiting */:
      return t2("match-status.waiting");
    case 2 /* Ready */:
      return t2("match-status.ready");
    case 3 /* Running */:
      return t2("match-status.running");
    case 4 /* Completed */:
      return t2("match-status.completed");
    case 5 /* Archived */:
      return t2("match-status.archived");
    default:
      return "Unknown status";
  }
}
function getGroupName(groupNumber) {
  return t2("common.group-name", { groupNumber });
}
function getBracketName(stage, type) {
  switch (type) {
    case "winner_bracket":
    case "loser_bracket":
      return t2(`common.group-name-${toI18nKey(type)}`, { stage });
    default:
      return;
  }
}
function getRoundName({ roundNumber, roundCount }, t3) {
  return roundNumber === roundCount ? t3("common.round-name-final") : t3("common.round-name", { roundNumber });
}
function getWinnerBracketRoundName({ roundNumber, roundCount }, t3) {
  return roundNumber === roundCount ? t3("common.round-name-winner-bracket-final") : t3("common.round-name-winner-bracket", { roundNumber });
}
function getLoserBracketRoundName({ roundNumber, roundCount }, t3) {
  return roundNumber === roundCount ? t3("common.round-name-loser-bracket-final") : t3("common.round-name-loser-bracket", { roundNumber });
}

// src/brackets-viewer/helpers.ts
function splitBy2(objects, key) {
  const map = {};
  for (const obj of objects) {
    const commonValue = obj[key];
    if (!map[commonValue])
      map[commonValue] = [];
    map[commonValue].push(obj);
  }
  return Object.values(map);
}
function splitByWithLeftovers(objects, key) {
  const map = {};
  for (const obj of objects) {
    const commonValue = obj[key] ?? "-1";
    if (!map[commonValue])
      map[commonValue] = [];
    map[commonValue].push(obj);
  }
  const withoutLeftovers = Object.entries(map).filter(([key2]) => key2 !== "-1").map(([_23, value]) => value);
  const result = [...withoutLeftovers];
  result[-1] = map[-1];
  return result;
}
function sortBy(array, key) {
  return [...array].sort((a, b) => a[key] - b[key]);
}
function findRoot(selector) {
  const queryResult = document.querySelectorAll(selector || ".brackets-viewer");
  if (queryResult.length === 0)
    throw Error("Root not found. You must have at least one root element.");
  if (queryResult.length > 1)
    throw Error("Multiple possible roots were found. Please use `config.selector` to choose a specific root.");
  const root = queryResult[0];
  if (!root.classList.contains("brackets-viewer"))
    throw Error("The selected root must have a `.brackets-viewer` class.");
  return root;
}
function completeWithBlankMatches(bracketType, matches, nextMatches) {
  if (!nextMatches)
    return { matches, fromToornament: false };
  let sources = [];
  if (bracketType === "single_bracket" || bracketType === "winner_bracket")
    sources = nextMatches.map((match) => [match.opponent1?.position || null, match.opponent2?.position || null]).flat();
  if (bracketType === "loser_bracket")
    sources = nextMatches.map((match) => match.opponent2?.position || null);
  if (sources.filter((source) => source !== null).length === 0)
    return { matches, fromToornament: false };
  return {
    matches: sources.map((source) => source && matches.find((match) => match.number === source) || null),
    fromToornament: true
  };
}
function getOriginAbbreviation(matchLocation, skipFirstRound, roundNumber, side) {
  roundNumber = roundNumber || -1;
  if (skipFirstRound && matchLocation === "loser_bracket" && roundNumber === 1)
    return t2("abbreviations.seed");
  if (matchLocation === "single_bracket" || matchLocation === "winner_bracket" && roundNumber === 1)
    return t2("abbreviations.seed");
  if (matchLocation === "loser_bracket" && roundNumber % 2 === 0 && side === "opponent1")
    return t2("abbreviations.position");
  return null;
}
function isMajorRound2(roundNumber) {
  return roundNumber === 1 || roundNumber % 2 === 0;
}
function rankingHeader(itemName) {
  return t2(`ranking.${itemName}`, { returnObjects: true });
}
function isMatch(input2) {
  return "child_count" in input2;
}
function isMatchGame(input2) {
  return !isMatch(input2);
}

// src/brackets-viewer/dom.ts
var robotoFontLoaded = false;
function ensureRobotoFont() {
  if (robotoFontLoaded || typeof document === "undefined")
    return;
  robotoFontLoaded = true;
  const existing = document.querySelector('link[href*="fonts.googleapis.com/css"][href*="Roboto"]');
  if (existing)
    return;
  const preconnect1 = document.createElement("link");
  preconnect1.rel = "preconnect";
  preconnect1.href = "https://fonts.googleapis.com";
  document.head.appendChild(preconnect1);
  const preconnect2 = document.createElement("link");
  preconnect2.rel = "preconnect";
  preconnect2.href = "https://fonts.gstatic.com";
  preconnect2.crossOrigin = "";
  document.head.appendChild(preconnect2);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;600;700&display=swap";
  document.head.appendChild(link);
}
function createTitle(title) {
  ensureRobotoFont();
  const h1 = document.createElement("h1");
  h1.innerText = title;
  return h1;
}
function createPopoverTitle(title) {
  const h4 = document.createElement("h4");
  h4.innerText = title;
  return h4;
}
function createRoundRobinContainer(stageId) {
  const stage = document.createElement("div");
  stage.classList.add("round-robin");
  stage.setAttribute("data-stage-id", stageId.toString());
  return stage;
}
function createEliminationContainer(stageId) {
  const stage = document.createElement("div");
  stage.classList.add("elimination");
  stage.setAttribute("data-stage-id", stageId.toString());
  return stage;
}
function createBracketContainer(groupId, title) {
  const bracket = document.createElement("section");
  bracket.classList.add("bracket");
  if (groupId)
    bracket.setAttribute("data-group-id", groupId.toString());
  if (title) {
    const h2 = document.createElement("h2");
    h2.innerText = title;
    bracket.append(h2);
  }
  return bracket;
}
function createGroupContainer(groupId, title) {
  const h2 = document.createElement("h2");
  h2.innerText = title;
  const group = document.createElement("section");
  group.classList.add("group");
  group.setAttribute("data-group-id", groupId.toString());
  group.append(h2);
  return group;
}
function createRoundsContainer() {
  const round = document.createElement("div");
  round.classList.add("rounds");
  return round;
}
function createRoundContainer(roundId, title) {
  const h3 = document.createElement("h3");
  h3.innerText = title;
  const round = document.createElement("article");
  round.classList.add("round");
  round.setAttribute("data-round-id", roundId.toString());
  round.append(h3);
  return round;
}
function createMatchContainer(match) {
  const div = document.createElement("div");
  div.classList.add("match");
  if (match) {
    if (isMatchGame(match))
      div.setAttribute("data-match-game-id", match.id.toString());
    else
      div.setAttribute("data-match-id", match.id.toString());
    div.setAttribute("data-match-status", match.status.toString());
  }
  return div;
}
function createMatchLabel(label, status, onClick) {
  const span = document.createElement("span");
  span.innerText = label || "";
  span.title = status;
  onClick && span.addEventListener("click", onClick);
  return span;
}
function createChildCountLabel(label, onClick) {
  const span = document.createElement("span");
  span.innerText = label;
  onClick && span.addEventListener("click", onClick);
  return span;
}
function createOpponentsContainer(onClick) {
  const opponents = document.createElement("div");
  opponents.classList.add("opponents");
  if (onClick) {
    opponents.setAttribute("role", "button");
    opponents.setAttribute("tabindex", "0");
    opponents.addEventListener("click", onClick);
    opponents.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onClick();
      }
    });
  }
  return opponents;
}
function createParticipantContainer(participantId) {
  const participant = document.createElement("div");
  participant.classList.add("participant");
  if (participantId !== null && participantId !== undefined)
    participant.setAttribute("data-participant-id", participantId.toString());
  return participant;
}
function createNameContainer() {
  const name = document.createElement("div");
  name.classList.add("name");
  return name;
}
function createResultContainer() {
  const result = document.createElement("div");
  result.classList.add("result");
  return result;
}
function createTable() {
  return document.createElement("table");
}
function createRow() {
  return document.createElement("tr");
}
function createCell(data) {
  const td = document.createElement("td");
  td.innerText = String(data);
  return td;
}
function createRankingHeaders(ranking) {
  const headers = document.createElement("tr");
  const firstItem = ranking[0];
  for (const key in firstItem) {
    const prop = key;
    const header = rankingHeader(prop);
    const th = document.createElement("th");
    th.innerText = header.text;
    th.setAttribute("title", header.tooltip);
    headers.append(th);
  }
  return headers;
}
function setupHint(nameContainer, hint) {
  nameContainer.classList.add("hint");
  nameContainer.innerText = hint;
  nameContainer.title = hint;
}
function setupBye(nameContainer) {
  nameContainer.innerText = t2("common.bye");
  nameContainer.classList.add("bye");
}
function setupWin(participantContainer, resultContainer, participant) {
  if (participant.result && participant.result === "win") {
    participantContainer.classList.add("win");
    if (participant.score === undefined)
      resultContainer.innerText = t2("abbreviations.win");
  }
}
function setupLoss(participantContainer, resultContainer, participant) {
  if (participant.result && participant.result === "loss" || participant.forfeit) {
    participantContainer.classList.add("loss");
    if (participant.forfeit)
      resultContainer.innerText = t2("abbreviations.forfeit");
    else if (participant.score === undefined)
      resultContainer.innerText = t2("abbreviations.loss");
  }
}
function addParticipantOrigin(nameContainer, text, placement) {
  const span = document.createElement("span");
  if (placement === "before") {
    span.innerText = `${text} `;
    nameContainer.prepend(span);
  } else if (placement === "after") {
    span.innerText = ` (${text})`;
    nameContainer.append(span);
  }
}
function addParticipantImage(nameContainer, src) {
  const img = document.createElement("img");
  img.src = src;
  nameContainer.prepend(img);
}
function getBracketConnection(alwaysConnectFirstRound, roundNumber, roundCount, match, matchLocation, connectFinal) {
  const connection = {
    connectPrevious: false,
    connectNext: false
  };
  if (matchLocation === "loser_bracket") {
    connection.connectPrevious = roundNumber > 1 && (roundNumber % 2 === 1 ? "square" : "straight");
    connection.connectNext = roundNumber < roundCount && (roundNumber % 2 === 0 ? "square" : "straight");
  } else {
    connection.connectPrevious = roundNumber > 1 && "square";
    connection.connectNext = roundNumber < roundCount ? "square" : connectFinal ? "straight" : false;
  }
  if (alwaysConnectFirstRound || roundNumber !== 2)
    return connection;
  const upperBracket = matchLocation === "single_bracket" || matchLocation === "winner_bracket";
  if (upperBracket && match.opponent1?.position === undefined && match.opponent2?.position === undefined)
    connection.connectPrevious = false;
  if (matchLocation === "loser_bracket" && match.opponent2?.position === undefined)
    connection.connectPrevious = false;
  return connection;
}
function getFinalConnection(finalType, roundNumber, matchCount) {
  return {
    connectPrevious: finalType === "grand_final" && roundNumber === 1 && "straight",
    connectNext: matchCount === 2 && roundNumber === 1 && "straight"
  };
}
function setupConnection(opponentsContainer, matchContainer, connection) {
  if (connection.connectPrevious)
    opponentsContainer.classList.add("connect-previous");
  if (connection.connectNext)
    matchContainer.classList.add("connect-next");
  if (connection.connectPrevious === "straight")
    opponentsContainer.classList.add("straight");
  if (connection.connectNext === "straight")
    matchContainer.classList.add("straight");
}

// src/brackets-viewer/main.ts
class BracketsViewer {
  participantRefs = {};
  participants = [];
  participantImages = [];
  stage;
  config;
  skipFirstRound = false;
  alwaysConnectFirstRound = false;
  popover;
  getRoundName(info, fallbackGetter) {
    return this.config.customRoundName?.(info, t2) || fallbackGetter(info, t2);
  }
  _onMatchClick = (match) => {};
  _onMatchLabelClick = (match) => {};
  set onMatchClicked(callback) {
    this._onMatchClick = callback;
  }
  async render(data, config) {
    if (typeof data === "string")
      throw Error("Using a CSS selector as the first argument is deprecated. Please look here: https://github.com/Drarig29/brackets-viewer.js");
    const root = document.createDocumentFragment();
    this.config = {
      customRoundName: config?.customRoundName,
      participantOriginPlacement: config?.participantOriginPlacement ?? "before",
      separatedChildCountLabel: config?.separatedChildCountLabel ?? false,
      showSlotsOrigin: config?.showSlotsOrigin ?? true,
      showLowerBracketSlotsOrigin: config?.showLowerBracketSlotsOrigin ?? true,
      showPopoverOnMatchLabelClick: config?.showPopoverOnMatchLabelClick ?? true,
      highlightParticipantOnHover: config?.highlightParticipantOnHover ?? true,
      showRankingTable: config?.showRankingTable ?? true,
      rankingFormula: config?.rankingFormula ?? ((item) => 3 * item.wins + 1 * item.draws + 0 * item.losses)
    };
    if (config?.onMatchClick)
      this._onMatchClick = config.onMatchClick;
    if (config?.onMatchLabelClick)
      this._onMatchLabelClick = config.onMatchLabelClick;
    if (!data.stages?.length)
      throw Error("The `data.stages` array is either empty or undefined");
    if (!data.matches?.length)
      throw Error("The `data.matches` array is either empty or undefined");
    this.participants = data.participants ?? [];
    this.participants.forEach((participant) => this.participantRefs[participant.id] = []);
    this.popover = document.createElement("div");
    this.popover.setAttribute("popover", "auto");
    this.popover.addEventListener("toggle", (event) => {
      if (event.newState === "closed")
        this.clearPreviousPopoverSelections();
    });
    root.append(this.popover);
    data.stages.forEach((stage) => this.renderStage(root, {
      ...data,
      stages: [stage],
      matches: data.matches.filter((match) => match.stage_id === stage.id).map((match) => ({
        ...match,
        metadata: {
          stageType: stage.type,
          games: data.matchGames.filter((game) => game.parent_id === match.id)
        }
      }))
    }));
    const target = findRoot(config?.selector);
    if (config?.clear)
      target.innerHTML = "";
    target.append(root);
  }
  updateMatch(match) {
    const matchContainer = document.querySelector(`[data-match-id='${match.id}']`);
    if (!matchContainer)
      throw Error("Match not found.");
    matchContainer.setAttribute("data-match-status", match.status.toString());
    const result1 = matchContainer.querySelector(".participant:nth-of-type(1) .result");
    if (result1 && match.opponent1?.score)
      result1.innerHTML = match.opponent1?.score?.toString();
    const result2 = matchContainer.querySelector(".participant:nth-of-type(2) .result");
    if (result2 && match.opponent2?.score)
      result2.innerHTML = match.opponent2?.score?.toString();
  }
  setParticipantImages(images) {
    this.participantImages = images;
  }
  async addLocale(name, locale) {
    await addLocale(name, locale);
  }
  renderStage(root, data) {
    const stage = data.stages[0];
    if (!data.matches?.length)
      throw Error(`No matches found for stage ${stage.id}`);
    const matchesByGroup = splitByWithLeftovers(data.matches, "group_id");
    this.stage = stage;
    this.skipFirstRound = stage.settings.skipFirstRound || false;
    switch (stage.type) {
      case "round_robin":
        this.renderRoundRobin(root, stage, matchesByGroup);
        break;
      case "single_elimination":
      case "double_elimination":
        this.renderElimination(root, stage, matchesByGroup);
        break;
      default:
        throw Error(`Unknown bracket type: ${stage.type}`);
    }
    this.renderConsolationMatches(root, stage, matchesByGroup);
  }
  renderRoundRobin(root, stage, matchesByGroup) {
    const container = createRoundRobinContainer(stage.id);
    container.append(createTitle(stage.name));
    let groupNumber = 1;
    for (const groupMatches of matchesByGroup) {
      const groupId = groupMatches[0].group_id;
      const groupContainer = createGroupContainer(groupId, getGroupName(groupNumber++));
      const matchesByRound = splitBy2(groupMatches, "round_id").map((matches) => sortBy(matches, "number"));
      let roundNumber = 1;
      for (const roundMatches of matchesByRound) {
        const roundId = roundMatches[0].round_id;
        const roundName = this.getRoundName({
          roundNumber,
          roundCount: 0,
          groupType: toI18nKey("round_robin")
        }, getRoundName);
        const roundContainer = createRoundContainer(roundId, roundName);
        for (const match of roundMatches)
          roundContainer.append(this.createMatch(match, true));
        groupContainer.append(roundContainer);
        roundNumber++;
      }
      if (this.config.showRankingTable)
        groupContainer.append(this.createRanking(groupMatches));
      container.append(groupContainer);
    }
    root.append(container);
  }
  renderElimination(root, stage, matchesByGroup) {
    const container = createEliminationContainer(stage.id);
    container.append(createTitle(stage.name));
    if (stage.type === "single_elimination")
      this.renderSingleElimination(container, matchesByGroup);
    else
      this.renderDoubleElimination(container, matchesByGroup);
    root.append(container);
  }
  renderConsolationMatches(root, stage, matchesByGroup) {
    const consolationMatches = matchesByGroup[-1];
    if (!consolationMatches?.length)
      return;
    const consolation = createBracketContainer(undefined, t2("common.consolation"));
    const roundsContainer = createRoundsContainer();
    let matchNumber = 0;
    for (const match of consolationMatches) {
      roundsContainer.append(this.createMatch({
        ...match,
        metadata: {
          label: t2("match-label.default", { matchNumber: ++matchNumber }),
          stageType: stage.type,
          games: []
        }
      }, true));
    }
    consolation.append(roundsContainer);
    root.append(consolation);
  }
  renderSingleElimination(container, matchesByGroup) {
    const bracketMatches = splitBy2(matchesByGroup[0], "round_id").map((matches) => sortBy(matches, "number"));
    const { hasFinal, connectFinal, finalMatches } = this.getFinalInfoSingleElimination(matchesByGroup);
    this.renderBracket(container, bracketMatches, getRoundName, "single_bracket", connectFinal);
    if (hasFinal)
      this.renderFinal(container, "consolation_final", finalMatches);
  }
  renderDoubleElimination(container, matchesByGroup) {
    const hasLoserBracket = matchesByGroup[1] !== undefined;
    const winnerBracketMatches = splitBy2(matchesByGroup[0], "round_id").map((matches) => sortBy(matches, "number"));
    const { hasFinal, connectFinal, grandFinalMatches, consolationFinalMatches } = this.getFinalInfoDoubleElimination(matchesByGroup);
    this.renderBracket(container, winnerBracketMatches, getWinnerBracketRoundName, "winner_bracket", connectFinal);
    if (hasLoserBracket) {
      const loserBracketMatches = splitBy2(matchesByGroup[1], "round_id").map((matches) => sortBy(matches, "number"));
      this.renderBracket(container, loserBracketMatches, getLoserBracketRoundName, "loser_bracket");
    }
    if (hasFinal) {
      this.renderFinal(container, "grand_final", grandFinalMatches);
      this.renderFinal(container, "consolation_final", consolationFinalMatches);
    }
  }
  getFinalInfoSingleElimination(matchesByGroup) {
    const hasFinal = matchesByGroup[1] !== undefined;
    const finalMatches = sortBy(matchesByGroup[1] ?? [], "number");
    const connectFinal = false;
    return { hasFinal, connectFinal, finalMatches };
  }
  getFinalInfoDoubleElimination(matchesByGroup) {
    const hasFinal = matchesByGroup[2] !== undefined;
    const finalMatches = sortBy(matchesByGroup[2] ?? [], "number");
    const grandFinalMatches = finalMatches.filter((match) => match.number === 1);
    const consolationFinalMatches = finalMatches.filter((match) => match.number === 2);
    const connectFinal = grandFinalMatches.length > 0;
    return { hasFinal, connectFinal, grandFinalMatches, consolationFinalMatches };
  }
  renderBracket(container, matchesByRound, getRoundName2, bracketType, connectFinal) {
    const groupId = matchesByRound[0][0].group_id;
    const roundCount = matchesByRound.length;
    const bracketContainer = createBracketContainer(groupId, getBracketName(this.stage, bracketType));
    const roundsContainer = createRoundsContainer();
    const { matches: completedMatches, fromToornament } = completeWithBlankMatches(bracketType, matchesByRound[0], matchesByRound[1]);
    this.alwaysConnectFirstRound = !fromToornament;
    for (let roundIndex = 0;roundIndex < matchesByRound.length; roundIndex++) {
      const roundId = matchesByRound[roundIndex][0].round_id;
      const roundNumber = roundIndex + 1;
      const roundName = this.getRoundName({
        roundNumber,
        roundCount,
        fractionOfFinal: exports_helpers.getFractionOfFinal(roundNumber, roundCount),
        groupType: toI18nKey(bracketType)
      }, getRoundName2);
      const roundContainer = createRoundContainer(roundId, roundName);
      const roundMatches = fromToornament && roundNumber === 1 ? completedMatches : matchesByRound[roundIndex];
      for (const match of roundMatches) {
        roundContainer.append(match && this.createBracketMatch({
          ...match,
          metadata: {
            ...match.metadata,
            roundNumber,
            roundCount,
            matchLocation: bracketType,
            connectFinal
          }
        }) || this.skipBracketMatch());
      }
      roundsContainer.append(roundContainer);
    }
    bracketContainer.append(roundsContainer);
    container.append(bracketContainer);
  }
  renderFinal(container, finalType, matches) {
    if (matches.length === 0)
      return;
    const upperBracket = container.querySelector(".bracket .rounds");
    if (!upperBracket)
      throw Error("Upper bracket not found.");
    const winnerWb = matches[0].opponent1;
    const displayCount = winnerWb?.id === null || winnerWb?.result === "win" ? 1 : 2;
    const finalMatches = matches.slice(0, displayCount);
    const roundCount = finalMatches.length;
    const defaultFinalRoundNameGetter = ({ roundNumber, roundCount: roundCount2 }) => getFinalMatchLabel(finalType, roundNumber, roundCount2);
    for (let roundIndex = 0;roundIndex < finalMatches.length; roundIndex++) {
      const roundNumber = roundIndex + 1;
      const roundName = this.getRoundName({
        roundNumber,
        roundCount,
        groupType: toI18nKey("final_group"),
        finalType: toI18nKey(finalType)
      }, defaultFinalRoundNameGetter);
      const finalMatch = {
        ...finalMatches[roundIndex],
        metadata: {
          ...finalMatches[roundIndex].metadata,
          roundNumber,
          roundCount,
          matchLocation: "final_group"
        }
      };
      const roundContainer = createRoundContainer(finalMatch.round_id, roundName);
      roundContainer.append(this.createFinalMatch(finalType, finalMatch));
      upperBracket.append(roundContainer);
    }
  }
  createRanking(matches) {
    const table = createTable();
    const ranking = exports_helpers.getRanking(matches, this.config.rankingFormula);
    table.append(createRankingHeaders(ranking));
    for (const item of ranking)
      table.append(this.createRankingRow(item));
    return table;
  }
  createRankingRow(item) {
    const row = createRow();
    const notRanked = item.played === 0;
    for (const key in item) {
      const prop = key;
      const data = item[prop];
      if (prop === "id") {
        const participant = this.participants.find((participant2) => participant2.id === data);
        if (participant !== undefined) {
          const cell = createCell(participant.name);
          this.setupMouseHover(participant.id, cell, true);
          row.append(cell);
          continue;
        }
      }
      if (notRanked && (prop === "rank" || prop === "points")) {
        row.append(createCell("-"));
        continue;
      }
      row.append(createCell(data));
    }
    return row;
  }
  createBracketMatch(match) {
    const { roundNumber, roundCount, matchLocation, connectFinal } = match.metadata;
    if (roundNumber === undefined || roundCount === undefined || matchLocation === undefined)
      throw Error(`The match's internal data is missing roundNumber, roundCount or matchLocation: ${JSON.stringify(match)}`);
    const connection = getBracketConnection(this.alwaysConnectFirstRound, roundNumber, roundCount, match, matchLocation, connectFinal);
    const matchLabel = getMatchLabel(match.number, roundNumber, roundCount, matchLocation);
    const originHint = getOriginHint(roundNumber, roundCount, this.skipFirstRound, matchLocation);
    match.metadata.connection = connection;
    match.metadata.label = matchLabel;
    match.metadata.originHint = originHint;
    return this.createMatch(match, true);
  }
  createFinalMatch(finalType, match) {
    const { roundNumber, roundCount } = match.metadata;
    if (roundNumber === undefined || roundCount === undefined)
      throw Error(`The match's internal data is missing roundNumber or roundCount: ${JSON.stringify(match)}`);
    const connection = getFinalConnection(finalType, roundNumber, roundCount);
    const matchLabel = getFinalMatchLabel(finalType, roundNumber, roundCount);
    const originHint = getFinalOriginHint(match.metadata.stageType, finalType, roundNumber);
    match.metadata.connection = connection;
    match.metadata.label = matchLabel;
    match.metadata.originHint = originHint;
    return this.createMatch(match, true);
  }
  skipBracketMatch() {
    const matchContainer = createMatchContainer();
    const opponents = createOpponentsContainer();
    const participant1 = this.createParticipant(null, true);
    const participant2 = this.createParticipant(null, true);
    opponents.append(participant1, participant2);
    matchContainer.append(opponents);
    matchContainer.style.visibility = "hidden";
    return matchContainer;
  }
  createMatch(match, propagateHighlight) {
    const matchContainer = createMatchContainer(match);
    const opponents = isMatch(match) ? createOpponentsContainer(() => this._onMatchClick(match)) : createOpponentsContainer();
    if (isMatch(match) && match.status >= 4 /* Completed */)
      match.metadata.originHint = undefined;
    if (isMatch(match)) {
      const { originHint, matchLocation, roundNumber } = match.metadata;
      const participant1 = this.createParticipant(match.opponent1, propagateHighlight, "opponent1", originHint, matchLocation, roundNumber);
      const participant2 = this.createParticipant(match.opponent2, propagateHighlight, "opponent2", originHint, matchLocation, roundNumber);
      this.renderMatchLabel(opponents, match);
      opponents.append(participant1, participant2);
    } else {
      const participant1 = this.createParticipant(match.opponent1, propagateHighlight, "opponent1");
      const participant2 = this.createParticipant(match.opponent2, propagateHighlight, "opponent2");
      this.renderMatchLabel(opponents, match);
      opponents.append(participant1, participant2);
    }
    matchContainer.append(opponents);
    if (isMatch(match)) {
      if (!match.metadata.connection)
        return matchContainer;
      setupConnection(opponents, matchContainer, match.metadata.connection);
    }
    return matchContainer;
  }
  createParticipant(participant, propagateHighlight, side, originHint, matchLocation, roundNumber) {
    const containers = {
      participant: createParticipantContainer(participant && participant.id),
      name: createNameContainer(),
      result: createResultContainer()
    };
    if (participant === null || participant === undefined)
      setupBye(containers.name);
    else
      this.renderParticipant(containers, participant, side, originHint, matchLocation, roundNumber);
    containers.participant.append(containers.name, containers.result);
    if (participant && participant.id !== null)
      this.setupMouseHover(participant.id, containers.participant, propagateHighlight);
    return containers.participant;
  }
  renderParticipant(containers, participant, side, originHint, matchLocation, roundNumber) {
    const found = this.participants.find((item) => item.id === participant.id);
    if (found) {
      containers.name.innerText = found.name;
      containers.participant.setAttribute("title", found.name);
      this.renderParticipantImage(containers.name, found.id);
      this.renderParticipantOrigin(containers.name, participant, side, matchLocation, roundNumber);
    } else
      this.renderHint(containers.name, participant, originHint, matchLocation);
    containers.result.innerText = `${participant.score === undefined ? "-" : participant.score}`;
    setupWin(containers.participant, containers.result, participant);
    setupLoss(containers.participant, containers.result, participant);
  }
  renderParticipantImage(nameContainer, participantId) {
    const found = this.participantImages.find((item) => item.participantId === participantId);
    if (found)
      addParticipantImage(nameContainer, found.imageUrl);
  }
  renderMatchLabel(opponents, match) {
    const { label } = match.metadata;
    if (isMatchGame(match)) {
      opponents.append(createMatchLabel(label, getMatchStatus2(match.status)));
      return;
    }
    const onClick = (event) => {
      event.stopPropagation();
      this._onMatchLabelClick(match);
      if (match.child_count > 0 && this.config.showPopoverOnMatchLabelClick) {
        this.clearPreviousPopoverSelections();
        opponents.classList.add("popover-selected");
        this.showPopover(match);
      }
    };
    if (this.config.separatedChildCountLabel) {
      opponents.append(createMatchLabel(label, getMatchStatus2(match.status), onClick));
      if (match.child_count > 0)
        opponents.append(createChildCountLabel(t2("common.best-of-x", { x: match.child_count }), onClick));
      return;
    }
    if (match.child_count > 0) {
      const childCountLabel = t2("common.best-of-x", { x: match.child_count });
      const joined = label ? `${label}, ${childCountLabel}` : childCountLabel;
      opponents.append(createMatchLabel(joined, getMatchStatus2(match.status), onClick));
    }
  }
  showPopover(match) {
    this.popover.innerText = "";
    const { roundNumber, roundCount, matchLocation } = match.metadata;
    const matchLabel = getMatchLabel(match.number, roundNumber, roundCount, matchLocation);
    const popoverTitle = createPopoverTitle(matchLabel);
    this.popover.append(popoverTitle);
    for (const game of match.metadata.games) {
      const matchGameLabel = t2("match-label.match-game", { gameNumber: game.number });
      const match2 = this.createMatch({
        ...game,
        metadata: { label: matchGameLabel }
      }, false);
      this.popover.append(match2);
    }
    try {
      this.popover.togglePopover();
    } catch {}
  }
  renderHint(nameContainer, participant, originHint, matchLocation) {
    if (originHint === undefined || participant.position === undefined)
      return;
    if (!this.config.showSlotsOrigin)
      return;
    if (!this.config.showLowerBracketSlotsOrigin && matchLocation === "loser_bracket")
      return;
    setupHint(nameContainer, originHint(participant.position));
  }
  renderParticipantOrigin(nameContainer, participant, side, matchLocation, roundNumber) {
    if (participant.position === undefined || matchLocation === undefined)
      return;
    if (!this.config.participantOriginPlacement || this.config.participantOriginPlacement === "none")
      return;
    if (!this.config.showSlotsOrigin)
      return;
    if (!this.config.showLowerBracketSlotsOrigin && matchLocation === "loser_bracket")
      return;
    const abbreviation = getOriginAbbreviation(matchLocation, this.skipFirstRound, roundNumber, side);
    if (!abbreviation)
      return;
    const origin = `${abbreviation}${participant.position}`;
    addParticipantOrigin(nameContainer, origin, this.config.participantOriginPlacement);
  }
  setupMouseHover(participantId, element, propagateHighlight) {
    if (!this.config.highlightParticipantOnHover)
      return;
    const setupListeners = (elements) => {
      element.addEventListener("mouseenter", () => {
        elements.forEach((el) => el.classList.add("hover"));
      });
      element.addEventListener("mouseleave", () => {
        elements.forEach((el) => el.classList.remove("hover"));
      });
    };
    if (!propagateHighlight) {
      setupListeners([element]);
      return;
    }
    const refs = this.participantRefs[participantId];
    if (!refs)
      throw Error(`The participant (id: ${participantId}) does not exist in the participants table.`);
    refs.push(element);
    setupListeners(refs);
  }
  clearPreviousPopoverSelections() {
    document.querySelector(".opponents.popover-selected")?.classList.remove("popover-selected");
  }
}

// src/brackets-viewer/index.ts
if (typeof window !== "undefined") {
  window.bracketsViewer = new BracketsViewer;
  window.inMemoryDatabase = new import_brackets_memory_db.InMemoryDatabase;
  window.bracketsManager = new BracketsManager(window.inMemoryDatabase);
}
export {
  BracketsViewer
};
