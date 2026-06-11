const tz = 'America/Sao_Paulo';

function getBrasiliaISOString(date = new Date()) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hour12: false, minute: '2-digit', second: '2-digit',
    fractionalSecondDigits: 3
  });
  const parts = dtf.formatToParts(date);
  const getVal = (type) => parts.find(p => p.type === type)?.value || '00';
  
  const year = getVal('year');
  const month = getVal('month');
  const day = getVal('day');
  let hour = getVal('hour');
  const minute = getVal('minute');
  const second = getVal('second');
  const millisecond = getVal('fractionalSecond') || '000';

  if (hour === '24') hour = '00';

  const offsetStr = '-03:00'; // Brasília is consistently UTC-3 since DST abolition

  return `${year}-${month}-${day}T${hour}:${minute}:${second}.${millisecond}${offsetStr}`;
}

function parseBrasiliaDate(dateStr) {
  if (!dateStr) return new Date();
  
  let normalizedStr = String(dateStr).trim();
  if (!normalizedStr.includes('Z') && !/[+-]\d{2}:?\d{2}$/.test(normalizedStr)) {
    if (normalizedStr.includes('T')) {
      normalizedStr = `${normalizedStr}-03:00`;
    } else if (normalizedStr.includes(' ')) {
      normalizedStr = `${normalizedStr.replace(' ', 'T')}-03:00`;
    } else {
      normalizedStr = `${normalizedStr}T00:00:00-03:00`;
    }
  }
  return new Date(normalizedStr);
}

module.exports = {
  getBrasiliaISOString,
  parseBrasiliaDate
};
