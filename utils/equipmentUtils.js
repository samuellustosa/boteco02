// utils/equipmentUtils.js
const { addDays, differenceInCalendarDays, startOfDay } = require('date-fns');

function parseDateLocal(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

const getDaysUntilNextCleaning = (equipment) => {
  const today = startOfDay(new Date());
  const lastCleaning = startOfDay(parseDateLocal(equipment.last_cleaning));
  const periodicity = Math.max(1, Number(equipment.periodicity) || 1);
  const nextCleaning = addDays(lastCleaning, periodicity);
  return differenceInCalendarDays(nextCleaning, today);
};

const getEquipmentStatus = (equipment) => {
  const daysUntil = getDaysUntilNextCleaning(equipment);
  if (daysUntil <= 0) {
    return 'overdue';
  }
  if (daysUntil === 1) {
    return 'warning';
  }
  return 'ok';
};

const formatDate = (dateString) => {
  try {
    const localDate = parseDateLocal(dateString);
    return localDate.toLocaleDateString('pt-BR');
  } catch {
    return dateString;
  }
};

module.exports = {
  getEquipmentStatus,
  getDaysUntilNextCleaning,
  formatDate
};