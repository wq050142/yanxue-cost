import * as XLSX from 'xlsx';
import { domToPng, domToJpeg } from 'modern-screenshot';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { ProjectData, CostSummary, DailyExpense, OtherExpenses, CoreConfig, DEFAULT_MEAL_CONFIG, ACCOMMODATION_TYPE_LABELS } from '@/types';

// 格式化金额
const formatMoney = (amount: number): string => {
  return amount.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY', minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

// 计算用餐费用
const calculateMealAmount = (
  mealConfig: { enabled?: boolean; clientMealType?: string; tableCount?: number; clientCount?: number; pricePerPerson?: number; staffMealType?: string; amount?: number },
  coreConfig: CoreConfig,
  totalClients: number
): number => {
  if (mealConfig.enabled === false) return 0;
  if (mealConfig.amount && mealConfig.amount > 0) return mealConfig.amount;
  const price = mealConfig.pricePerPerson || coreConfig.mealStandardClient || 0;
  if ((mealConfig.clientMealType || 'table') === 'table') {
    const tables = mealConfig.tableCount || Math.ceil(totalClients / 10);
    return price * 10 * tables;
  } else {
    const count = mealConfig.clientCount || totalClients;
    return price * count;
  }
};

// 计算每日住宿费用
const calculateDailyAccommodation = (
  day: DailyExpense,
  coreConfig: CoreConfig,
  totalStaff: number,
  accommodationDays: number,
  dayIndex: number
): number => {
  // 如果每日设置了金额，使用每日金额
  if (day.accommodationAmount && day.accommodationAmount > 0) {
    return day.accommodationAmount;
  }
  
  // 如果超过住宿晚数，返回0
  if (dayIndex >= accommodationDays) {
    return 0;
  }
  
  // 否则根据每日房型配置或客户配置计算
  const twinCount = day.twinRoomCount ?? coreConfig.twinRoom?.countClient ?? 0;
  const twinPrice = day.twinRoomPrice ?? coreConfig.twinRoom?.price ?? 0;
  const kingCount = day.kingRoomCount ?? coreConfig.kingRoom?.countClient ?? 0;
  const kingPrice = day.kingRoomPrice ?? coreConfig.kingRoom?.price ?? 0;
  const clientAccommodation = twinCount * twinPrice + kingCount * kingPrice;
  
  // 工作人员住宿
  let staffAccommodation = 0;
  if (day.staffAccommodationAmount && day.staffAccommodationAmount > 0) {
    staffAccommodation = day.staffAccommodationAmount;
  } else if (coreConfig.staffAccommodation) {
    const staffRoomCount = day.staffRoomCount ?? Math.ceil(totalStaff / 2);
    const staffRoomPrice = day.staffRoomPrice ?? coreConfig.staffRoomPrice ?? 0;
    staffAccommodation = staffRoomCount * staffRoomPrice;
  }
  
  return clientAccommodation + staffAccommodation;
};


// 导出为 Excel
export function exportToExcel(
  projectData: ProjectData,
  summary: CostSummary,
  dailyExpenses: DailyExpense[],
  otherExpenses: OtherExpenses,
  coreConfig: CoreConfig,
  discount: number
) {
  const wb = XLSX.utils.book_new();
  const totalClients = coreConfig.studentCount + coreConfig.parentCount + coreConfig.teacherCount;
  const totalStaff = coreConfig.staffMembers.reduce((sum, m) => sum + m.count, 0);

  // 1. 项目概览
  const projectTypeLabel = projectData.project.type === 'half-day' ? '半日' : projectData.project.type === 'one-day' ? '一日' : `${coreConfig.tripDays}天`;
  const overviewData = [
    ['研学旅行成本核算与报价单'],
    [],
    ['项目信息'],
    ['项目名称', projectData.project.name],
    ['行程类型', projectTypeLabel],
    ['项目备注', projectData.project.remark || '无'],
    ['创建时间', projectData.project.createdAt],
    ['更新时间', projectData.project.updatedAt],
    [],
    ['人员统计'],
    ['学生人数', coreConfig.studentCount, '人'],
    ['家长人数', coreConfig.parentCount, '人'],
    ['老师人数', coreConfig.teacherCount, '人'],
    ['客户总计', totalClients, '人'],
    ['计价人数', coreConfig.pricingCount || totalClients, '人'],
    ['工作人员', totalStaff, '人'],
    [],
    ['行程信息'],
    ['行程天数', coreConfig.tripDays, '天'],
    ['住宿晚数', coreConfig.accommodationDays, '晚'],
    [],
    ['费用汇总'],
    ['总成本', formatMoney(summary.totalCost)],
    ['人均成本', formatMoney(summary.totalCost / (coreConfig.pricingCount || totalClients || 1))],
  ];
  const wsOverview = XLSX.utils.aoa_to_sheet(overviewData);
  XLSX.utils.book_append_sheet(wb, wsOverview, '项目概览');

  // 2. 核心配置
  const configData: any[][] = [
    ['核心配置明细'],
    [],
    ['【客户人员配置】'],
    ['学生人数', coreConfig.studentCount, '人'],
    ['家长人数', coreConfig.parentCount, '人'],
    ['老师人数', coreConfig.teacherCount, '人'],
    ['客户总计', totalClients, '人'],
    ['计价人数', coreConfig.pricingCount || totalClients, '人'],
    [],
    ['【工作人员配置】'],
  ];
  
  // 工作人员明细
  configData.push(['角色', '人数', '日薪(元)', '行程天数', '费用小计']);
  coreConfig.staffMembers.forEach(member => {
    if (member.count > 0) {
      configData.push([
        member.name,
        member.count,
        member.dailyFee,
        coreConfig.tripDays,
        formatMoney(member.count * member.dailyFee * coreConfig.tripDays)
      ]);
    }
  });
  configData.push(['工作人员总计', totalStaff, '', '', formatMoney(summary.totalStaffFee)]);
  configData.push([]);

  // 住宿配置
  configData.push(['【住宿配置】']);
  configData.push(['住宿标准', ACCOMMODATION_TYPE_LABELS[coreConfig.accommodationType]]);
  configData.push(['住宿晚数', coreConfig.accommodationDays, '晚']);
  configData.push([]);
  configData.push(['房型', '客户房间数', '工作人员房间数', '单价(元/晚)', '晚数', '费用小计']);
  
  if (coreConfig.twinRoom && (coreConfig.twinRoom.countClient > 0 || coreConfig.twinRoom.countStaff > 0)) {
    const totalRooms = (coreConfig.twinRoom.countClient || 0) + (coreConfig.twinRoom.countStaff || 0);
    const cost = totalRooms * (coreConfig.twinRoom.price || 0) * coreConfig.accommodationDays;
    configData.push([
      '双床房',
      coreConfig.twinRoom.countClient || 0,
      coreConfig.twinRoom.countStaff || 0,
      coreConfig.twinRoom.price || 0,
      coreConfig.accommodationDays,
      formatMoney(cost)
    ]);
  }
  
  if (coreConfig.kingRoom && (coreConfig.kingRoom.countClient > 0 || coreConfig.kingRoom.countStaff > 0)) {
    const totalRooms = (coreConfig.kingRoom.countClient || 0) + (coreConfig.kingRoom.countStaff || 0);
    const cost = totalRooms * (coreConfig.kingRoom.price || 0) * coreConfig.accommodationDays;
    configData.push([
      '大床房',
      coreConfig.kingRoom.countClient || 0,
      coreConfig.kingRoom.countStaff || 0,
      coreConfig.kingRoom.price || 0,
      coreConfig.accommodationDays,
      formatMoney(cost)
    ]);
  }
  
  // 工作人员住宿
  if (coreConfig.staffAccommodation) {
    const staffRooms = Math.ceil(totalStaff / 2);
    const cost = staffRooms * (coreConfig.staffRoomPrice || 0) * (coreConfig.staffAccommodationNights || 0);
    configData.push([
      '工作人员住宿',
      '-',
      staffRooms,
      coreConfig.staffRoomPrice || 0,
      coreConfig.staffAccommodationNights || 0,
      formatMoney(cost)
    ]);
  }
  configData.push([]);

  // 用餐配置
  configData.push(['【用餐配置】']);
  configData.push(['客户餐标', `${coreConfig.mealStandardClient}元/人/餐`]);
  configData.push(['工作人员餐标', `${coreConfig.mealStandardStaff}元/人/餐`]);
  configData.push([]);

  // 交通配置
  configData.push(['【交通配置】']);
  if (coreConfig.busFee > 0) {
    configData.push(['大巴包车费', formatMoney(coreConfig.busFee)]);
  }
  if (coreConfig.otherTransports && coreConfig.otherTransports.length > 0) {
    configData.push(['交通类型', '数量', '成本单价', '费用小计']);
    coreConfig.otherTransports.forEach(t => {
      configData.push([
        t.type === 'flight' ? '飞机' : '高铁',
        t.count,
        t.price,
        formatMoney(t.price * t.count)
      ]);
    });
  }
  configData.push([]);

  // 其他费用配置
  configData.push(['【其他费用配置】']);
  if (otherExpenses.insurance.totalAmount > 0) {
    configData.push([
      '保险费',
      `${otherExpenses.insurance.pricePerPerson}元/人/天`,
      `${otherExpenses.insurance.days}天`,
      `${totalClients + totalStaff}人`,
      formatMoney(otherExpenses.insurance.totalAmount)
    ]);
  }
  if (otherExpenses.reserveFund > 0) {
    configData.push(['备用金', formatMoney(otherExpenses.reserveFund)]);
  }
  if (otherExpenses.materials && otherExpenses.materials.length > 0) {
    configData.push([]);
    configData.push(['物料费用']);
    configData.push(['物料名称', '数量', '单价', '费用小计']);
    otherExpenses.materials.forEach(m => {
      configData.push([m.name, m.quantity, m.price, formatMoney(m.totalPrice || m.price * m.quantity)]);
    });
  }
  if (otherExpenses.otherExpenses && otherExpenses.otherExpenses.length > 0) {
    configData.push([]);
    configData.push(['工作人员杂费']);
    configData.push(['项目名称', '数量', '单价', '费用小计']);
    otherExpenses.otherExpenses.forEach(o => {
      configData.push([o.name || '其他', o.quantity, o.price, formatMoney(o.totalPrice || o.price * o.quantity)]);
    });
  }

  const wsConfig = XLSX.utils.aoa_to_sheet(configData);
  XLSX.utils.book_append_sheet(wb, wsConfig, '核心配置');

  // 3. 每日安排
  const dailyArrangementData: any[][] = [
    ['每日安排明细'],
    [],
  ];

  dailyExpenses.forEach((day, index) => {
    dailyArrangementData.push([`=== 第${day.day}天 ===`]);
    if (day.date) {
      dailyArrangementData.push(['日期', day.date]);
    }
    
    // 住宿
    const dayAccommodation = calculateDailyAccommodation(day, coreConfig, totalStaff, coreConfig.accommodationDays, index);
    if (dayAccommodation > 0) {
      dailyArrangementData.push(['住宿费', formatMoney(dayAccommodation)]);
    }
    
    // 用餐
    const lunch = day.lunch || DEFAULT_MEAL_CONFIG;
    const dinner = day.dinner || DEFAULT_MEAL_CONFIG;
    const lunchAmount = calculateMealAmount(lunch, coreConfig, totalClients);
    const dinnerAmount = calculateMealAmount(dinner, coreConfig, totalClients);
    
    dailyArrangementData.push([]);
    dailyArrangementData.push(['【用餐安排】']);
    
    // 中餐
    if (lunch.enabled !== false && lunchAmount > 0) {
      dailyArrangementData.push(['中餐']);
      if (lunch.restaurantName) {
        dailyArrangementData.push(['餐厅', lunch.restaurantName]);
      }
      const price = lunch.pricePerPerson || coreConfig.mealStandardClient || 0;
      if ((lunch.clientMealType || 'table') === 'table') {
        const tables = lunch.tableCount || Math.ceil(totalClients / 10);
        dailyArrangementData.push([
          '用餐方式', '桌餐',
          '桌数', tables,
          '桌价', price * 10,
          '费用', formatMoney(lunchAmount)
        ]);
      } else {
        const count = lunch.clientCount || totalClients;
        dailyArrangementData.push([
          '用餐方式', '例餐',
          '人数', count,
          '人均', price,
          '费用', formatMoney(lunchAmount)
        ]);
      }
      dailyArrangementData.push(['工作人员用餐', lunch.staffMealType === 'with-group' ? '随团用餐' : '独立用餐']);
    }
    
    // 晚餐
    if (dinner.enabled !== false && dinnerAmount > 0) {
      dailyArrangementData.push(['晚餐']);
      if (dinner.restaurantName) {
        dailyArrangementData.push(['餐厅', dinner.restaurantName]);
      }
      const price = dinner.pricePerPerson || coreConfig.mealStandardClient || 0;
      if ((dinner.clientMealType || 'table') === 'table') {
        const tables = dinner.tableCount || Math.ceil(totalClients / 10);
        dailyArrangementData.push([
          '用餐方式', '桌餐',
          '桌数', tables,
          '桌价', price * 10,
          '费用', formatMoney(dinnerAmount)
        ]);
      } else {
        const count = dinner.clientCount || totalClients;
        dailyArrangementData.push([
          '用餐方式', '例餐',
          '人数', count,
          '人均', price,
          '费用', formatMoney(dinnerAmount)
        ]);
      }
      dailyArrangementData.push(['工作人员用餐', dinner.staffMealType === 'with-group' ? '随团用餐' : '独立用餐']);
    }
    
    // 工作人员费用
    dailyArrangementData.push([]);
    dailyArrangementData.push(['【工作人员费用】']);
    let dayStaffFee = 0;
    coreConfig.staffMembers.forEach((member) => {
      const dailyFee = day.staffFees[member.id] ?? member.dailyFee;
      if (member.count > 0) {
        const fee = dailyFee * member.count;
        dayStaffFee += fee;
        dailyArrangementData.push([member.name, `${member.count}人`, `${dailyFee}元/天`, formatMoney(fee)]);
      }
    });
    dailyArrangementData.push(['工作人员费用小计', formatMoney(dayStaffFee)]);
    
    // 活动项目
    if (day.singleItems && day.singleItems.length > 0 && day.singleItems.some(item => item.name && (item.totalPrice || item.price * item.count) > 0)) {
      dailyArrangementData.push([]);
      dailyArrangementData.push(['【活动项目】']);
      dailyArrangementData.push(['项目名称', '时间', '数量', '单位', '单价', '费用小计', '备注']);
      day.singleItems.filter(item => item.name && (item.totalPrice || item.price * item.count) > 0).forEach((item) => {
        const timeRange = item.startTime && item.endTime ? `${item.startTime}-${item.endTime}` : '';
        dailyArrangementData.push([
          item.name,
          timeRange,
          item.count,
          item.unit || '人',
          item.price,
          formatMoney(item.totalPrice || item.price * item.count),
          item.remark || ''
        ]);
      });
    }
    
    // 当日小计
    const daySingleItems = day.singleItems.reduce((sum, item) => sum + (item.totalPrice || item.price * item.count), 0);
    const dailyTotal = dayAccommodation + lunchAmount + dinnerAmount + dayStaffFee + daySingleItems;
    dailyArrangementData.push([]);
    dailyArrangementData.push(['当日费用小计', formatMoney(dailyTotal)]);
    dailyArrangementData.push([]);
  });

  const wsDailyArrangement = XLSX.utils.aoa_to_sheet(dailyArrangementData);
  XLSX.utils.book_append_sheet(wb, wsDailyArrangement, '每日安排');

  // 2. 成本明细
  const costData: any[][] = [
    ['成本明细'],
    [],
  ];

  // 住宿费
  if (projectData.project.type === 'multi-day' && summary.totalAccommodation > 0) {
    costData.push(['住宿费']);
    if (coreConfig.twinRoom && (coreConfig.twinRoom.countClient > 0 || coreConfig.twinRoom.countStaff > 0)) {
      costData.push(['双床房', `${(coreConfig.twinRoom.countClient || 0) + (coreConfig.twinRoom.countStaff || 0)}间`, `${coreConfig.twinRoom.price}元/间`, `${coreConfig.accommodationDays}晚`, formatMoney(((coreConfig.twinRoom.countClient || 0) + (coreConfig.twinRoom.countStaff || 0)) * (coreConfig.twinRoom.price || 0) * coreConfig.accommodationDays)]);
    }
    if (coreConfig.kingRoom && (coreConfig.kingRoom.countClient > 0 || coreConfig.kingRoom.countStaff > 0)) {
      costData.push(['大床房', `${(coreConfig.kingRoom.countClient || 0) + (coreConfig.kingRoom.countStaff || 0)}间`, `${coreConfig.kingRoom.price}元/间`, `${coreConfig.accommodationDays}晚`, formatMoney(((coreConfig.kingRoom.countClient || 0) + (coreConfig.kingRoom.countStaff || 0)) * (coreConfig.kingRoom.price || 0) * coreConfig.accommodationDays)]);
    }
    costData.push([]);
  }

  // 用餐费
  if (summary.totalMeal > 0) {
    costData.push(['用餐费']);
    dailyExpenses.forEach((day) => {
      const lunch = day.lunch || DEFAULT_MEAL_CONFIG;
      const dinner = day.dinner || DEFAULT_MEAL_CONFIG;
      const lunchAmount = calculateMealAmount(lunch, coreConfig, totalClients);
      const dinnerAmount = calculateMealAmount(dinner, coreConfig, totalClients);
      
      if (lunchAmount > 0) {
        const price = lunch.pricePerPerson || coreConfig.mealStandardClient || 0;
        if ((lunch.clientMealType || 'table') === 'table') {
          const tables = lunch.tableCount || Math.ceil(totalClients / 10);
          costData.push([`D${day.day}中餐`, `${tables}桌`, `${price * 10}元/桌`, '', formatMoney(lunchAmount)]);
        } else {
          const count = lunch.clientCount || totalClients;
          costData.push([`D${day.day}中餐`, `${count}人`, `${price}元/人`, '', formatMoney(lunchAmount)]);
        }
      }
      if (dinnerAmount > 0) {
        const price = dinner.pricePerPerson || coreConfig.mealStandardClient || 0;
        if ((dinner.clientMealType || 'table') === 'table') {
          const tables = dinner.tableCount || Math.ceil(totalClients / 10);
          costData.push([`D${day.day}晚餐`, `${tables}桌`, `${price * 10}元/桌`, '', formatMoney(dinnerAmount)]);
        } else {
          const count = dinner.clientCount || totalClients;
          costData.push([`D${day.day}晚餐`, `${count}人`, `${price}元/人`, '', formatMoney(dinnerAmount)]);
        }
      }
    });
    costData.push([]);
  }

  // 交通费
  if (summary.totalBus > 0) {
    costData.push(['交通费']);
    if (coreConfig.busFee > 0) {
      costData.push(['大巴', '', '', '', formatMoney(coreConfig.busFee)]);
    }
    (coreConfig.otherTransports || []).forEach((t) => {
      costData.push([t.type === 'flight' ? '飞机' : '高铁', `${t.count}张`, `${t.price}元/张`, '', formatMoney(t.price * t.count)]);
    });
    costData.push([]);
  }

  // 工作人员
  if (summary.totalStaffFee > 0) {
    costData.push(['工作人员']);
    coreConfig.staffMembers.filter(m => m.count > 0).forEach((member) => {
      const totalFee = member.count * member.dailyFee * coreConfig.tripDays;
      costData.push([member.name, `${member.count}人`, `${member.dailyFee}元/天`, `${coreConfig.tripDays}天`, formatMoney(totalFee)]);
    });
    costData.push([]);
  }

  // 活动项目
  if (summary.totalSingleItems > 0) {
    costData.push(['活动项目']);
    dailyExpenses.forEach((day) => {
      day.singleItems.filter(item => item.name && (item.totalPrice || item.price * item.count) > 0).forEach((item) => {
        costData.push([`D${day.day} ${item.name}`, `${item.count}${item.unit || '人'}`, `${item.price}元`, '', formatMoney(item.totalPrice || item.price * item.count)]);
      });
    });
    costData.push([]);
  }

  // 其他费用
  if (summary.totalOtherExpenses > 0) {
    costData.push(['其他费用']);
    if (otherExpenses.insurance.totalAmount > 0) {
      costData.push(['保险', `${otherExpenses.insurance.pricePerPerson}元/人/天`, `${otherExpenses.insurance.days}天`, `${totalClients + totalStaff}人`, formatMoney(otherExpenses.insurance.totalAmount)]);
    }
    if (otherExpenses.reserveFund > 0) {
      costData.push(['备用金', '', '', '', formatMoney(otherExpenses.reserveFund)]);
    }
    otherExpenses.materials.filter(m => m.totalPrice > 0 || m.price * m.quantity > 0).forEach((m) => {
      costData.push([`杂费(客户)-${m.name}`, `${m.quantity}`, `${m.price}元`, '', formatMoney(m.totalPrice || m.price * m.quantity)]);
    });
    otherExpenses.otherExpenses.filter(o => o.totalPrice > 0 || o.price * o.quantity > 0).forEach((o) => {
      costData.push([`杂费(工作人员)-${o.name || '其他'}`, `${o.quantity}`, `${o.price}元`, '', formatMoney(o.totalPrice || o.price * o.quantity)]);
    });
    costData.push([]);
  }

  costData.push(['总成本', '', '', '', formatMoney(summary.totalCost)]);
  const wsCost = XLSX.utils.aoa_to_sheet(costData);
  XLSX.utils.book_append_sheet(wb, wsCost, '成本明细');

  // 3. 报价单
  const serviceFee = summary.totalCost * (otherExpenses.serviceFeePercent / 100);
  const tax = (summary.totalCost + serviceFee) * ((otherExpenses.taxPercent ?? 1) / 100);
  const totalPrice = summary.totalCost + serviceFee + tax;
  const finalPrice = totalPrice - discount;

  const quoteData: any[][] = [
    ['报价单'],
    [],
    ['成本小计', formatMoney(summary.totalCost)],
    [`服务费(${otherExpenses.serviceFeePercent}%)`, formatMoney(serviceFee)],
    [`税费(${otherExpenses.taxPercent ?? 1}%)`, formatMoney(tax)],
    ['报价合计', formatMoney(totalPrice)],
    ['优惠', `-${formatMoney(discount)}`],
    ['最终报价', formatMoney(finalPrice)],
    [],
    ['人均报价', formatMoney(finalPrice / (coreConfig.pricingCount || totalClients || 1))],
  ];
  const wsQuote = XLSX.utils.aoa_to_sheet(quoteData);
  XLSX.utils.book_append_sheet(wb, wsQuote, '报价单');

  // 4. 每日明细
  const dailyData: any[][] = [
    ['日期', '住宿费', '中餐', '晚餐', '工作人员', '活动项目', '小计'],
  ];
  
  dailyExpenses.forEach((day, index) => {
    let dayStaffFee = 0;
    coreConfig.staffMembers.forEach((member) => {
      const dailyFee = day.staffFees[member.id] ?? member.dailyFee;
      dayStaffFee += dailyFee * member.count;
    });
    
    const daySingleItems = day.singleItems.reduce((sum, item) => sum + (item.totalPrice || item.price * item.count), 0);
    const lunch = day.lunch || DEFAULT_MEAL_CONFIG;
    const dinner = day.dinner || DEFAULT_MEAL_CONFIG;
    const lunchAmount = calculateMealAmount(lunch, coreConfig, totalClients);
    const dinnerAmount = calculateMealAmount(dinner, coreConfig, totalClients);
    const dayAccommodation = calculateDailyAccommodation(day, coreConfig, totalStaff, coreConfig.accommodationDays, index);
    const dailyTotal = dayAccommodation + lunchAmount + dinnerAmount + dayStaffFee + daySingleItems;
    
    dailyData.push([
      `第${day.day}天`,
      formatMoney(dayAccommodation),
      formatMoney(lunchAmount),
      formatMoney(dinnerAmount),
      formatMoney(dayStaffFee),
      formatMoney(daySingleItems),
      formatMoney(dailyTotal),
    ]);
  });
  
  const wsDaily = XLSX.utils.aoa_to_sheet(dailyData);
  XLSX.utils.book_append_sheet(wb, wsDaily, '每日明细');

  // 导出文件
  XLSX.writeFile(wb, `${projectData.project.name}-成本核算与报价单.xlsx`);
}

// 导出 HTML 元素为图片
export async function exportElementAsImage(element: HTMLElement, filename: string) {
  try {
    // 先隐藏导出按钮
    const exportButtons = element.querySelectorAll('.export-button-container');
    exportButtons.forEach((btn) => {
      (btn as HTMLElement).style.display = 'none';
    });
    
    // 使用 modern-screenshot 导出
    const dataUrl = await domToPng(element, {
      scale: 2,
      backgroundColor: '#ffffff',
    });
    
    // 恢复导出按钮
    exportButtons.forEach((btn) => {
      (btn as HTMLElement).style.display = '';
    });
    
    const link = document.createElement('a');
    link.download = `${filename}.png`;
    link.href = dataUrl;
    link.click();
  } catch (error) {
    console.error('导出图片失败:', error);
    alert('导出图片失败，请重试');
  }
}

// 导出 HTML 元素为 PDF
export async function exportElementAsPDF(element: HTMLElement, filename: string) {
  try {
    // 先隐藏导出按钮
    const exportButtons = element.querySelectorAll('.export-button-container');
    exportButtons.forEach((btn) => {
      (btn as HTMLElement).style.display = 'none';
    });
    
    // 使用 modern-screenshot 获取图片
    const dataUrl = await domToPng(element, {
      scale: 2,
      backgroundColor: '#ffffff',
    });
    
    // 恢复导出按钮
    exportButtons.forEach((btn) => {
      (btn as HTMLElement).style.display = '';
    });
    
    // 创建图片获取尺寸
    const img = new Image();
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.src = dataUrl;
    });
    
    const imgWidth = img.width;
    const imgHeight = img.height;
    
    // 计算PDF尺寸（A4纸张）
    const pdfWidth = 210; // A4宽度(mm)
    const pdfHeight = (imgHeight * pdfWidth) / imgWidth;
    
    const pdf = new jsPDF({
      orientation: pdfHeight > 297 ? 'portrait' : 'portrait',
      unit: 'mm',
      format: [pdfWidth, Math.min(pdfHeight, 2000)], // 限制最大高度
    });
    
    pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${filename}.pdf`);
  } catch (error) {
    console.error('导出PDF失败:', error);
    alert('导出PDF失败，请重试');
  }
}
