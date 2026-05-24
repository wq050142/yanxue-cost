import { ProjectData, CostSummary, DailyCostBreakdown, DEFAULT_MEAL_CONFIG, OtherExpenses } from '@/types';

// 计算单餐费用
function calculateMealAmount(
  mealConfig: { enabled?: boolean; clientMealType?: string; tableCount?: number; clientCount?: number; pricePerPerson?: number; staffMealType?: string; amount?: number },
  coreConfig: ProjectData['coreConfig'],
  totalClients: number,
  totalStaff: number
): number {
  if (mealConfig.enabled === false) {
    return 0;
  }
  if (mealConfig.amount && mealConfig.amount > 0) {
    return mealConfig.amount;
  }
  const pricePerPerson = mealConfig.pricePerPerson || coreConfig.mealStandardClient || 0;
  const clientMealType = mealConfig.clientMealType || 'table';
  const clientAmount = clientMealType === 'table'
    ? pricePerPerson * 10 * (mealConfig.tableCount || Math.ceil(totalClients / 10))
    : pricePerPerson * (mealConfig.clientCount || totalClients);
  const staffAmount = mealConfig.staffMealType === 'independent'
    ? (coreConfig.mealStandardStaff || 0) * totalStaff
    : 0;
  return clientAmount + staffAmount;
}

function calculateOtherExpenses(otherExpenses: OtherExpenses, totalClients: number, totalStaff: number): number {
  const insuranceTotal = otherExpenses.insurance.totalAmount || 0;
  const reserveFund = otherExpenses.reserveFund || 0;
  const materialsTotal = otherExpenses.materials.reduce((sum, item) =>
    sum + (item.totalPrice || item.price * item.quantity), 0);
  const otherTotal = otherExpenses.otherExpenses.reduce((sum, item) =>
    sum + (item.totalPrice || item.price * item.quantity), 0);
  return insuranceTotal + reserveFund + materialsTotal + otherTotal;
}

export function calculateServiceFee(subtotal: number, serviceFeePercent: number): number {
  return subtotal * (serviceFeePercent / 100);
}

export function calculateServiceFeePerPerson(perPerson: number, days: number, totalPeople: number): number {
  return perPerson * days * totalPeople;
}

