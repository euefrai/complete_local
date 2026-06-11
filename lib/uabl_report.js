function summarizeRisks(risks) {
  if (!Array.isArray(risks) || risks.length === 0) return [];
  return risks;
}

function makeUablReport({
  action,
  status,
  memoryUsed,
  risks,
  impact,
  evidence,
  executed,
  validation,
  details
}) {
  return {
    uabl: {
      identity: 'TITAN OS',
      mindset: 'single-mind',
      action: action || null,
      executed: !!executed,
      status: status || (executed ? 'completed' : 'skipped'),
      memoryUsed: memoryUsed || null,
      risks: summarizeRisks(risks),
      impact: impact || null,
      evidence: evidence || null,
      validation: validation || null,
      details: details || null
    }
  };
}

module.exports = {
  makeUablReport
};

