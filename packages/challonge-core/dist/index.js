var __defProp = Object.defineProperty;
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
// src/brackets-model/other.ts
var Status;
((Status2) => {
  Status2[Status2["Locked"] = 0] = "Locked";
  Status2[Status2["Waiting"] = 1] = "Waiting";
  Status2[Status2["Ready"] = 2] = "Ready";
  Status2[Status2["Running"] = 3] = "Running";
  Status2[Status2["Completed"] = 4] = "Completed";
  Status2[Status2["Archived"] = 5] = "Archived";
})(Status ||= {});
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
export {
  exports_helpers as helpers,
  Status,
  BracketsManager
};