export function calculateCostSummary(data: ProjectData): CostSummary {
  const { coreConfig, dailyExpenses = [], otherExpenses } = data || {};
  
  if (!coreConfig || !otherExpenses) {
    return {
      totalClients: 0, totalStaff: 0,
      totalAccommodation: 0, totalMeal: 0, totalBus: 0, totalStaffFee: 0, totalSingleItems: 0, totalOtherExpenses: 0,
      totalCost: 0, avgCostPerClient: 0, dailyBreakdown: [],
    };
  }

  const totalClients = (coreConfig.studentCount || 0) + (coreConfig.parentCount || 0) + (coreConfig.teacherCount || 0);
  const totalStaff = (coreConfig.staffMembers || []).reduce((sum, member) => sum + (member?.count || 0), 0);

  let totalAccommodation = 0;
  dailyExpenses.forEach((day, index) => {
    if (index >= (coreConfig.accommodationDays || 0)) return;
    const twinCount = day.twinRoomCount ?? coreConfig.twinRoom?.countClient ?? 0;
    const twinPrice = day.twinRoomPrice ?? coreConfig.twinRoom?.price ?? 0;
    const kingCount = day.kingRoomCount ?? coreConfig.kingRoom?.countClient ?? 0;
    const kingPrice = day.kingRoomPrice ?? coreConfig.kingRoom?.price ?? 0;
    const clientAccommodation = twinCount * twinPrice + kingCount * kingPrice;
    let staffAccommodation = 0;
    if (day.staffAccommodationAmount && day.staffAccommodationAmount > 0) {
      staffAccommodation = day.staffAccommodationAmount;
    } else if (coreConfig.staffAccommodation) {
      const staffRoomCount = day.staffRoomCount ?? Math.ceil(totalStaff / 2);
      const staffRoomPrice = day.staffRoomPrice ?? coreConfig.staffRoomPrice ?? 0;
      staffAccommodation = staffRoomCount * staffRoomPrice;
    }
    totalAccommodation += clientAccommodation + staffAccommodation;
  });

  let totalMeal = 0;
  dailyExpenses.forEach(day => {
    const lunch = day.lunch || DEFAULT_MEAL_CONFIG;
    const dinner = day.dinner || DEFAULT_MEAL_CONFIG;
    totalMeal += calculateMealAmount(lunch, coreConfig, totalClients, totalStaff);
    totalMeal += calculateMealAmount(dinner, coreConfig, totalClients, totalStaff);
  });

  const totalBus = coreConfig.busFee || 0;
  const otherTransportsTotal = (coreConfig.otherTransports || []).reduce((sum, t) => sum + (t?.price || 0) * (t?.count || 0), 0);
  const totalTransport = totalBus + otherTransportsTotal;

  let totalStaffFee = 0;
  dailyExpenses.forEach(day => {
    (coreConfig.staffMembers || []).forEach(member => {
      if (!member) return;
      const dailyFee = (day.staffFees && day.staffFees[member.id] !== undefined) ? day.staffFees[member.id] : (member.dailyFee || 0);
      totalStaffFee += dailyFee * (member.count || 0);
    });
    (day.staffMembers || []).forEach(member => {
      if (!member) return;
      totalStaffFee += (member.dailyFee || 0) * (member.count || 0);
    });
  });

  let totalSingleItems = 0;
  dailyExpenses.forEach(day => {
    (day.singleItems || []).forEach(item => {
      if (!item) return;
      totalSingleItems += item.totalPrice || ((item.price || 0) * (item.count || 0));
    });
  });

  const totalOtherExpenses = calculateOtherExpenses(otherExpenses, totalClients, totalStaff);
  const totalCost = totalAccommodation + totalMeal + totalTransport + totalStaffFee + totalSingleItems + totalOtherExpenses;
  const avgCostPerClient = totalClients > 0 ? totalCost / totalClients : 0;

  const dailyBreakdown: DailyCostBreakdown[] = dailyExpenses.map((day, dayIndex) => {
    let dayStaffFee = 0;
    (coreConfig.staffMembers || []).forEach(member => {
      if (!member) return;
      const dailyFee = (day.staffFees && day.staffFees[member.id] !== undefined) ? day.staffFees[member.id] : (member.dailyFee || 0);
      dayStaffFee += dailyFee * (member.count || 0);
    });
    (day.staffMembers || []).forEach(member => {
      if (!member) return;
      dayStaffFee += (member.dailyFee || 0) * (member.count || 0);
    });
    const daySingleItems = (day.singleItems || []).reduce((sum, item) =>
      sum + (item?.totalPrice || (item?.price || 0) * (item?.count || 0)), 0);
    const lunch = day.lunch || DEFAULT_MEAL_CONFIG;
    const dinner = day.dinner || DEFAULT_MEAL_CONFIG;
    const lunchAmount = calculateMealAmount(lunch, coreConfig, totalClients, totalStaff);
    const dinnerAmount = calculateMealAmount(dinner, coreConfig, totalClients, totalStaff);

    let dayAccommodation = 0;
    if (dayIndex < (coreConfig.accommodationDays || 0)) {
      const twinCount = day.twinRoomCount ?? coreConfig.twinRoom?.countClient ?? 0;
      const twinPrice = day.twinRoomPrice ?? coreConfig.twinRoom?.price ?? 0;
      const kingCount = day.kingRoomCount ?? coreConfig.kingRoom?.countClient ?? 0;
      const kingPrice = day.kingRoomPrice ?? coreConfig.kingRoom?.price ?? 0;
      const clientAccommodation = twinCount * twinPrice + kingCount * kingPrice;
      let staffAccommodation = 0;
      if (day.staffAccommodationAmount && day.staffAccommodationAmount > 0) {
        staffAccommodation = day.staffAccommodationAmount;
      } else if (coreConfig.staffAccommodation) {
        const staffRoomCount = day.staffRoomCount ?? Math.ceil(totalStaff / 2);
        const staffRoomPrice = day.staffRoomPrice ?? coreConfig.staffRoomPrice ?? 0;
        staffAccommodation = staffRoomCount * staffRoomPrice;
      }
      dayAccommodation = clientAccommodation + staffAccommodation;
    }

    const dailyTotal = dayAccommodation + lunchAmount + dinnerAmount + dayStaffFee + daySingleItems;
    return {
      day: day.day,
      accommodation: dayAccommodation,
      lunch: lunchAmount,
      dinner: dinnerAmount,
      staffFee: dayStaffFee,
      singleItems: daySingleItems,
      dailyTotal: dailyTotal,
    };
  });

  return {
    totalClients, totalStaff,
    totalAccommodation, totalMeal, totalBus: totalTransport, totalStaffFee, totalSingleItems, totalOtherExpenses,
    totalCost, avgCostPerClient, dailyBreakdown,
  };
}


// 格式化金额
export function formatMoney(amount: number): string {
  if (amount === 0) return '0';
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}
