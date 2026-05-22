const CHALLENGE_RECORDS_KEY = "command-lab.challenge-records.v1";

function readChallengeRecords() {
  try {
    return JSON.parse(localStorage.getItem(CHALLENGE_RECORDS_KEY)) ?? {};
  } catch {
    return {};
  }
}

function getChallengeRecord(key) {
  return readChallengeRecords()[key] ?? null;
}

function saveChallengeRecord(key, record) {
  const records = readChallengeRecords();
  records[key] = {
    ...record,
    savedAt: Date.now(),
  };
  localStorage.setItem(CHALLENGE_RECORDS_KEY, JSON.stringify(records));
  return records[key];
}

function keepBetterChallengeRecord(key, candidate, betterThan) {
  const current = getChallengeRecord(key);
  if (current && !betterThan(candidate, current)) {
    return { record: current, improved: false };
  }
  return { record: saveChallengeRecord(key, candidate), improved: true };
}

window.challengeRecords = {
  get: getChallengeRecord,
  keepBetter: keepBetterChallengeRecord,
};
