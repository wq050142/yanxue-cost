'use client';

import { useState, useEffect, use, useRef, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ArrowLeft, Save, Download, Plus, Trash2, Pencil, Check, FileSpreadsheet, Image, FileText, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { NumberInput } from '@/components/number-input';
import { 
  ProjectData, 
  ProjectType, 
  AccommodationType, 
  StaffMember, 
  TransportItem,
  MaterialItem, 
  OtherExpenseItem,
  ACCOMMODATION_TYPE_LABELS, 
  DEFAULT_MEAL_CONFIG,
  DEFAULT_STAFF_MEMBERS,
  DEFAULT_CORE_CONFIG,
  DEFAULT_OTHER_EXPENSES,
  DEFAULT_INSURANCE_CONFIG,
  CostSummary
} from '@/types';
import { getProjectData, updateProjectData, createProject } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { AuthModal } from '@/components/AuthModal';
import { calculateCostSummary, calculateServiceFee, calculateServiceFeePerPerson, formatMoney } from '@/lib/calculation';
import { exportToExcel, exportElementAsImage, exportElementAsPDF } from '@/lib/export';

const PROJECT_TYPES: { value: ProjectType; label: string }[] = [
  { value: 'half-day', label: '半日' },
  { value: 'one-day', label: '一日' },
  { value: 'multi-day', label: '多日' },
];

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isQuoteEditing, setIsQuoteEditing] = useState(false);
  const [quoteEditSnapshot, setQuoteEditSnapshot] = useState<any>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // 导出相关 ref
  const costProfitCardRef = useRef<HTMLDivElement>(null);
  const quoteCardRef = useRef<HTMLDivElement>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showCostExportMenu, setShowCostExportMenu] = useState(false);
  const [showQuoteExportMenu, setShowQuoteExportMenu] = useState(false);

  // 检查是否是临时项目
  const isTempProject = id.startsWith('temp_');
  
  useEffect(() => {
    if (authLoading) return;
    
    const loadData = async () => {
      try {
        setIsLoading(true);
        
        // 如果是临时项目，从 localStorage 读取
        if (isTempProject) {
          const tempData = localStorage.getItem(`temp_project_${id}`);
          if (tempData) {
            const parsedData = JSON.parse(tempData);
            // 迁移旧数据格式
            const safeData = migrateOldData(parsedData);
            setProjectData(safeData);
          } else {
            alert('临时项目不存在或已过期');
            router.push('/');
          }
        } else {
          // 非临时项目需要登录
          if (!user) {
            router.push('/');
            return;
          }
          const data = await getProjectData(id);
          if (data) {
            // 迁移旧数据格式
            const safeData = migrateOldData(data);
            setProjectData(safeData);
          } else {
            alert('项目不存在或无权限访问');
            router.push('/');
          }
        }
      } catch (error) {
        console.error('加载项目失败:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [id, router, user, authLoading, isTempProject]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '您有未保存的更改，确定要离开吗？';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      if (window.confirm('您有未保存的更改，确定要离开吗？')) {
        setHasUnsavedChanges(false);
        return originalPushState.apply(this, args);
      }
      return undefined;
    };

    history.replaceState = function(...args) {
      if (window.confirm('您有未保存的更改，确定要离开吗？')) {
        setHasUnsavedChanges(false);
        return originalReplaceState.apply(this, args);
      }
      return undefined;
    };

    return () => {
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  }, [hasUnsavedChanges]);

  // 迁移旧数据格式到新格式
  const migrateOldData = (data: ProjectData): ProjectData => {
    try {
      if (!data) throw new Error('Data is null');
      
      const d = JSON.parse(JSON.stringify(data));
      
      // 1. 确保基础结构存在并合并默认值
      if (!d.project) d.project = { id, name: '未命名项目', type: 'one-day', remark: '', clientName: '', travelDateStart: '', travelDateEnd: '', quoteDate: new Date().toISOString().split('T')[0], quoteCompany: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      
      // 迁移旧的 travelDate 到新的日期区间格式
      if ((d.project as any).travelDate && !d.project.travelDateStart && !d.project.travelDateEnd) {
        d.project.travelDateStart = (d.project as any).travelDate;
        d.project.travelDateEnd = (d.project as any).travelDate;
        delete (d.project as any).travelDate;
      }
      
      // 确保新字段存在默认值
      if (d.project.clientName === undefined) d.project.clientName = '';
      if (d.project.travelDateStart === undefined) d.project.travelDateStart = '';
      if (d.project.travelDateEnd === undefined) d.project.travelDateEnd = '';
      if (d.project.quoteDate === undefined) d.project.quoteDate = new Date().toISOString().split('T')[0];
      if (d.project.quoteCompany === undefined) d.project.quoteCompany = '';
      
      if (!d.coreConfig) {
        d.coreConfig = { ...DEFAULT_CORE_CONFIG };
      } else {
        // 确保核心配置中的基本数值字段存在
        d.coreConfig.studentCount = Number(d.coreConfig.studentCount) || 0;
        d.coreConfig.parentCount = Number(d.coreConfig.parentCount) || 0;
        d.coreConfig.teacherCount = Number(d.coreConfig.teacherCount) || 0;
        d.coreConfig.tripDays = Number(d.coreConfig.tripDays) || 1;
        d.coreConfig.accommodationDays = Number(d.coreConfig.accommodationDays) || 0;
        
        if (!d.coreConfig.staffMembers) {
          d.coreConfig.staffMembers = JSON.parse(JSON.stringify(DEFAULT_STAFF_MEMBERS));
        }
        
        if (!d.coreConfig.twinRoom) d.coreConfig.twinRoom = { ...DEFAULT_CORE_CONFIG.twinRoom };
        if (!d.coreConfig.kingRoom) d.coreConfig.kingRoom = { ...DEFAULT_CORE_CONFIG.kingRoom };
        if (!d.coreConfig.otherTransports) d.coreConfig.otherTransports = [];
      }

      if (!d.otherExpenses) {
        d.otherExpenses = JSON.parse(JSON.stringify(DEFAULT_OTHER_EXPENSES));
      } else {
        if (!d.otherExpenses.insurance) d.otherExpenses.insurance = { ...DEFAULT_INSURANCE_CONFIG };
        if (!d.otherExpenses.materials) d.otherExpenses.materials = [];
        if (!d.otherExpenses.otherExpenses) d.otherExpenses.otherExpenses = [];
        if (d.otherExpenses.taxPercent === undefined) d.otherExpenses.taxPercent = 1;
        if (!d.otherExpenses.serviceFeeMode) d.otherExpenses.serviceFeeMode = 'percent';
        if (d.otherExpenses.discount === undefined) d.otherExpenses.discount = 0;
      }

      if (!d.dailyExpenses) {
        d.dailyExpenses = [];
      }

      // 迁移旧版工作人员数据格式 (staffCounts -> staffMembers)
      if (d.coreConfig.staffMembers.length === 0 && (d.coreConfig as any).staffCounts) {
        const oldStaff = (d.coreConfig as any).staffCounts;
        const oldFees = (d.coreConfig as any).staffDailyFees || {};
        d.coreConfig.staffMembers = [
          { id: 'guide', name: '导游', count: Number(oldStaff.guide) || 0, dailyFee: Number(oldFees.guide) || 0 },
          { id: 'photographer', name: '摄影', count: Number(oldStaff.photographer) || 0, dailyFee: Number(oldFees.photographer) || 0 },
          { id: 'videographer', name: '摄像', count: Number(oldStaff.videographer) || 0, dailyFee: Number(oldFees.videographer) || 0 },
          { id: 'driver', name: '司机', count: Number(oldStaff.driver) || 0, dailyFee: Number(oldFees.driver) || 0 },
        ];
      }
      
      // 迁移：保险数据格式兼容
      if ((d.otherExpenses as any).insurance !== undefined && typeof (d.otherExpenses as any).insurance === 'number') {
        const oldAmount = d.otherExpenses.insurance as unknown as number;
        d.otherExpenses.insurance = {
          pricePerPerson: 0,
          days: d.coreConfig.tripDays || 1,
          totalAmount: oldAmount || 0,
        };
      }
      
      // 迁移交通数据
      if (!d.coreConfig.otherTransports || d.coreConfig.otherTransports.length === 0) {
        const transports: TransportItem[] = [];
        if ((d.coreConfig as any).flightEnabled && (d.coreConfig as any).flightPrice) {
          transports.push({
            id: 'flight_migrated',
            type: 'flight',
            price: Number((d.coreConfig as any).flightPrice) || 0,
            count: Number((d.coreConfig as any).flightCount) || 0,
          });
        }
        if ((d.coreConfig as any).trainEnabled && (d.coreConfig as any).trainPrice) {
          transports.push({
            id: 'train_migrated',
            type: 'train',
            price: Number((d.coreConfig as any).trainPrice) || 0,
            count: Number((d.coreConfig as any).trainCount) || 0,
          });
        }
        if (transports.length > 0) d.coreConfig.otherTransports = transports;
      }
      
      // 标准化每日费用数据
      const totalClientsCount = d.coreConfig.studentCount + d.coreConfig.parentCount + d.coreConfig.teacherCount;
      const staffFeesBase: Record<string, number> = {};
      d.coreConfig.staffMembers.forEach((m: StaffMember) => { staffFeesBase[m.id] = m.dailyFee; });

      // 确保每日费用数组长度正确且内容完整
      const targetDays = d.coreConfig.tripDays || 1;
      const newDailyExpenses = Array.from({ length: targetDays }, (_, i) => {
        const existingDay = d.dailyExpenses[i] || {};
        return {
          day: i + 1,
          accommodationAmount: Number(existingDay.accommodationAmount) || 0,
          staffAccommodationAmount: Number(existingDay.staffAccommodationAmount) || 0,
          lunch: existingDay.lunch || JSON.parse(JSON.stringify(DEFAULT_MEAL_CONFIG)),
          dinner: existingDay.dinner || JSON.parse(JSON.stringify(DEFAULT_MEAL_CONFIG)),
          staffFees: existingDay.staffFees || { ...staffFeesBase },
          singleItems: existingDay.singleItems || [{ 
            id: `init_${Date.now()}_${i}`, 
            name: '', 
            remark: '', 
            startTime: '', 
            endTime: '', 
            price: 0, 
            count: totalClientsCount, 
            unit: '人' as const, 
            totalPrice: 0 
          }],
          ...existingDay
        };
      });
      d.dailyExpenses = newDailyExpenses;

      return d;
    } catch (err) {
      console.error('Data migration failed:', err);
      return data; // 如果迁移失败，返回原始数据，防止页面白屏
    }
  };

  const updateData = (updates: Partial<ProjectData>) => {
    if (!projectData) return;
    setProjectData(prev => {
      if (!prev) return prev;
      return { ...prev, ...updates };
    });
    setHasUnsavedChanges(true);
  };

  // 自动保存到 localStorage
  useEffect(() => {
    if (!projectData || !hasUnsavedChanges) return;
    
    // 如果是临时项目，自动保存到 localStorage
    if (isTempProject) {
      localStorage.setItem(`temp_project_${id}`, JSON.stringify(projectData));
    }
  }, [projectData, hasUnsavedChanges, id, isTempProject]);
  
  // 登录对话框状态
  const [showLoginForSave, setShowLoginForSave] = useState(false);
  
  // 监听登录状态变化，如果登录后是因为保存而打开的，则继续保存
  useEffect(() => {
    if (user && showLoginForSave) {
      setShowLoginForSave(false);
      // 登录后自动保存
      handleSave();
    }
  }, [user, showLoginForSave]);
  
  const handleSave = async () => {
    if (!projectData) return;
    
    // 如果是临时项目
    if (isTempProject) {
      // 如果未登录，要求先登录
      if (!user) {
        if (confirm('需要登录后才能保存项目到云端，是否现在登录？')) {
          setShowLoginForSave(true);
        }
        return;
      }
      
      // 已登录，先创建项目
      try {
        setIsSaving(true);
        // 先创建项目
        const createResult = await createProject(
          projectData.project.name, 
          projectData.project.type, 
          projectData.project.remark
        );
        
        if (createResult?.project?.id) {
          const newId = createResult.project.id;
          // 更新项目 ID
          const dataToSave = {
            ...projectData,
            project: {
              ...projectData.project,
              id: newId,
            }
          };
          
          // 保存数据
          const success = await updateProjectData(dataToSave);
          setIsSaving(false);
          
          if (success) {
            // 移除临时项目
            localStorage.removeItem(`temp_project_${id}`);
            setHasUnsavedChanges(false);
            alert('保存成功！');
            // 跳转到正式项目
            router.replace(`/project/${newId}`);
          } else {
            alert('保存失败，请重试');
          }
        }
      } catch (error) {
        setIsSaving(false);
        console.error('保存失败:', error);
        alert('保存失败，请重试');
      }
    } else {
      // 已有项目，直接保存
      setIsSaving(true);
      const success = await updateProjectData(projectData);
      setIsSaving(false);
      if (success) {
        setHasUnsavedChanges(false);
        alert('保存成功！');
      } else {
        alert('保存失败，请重试');
      }
    }
  };

  // 导出 Excel
  const handleExportExcel = () => {
    if (!projectData || !stats) return;
    const summary = calculateCostSummary(projectData);
    const { coreConfig, dailyExpenses, otherExpenses } = projectData;
    exportToExcel(projectData, summary, dailyExpenses, otherExpenses, coreConfig, stats.discountAmount || 0);
    setShowExportMenu(false);
  };

  // 导出成本利润卡片
  const handleExportCostCard = async (type: 'image' | 'pdf') => {
    if (!costProfitCardRef.current) return;
    const filename = `${projectData?.project.name || '项目'}-成本核算与利润分析`;
    if (type === 'image') {
      await exportElementAsImage(costProfitCardRef.current, filename);
    } else {
      await exportElementAsPDF(costProfitCardRef.current, filename);
    }
    setShowCostExportMenu(false);
  };

  // 导出报价单卡片
  const handleExportQuoteCard = async (type: 'image' | 'pdf') => {
    if (!quoteCardRef.current) return;
    const filename = `${projectData?.project.name || '项目'}-报价单`;
    if (type === 'image') {
      await exportElementAsImage(quoteCardRef.current, filename);
    } else {
      await exportElementAsPDF(quoteCardRef.current, filename);
    }
    setShowQuoteExportMenu(false);
  };

  // 基础统计数据
  const stats = useMemo(() => {
    if (!projectData || !projectData.coreConfig || !projectData.otherExpenses) return null;
    
    const { coreConfig, dailyExpenses = [], otherExpenses } = projectData;
    const totalClients = (coreConfig.studentCount || 0) + (coreConfig.parentCount || 0) + (coreConfig.teacherCount || 0);
    const totalStaff = (coreConfig.staffMembers || []).reduce((sum: number, m: StaffMember) => sum + (m?.count || 0), 0);
    const totalPeople = totalClients + totalStaff;
    
    // 安全地调用 calculateCostSummary
    let summary: CostSummary;
    try {
      summary = calculateCostSummary(projectData);
    } catch (e) {
      console.error('calculateCostSummary failed:', e);
      return null;
    }

    // 报价计算函数
    const calculateMealAmountFn = (meal: any) => {
      if (!meal || meal.enabled === false) return 0;
      if (meal.amount && meal.amount > 0) return meal.amount;
      const price = meal.pricePerPerson || coreConfig.mealStandardClient || 0;
      const clientMealType = meal.clientMealType || 'table';
      if (clientMealType === 'table') {
        const tables = meal.tableCount || Math.ceil(totalClients / 10);
        return price * 10 * tables;
      } else {
        const count = meal.clientCount || totalClients;
        return price * count;
      }
    };

    const quoteAcc_m = dailyExpenses.slice(0, coreConfig.accommodationDays || 0).reduce((total: number, day: any) => {
      const dayTwinCount = day.twinRoomCount ?? coreConfig.twinRoom?.countClient ?? 0;
      const dayTwinPrice = day.twinRoomPrice ?? coreConfig.twinRoom?.price ?? 0;
      const dayKingCount = day.kingRoomCount ?? coreConfig.kingRoom?.countClient ?? 0;
      const dayKingPrice = day.kingRoomPrice ?? coreConfig.kingRoom?.price ?? 0;
      const qTwinCount = day.quoteTwinRoomCount ?? dayTwinCount;
      const qTwinPrice = day.quoteTwinRoomPrice ?? dayTwinPrice;
      const qKingCount = day.quoteKingRoomCount ?? dayKingCount;
      const qKingPrice = day.quoteKingRoomPrice ?? dayKingPrice;
      return total + (day.quoteAccommodationAmount ?? (qTwinCount * qTwinPrice + qKingCount * qKingPrice));
    }, 0);

    const quoteMeal_m = dailyExpenses.reduce((total: number, day: any) => {
      const lunch = day.lunch || DEFAULT_MEAL_CONFIG;
      const dinner = day.dinner || DEFAULT_MEAL_CONFIG;
      return total + (lunch.quoteAmount ?? calculateMealAmountFn(lunch)) + (dinner.quoteAmount ?? calculateMealAmountFn(dinner));
    }, 0);

    const quoteBus_m = (coreConfig.busQuoteFee ?? coreConfig.busFee ?? 0) + (coreConfig.otherTransports || []).reduce((s: number, t: any) => s + (t?.quotePrice ?? t?.price ?? 0) * (t?.count || 0), 0);
    
    const quoteSingle_m = dailyExpenses.flatMap((d: any) => d.singleItems || []).filter((i: any) => i && i.name).reduce((s: number, item: any) => s + (item.quoteTotalPrice || (item.quotePrice || item.price || 0) * (item.count || 0)), 0);
    
    const insuranceQ_m = otherExpenses.insurance?.quoteAmount ?? otherExpenses.insurance?.totalAmount ?? 0;
    const materialsQ_m = (otherExpenses.materials || []).reduce((s: number, m: any) => s + (m.quoteTotalPrice ?? m.totalPrice ?? (m.price || 0) * (m.quantity || 0)), 0);
    const quoteOther_m = insuranceQ_m + materialsQ_m;

    const quoteStaffFee_m = dailyExpenses.reduce((total: number, day: any) => {
      return total + (coreConfig.staffMembers || []).reduce((s: number, member: StaffMember) => {
        if (!member) return s;
        const count = (day.quoteStaffCounts?.[member.id] ?? member.count) || 0;
        const dailyFee = (day.quoteStaffFees?.[member.id] ?? (day.staffFees && day.staffFees[member.id]) ?? member.dailyFee) || 0;
        return s + count * dailyFee;
      }, 0);
    }, 0);

    const qSubtotal_m = quoteAcc_m + quoteMeal_m + quoteBus_m + quoteSingle_m + quoteOther_m + quoteStaffFee_m;
    const serviceFeePeople_m = otherExpenses.serviceFeePeople ?? totalClients;
    const serviceFeeBase_m = otherExpenses.serviceFeeBase || qSubtotal_m;
    
    const serviceFeeAmount = (otherExpenses.serviceFeeMode ?? 'percent') === 'per-person'
      ? (otherExpenses.serviceFeePerPerson || 0) * (otherExpenses.serviceFeeDays || 1) * serviceFeePeople_m
      : calculateServiceFee(serviceFeeBase_m, otherExpenses.serviceFeePercent || 0);

    const taxBase_m = qSubtotal_m;
    const tax = taxBase_m * (otherExpenses.taxPercent ?? 1) / 100;

    const totalPrice = qSubtotal_m + serviceFeeAmount + tax;
    const discountAmount = otherExpenses.discount || 0;
    const finalPrice = totalPrice - discountAmount;
    const pricePerClient = totalClients > 0 ? finalPrice / totalClients : 0;

    return {
      totalClients, totalStaff, totalPeople, summary, qSubtotal_m, 
      serviceFeeAmount, tax, totalPrice, finalPrice, pricePerClient,
      quoteAcc_m, quoteMeal_m, quoteBus_m, quoteSingle_m, quoteOther_m, 
      quoteStaffFee_m, insuranceQ_m, materialsQ_m,
      taxBase_m, discountAmount // 将计算出的实际税基也返回
    };
  }, [projectData]);

  const handleExport = () => {
    if (!projectData || !stats) return;
    const { coreConfig, dailyExpenses, otherExpenses } = projectData;
    const { totalClients, totalStaff, summary, qSubtotal_m, serviceFeeAmount, tax, totalPrice, finalPrice, discountAmount } = stats;
    
    const projectTypeLabel = projectData.project.type === 'half-day' ? '半日' : projectData.project.type === 'one-day' ? '一日' : `${coreConfig.tripDays}天`;
    
    const lines = ['═'.repeat(60), '研学旅行报价单', '═'.repeat(60),
      `项目名称：${projectData.project.name}`,
      `行程类型：${projectTypeLabel}`,
      `客户人数：${totalClients}人`,
      `工作人员：${totalStaff}人`,
      `核算日期：${new Date().toLocaleDateString()}`,
      '', '─'.repeat(60), '费用明细', '─'.repeat(60),
    ];
    
    // 住宿费明细
    if (summary.totalAccommodation > 0) {
      lines.push(``, `【住宿费】 ${formatMoney(summary.totalAccommodation)}`);
      if (coreConfig.twinRoom && (coreConfig.twinRoom.countClient > 0 || coreConfig.twinRoom.countStaff > 0)) {
        const totalRooms = (coreConfig.twinRoom.countClient || 0) + (coreConfig.twinRoom.countStaff || 0);
        lines.push(`  双床房：${totalRooms}间 × ${coreConfig.twinRoom.price}元/晚 × ${coreConfig.accommodationDays}晚 = ${formatMoney(totalRooms * (coreConfig.twinRoom.price || 0) * coreConfig.accommodationDays)}`);
      }
      if (coreConfig.kingRoom && (coreConfig.kingRoom.countClient > 0 || coreConfig.kingRoom.countStaff > 0)) {
        const totalRooms = (coreConfig.kingRoom.countClient || 0) + (coreConfig.kingRoom.countStaff || 0);
        lines.push(`  大床房：${totalRooms}间 × ${coreConfig.kingRoom.price}元/晚 × ${coreConfig.accommodationDays}晚 = ${formatMoney(totalRooms * (coreConfig.kingRoom.price || 0) * coreConfig.accommodationDays)}`);
      }
      if (coreConfig.staffAccommodation) {
        lines.push(`  工作人员住宿：${Math.ceil(totalStaff / 2)}间 × ${coreConfig.staffRoomPrice || 0}元/晚 × ${coreConfig.staffAccommodationNights || 0}晚 = ${formatMoney(Math.ceil(totalStaff / 2) * (coreConfig.staffRoomPrice || 0) * (coreConfig.staffAccommodationNights || 0))}`);
      }
    }
    
    // 用餐费明细
    if (summary.totalMeal > 0) {
      lines.push(``, `【用餐费】 ${formatMoney(summary.totalMeal)}`);
      dailyExpenses.forEach((day: any) => {
        const lunch = day.lunch || DEFAULT_MEAL_CONFIG;
        const dinner = day.dinner || DEFAULT_MEAL_CONFIG;
        
        const calculateMealAmountFn = (meal: typeof DEFAULT_MEAL_CONFIG) => {
          if (meal.enabled === false) return 0;
          if (meal.amount && meal.amount > 0) return meal.amount;
          const price = meal.pricePerPerson || coreConfig.mealStandardClient || 0;
          const clientMealType = meal.clientMealType || 'table';
          if (clientMealType === 'table') {
            const tables = meal.tableCount || Math.ceil(totalClients / 10);
            return price * 10 * tables;
          } else {
            const count = meal.clientCount || totalClients;
            return price * count;
          }
        };

        const lunchAmount = lunch.amount || calculateMealAmountFn(lunch);
        const dinnerAmount = dinner.amount || calculateMealAmountFn(dinner);
        if (lunchAmount > 0) {
          const restaurant = lunch.restaurantName ? `(${lunch.restaurantName})` : '';
          lines.push(`  D${day.day}中餐${restaurant}：${formatMoney(lunchAmount)}`);
        }
        if (dinnerAmount > 0) {
          const restaurant = dinner.restaurantName ? `(${dinner.restaurantName})` : '';
          lines.push(`  D${day.day}晚餐${restaurant}：${formatMoney(dinnerAmount)}`);
        }
      });
    }
    
    // 交通费明细
    if (summary.totalBus > 0) {
      lines.push(``, `【交通费】 ${formatMoney(summary.totalBus)}`);
      if (coreConfig.busFee > 0) {
        lines.push(`  大巴租赁：${formatMoney(coreConfig.busFee)}`);
      }
      (coreConfig.otherTransports || []).forEach((t: any) => {
        const typeName = t.type === 'flight' ? '飞机票' : '高铁票';
        lines.push(`  ${typeName}：${t.count}张 × ${t.price}元/张 = ${formatMoney(t.price * t.count)}`);
      });
    }
    
    // 活动项目明细
    if (summary.totalSingleItems > 0) {
      lines.push(``, `【活动项目】 ${formatMoney(summary.totalSingleItems)}`);
      dailyExpenses.forEach((day: any) => {
        (day.singleItems || []).filter((item: any) => item && item.name && (item.totalPrice || item.price * item.count) > 0).forEach((item: any) => {
          const remark = item.remark ? `（${item.remark}）` : '';
          lines.push(`  D${day.day} ${item.name}：${item.price}元 × ${item.count}${item.unit || '人'}${remark} = ${formatMoney(item.totalPrice || item.price * item.count)}`);
        });
      });
    }
    
    // 工作人员费用明细
    if (summary.totalStaffFee > 0) {
      lines.push(``, `【工作人员】 ${formatMoney(summary.totalStaffFee)}`);
      coreConfig.staffMembers.filter((m: StaffMember) => m && m.count > 0).forEach((member: StaffMember) => {
        let actualTotalFee = 0;
        let firstDailyFee = 0;
        dailyExpenses.forEach((day: any) => {
          const dailyFee = (day.staffFees && day.staffFees[member.id] !== undefined) ? day.staffFees[member.id] : member.dailyFee;
          if (dailyFee > 0 && firstDailyFee === 0) {
            firstDailyFee = dailyFee;
          }
          actualTotalFee += dailyFee * member.count;
        });
        const displayDailyFee = firstDailyFee || member.dailyFee;
        lines.push(`  ${member.name}：${member.count}人 × ${displayDailyFee}元/天 × ${coreConfig.tripDays}天 = ${formatMoney(actualTotalFee)}`);
      });
    }
    
    // 其他费用明细
    if (summary.totalOtherExpenses > 0) {
      lines.push(``, `【其他费用】 ${formatMoney(summary.totalOtherExpenses)}`);
      if (otherExpenses.insurance && otherExpenses.insurance.totalAmount > 0) {
        lines.push(`  保险费：${otherExpenses.insurance.pricePerPerson}元/人/天 × ${otherExpenses.insurance.days}天 × ${totalClients + totalStaff}人 = ${formatMoney(otherExpenses.insurance.totalAmount)}`);
      }
      if (otherExpenses.reserveFund > 0) {
        lines.push(`  备用金：${formatMoney(otherExpenses.reserveFund)}`);
      }
      (otherExpenses.materials || []).filter((m: any) => m && (m.totalPrice > 0 || m.price * m.quantity > 0)).forEach((m: any) => {
        lines.push(`  杂费(客户)-${m.name}：${m.price}元 × ${m.quantity} = ${formatMoney(m.totalPrice || m.price * m.quantity)}`);
      });
      (otherExpenses.otherExpenses || []).filter((o: any) => o && (o.totalPrice > 0 || o.price * o.quantity > 0)).forEach((o: any) => {
        lines.push(`  杂费(工作人员)-${o.name || '其他'}：${o.price}元 × ${o.quantity} = ${formatMoney(o.totalPrice || o.price * o.quantity)}`);
      });
    }
    
    lines.push('', '─'.repeat(60), 
      `成本小计：${formatMoney(summary.totalCost)}`, 
      `税费(${otherExpenses.taxPercent ?? 1}%)：${formatMoney(tax)}`,
      `报价合计：${formatMoney(totalPrice)}`);
    
    if (discountAmount > 0) {
      lines.push(`优惠：-${formatMoney(discountAmount)}`);
    }
    
    lines.push('', '═'.repeat(60), 
      `应付金额：${formatMoney(finalPrice)}`, 
      `人均费用：${formatMoney(finalPrice / (totalClients || 1))}`);
    
    const revenue = qSubtotal_m + serviceFeeAmount + tax - discountAmount;
    const cost = summary.totalCost;
    const profit = revenue - cost;
    const profitRate = revenue > 0 ? (profit / revenue * 100) : 0;
    
    lines.push('', '─'.repeat(60), '利润分析（内部参考）', '─'.repeat(60),
      `营收：${formatMoney(revenue)}`,
      `成本：${formatMoney(cost)}`,
      `利润：${profit >= 0 ? '+' : ''}${formatMoney(profit)}`,
      `利润率：${profitRate.toFixed(1)}%`);
    
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectData.project.name}-报价单.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 数据一致性检查与同步
  useEffect(() => {
    if (!projectData) return;

    let needsUpdate = false;
    const newProjectData = JSON.parse(JSON.stringify(projectData)) as ProjectData;
    const { coreConfig: newCoreConfig, dailyExpenses: newDailyExpenses, otherExpenses: newOtherExpenses } = newProjectData;

    // 1. 确保工作人员列表存在
    if (!newCoreConfig.staffMembers || newCoreConfig.staffMembers.length === 0) {
      newCoreConfig.staffMembers = [...DEFAULT_STAFF_MEMBERS];
      needsUpdate = true;
    }

    // 2. 同步工作人员日薪
    newCoreConfig.staffMembers.forEach((member: StaffMember) => {
      if (member.dailyFee === 0) {
        newDailyExpenses.forEach((day: any) => {
          if (day.staffFees && day.staffFees[member.id] !== undefined && day.staffFees[member.id] !== 0) {
            delete day.staffFees[member.id];
            needsUpdate = true;
          }
        });
      }
    });

    // 3. 补全缺失字段
    if (!newOtherExpenses.insurance || typeof newOtherExpenses.insurance !== 'object') {
      newOtherExpenses.insurance = { ...DEFAULT_INSURANCE_CONFIG, days: newCoreConfig.tripDays };
      needsUpdate = true;
    }
    if (!newOtherExpenses.materials) { newOtherExpenses.materials = []; needsUpdate = true; }
    if (!newOtherExpenses.otherExpenses) { newOtherExpenses.otherExpenses = []; needsUpdate = true; }
    if (newOtherExpenses.taxPercent === undefined) { newOtherExpenses.taxPercent = 1; needsUpdate = true; }
    if (!newOtherExpenses.serviceFeeMode) { newOtherExpenses.serviceFeeMode = 'percent'; needsUpdate = true; }

    // 4. 迁移每日数据长度
    const totalClientsCount = newCoreConfig.studentCount + newCoreConfig.parentCount + newCoreConfig.teacherCount;
    if (newDailyExpenses.length !== newCoreConfig.tripDays) {
      needsUpdate = true;
      const staffFeesBase: Record<string, number> = {};
      newCoreConfig.staffMembers.forEach((m: StaffMember) => { staffFeesBase[m.id] = m.dailyFee; });
      
      newProjectData.dailyExpenses = Array.from({ length: newCoreConfig.tripDays || 1 }, (_, i) => {
        const existingDay = newDailyExpenses[i];
        if (existingDay) {
          if (!existingDay.singleItems || existingDay.singleItems.length === 0) {
            return { ...existingDay, singleItems: [{ id: `init_${Date.now()}_${i}`, name: '', remark: '', startTime: '', endTime: '', price: 0, count: totalClientsCount, unit: '人' as const, totalPrice: 0 }] };
          }
          return existingDay;
        }
        return { 
          day: i + 1, accommodationAmount: 0, staffAccommodationAmount: 0, lunch: { ...DEFAULT_MEAL_CONFIG }, dinner: { ...DEFAULT_MEAL_CONFIG },
          staffFees: { ...staffFeesBase }, singleItems: [{ id: `init_${Date.now()}_${i}`, name: '', remark: '', startTime: '', endTime: '', price: 0, count: totalClientsCount, unit: '人' as const, totalPrice: 0 }] 
        };
      });
    }

    if (needsUpdate) setProjectData(newProjectData);
  }, [projectData?.coreConfig.tripDays]);

  // 操作辅助函数
  const addStaffMember = () => {
    if (!projectData) return;
    const newId = `staff_${Date.now()}`;
    updateData({ coreConfig: { ...projectData.coreConfig, staffMembers: [...projectData.coreConfig.staffMembers, { id: newId, name: '', count: 0, dailyFee: 0 }] } });
  };

  const updateStaffMember = (id: string, updates: Partial<StaffMember>) => {
    setProjectData((prev: ProjectData | null) => {
      if (!prev) return prev;
      const newMembers = prev.coreConfig.staffMembers.map((m: StaffMember) => m.id !== id ? m : { ...m, ...updates });
      let newDailyExpenses = prev.dailyExpenses;
      if (updates.dailyFee !== undefined) {
        if (updates.dailyFee === 0) {
          newDailyExpenses = prev.dailyExpenses.map((day: any) => {
            const { [id]: _, ...rest } = day.staffFees || {};
            return { ...day, staffFees: rest };
          });
        } else {
          newDailyExpenses = prev.dailyExpenses.map((day: any) => ({ ...day, staffFees: { ...(day.staffFees || {}), [id]: updates.dailyFee! } }));
        }
      }
      return { ...prev, coreConfig: { ...prev.coreConfig, staffMembers: newMembers }, dailyExpenses: newDailyExpenses };
    });
    setHasUnsavedChanges(true);
  };

  const removeStaffMember = (id: string) => {
    if (!projectData) return;
    updateData({ coreConfig: { ...projectData.coreConfig, staffMembers: projectData.coreConfig.staffMembers.filter((m: StaffMember) => m.id !== id) } });
  };

  const addTransport = (type: 'flight' | 'train') => {
    if (!projectData || !stats) return;
    updateData({ coreConfig: { ...projectData.coreConfig, otherTransports: [...(projectData.coreConfig.otherTransports || []), { id: `transport_${Date.now()}`, type, price: 0, count: stats.totalPeople }] } });
  };

  const updateTransport = (id: string, updates: { price?: number; count?: number }) => {
    if (!projectData) return;
    updateData({ coreConfig: { ...projectData.coreConfig, otherTransports: (projectData.coreConfig.otherTransports || []).map((t: any) => t.id === id ? { ...t, ...updates } : t) } });
  };

  const removeTransport = (id: string) => {
    if (!projectData) return;
    updateData({ coreConfig: { ...projectData.coreConfig, otherTransports: (projectData.coreConfig.otherTransports || []).filter((t: any) => t.id !== id) } });
  };

  const updateInsurance = (updates: Partial<typeof DEFAULT_INSURANCE_CONFIG>) => {
    if (!projectData || !stats) return;
    const newInsurance = { ...projectData.otherExpenses.insurance, ...updates };
    if ('pricePerPerson' in updates || 'days' in updates) {
      newInsurance.totalAmount = (newInsurance.pricePerPerson || 0) * (newInsurance.days || 0) * stats.totalPeople;
    }
    updateData({ otherExpenses: { ...projectData.otherExpenses, insurance: newInsurance } });
  };

  const addMaterial = () => {
    if (!projectData) return;
    updateData({ otherExpenses: { ...projectData.otherExpenses, materials: [...projectData.otherExpenses.materials, { id: `mat_${Date.now()}`, name: '', price: 0, quantity: 0, totalPrice: 0 }] } });
  };

  const updateMaterial = (id: string, updates: Partial<MaterialItem>) => {
    if (!projectData) return;
    updateData({ otherExpenses: { ...projectData.otherExpenses, materials: projectData.otherExpenses.materials.map((m: MaterialItem) => {
      if (m.id === id) {
        const updated = { ...m, ...updates };
        if ('price' in updates || 'quantity' in updates) updated.totalPrice = (updated.price || 0) * (updated.quantity || 0);
        return updated;
      }
      return m;
    }) } });
  };

  const removeMaterial = (id: string) => {
    if (!projectData) return;
    updateData({ otherExpenses: { ...projectData.otherExpenses, materials: projectData.otherExpenses.materials.filter((m: MaterialItem) => m.id !== id) } });
  };

  const addOtherExpense = () => {
    if (!projectData) return;
    updateData({ otherExpenses: { ...projectData.otherExpenses, otherExpenses: [...projectData.otherExpenses.otherExpenses, { id: `other_${Date.now()}`, name: '', price: 0, quantity: 1, totalPrice: 0 }] } });
  };

  const updateOtherExpense = (id: string, updates: Partial<OtherExpenseItem>) => {
    if (!projectData) return;
    updateData({ otherExpenses: { ...projectData.otherExpenses, otherExpenses: projectData.otherExpenses.otherExpenses.map((o: OtherExpenseItem) => {
      if (o.id === id) {
        const updated = { ...o, ...updates };
        if (updates.price !== undefined || updates.quantity !== undefined) updated.totalPrice = (updated.price || 0) * (updated.quantity || 0);
        return updated;
      }
      return o;
    }) } });
  };

  const removeOtherExpense = (id: string) => {
    if (!projectData) return;
    updateData({ otherExpenses: { ...projectData.otherExpenses, otherExpenses: projectData.otherExpenses.otherExpenses.filter((o: OtherExpenseItem) => o.id !== id) } });
  };

  if (authLoading || isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-600">加载中...</p>
      </div>
    </div>
  );
  
  if (!user) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <LogIn className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-600 mb-4">请先登录</p>
        <Button onClick={() => router.push('/')}>返回首页</Button>
      </div>
    </div>
  );
  
  if (!projectData || !stats) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-600 mb-4">项目不存在或无权限访问</p>
        <Button onClick={() => router.push('/')}>返回首页</Button>
      </div>
    </div>
  );

  const { coreConfig, dailyExpenses, otherExpenses } = projectData;
  const { totalClients, totalStaff, summary, qSubtotal_m, serviceFeeAmount, tax, totalPrice, finalPrice, discountAmount } = stats;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100">
      {/* Header - Apple Style */}
      <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-xl border-b border-slate-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-4 mb-4">
                <Button variant="ghost" size="icon" className="h-11 w-11 flex-shrink-0 hover:bg-slate-100 rounded-xl transition-all duration-200" onClick={() => {
                  if (hasUnsavedChanges && !window.confirm('您有未保存的更改，确定要离开吗？')) {
                    return;
                  }
                  setHasUnsavedChanges(false);
                  router.push('/');
                }}>
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <Input value={projectData.project.name} onChange={(e) => updateData({ project: { ...projectData.project, name: e.target.value } })}
                  className="text-2xl font-semibold text-slate-900 border-0 p-0 h-auto flex-1 min-w-0 focus-visible:ring-0 placeholder:text-slate-400" placeholder="项目名称" />
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-3 ml-14">
                <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl border border-slate-200/50 shadow-sm">
                  <span className="text-sm text-slate-500 font-medium">时长类型</span>
                  <span className={`text-sm font-semibold ${
                    projectData.project.type === 'half-day' ? 'text-emerald-600' :
                    projectData.project.type === 'one-day' ? 'text-blue-600' :
                    'text-violet-600'
                  }`}>{PROJECT_TYPES.find(t => t.value === projectData.project.type)?.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-600 font-medium">客户</span>
                  <Input 
                    value={projectData.project.clientName || ''} 
                    onChange={(e) => updateData({ project: { ...projectData.project, clientName: e.target.value } })}
                    className="h-9 w-48 text-sm px-4 border border-slate-200 rounded-xl bg-white/60 backdrop-blur-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all duration-200" 
                    placeholder="客户名称"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-600 font-medium">出行</span>
                  <Input 
                    type="date"
                    value={projectData.project.travelDateStart || ''} 
                    onChange={(e) => updateData({ project: { ...projectData.project, travelDateStart: e.target.value } })}
                    className="h-9 w-36 text-sm px-4 border border-slate-200 rounded-xl bg-white/60 backdrop-blur-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all duration-200" 
                    placeholder="开始"
                  />
                  <span className="text-xs text-slate-400">至</span>
                  <Input 
                    type="date"
                    value={projectData.project.travelDateEnd || ''} 
                    onChange={(e) => updateData({ project: { ...projectData.project, travelDateEnd: e.target.value } })}
                    className="h-9 w-36 text-sm px-4 border border-slate-200 rounded-xl bg-white/60 backdrop-blur-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all duration-200" 
                    placeholder="结束"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-600 font-medium">报价</span>
                  <Input 
                    type="date"
                    value={projectData.project.quoteDate || new Date().toISOString().split('T')[0]} 
                    onChange={(e) => updateData({ project: { ...projectData.project, quoteDate: e.target.value } })}
                    className="h-9 w-36 text-sm px-4 border border-slate-200 rounded-xl bg-white/60 backdrop-blur-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all duration-200" 
                    placeholder="报价日期"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-600 font-medium">单位</span>
                  <Input 
                    value={projectData.project.quoteCompany || ''} 
                    onChange={(e) => updateData({ project: { ...projectData.project, quoteCompany: e.target.value } })}
                    className="h-9 w-48 text-sm px-4 border border-slate-200 rounded-xl bg-white/60 backdrop-blur-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all duration-200" 
                    placeholder="报价单位"
                  />
                </div>
                {projectData.project.remark && (
                  <span className="text-sm text-slate-500 truncate max-w-xs px-4 py-2 bg-slate-50 rounded-xl border border-slate-200/50" title={projectData.project.remark}>
                    备注：{projectData.project.remark}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-3">
              {/* 导出按钮 */}
              <div className="relative">
                <Button variant="outline" size="sm" className="h-11 px-5 text-sm font-medium rounded-xl border-2 border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 shadow-sm" onClick={() => setShowExportMenu(!showExportMenu)}>
                  <Download className="w-5 h-5 mr-2" />导出
                </Button>
                {showExportMenu && (
                  <div className="absolute right-0 top-12 z-50 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-xl py-3 min-w-[170px]">
                    <button
                      className="w-full px-5 py-3 text-left text-sm font-medium hover:bg-slate-50 flex items-center gap-3 transition-all duration-200"
                      onClick={handleExportExcel}
                    >
                      <FileSpreadsheet className="w-5 h-5 text-emerald-600" />导出 Excel
                    </button>
                    <button
                      className="w-full px-5 py-3 text-left text-sm font-medium hover:bg-slate-50 flex items-center gap-3 transition-all duration-200"
                      onClick={() => { handleExport(); setShowExportMenu(false); }}
                    >
                      <FileText className="w-5 h-5 text-blue-600" />导出文本
                    </button>
                  </div>
                )}
              </div>
              <Button size="sm" className="h-11 px-6 text-sm font-medium bg-gradient-to-r from-slate-800 to-slate-900 text-white hover:from-slate-700 hover:to-slate-800 rounded-xl shadow-md hover:shadow-lg transition-all duration-200" onClick={handleSave} disabled={isSaving}>
                <Save className="w-5 h-5 mr-2" />
                {isSaving ? '保存中' : '保存'}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex flex-col lg:flex-row gap-6 p-4 md:p-6 max-w-[1700px] mx-auto">
        <div className="flex-1 min-w-0 space-y-5 max-w-2xl">
          {/* 项目时长 - 仅多日项目显示 */}
          {projectData.project.type === 'multi-day' && (
            <Card className="bg-white/70 backdrop-blur-xl rounded-2xl border border-slate-200/50 shadow-sm hover:shadow-lg transition-all duration-300">
              <CardContent className="py-4 px-6">
                <div className="flex items-center gap-8 text-sm">
                  <span className="text-slate-600 font-semibold">项目时长</span>
                  <div className="flex items-center gap-3">
                    <NumberInput className="h-10 w-16 text-sm px-4 border border-slate-200 rounded-xl bg-white/50 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all duration-200" value={coreConfig.tripDays} onChange={(v) => updateData({ coreConfig: { ...coreConfig, tripDays: v, accommodationDays: v > 0 ? Math.min(coreConfig.accommodationDays, v) : 0 } })} />
                    <span className="text-slate-700 font-semibold">天</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <NumberInput className="h-10 w-16 text-sm px-4 border border-slate-200 rounded-xl bg-white/50 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all duration-200" value={coreConfig.accommodationDays} onChange={(v) => updateData({ coreConfig: { ...coreConfig, accommodationDays: v } })} />
                    <span className="text-slate-700 font-semibold">晚住宿</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 客户配置 */}
          <Card className="bg-white/70 backdrop-blur-xl rounded-2xl border border-slate-200/50 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">
            <CardHeader className="py-4 px-6 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white/50"><CardTitle className="text-lg font-semibold text-slate-900">客户配置 <span className="text-blue-600 font-semibold text-base ml-1">共{totalClients}人</span></CardTitle></CardHeader>
            <CardContent className="py-5 px-6 space-y-4">
              <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm">
                <span className="text-slate-600 w-12 font-semibold">人员</span>
                <div className="flex items-center gap-3">
                  <span className="text-slate-700 font-medium">学生</span>
                  <NumberInput className="h-10 w-20 text-sm px-4 border border-slate-200 rounded-xl bg-white/50 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all duration-200" value={coreConfig.studentCount} onChange={(v) => updateData({ coreConfig: { ...coreConfig, studentCount: v } })} />
                  <span className="text-slate-500">人</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-700 font-medium">老师</span>
                  <NumberInput className="h-10 w-20 text-sm px-4 border border-slate-200 rounded-xl bg-white/50 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all duration-200" value={coreConfig.teacherCount} onChange={(v) => updateData({ coreConfig: { ...coreConfig, teacherCount: v } })} />
                  <span className="text-slate-500">人</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-700 font-medium">家长</span>
                  <NumberInput className="h-10 w-20 text-sm px-4 border border-slate-200 rounded-xl bg-white/50 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all duration-200" value={coreConfig.parentCount} onChange={(v) => updateData({ coreConfig: { ...coreConfig, parentCount: v } })} />
                  <span className="text-slate-500">人</span>
                </div>
              </div>

              {projectData.project.type === 'multi-day' && (
                <>
                  <Separator />
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                    <span className="text-gray-500 w-12">住宿</span>
                    <span className="text-gray-600">标准</span>
                    <div className="flex gap-3">
                      {(Object.keys(ACCOMMODATION_TYPE_LABELS) as AccommodationType[]).map(type => (
                        <label key={type} className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            name="accommodationType"
                            checked={(coreConfig.accommodationType || '3-diamond') === type}
                            onChange={() => updateData({ coreConfig: { ...coreConfig, accommodationType: type } })}
                            className="w-4 h-4 accent-blue-500"
                          />
                          <span className={`${(coreConfig.accommodationType || '3-diamond') === type ? 'text-blue-600 font-medium' : 'text-gray-600'}`}>{ACCOMMODATION_TYPE_LABELS[type]}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm pl-16">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-600 w-12">双床房</span>
                      <NumberInput className="h-8 w-16 text-sm px-2 border rounded" value={coreConfig.twinRoom?.countClient || 0} onChange={(v) => updateData({ coreConfig: { ...coreConfig, twinRoom: { ...coreConfig.twinRoom, countClient: v, price: coreConfig.twinRoom?.price || 0, countStaff: coreConfig.twinRoom?.countStaff || 0 } } })} />
                      <span className="text-gray-500">间</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <NumberInput className="h-8 w-20 text-sm px-2 border rounded" value={coreConfig.twinRoom?.price || 0} onChange={(v) => updateData({ coreConfig: { ...coreConfig, twinRoom: { ...coreConfig.twinRoom, price: v, countClient: coreConfig.twinRoom?.countClient || 0, countStaff: coreConfig.twinRoom?.countStaff || 0 } } })} />
                      <span className="text-gray-500 whitespace-nowrap">元/间</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm pl-16">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-600 w-12">大床房</span>
                      <NumberInput className="h-8 w-16 text-sm px-2 border rounded" value={coreConfig.kingRoom?.countClient || 0} onChange={(v) => updateData({ coreConfig: { ...coreConfig, kingRoom: { ...coreConfig.kingRoom, countClient: v, price: coreConfig.kingRoom?.price || 0, countStaff: coreConfig.kingRoom?.countStaff || 0 } } })} />
                      <span className="text-gray-500">间</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <NumberInput className="h-8 w-20 text-sm px-2 border rounded" value={coreConfig.kingRoom?.price || 0} onChange={(v) => updateData({ coreConfig: { ...coreConfig, kingRoom: { ...coreConfig.kingRoom, price: v, countClient: coreConfig.kingRoom?.countClient || 0, countStaff: coreConfig.kingRoom?.countStaff || 0 } } })} />
                      <span className="text-gray-500 whitespace-nowrap">元/间</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm pl-16">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-600 w-12">酒店</span>
                      <Input 
                        className="h-8 w-48 text-sm px-2 border rounded" 
                        placeholder="酒店名称（可选）" 
                        value={coreConfig.accommodationHotelName || ''} 
                        onChange={(e) => updateData({ coreConfig: { ...coreConfig, accommodationHotelName: e.target.value } })} 
                      />
                    </div>
                  </div>
                </>
              )}

              <Separator />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <span className="text-gray-500 w-12">用餐</span>
                <div className="flex items-center gap-1">
                  <span className="text-gray-600">餐标</span>
                  <NumberInput className="h-8 w-20 text-sm px-2 border rounded" value={coreConfig.mealStandardClient || 0} onChange={(v) => updateData({ coreConfig: { ...coreConfig, mealStandardClient: v } })} />
                  <span className="text-gray-500 whitespace-nowrap">元/人</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 人员及大交通 */}
          <Card className="bg-white rounded-2xl border border-gray-200/50 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
            <CardHeader className="py-3 px-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
              <CardTitle className="text-lg font-semibold text-gray-900">人员及大交通 <span className="text-green-600 font-medium text-base ml-1">共{totalStaff}人</span></CardTitle>
            </CardHeader>
            <CardContent className="py-4 px-5 space-y-3">
              {coreConfig.staffMembers.map((member, index) => (
                <div key={member.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm bg-gray-50/50 rounded-xl p-3 hover:bg-gray-50 transition-colors">
                  <Input 
                    placeholder="角色名称" 
                    className="h-9 w-28 text-sm px-3" 
                    value={member.name} 
                    onChange={(e) => updateStaffMember(member.id, { name: e.target.value })} 
                  />
                  <div className="flex items-center gap-2">
                    <NumberInput className="h-9 w-20 text-sm px-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-400" value={member.count} onChange={(v) => updateStaffMember(member.id, { count: v })} />
                    <span className="text-gray-600">人</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">日薪</span>
                    <NumberInput className="h-9 w-24 text-sm px-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-400" value={member.dailyFee} onChange={(v) => updateStaffMember(member.id, { dailyFee: v })} />
                    <span className="text-gray-600">元</span>
                  </div>
                  {coreConfig.staffMembers.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" onClick={() => removeStaffMember(member.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" className="h-9 text-sm font-medium rounded-lg border-dashed border-2 hover:bg-gray-50 transition-colors" onClick={addStaffMember}>
                <Plus className="w-4 h-4 mr-2" />
                添加角色
              </Button>
              
              {projectData.project.type === 'multi-day' && (
                <>
                  <Separator className="my-3" />
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                      <span className="text-gray-500 w-12">住宿</span>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="radio" name="staffAccommodation" checked={coreConfig.staffAccommodation === true} onChange={() => updateData({ coreConfig: { ...coreConfig, staffAccommodation: true } })} className="w-4 h-4 accent-blue-500" />
                        <span>是</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="radio" name="staffAccommodation" checked={coreConfig.staffAccommodation === false} onChange={() => updateData({ coreConfig: { ...coreConfig, staffAccommodation: false } })} className="w-4 h-4 accent-blue-500" />
                        <span>否</span>
                      </label>
                    </div>
                    {coreConfig.staffAccommodation && (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm pl-16">
                        <div className="flex items-center gap-1">
                          <span className="text-gray-600">床型</span>
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input type="radio" name="staffRoomType" checked={(coreConfig.staffRoomType || 'twin') === 'twin'} onChange={() => updateData({ coreConfig: { ...coreConfig, staffRoomType: 'twin' } })} className="w-4 h-4 accent-blue-500" />
                            <span>双床</span>
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input type="radio" name="staffRoomType" checked={coreConfig.staffRoomType === 'king'} onChange={() => updateData({ coreConfig: { ...coreConfig, staffRoomType: 'king' } })} className="w-4 h-4 accent-blue-500" />
                            <span>大床</span>
                          </label>
                        </div>
                        <div className="flex items-center gap-1">
                          <NumberInput className="h-8 w-20 text-sm px-2 border rounded" value={coreConfig.staffRoomPrice || 0} onChange={(v) => updateData({ coreConfig: { ...coreConfig, staffRoomPrice: v } })} />
                          <span className="text-gray-500 whitespace-nowrap">元/间</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <NumberInput className="h-8 w-16 text-sm px-2 border rounded" value={coreConfig.staffAccommodationNights || 0} onChange={(v) => updateData({ coreConfig: { ...coreConfig, staffAccommodationNights: v } })} />
                          <span className="text-gray-500">晚</span>
                        </div>
                        <span className="text-gray-400 text-sm">({Math.ceil(totalStaff / 2)}间)</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              <Separator className="my-3" />
              <div className="space-y-2">
                <span className="text-sm font-medium text-gray-700">大交通</span>
                
                {/* 大巴 - 默认显示 */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <span className="text-gray-600 w-12">大巴</span>
                  <div className="flex items-center gap-1">
                    <NumberInput className="h-8 w-24 text-sm px-2 border rounded" value={coreConfig.busFee} onChange={(v) => updateData({ coreConfig: { ...coreConfig, busFee: v } })} />
                  </div>
                </div>
                
                {/* 已添加的交通方式 */}
                {(coreConfig.otherTransports || []).map((transport) => (
                  <div key={transport.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm bg-gray-50 rounded-lg p-2">
                    <span className="text-gray-700 w-12">{transport.type === 'flight' ? '飞机' : '高铁'}</span>
                    <div className="flex items-center gap-1">
                      <NumberInput className="h-8 w-20 text-sm px-2 border rounded" value={transport.price} onChange={(v) => updateTransport(transport.id, { price: v })} />
                      <span className="text-gray-500 whitespace-nowrap">元/张</span>
                    </div>
                    <span className="text-gray-400">×</span>
                    <div className="flex items-center gap-1">
                      <NumberInput className="h-8 w-16 text-sm px-2 border rounded" value={transport.count} onChange={(v) => updateTransport(transport.id, { count: v })} />
                      <span className="text-gray-500">张</span>
                    </div>
                    <span className="text-gray-400">=</span>
                    <span className="font-medium">{formatMoney(transport.price * transport.count)}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={() => removeTransport(transport.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                
                {/* 添加按钮 */}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-7 text-sm" onClick={() => addTransport('flight')}>
                    <Plus className="w-4 h-4 mr-1" />添加飞机
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-sm" onClick={() => addTransport('train')}>
                    <Plus className="w-4 h-4 mr-1" />添加高铁
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 每日费用 */}
          <Card className="bg-white/70 backdrop-blur-xl rounded-2xl border border-slate-200/50 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">
            <CardHeader className="py-4 px-6 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white/50">
              <CardTitle className="text-lg font-semibold text-slate-900">
                {projectData.project.type === 'half-day' ? '费用明细' : '每日费用'}
              </CardTitle>
            </CardHeader>
            <CardContent className="py-5 px-6 space-y-5">
              {coreConfig.tripDays === 0 && projectData.project.type === 'multi-day' ? (
                <div className="text-center text-gray-400 text-sm py-4">请先设置行程天数</div>
              ) : (
                dailyExpenses.slice(0, Math.max(1, coreConfig.tripDays)).map((day, dayIdx) => {
                  // 计算住宿费用
                  const dayTwinCount = day.twinRoomCount ?? coreConfig.twinRoom?.countClient ?? 0;
                  const dayTwinPrice = day.twinRoomPrice ?? coreConfig.twinRoom?.price ?? 0;
                  const dayKingCount = day.kingRoomCount ?? coreConfig.kingRoom?.countClient ?? 0;
                  const dayKingPrice = day.kingRoomPrice ?? coreConfig.kingRoom?.price ?? 0;
                  const dayStaffRoomCount = day.staffRoomCount ?? (coreConfig.staffAccommodation ? Math.ceil(totalStaff / 2) : 0);
                  const dayStaffRoomPrice = day.staffRoomPrice ?? coreConfig.staffRoomPrice ?? 0;
                  
                  const calculatedAccommodation = (projectData.project.type === 'multi-day' && dayIdx < coreConfig.accommodationDays)
                    ? dayTwinCount * dayTwinPrice + dayKingCount * dayKingPrice + dayStaffRoomCount * dayStaffRoomPrice
                    : 0;
                  
                  const accommodationValue = day.accommodationAmount || calculatedAccommodation;
                  
                  const calculateMealAmount = (mealConfig: typeof day.lunch) => {
                    if (mealConfig.amount && mealConfig.amount > 0) return mealConfig.amount;
                    const pricePerPerson = mealConfig.pricePerPerson || coreConfig.mealStandardClient || 0;
                    const clientMealType = mealConfig.clientMealType || 'individual';
                    const clientAmount = clientMealType === 'table'
                      ? pricePerPerson * 10 * (mealConfig.tableCount || Math.ceil(totalClients / 10))
                      : pricePerPerson * (mealConfig.clientCount || totalClients);
                    const staffAmount = mealConfig.staffMealType === 'independent'
                      ? (coreConfig.mealStandardStaff || 0) * totalStaff
                      : 0;
                    return clientAmount + staffAmount;
                  };
                  
                  const lunch = day.lunch || { ...DEFAULT_MEAL_CONFIG };
                  const dinner = day.dinner || { ...DEFAULT_MEAL_CONFIG };
                  const lunchAmount = lunch.amount || calculateMealAmount(lunch);
                  const dinnerAmount = dinner.amount || calculateMealAmount(dinner);
                  
                  let dayStaffFee = 0;
                  coreConfig.staffMembers.forEach(member => {
                    const dailyFee = day.staffFees[member.id] ?? member.dailyFee;
                    dayStaffFee += dailyFee * member.count;
                  });
                  (day.staffMembers || []).forEach(member => {
                    dayStaffFee += member.dailyFee * member.count;
                  });
                  
                  const daySingleItems = day.singleItems.reduce((s, i) => s + (i.totalPrice || i.price * i.count), 0);
                  const dayTotal = accommodationValue + lunchAmount + dinnerAmount + dayStaffFee + daySingleItems;
                  
                  const updateMeal = (mealType: 'lunch' | 'dinner', updates: Partial<typeof day.lunch>) => {
                    const newDays = [...dailyExpenses];
                    newDays[dayIdx] = { ...day, [mealType]: { ...day[mealType], ...updates } };
                    updateData({ dailyExpenses: newDays });
                  };
                  
                  return (
                    <div key={day.day} className="border border-gray-200 rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between border-b pb-2">
                        <span className="text-lg font-bold text-gray-900">{projectData.project.type === 'half-day' ? '费用明细' : `第${day.day}天`}</span>
                        <span className="text-lg font-bold text-gray-900">¥{dayTotal.toFixed(0)}</span>
                      </div>
                      
                      <div className="space-y-2">
                        {projectData.project.type === 'multi-day' && (
                          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-700">住宿</span>
                              <span className="text-sm font-medium text-gray-900">¥{accommodationValue.toFixed(0)}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                              <div className="flex items-center gap-1">
                                <span className="text-gray-600">标准</span>
                                <select 
                                  className="h-7 text-sm px-2 border rounded bg-white"
                                  value={day.accommodationType || coreConfig.accommodationType}
                                  onChange={(e) => { 
                                    const newDays = [...dailyExpenses]; 
                                    newDays[dayIdx] = { ...day, accommodationType: e.target.value as any }; 
                                    updateData({ dailyExpenses: newDays }); 
                                  }}
                                >
                                  <option value="3-diamond">3钻</option>
                                  <option value="4-diamond">4钻</option>
                                  <option value="5-diamond">5钻</option>
                                  <option value="camp">营地</option>
                                </select>
                              </div>
                              <div className="flex items-center gap-1 flex-1 min-w-[200px]">
                                <span className="text-gray-600">酒店</span>
                                <Input 
                                  className="h-7 flex-1 text-sm px-2 border rounded" 
                                  placeholder={coreConfig.accommodationHotelName || '酒店名称'} 
                                  value={day.hotelName || ''} 
                                  onChange={(e) => { 
                                    const newDays = [...dailyExpenses]; 
                                    newDays[dayIdx] = { ...day, hotelName: e.target.value }; 
                                    updateData({ dailyExpenses: newDays }); 
                                  }} 
                                />
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                              <div className="flex items-center gap-1">
                                <span className="text-gray-600">双床房</span>
                                <NumberInput className="h-7 w-14 text-sm px-1 border rounded" value={day.twinRoomCount ?? coreConfig.twinRoom?.countClient ?? 0} onChange={(v) => { const newDays = [...dailyExpenses]; newDays[dayIdx] = { ...day, twinRoomCount: v }; updateData({ dailyExpenses: newDays }); }} />
                                <span className="text-gray-500">间</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <NumberInput className="h-7 w-16 text-sm px-1 border rounded" value={day.twinRoomPrice ?? coreConfig.twinRoom?.price ?? 0} onChange={(v) => { const newDays = [...dailyExpenses]; newDays[dayIdx] = { ...day, twinRoomPrice: v }; updateData({ dailyExpenses: newDays }); }} />
                                <span className="text-gray-500">元/间</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-gray-600">大床房</span>
                                <NumberInput className="h-7 w-14 text-sm px-1 border rounded" value={day.kingRoomCount ?? coreConfig.kingRoom?.countClient ?? 0} onChange={(v) => { const newDays = [...dailyExpenses]; newDays[dayIdx] = { ...day, kingRoomCount: v }; updateData({ dailyExpenses: newDays }); }} />
                                <span className="text-gray-500">间</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <NumberInput className="h-7 w-16 text-sm px-1 border rounded" value={day.kingRoomPrice ?? coreConfig.kingRoom?.price ?? 0} onChange={(v) => { const newDays = [...dailyExpenses]; newDays[dayIdx] = { ...day, kingRoomPrice: v }; updateData({ dailyExpenses: newDays }); }} />
                                <span className="text-gray-500">元/间</span>
                              </div>
                            </div>
                            {coreConfig.staffAccommodation && (
                              <div className="flex items-center gap-2 text-sm border-t pt-2">
                                <span className="text-gray-600">工作人员住宿</span>
                                <NumberInput className="h-7 w-14 text-sm px-1 border rounded" value={day.staffRoomCount ?? Math.ceil(totalStaff / 2)} onChange={(v) => { const newDays = [...dailyExpenses]; newDays[dayIdx] = { ...day, staffRoomCount: v }; updateData({ dailyExpenses: newDays }); }} />
                                <span className="text-gray-500">间</span>
                                <NumberInput className="h-7 w-16 text-sm px-1 border rounded" value={day.staffRoomPrice ?? coreConfig.staffRoomPrice ?? 0} onChange={(v) => { const newDays = [...dailyExpenses]; newDays[dayIdx] = { ...day, staffRoomPrice: v }; updateData({ dailyExpenses: newDays }); }} />
                                <span className="text-gray-500">元/间</span>
                                <span className="text-gray-500 ml-2">= ¥{((day.staffRoomCount ?? Math.ceil(totalStaff / 2)) * (day.staffRoomPrice ?? coreConfig.staffRoomPrice ?? 0)).toFixed(0)}</span>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600 font-medium">工作人员薪资</span>
                            <Button variant="outline" size="sm" className="h-7 text-sm px-3" onClick={() => { const newDays = [...dailyExpenses]; const newMember: StaffMember = { id: Date.now().toString(), name: '', count: 1, dailyFee: 0 }; const existingMembers = day.staffMembers || []; newDays[dayIdx] = { ...day, staffMembers: [...existingMembers, newMember] }; updateData({ dailyExpenses: newDays }); }}><Plus className="w-4 h-4 mr-1" />添加</Button>
                          </div>
                          {coreConfig.staffMembers.filter(m => m.count > 0).map(member => {
                            const dailyFee = day.staffFees[member.id] ?? member.dailyFee;
                            return (
                              <div key={member.id} className="flex items-center gap-2 text-sm bg-gray-50 rounded px-3 py-1.5">
                                <span className="text-gray-700 w-20">{member.name}</span>
                                <span className="text-gray-500">{member.count}人</span>
                                <NumberInput className="h-7 w-16 text-sm px-1 border rounded" value={dailyFee} onChange={(v) => { const newDays = [...dailyExpenses]; newDays[dayIdx] = { ...day, staffFees: { ...day.staffFees, [member.id]: v } }; updateData({ dailyExpenses: newDays }); }} />
                                <span className="text-gray-500">元/天 = ¥{(member.count * dailyFee).toFixed(0)}</span>
                              </div>
                            );
                          })}
                          {(day.staffMembers || []).map((member, memberIdx) => (
                            <div key={member.id} className="flex items-center gap-2 text-sm bg-blue-50 rounded px-3 py-1.5">
                              <Input className="h-7 w-20 text-sm px-2 border rounded" placeholder="角色名" value={member.name} onChange={(e) => { const newDays = [...dailyExpenses]; const members = [...(day.staffMembers || [])]; members[memberIdx] = { ...members[memberIdx], name: e.target.value }; newDays[dayIdx] = { ...day, staffMembers: members }; updateData({ dailyExpenses: newDays }); }} />
                              <NumberInput className="h-7 w-14 text-sm px-1 border rounded" value={member.count} onChange={(v) => { const newDays = [...dailyExpenses]; const members = [...(day.staffMembers || [])]; members[memberIdx] = { ...members[memberIdx], count: v }; newDays[dayIdx] = { ...day, staffMembers: members }; updateData({ dailyExpenses: newDays }); }} />
                              <span className="text-gray-500">人</span>
                              <NumberInput className="h-7 w-16 text-sm px-1 border rounded" value={member.dailyFee} onChange={(v) => { const newDays = [...dailyExpenses]; const members = [...(day.staffMembers || [])]; members[memberIdx] = { ...members[memberIdx], dailyFee: v }; newDays[dayIdx] = { ...day, staffMembers: members }; updateData({ dailyExpenses: newDays }); }} />
                              <span className="text-gray-500">元/天 = ¥{(member.count * member.dailyFee).toFixed(0)}</span>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-red-500" onClick={() => { const newDays = [...dailyExpenses]; newDays[dayIdx] = { ...day, staffMembers: (day.staffMembers || []).filter((_, i) => i !== memberIdx) }; updateData({ dailyExpenses: newDays }); }}><Trash2 className="w-3 h-3" /></Button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600 font-medium">活动项目</span>
                          <Button variant="outline" size="sm" className="h-7 text-sm px-3" onClick={() => { const newDays = [...dailyExpenses]; newDays[dayIdx] = { ...day, singleItems: [...day.singleItems, { id: Date.now().toString(), name: '', remark: '', startTime: '', endTime: '', price: 0, count: totalClients, unit: '人' as const, totalPrice: 0 }] }; updateData({ dailyExpenses: newDays }); }}><Plus className="w-4 h-4 mr-1" />添加</Button>
                        </div>
                        {day.singleItems.map((item, itemIdx) => (
                          <div key={item.id} className="bg-gray-50 rounded-lg p-3 space-y-2">
                            <div className="flex items-center gap-3">
                              <Input placeholder="项目名称" className="h-8 flex-1 text-sm px-3" value={item.name} onChange={(e) => { const newDays = [...dailyExpenses]; const items = [...day.singleItems]; items[itemIdx] = { ...items[itemIdx], name: e.target.value }; newDays[dayIdx] = { ...day, singleItems: items }; updateData({ dailyExpenses: newDays }); }} />
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-500" onClick={() => { const newDays = [...dailyExpenses]; newDays[dayIdx] = { ...day, singleItems: day.singleItems.filter((_, i) => i !== itemIdx) }; updateData({ dailyExpenses: newDays }); }}><Trash2 className="w-4 h-4" /></Button>
                            </div>
                            <textarea placeholder="备注说明" className="w-full h-16 text-sm px-3 py-2 border rounded resize-none" value={item.remark || ''} onChange={(e) => { const newDays = [...dailyExpenses]; const items = [...day.singleItems]; items[itemIdx] = { ...items[itemIdx], remark: e.target.value }; newDays[dayIdx] = { ...day, singleItems: items }; updateData({ dailyExpenses: newDays }); }} />
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-gray-500">单价</span>
                              <NumberInput className="h-8 w-24 text-sm px-2 border rounded" value={item.price} onChange={(v) => { const newDays = [...dailyExpenses]; const items = [...day.singleItems]; items[itemIdx] = { ...items[itemIdx], price: v, totalPrice: v * items[itemIdx].count }; newDays[dayIdx] = { ...day, singleItems: items }; updateData({ dailyExpenses: newDays }); }} />
                              <span className="text-gray-500 whitespace-nowrap">元 ×</span>
                              <NumberInput className="h-8 w-16 text-sm px-2 border rounded" value={item.count} onChange={(v) => { const newDays = [...dailyExpenses]; const items = [...day.singleItems]; items[itemIdx] = { ...items[itemIdx], count: v || totalClients, totalPrice: items[itemIdx].price * (v || totalClients) }; newDays[dayIdx] = { ...day, singleItems: items }; updateData({ dailyExpenses: newDays }); }} />
                              <select className="h-8 text-sm px-2 border rounded bg-white" value={item.unit || '人'} onChange={(e) => { const newDays = [...dailyExpenses]; const items = [...day.singleItems]; items[itemIdx] = { ...items[itemIdx], unit: e.target.value as any }; newDays[dayIdx] = { ...day, singleItems: items }; updateData({ dailyExpenses: newDays }); }}>
                                <option value="人">人</option><option value="团">团</option><option value="组">组</option><option value="辆">辆</option><option value="间">间</option>
                              </select>
                              <span className="text-gray-500">=</span>
                              <span className="text-base font-semibold text-gray-900">¥{(item.totalPrice || item.price * item.count).toFixed(0)}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className={`bg-gray-50 rounded-lg p-3 space-y-2 ${lunch.enabled === false ? 'opacity-50' : ''}`}>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-700 font-medium">中餐</span>
                          <button type="button" onClick={() => updateMeal('lunch', { enabled: lunch.enabled !== false ? false : true })} className={`text-xs px-2 py-0.5 rounded ${lunch.enabled === false ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-500'}`}>{lunch.enabled === false ? '启用' : '删除'}</button>
                        </div>
                        {lunch.enabled !== false && (
                          <>
                            <Input placeholder="餐厅名称（可选）" className="h-8 text-sm px-3" value={lunch.restaurantName || ''} onChange={(e) => updateMeal('lunch', { restaurantName: e.target.value })} />
                            <div className="text-sm space-y-1">
                              <div className="flex items-center gap-2 text-gray-500">
                                <span className="w-12 flex-shrink-0">客户</span>
                                <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name={`lunch-client-${day.day}`} checked={lunch.clientMealType === 'individual'} onChange={() => updateMeal('lunch', { clientMealType: 'individual', tableCount: 0, clientCount: lunch.clientCount || totalClients, pricePerPerson: lunch.pricePerPerson || coreConfig.mealStandardClient })} className="w-4 h-4" /><span>例餐</span></label>
                                <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name={`lunch-client-${day.day}`} checked={(lunch.clientMealType || 'table') === 'table'} onChange={() => updateMeal('lunch', { clientMealType: 'table', tableCount: lunch.tableCount || Math.ceil(totalClients / 10), clientCount: 0, pricePerPerson: lunch.pricePerPerson || coreConfig.mealStandardClient })} className="w-4 h-4" /><span>桌餐</span></label>
                              </div>
                              <div className="flex items-center gap-1 pl-12 flex-wrap">
                                <NumberInput className="h-8 w-16 text-sm px-2 border rounded" value={(lunch.clientMealType || 'table') === 'table' ? (lunch.pricePerPerson || coreConfig.mealStandardClient || 0) * 10 : (lunch.pricePerPerson || coreConfig.mealStandardClient || 0)} onChange={(v) => updateMeal('lunch', { pricePerPerson: (lunch.clientMealType || 'table') === 'table' ? v / 10 : v })} />
                                <span className="text-gray-500">{(lunch.clientMealType || 'table') === 'table' ? '元/桌' : '元/人'}</span>
                                <span className="text-gray-400">×</span>
                                {lunch.clientMealType === 'individual' ? (<><NumberInput className="h-8 w-14 text-sm px-2 border rounded" value={lunch.clientCount || totalClients} onChange={(v) => updateMeal('lunch', { clientCount: v })} /><span className="text-gray-500">人</span></>) : (<><NumberInput className="h-8 w-14 text-sm px-2 border rounded" value={lunch.tableCount || Math.ceil(totalClients / 10)} onChange={(v) => updateMeal('lunch', { tableCount: v })} /><span className="text-gray-500">桌</span></>)}
                                <span className="text-gray-400">=</span>
                                <NumberInput className="h-8 w-20 text-sm px-2 border rounded text-right" value={lunchAmount} onChange={(v) => updateMeal('lunch', { amount: v })} />
                                <span className="text-gray-500">元</span>
                              </div>
                            </div>
                            <div className="text-sm space-y-1">
                              <div className="flex items-center gap-2 text-gray-500">
                                <span className="w-12 flex-shrink-0 whitespace-nowrap">工作人员</span>
                                <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name={`lunch-staff-${day.day}`} checked={(lunch.staffMealType || 'with-group') === 'with-group'} onChange={() => updateMeal('lunch', { staffMealType: 'with-group' })} className="w-4 h-4" /><span>随团</span></label>
                                <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name={`lunch-staff-${day.day}`} checked={lunch.staffMealType === 'independent'} onChange={() => updateMeal('lunch', { staffMealType: 'independent' })} className="w-4 h-4" /><span>独立</span></label>
                              </div>
                              {lunch.staffMealType === 'independent' && (<div className="flex items-center gap-1 pl-12"><NumberInput className="h-8 w-16 text-sm px-2 border rounded" value={coreConfig.mealStandardStaff || 0} onChange={(v) => updateData({ coreConfig: { ...coreConfig, mealStandardStaff: v } })} /><span className="text-gray-500">元/人</span></div>)}
                            </div>
                          </>
                        )}
                      </div>

                      <div className={`bg-gray-50 rounded-lg p-3 space-y-2 ${dinner.enabled === false ? 'opacity-50' : ''}`}>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-700 font-medium">晚餐</span>
                          <button type="button" onClick={() => updateMeal('dinner', { enabled: dinner.enabled !== false ? false : true })} className={`text-xs px-2 py-0.5 rounded ${dinner.enabled === false ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-500'}`}>{dinner.enabled === false ? '启用' : '删除'}</button>
                        </div>
                        {dinner.enabled !== false && (
                          <>
                            <Input placeholder="餐厅名称（可选）" className="h-8 text-sm px-3" value={dinner.restaurantName || ''} onChange={(e) => updateMeal('dinner', { restaurantName: e.target.value })} />
                            <div className="text-sm space-y-1">
                              <div className="flex items-center gap-2 text-gray-500">
                                <span className="w-12 flex-shrink-0">客户</span>
                                <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name={`dinner-client-${day.day}`} checked={dinner.clientMealType === 'individual'} onChange={() => updateMeal('dinner', { clientMealType: 'individual', tableCount: 0, clientCount: dinner.clientCount || totalClients, pricePerPerson: dinner.pricePerPerson || coreConfig.mealStandardClient })} className="w-4 h-4" /><span>例餐</span></label>
                                <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name={`dinner-client-${day.day}`} checked={(dinner.clientMealType || 'table') === 'table'} onChange={() => updateMeal('dinner', { clientMealType: 'table', tableCount: dinner.tableCount || Math.ceil(totalClients / 10), clientCount: 0, pricePerPerson: dinner.pricePerPerson || coreConfig.mealStandardClient })} className="w-4 h-4" /><span>桌餐</span></label>
                              </div>
                              <div className="flex items-center gap-1 pl-12 flex-wrap">
                                <NumberInput className="h-8 w-16 text-sm px-2 border rounded" value={(dinner.clientMealType || 'table') === 'table' ? (dinner.pricePerPerson || coreConfig.mealStandardClient || 0) * 10 : (dinner.pricePerPerson || coreConfig.mealStandardClient || 0)} onChange={(v) => updateMeal('dinner', { pricePerPerson: (dinner.clientMealType || 'table') === 'table' ? v / 10 : v })} />
                                <span className="text-gray-500">{(dinner.clientMealType || 'table') === 'table' ? '元/桌' : '元/人'}</span>
                                <span className="text-gray-400">×</span>
                                {dinner.clientMealType === 'individual' ? (<><NumberInput className="h-8 w-14 text-sm px-2 border rounded" value={dinner.clientCount || totalClients} onChange={(v) => updateMeal('dinner', { clientCount: v })} /><span className="text-gray-500">人</span></>) : (<><NumberInput className="h-8 w-14 text-sm px-2 border rounded" value={dinner.tableCount || Math.ceil(totalClients / 10)} onChange={(v) => updateMeal('dinner', { tableCount: v })} /><span className="text-gray-500">桌</span></>)}
                                <span className="text-gray-400">=</span>
                                <NumberInput className="h-8 w-20 text-sm px-2 border rounded text-right" value={dinnerAmount} onChange={(v) => updateMeal('dinner', { amount: v })} />
                                <span className="text-gray-500">元</span>
                              </div>
                            </div>
                            <div className="text-sm space-y-1">
                              <div className="flex items-center gap-2 text-gray-500">
                                <span className="w-12 flex-shrink-0 whitespace-nowrap">工作人员</span>
                                <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name={`dinner-staff-${day.day}`} checked={(dinner.staffMealType || 'with-group') === 'with-group'} onChange={() => updateMeal('dinner', { staffMealType: 'with-group' })} className="w-4 h-4" /><span>随团</span></label>
                                <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name={`dinner-staff-${day.day}`} checked={dinner.staffMealType === 'independent'} onChange={() => updateMeal('dinner', { staffMealType: 'independent' })} className="w-4 h-4" /><span>独立</span></label>
                              </div>
                              {dinner.staffMealType === 'independent' && (<div className="flex items-center gap-1 pl-12"><NumberInput className="h-8 w-16 text-sm px-2 border rounded" value={coreConfig.mealStandardStaff || 0} onChange={(v) => updateData({ coreConfig: { ...coreConfig, mealStandardStaff: v } })} /><span className="text-gray-500">元/人</span></div>)}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-xl rounded-2xl border border-slate-200/50 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">
            <CardHeader className="py-4 px-6 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white/50">
              <CardTitle className="text-lg font-semibold text-slate-900">其他费用</CardTitle>
            </CardHeader>
            <CardContent className="py-5 px-6 space-y-5">
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <span className="text-sm font-medium text-gray-700">保险费</span>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <div className="flex items-center gap-1"><NumberInput className="h-8 w-20 text-sm px-2 border rounded" value={otherExpenses.insurance.pricePerPerson} onChange={(v) => updateInsurance({ pricePerPerson: v })} /><span className="text-gray-500 whitespace-nowrap">元/人/天</span></div>
                  <div className="flex items-center gap-1"><span className="text-gray-400">×</span><NumberInput className="h-8 w-16 text-sm px-2 border rounded" value={otherExpenses.insurance.days} onChange={(v) => updateInsurance({ days: v })} /><span className="text-gray-500">天</span></div>
                  <div className="flex items-center gap-1"><span className="text-gray-400">×</span><span className="text-gray-500">{totalClients + totalStaff}人</span><span className="text-gray-400 text-xs">(客户{totalClients}+工作人员{totalStaff})</span></div>
                  <div className="flex items-center gap-1"><span className="text-gray-400">=</span><NumberInput className="h-8 w-24 text-sm px-2 border rounded" value={otherExpenses.insurance.totalAmount} onChange={(v) => updateData({ otherExpenses: { ...otherExpenses, insurance: { ...otherExpenses.insurance, totalAmount: v } } })} /><span className="text-gray-500">元</span></div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">服务费</span>
                  <div className="flex bg-white border rounded overflow-hidden text-xs">
                    <button className={`px-2 py-1 ${(otherExpenses.serviceFeeMode ?? 'percent') === 'percent' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`} onClick={() => updateData({ otherExpenses: { ...otherExpenses, serviceFeeMode: 'percent' } })}>按团</button>
                    <button className={`px-2 py-1 ${otherExpenses.serviceFeeMode === 'per-person' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`} onClick={() => updateData({ otherExpenses: { ...otherExpenses, serviceFeeMode: 'per-person' } })}>按人按天</button>
                  </div>
                </div>
                {(otherExpenses.serviceFeeMode ?? 'percent') === 'percent' ? (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                    <div className="flex items-center gap-1"><span className="text-gray-600">基数</span><NumberInput className="h-8 w-28 text-sm px-2 border rounded" value={otherExpenses.serviceFeeBase || qSubtotal_m} onChange={(v) => updateData({ otherExpenses: { ...otherExpenses, serviceFeeBase: v } })} /></div>
                    <div className="flex items-center gap-1"><span className="text-gray-600">x</span><NumberInput className="h-8 w-16 text-sm px-2 border rounded" value={otherExpenses.serviceFeePercent} onChange={(v) => updateData({ otherExpenses: { ...otherExpenses, serviceFeePercent: v } })} /><span className="text-gray-500">%</span></div>
                    <div className="flex items-center gap-1"><span className="text-gray-400">=</span><span className="text-base font-semibold text-gray-900">{formatMoney(serviceFeeAmount)}</span></div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                    <div className="flex items-center gap-1"><span className="text-gray-600">人均</span><NumberInput className="h-8 w-20 text-sm px-2 border rounded" value={otherExpenses.serviceFeePerPerson || 0} onChange={(v) => updateData({ otherExpenses: { ...otherExpenses, serviceFeePerPerson: v } })} /><span className="text-gray-500">元</span></div>
                    <div className="flex items-center gap-1"><span className="text-gray-600">x</span><NumberInput className="h-8 w-12 text-sm px-2 border rounded" value={otherExpenses.serviceFeeDays || 1} onChange={(v) => updateData({ otherExpenses: { ...otherExpenses, serviceFeeDays: v } })} /><span className="text-gray-500">天</span></div>
                    <div className="flex items-center gap-1"><span className="text-gray-600">x</span><NumberInput className="h-8 w-14 text-sm px-2 border rounded" value={otherExpenses.serviceFeePeople || totalClients} onChange={(v) => updateData({ otherExpenses: { ...otherExpenses, serviceFeePeople: v } })} /><span className="text-gray-500">人</span></div>
                    <div className="flex items-center gap-1"><span className="text-gray-400">=</span><span className="text-base font-semibold text-gray-900">{formatMoney(serviceFeeAmount)}</span></div>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <span className="text-sm font-medium text-gray-700">税费</span>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <div className="flex items-center gap-1"><span className="text-gray-600">按合计</span><NumberInput className="h-8 w-16 text-sm px-2 border rounded" value={otherExpenses.taxPercent ?? 1} onChange={(v) => updateData({ otherExpenses: { ...otherExpenses, taxPercent: v } })} /><span className="text-gray-500">%</span></div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 whitespace-nowrap">税基数</span>
                    <span className="bg-blue-100 px-3 py-1 rounded font-mono font-bold text-blue-800">{formatMoney(qSubtotal_m)}</span>
                  </div>
                  <div className="flex items-center gap-1"><span className="text-gray-400">=</span><span className="text-base font-semibold text-gray-900">{formatMoney(tax)}</span></div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <span className="text-sm font-medium text-gray-700">备用金</span>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <div className="flex items-center gap-1"><NumberInput className="h-8 w-24 text-sm px-2 border rounded" value={otherExpenses.reserveFund} onChange={(v) => updateData({ otherExpenses: { ...otherExpenses, reserveFund: v } })} /><span className="text-gray-500">元</span></div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <span className="text-sm font-medium text-gray-700">优惠</span>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <div className="flex items-center gap-1"><NumberInput className="h-8 w-24 text-sm px-2 border rounded" value={otherExpenses.discount || 0} onChange={(v) => updateData({ otherExpenses: { ...otherExpenses, discount: v } })} /><span className="text-gray-500">元</span></div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-700">杂费（客户）</span><Button variant="outline" size="sm" className="h-7 text-sm" onClick={addMaterial}><Plus className="w-4 h-4 mr-1" />添加</Button></div>
                {otherExpenses.materials.map((material) => (
                  <div key={material.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                    <Input placeholder="项目名称" className="h-8 w-32 text-sm px-2" value={material.name} onChange={(e) => updateMaterial(material.id, { name: e.target.value })} />
                    <div className="flex items-center gap-1"><NumberInput className="h-8 w-20 text-sm px-2 border rounded" value={material.price} onChange={(v) => updateMaterial(material.id, { price: v })} /><span className="text-gray-500">元 ×</span></div>
                    <div className="flex items-center gap-1"><NumberInput className="h-8 w-16 text-sm px-2 border rounded" value={material.quantity} onChange={(v) => updateMaterial(material.id, { quantity: v })} /><span className="text-gray-500">=</span></div>
                    <span className="text-sm font-medium">{formatMoney(material.totalPrice || material.price * material.quantity)}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={() => removeMaterial(material.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                ))}
              </div>

              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-700">杂费（工作人员）</span><Button variant="outline" size="sm" className="h-7 text-sm" onClick={addOtherExpense}><Plus className="w-4 h-4 mr-1" />添加</Button></div>
                {otherExpenses.otherExpenses.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                    <Input placeholder="项目名称" className="h-8 w-32 text-sm px-2" value={item.name} onChange={(e) => updateOtherExpense(item.id, { name: e.target.value })} />
                    <div className="flex items-center gap-1"><NumberInput className="h-8 w-20 text-sm px-2 border rounded" value={item.price} onChange={(v) => updateOtherExpense(item.id, { price: v })} /><span className="text-gray-500">元 ×</span></div>
                    <div className="flex items-center gap-1"><NumberInput className="h-8 w-16 text-sm px-2 border rounded" value={item.quantity} onChange={(v) => updateOtherExpense(item.id, { quantity: v })} /><span className="text-gray-500">=</span></div>
                    <span className="text-sm font-medium">{formatMoney(item.totalPrice || item.price * item.quantity)}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={() => removeOtherExpense(item.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="w-full lg:w-auto flex-shrink-0 lg:sticky lg:top-14 lg:self-start">
          <div className="flex flex-col lg:flex-row gap-4">
            <div ref={costProfitCardRef} className="w-full lg:w-[380px]">
            <Card className="bg-white/70 backdrop-blur-xl rounded-2xl border border-slate-200/50 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">
              <CardHeader className="py-4 px-6 border-b border-slate-100 bg-gradient-to-r from-blue-50/80 to-white/50">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold text-blue-900">成本核算</CardTitle>
                    <p className="text-sm text-slate-500 mt-1">内部参考</p>
                  </div>
                  <div className="relative export-button-container">
                    <Button variant="ghost" size="sm" className="h-9 w-9 rounded-xl text-slate-600 hover:text-slate-700 hover:bg-slate-100 transition-all duration-200" onClick={() => setShowCostExportMenu(!showCostExportMenu)}>
                      <Download className="w-5 h-5" />
                    </Button>
                    {showCostExportMenu && (
                      <div className="absolute right-0 top-11 z-50 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-xl shadow-xl py-2 min-w-[120px]">
                        <button className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-all duration-200" onClick={() => handleExportCostCard('image')}>
                          <Image className="w-4 h-4 text-blue-600" />图片
                        </button>
                        <button className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-all duration-200" onClick={() => handleExportCostCard('pdf')}>
                          <FileText className="w-4 h-4 text-purple-600" />PDF
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
            <CardContent className="py-5 px-6">
              <div className="space-y-0 text-sm">
                {projectData.project.type === 'multi-day' && summary.totalAccommodation > 0 && (
                  <>
                    <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-600 font-medium">住宿费</span><span className="font-medium">{formatMoney(summary.totalAccommodation)}</span></div>
                    <div className="pl-2 text-xs text-gray-500 space-y-1 py-1 border-b border-gray-50">
                      {dailyExpenses.slice(0, coreConfig.accommodationDays).map((day, idx) => {
                        const dayTwinCount = day.twinRoomCount ?? coreConfig.twinRoom?.countClient ?? 0;
                        const dayTwinPrice = day.twinRoomPrice ?? coreConfig.twinRoom?.price ?? 0;
                        const dayKingCount = day.kingRoomCount ?? coreConfig.kingRoom?.countClient ?? 0;
                        const dayKingPrice = day.kingRoomPrice ?? coreConfig.kingRoom?.price ?? 0;
                        const dayStaffRoomCount = day.staffRoomCount ?? (coreConfig.staffAccommodation ? Math.ceil(totalStaff / 2) : 0);
                        const dayStaffRoomPrice = day.staffRoomPrice ?? coreConfig.staffRoomPrice ?? 0;
                        const dayAccommodation = day.accommodationAmount || (dayTwinCount * dayTwinPrice + dayKingCount * dayKingPrice + dayStaffRoomCount * dayStaffRoomPrice);
                        if (dayAccommodation <= 0) return null;
                        return (
                          <div key={day.day} className="py-1">
                            <div className="flex justify-between font-medium text-gray-700"><span>D{day.day} {ACCOMMODATION_TYPE_LABELS[day.accommodationType || coreConfig.accommodationType]}</span><span>{formatMoney(dayAccommodation)}</span></div>
                            <div className="text-gray-500 pl-2">{dayTwinCount > 0 && <span>双床{dayTwinCount}×{dayTwinPrice} </span>}{dayKingCount > 0 && <span>大床{dayKingCount}×{dayKingPrice} </span>}{dayStaffRoomCount > 0 && <span>工作人员{dayStaffRoomCount}×{dayStaffRoomPrice}</span>}</div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
                
                {summary.totalMeal > 0 && (
                  <>
                    <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-600 font-medium">用餐费</span><span className="font-medium">{formatMoney(summary.totalMeal)}</span></div>
                    <div className="pl-2 text-xs text-gray-500 space-y-1 py-1 border-b border-gray-50">
                      {dailyExpenses.map((day, idx) => {
                        const lunch = day.lunch || DEFAULT_MEAL_CONFIG; const dinner = day.dinner || DEFAULT_MEAL_CONFIG;
                        const calculateMeal = (meal: typeof lunch) => { if (meal.enabled === false) return 0; if (meal.amount && meal.amount > 0) return meal.amount; const price = meal.pricePerPerson || coreConfig.mealStandardClient || 0; return (meal.clientMealType || 'table') === 'table' ? price * 10 * (meal.tableCount || Math.ceil(totalClients / 10)) : price * (meal.clientCount || totalClients); };
                        const lunchAmount = calculateMeal(lunch); const dinnerAmount = calculateMeal(dinner);
                        if (lunchAmount === 0 && dinnerAmount === 0) return null;
                        return (
                          <div key={idx} className="space-y-0.5">
                            {lunchAmount > 0 && (<div className="flex justify-between"><span>D{day.day}中餐 {lunchAmount}元</span><span>{formatMoney(lunchAmount)}</span></div>)}
                            {dinnerAmount > 0 && (<div className="flex justify-between"><span>D{day.day}晚餐 {dinnerAmount}元</span><span>{formatMoney(dinnerAmount)}</span></div>)}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
                
                {summary.totalBus > 0 && (
                  <>
                    <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-600 font-medium">交通费</span><span className="font-medium">{formatMoney(summary.totalBus)}</span></div>
                    <div className="pl-2 text-xs text-gray-500 space-y-0.5 py-1 border-b border-gray-50">
                      {coreConfig.busFee > 0 && (<div className="flex justify-between"><span>大巴</span><span>{formatMoney(coreConfig.busFee)}</span></div>)}
                      {(coreConfig.otherTransports || []).map((t) => (<div key={t.id} className="flex justify-between"><span>{t.type === 'flight' ? '飞机' : '高铁'} {t.count}张×{t.price}元</span><span>{formatMoney(t.price * t.count)}</span></div>))}
                    </div>
                  </>
                )}

                {summary.totalStaffFee > 0 && (
                  <>
                    <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-600 font-medium">工作人员</span><span className="font-medium">{formatMoney(summary.totalStaffFee)}</span></div>
                    <div className="pl-2 text-xs text-gray-500 space-y-1 py-1 border-b border-gray-50">
                      {dailyExpenses.map((day) => {
                        let dayTotal = 0;
                        coreConfig.staffMembers.forEach(m => dayTotal += (day.staffFees[m.id] ?? m.dailyFee) * m.count);
                        (day.staffMembers || []).forEach(m => dayTotal += m.dailyFee * m.count);
                        if (dayTotal === 0) return null;
                        return (<div key={day.day} className="flex justify-between"><span>D{day.day}</span><span>{formatMoney(dayTotal)}</span></div>);
                      })}
                    </div>
                  </>
                )}
                
                {summary.totalSingleItems > 0 && (
                  <>
                    <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-600 font-medium">活动项目</span><span className="font-medium">{formatMoney(summary.totalSingleItems)}</span></div>
                    <div className="pl-2 text-xs text-gray-500 space-y-0.5 py-1 border-b border-gray-50">
                      {dailyExpenses.map((day) => day.singleItems.filter(i => i.name && (i.totalPrice || i.price * i.count) > 0).map((i, idx) => (<div key={`${day.day}-${idx}`} className="flex justify-between"><span>D{day.day} {i.name}</span><span>{formatMoney(i.totalPrice || i.price * i.count)}</span></div>)))}
                    </div>
                  </>
                )}
                
                {summary.totalOtherExpenses > 0 && (
                  <>
                    <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-600 font-medium">其他费用</span><span className="font-medium">{formatMoney(summary.totalOtherExpenses)}</span></div>
                    <div className="pl-2 text-xs text-gray-500 space-y-0.5 py-1 border-b border-gray-50">
                      {otherExpenses.insurance.totalAmount > 0 && (<div className="flex justify-between"><span>保险费</span><span>{formatMoney(otherExpenses.insurance.totalAmount)}</span></div>)}
                      {otherExpenses.reserveFund > 0 && (<div className="flex justify-between"><span>备用金</span><span>{formatMoney(otherExpenses.reserveFund)}</span></div>)}
                      {otherExpenses.materials.map((m, idx) => (<div key={idx} className="flex justify-between"><span>杂费(客)-{m.name}</span><span>{formatMoney(m.totalPrice || m.price * m.quantity)}</span></div>))}
                      {otherExpenses.otherExpenses.map((o, idx) => (<div key={idx} className="flex justify-between"><span>杂费(工)-{o.name || '其他'}</span><span>{formatMoney(o.totalPrice || o.price * o.quantity)}</span></div>))}
                    </div>
                  </>
                )}
                
                <div className="flex justify-between py-2.5 bg-gray-50 rounded mt-2 px-3"><span className="font-semibold text-gray-800">总成本</span><span className="font-bold text-gray-900 text-xl">{formatMoney(summary.totalCost)}</span></div>
                
                <div className="mt-2 pt-2 border-t border-gray-100 space-y-1 text-sm">
                  <div className="flex justify-between py-1 text-gray-600"><span>服务费</span><span>{formatMoney(serviceFeeAmount)}</span></div>
                  <div className="flex justify-between py-1 text-gray-600"><span>税费（{otherExpenses.taxPercent ?? 1}%）</span><span>{formatMoney(tax)}</span></div>
                  <div className="flex justify-between py-2 bg-blue-50 rounded px-2"><span className="font-semibold text-gray-800">成本合计</span><span className="font-bold text-blue-700">{formatMoney(summary.totalCost + tax)}</span></div>
                </div>
                
                <div className="mt-4 pt-3 border-t-2 border-blue-200">
                  <div className="text-sm font-semibold text-blue-700 mb-2">利润分析</div>
                  {(() => {
                    const revenue = finalPrice; const pricingPeople = coreConfig.pricingCount ?? totalClients; const pricePerPerson = pricingPeople > 0 ? revenue / pricingPeople : 0;
                    const costWithTax = summary.totalCost + tax; const profit = revenue - costWithTax; const profitRate = revenue > 0 ? (profit / revenue * 100) : 0;
                    return (
                      <>
                        <div className="flex justify-between py-1.5 border-b border-gray-100"><span className="text-gray-600">营收 (实收)</span><span className="font-medium text-gray-800">{formatMoney(revenue)}</span></div>
                        <div className="pl-2 text-xs text-gray-500 space-y-0.5 py-1 border-b border-gray-50">
                          <div className="flex justify-between"><span>报价合计 {formatMoney(totalPrice)}{discountAmount > 0 ? ` - 优惠 ${formatMoney(discountAmount)}` : ''}</span><span>{formatMoney(revenue)}</span></div>
                          <div className="flex justify-between"><span>{pricingPeople}人 × {formatMoney(pricePerPerson)}/人</span><span></span></div>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-gray-100"><span className="text-gray-600">成本 (含税)</span><span className="font-medium text-gray-800">{formatMoney(costWithTax)}</span></div>
                        <div className="flex justify-between py-2 bg-blue-50 rounded mt-1 px-2"><span className="font-semibold text-blue-800">利润</span><span className={`font-bold text-lg ${profit >= 0 ? 'text-red-600' : 'text-green-600'}`}>{profit >= 0 ? '+' : ''}{formatMoney(profit)}</span></div>
                        <div className="flex justify-between py-1.5 border-b border-gray-100"><span className="text-gray-600">利润率</span><span className={`font-medium ${profitRate >= 0 ? 'text-red-600' : 'text-green-600'}`}>{profitRate.toFixed(1)}%</span></div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>
          </div>

          <div ref={quoteCardRef} className="w-full lg:w-[380px]">
          <Card className="bg-white/70 backdrop-blur-xl rounded-2xl border border-slate-200/50 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
            <CardHeader className="py-5 px-6 border-b border-slate-100 bg-gradient-to-r from-amber-50/80 to-orange-50/80">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-semibold text-amber-900">{projectData.project.name}</CardTitle>
                  <p className="text-sm text-amber-700 font-semibold mt-1">报价单</p>
                </div>
                <div className="flex items-center gap-2 export-button-container">
                  {isQuoteEditing ? (
                    <>
                      <Button variant="outline" size="sm" className="h-9 text-sm font-medium rounded-xl border-slate-300 hover:bg-slate-50 transition-all duration-200" onClick={() => { if (quoteEditSnapshot) { updateData({ coreConfig: quoteEditSnapshot.coreConfig, dailyExpenses: quoteEditSnapshot.dailyExpenses, otherExpenses: quoteEditSnapshot.otherExpenses }); } setQuoteEditSnapshot(null); setIsQuoteEditing(false); }}>
                        取消
                      </Button>
                      <Button size="sm" className="h-9 text-sm font-medium bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-xl hover:from-slate-700 hover:to-slate-800 transition-all duration-200" onClick={() => { setQuoteEditSnapshot(null); setIsQuoteEditing(false); handleSave(); }}>
                        <Check className="w-4 h-4 mr-1" />
                        保存
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" size="sm" className="h-9 text-sm font-medium rounded-xl border-2 border-slate-300 hover:bg-slate-50 transition-all duration-200" onClick={() => { setQuoteEditSnapshot({ coreConfig: JSON.parse(JSON.stringify(coreConfig)), dailyExpenses: JSON.parse(JSON.stringify(dailyExpenses)), otherExpenses: JSON.parse(JSON.stringify(otherExpenses)) }); setIsQuoteEditing(true); }}>
                      <Pencil className="w-4 h-4 mr-1" />
                      编辑
                    </Button>
                  )}
                  <div className="relative">
                    <Button variant="ghost" size="sm" className="h-9 w-9 rounded-xl text-slate-600 hover:text-slate-700 hover:bg-slate-100 transition-all duration-200" onClick={() => setShowQuoteExportMenu(!showQuoteExportMenu)}>
                      <Download className="w-5 h-5" />
                    </Button>
                    {showQuoteExportMenu && (
                      <div className="absolute right-0 top-11 z-50 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-xl shadow-xl py-3 min-w-[130px]">
                        <button className="w-full px-5 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-all duration-200" onClick={() => handleExportQuoteCard('image')}>
                          <Image className="w-5 h-5 text-blue-600" />
                          图片
                        </button>
                        <button className="w-full px-5 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-all duration-200" onClick={() => handleExportQuoteCard('pdf')}>
                          <FileText className="w-5 h-5 text-purple-600" />
                          PDF
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="py-6 px-6">
              <div className="space-y-0 text-sm">
                {/* 客户信息展示 */}
                {(projectData.project.clientName || projectData.project.travelDateStart || projectData.project.travelDateEnd || projectData.project.quoteDate || projectData.project.quoteCompany) && (
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-5 mb-5 border border-amber-100/50 shadow-sm">
                    <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span className="w-1 h-4 bg-amber-500 rounded-full"></span>
                      项目信息
                    </div>
                    <div className="space-y-3">
                      {projectData.project.clientName && (
                        <div className="flex justify-between items-center py-1.5 border-b border-amber-100/50">
                          <span className="text-gray-600 text-sm">客户名称</span>
                          <span className="text-gray-900 font-semibold">{projectData.project.clientName}</span>
                        </div>
                      )}
                      {(projectData.project.travelDateStart || projectData.project.travelDateEnd) && (
                        <div className="flex justify-between items-center py-1.5 border-b border-amber-100/50">
                          <span className="text-gray-600 text-sm">出行日期</span>
                          <span className="text-gray-900 font-semibold">
                            {(() => {
                              const start = projectData.project.travelDateStart;
                              const end = projectData.project.travelDateEnd;
                              if (start && end) {
                                return `${start} 至 ${end}`;
                              } else if (start) {
                                return start;
                              } else if (end) {
                                return end;
                              }
                              return '';
                            })()}
                          </span>
                        </div>
                      )}
                      {projectData.project.quoteDate && (
                        <div className="flex justify-between items-center py-1.5 border-b border-amber-100/50">
                          <span className="text-gray-600 text-sm">报价日期</span>
                          <span className="text-gray-900 font-semibold">{projectData.project.quoteDate}</span>
                        </div>
                      )}
                      {projectData.project.quoteCompany && (
                        <div className="flex justify-between items-center py-1.5">
                          <span className="text-gray-600 text-sm">报价单位</span>
                          <span className="text-gray-900 font-semibold">{projectData.project.quoteCompany}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {/* 报价单细项明细 */}
                {stats.quoteAcc_m > 0 && (
                  <>
                    <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-600 font-medium">住宿费</span><span className="font-medium">{formatMoney(stats.quoteAcc_m)}</span></div>
                    <div className="pl-2 text-xs text-gray-500 space-y-1 py-1 border-b border-gray-50">
                      {dailyExpenses.slice(0, coreConfig.accommodationDays).map((day: any, idx: number) => {
                        const dayTwinCount = day.twinRoomCount ?? coreConfig.twinRoom?.countClient ?? 0;
                        const dayTwinPrice = day.twinRoomPrice ?? coreConfig.twinRoom?.price ?? 0;
                        const dayKingCount = day.kingRoomCount ?? coreConfig.kingRoom?.countClient ?? 0;
                        const dayKingPrice = day.kingRoomPrice ?? coreConfig.kingRoom?.price ?? 0;
                        const qTwinCount = day.quoteTwinRoomCount ?? dayTwinCount;
                        const qTwinPrice = day.quoteTwinRoomPrice ?? dayTwinPrice;
                        const qKingCount = day.quoteKingRoomCount ?? dayKingCount;
                        const qKingPrice = day.quoteKingRoomPrice ?? dayKingPrice;
                        const dayAcc = day.quoteAccommodationAmount ?? (qTwinCount * qTwinPrice + qKingCount * qKingPrice);
                        if (dayAcc <= 0) return null;
                        return (
                          <div key={day.day} className="py-1">
                            <div className="flex justify-between font-medium text-gray-700"><span>D{day.day} {ACCOMMODATION_TYPE_LABELS[(day.accommodationType || coreConfig.accommodationType) as AccommodationType]}</span><span>{formatMoney(dayAcc)}</span></div>
                            <div className="text-gray-500 pl-2">
                              {isQuoteEditing ? (
                                <div className="flex flex-wrap gap-2 mt-1">
                                  <div className="flex items-center gap-1"><span>双床</span><NumberInput className="h-6 w-12 text-xs border rounded" value={qTwinCount} onChange={(v) => { const newDays = [...dailyExpenses]; newDays[idx] = { ...day, quoteTwinRoomCount: v }; updateData({ dailyExpenses: newDays }); }} /><span>x</span><NumberInput className="h-6 w-16 text-xs border rounded" value={qTwinPrice} onChange={(v) => { const newDays = [...dailyExpenses]; newDays[idx] = { ...day, quoteTwinRoomPrice: v }; updateData({ dailyExpenses: newDays }); }} /></div>
                                  <div className="flex items-center gap-1"><span>大床</span><NumberInput className="h-6 w-12 text-xs border rounded" value={qKingCount} onChange={(v) => { const newDays = [...dailyExpenses]; newDays[idx] = { ...day, quoteKingRoomCount: v }; updateData({ dailyExpenses: newDays }); }} /><span>x</span><NumberInput className="h-6 w-16 text-xs border rounded" value={qKingPrice} onChange={(v) => { const newDays = [...dailyExpenses]; newDays[idx] = { ...day, quoteKingRoomPrice: v }; updateData({ dailyExpenses: newDays }); }} /></div>
                                </div>
                              ) : (
                                <>
                                  {qTwinCount > 0 && <span>双床{qTwinCount}×{qTwinPrice} </span>}
                                  {qKingCount > 0 && <span>大床{qKingCount}×{qKingPrice} </span>}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {stats.quoteMeal_m > 0 && (
                  <>
                    <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-600 font-medium">用餐费</span><span className="font-medium">{formatMoney(stats.quoteMeal_m)}</span></div>
                    <div className="pl-2 text-xs text-gray-500 space-y-1 py-1 border-b border-gray-50">
                      {dailyExpenses.map((day: any, idx: number) => {
                        const lunch = day.lunch || DEFAULT_MEAL_CONFIG;
                        const dinner = day.dinner || DEFAULT_MEAL_CONFIG;
                        const calculateMealAmountFn = (meal: any) => {
                          if (!meal || meal.enabled === false) return 0;
                          if (meal.amount && meal.amount > 0) return meal.amount;
                          const price = meal.pricePerPerson || coreConfig.mealStandardClient || 0;
                          return (meal.clientMealType || 'table') === 'table' ? price * 10 * (meal.tableCount || Math.ceil(totalClients / 10)) : price * (meal.clientCount || totalClients);
                        };
                        const qLunch = lunch.quoteAmount ?? calculateMealAmountFn(lunch);
                        const qDinner = dinner.quoteAmount ?? calculateMealAmountFn(dinner);
                        if (qLunch === 0 && qDinner === 0) return null;
                        return (
                          <div key={idx} className="space-y-1">
                            {qLunch > 0 && (
                              <div className="flex justify-between items-center">
                                <span>D{day.day}中餐</span>
                                <div className="flex items-center gap-2">
                                  {isQuoteEditing && <NumberInput className="h-6 w-20 text-xs border rounded" value={qLunch} onChange={(v) => { const newDays = [...dailyExpenses]; newDays[idx] = { ...day, lunch: { ...lunch, quoteAmount: v } }; updateData({ dailyExpenses: newDays }); }} />}
                                  <span>{formatMoney(qLunch)}</span>
                                </div>
                              </div>
                            )}
                            {qDinner > 0 && (
                              <div className="flex justify-between items-center">
                                <span>D{day.day}晚餐</span>
                                <div className="flex items-center gap-2">
                                  {isQuoteEditing && <NumberInput className="h-6 w-20 text-xs border rounded" value={qDinner} onChange={(v) => { const newDays = [...dailyExpenses]; newDays[idx] = { ...day, dinner: { ...dinner, quoteAmount: v } }; updateData({ dailyExpenses: newDays }); }} />}
                                  <span>{formatMoney(qDinner)}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {stats.quoteBus_m > 0 && (
                  <>
                    <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-600 font-medium">交通费</span><span className="font-medium">{formatMoney(stats.quoteBus_m)}</span></div>
                    <div className="pl-2 text-xs text-gray-500 space-y-1 py-1 border-b border-gray-50">
                      <div className="flex justify-between items-center">
                        <span>大巴包车</span>
                        <div className="flex items-center gap-2">
                          {isQuoteEditing && <NumberInput className="h-6 w-20 text-xs border rounded" value={coreConfig.busQuoteFee ?? coreConfig.busFee} onChange={(v) => updateData({ coreConfig: { ...coreConfig, busQuoteFee: v } })} />}
                          <span>{formatMoney(coreConfig.busQuoteFee ?? coreConfig.busFee)}</span>
                        </div>
                      </div>
                      {(coreConfig.otherTransports || []).map((t: any, idx: number) => (
                        <div key={t.id} className="flex justify-between items-center">
                          <span>{t.type === 'flight' ? '飞机' : '高铁'} {t.count}张</span>
                          <div className="flex items-center gap-2">
                            {isQuoteEditing && <NumberInput className="h-6 w-20 text-xs border rounded" value={t.quotePrice ?? t.price} onChange={(v) => { const newTrans = [...coreConfig.otherTransports]; newTrans[idx] = { ...t, quotePrice: v }; updateData({ coreConfig: { ...coreConfig, otherTransports: newTrans } }); }} />}
                            <span>{formatMoney((t.quotePrice ?? t.price) * t.count)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {stats.quoteStaffFee_m > 0 && (
                  <>
                    <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-600 font-medium">工作人员</span><span className="font-medium">{formatMoney(stats.quoteStaffFee_m)}</span></div>
                    <div className="pl-2 text-xs text-gray-500 space-y-1 py-1 border-b border-gray-50">
                      {dailyExpenses.map((day: any, idx: number) => {
                        let dayTotal = 0;
                        (coreConfig.staffMembers || []).forEach((m: StaffMember) => {
                          const count = (day.quoteStaffCounts?.[m.id] ?? m.count) || 0;
                          const fee = (day.quoteStaffFees?.[m.id] ?? (day.staffFees && day.staffFees[m.id]) ?? m.dailyFee) || 0;
                          dayTotal += count * fee;
                        });
                        if (dayTotal === 0) return null;
                        return (
                          <div key={day.day} className="py-1">
                            <div className="flex justify-between font-medium"><span>D{day.day}</span><span>{formatMoney(dayTotal)}</span></div>
                            {isQuoteEditing && (
                              <div className="pl-2 space-y-1 mt-1">
                                {(coreConfig.staffMembers || []).filter((m: StaffMember) => m.count > 0).map((m: StaffMember) => (
                                  <div key={m.id} className="flex items-center gap-2">
                                    <span className="w-12">{m.name}</span>
                                    <NumberInput className="h-6 w-10 text-xs border rounded" value={day.quoteStaffCounts?.[m.id] ?? m.count} onChange={(v) => { const newDays = [...dailyExpenses]; newDays[idx] = { ...day, quoteStaffCounts: { ...(day.quoteStaffCounts || {}), [m.id]: v } }; updateData({ dailyExpenses: newDays }); }} />
                                    <span>人 x</span>
                                    <NumberInput className="h-6 w-16 text-xs border rounded" value={day.quoteStaffFees?.[m.id] ?? (day.staffFees && day.staffFees[m.id]) ?? m.dailyFee} onChange={(v) => { const newDays = [...dailyExpenses]; newDays[idx] = { ...day, quoteStaffFees: { ...(day.quoteStaffFees || {}), [m.id]: v } }; updateData({ dailyExpenses: newDays }); }} />
                                    <span>元</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {stats.quoteSingle_m > 0 && (
                  <>
                    <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-600 font-medium">活动项目</span><span className="font-medium">{formatMoney(stats.quoteSingle_m)}</span></div>
                    <div className="pl-2 text-xs text-gray-500 space-y-1 py-1 border-b border-gray-50">
                      {dailyExpenses.map((day: any, dIdx: number) => (day.singleItems || []).filter((i: any) => i.name).map((i: any, iIdx: number) => {
                        const qPrice = i.quotePrice ?? i.price;
                        const qCount = i.quoteCountClient ?? i.count;
                        const qTotal = i.quoteTotalPrice ?? (qPrice * qCount);
                        return (
                          <div key={`${day.day}-${iIdx}`} className="flex justify-between items-center">
                            <span>D{day.day} {i.name}</span>
                            <div className="flex items-center gap-2">
                              {isQuoteEditing && (
                                <div className="flex items-center gap-1">
                                  <NumberInput className="h-6 w-16 text-xs border rounded" value={qPrice} onChange={(v) => { const newDays = [...dailyExpenses]; const items = [...day.singleItems]; items[iIdx] = { ...items[iIdx], quotePrice: v, quoteTotalPrice: v * (items[iIdx].quoteCountClient || items[iIdx].count) }; newDays[dIdx] = { ...day, singleItems: items }; updateData({ dailyExpenses: newDays }); }} />
                                  <span>x</span>
                                  <NumberInput className="h-6 w-12 text-xs border rounded" value={qCount} onChange={(v) => { const newDays = [...dailyExpenses]; const items = [...day.singleItems]; items[iIdx] = { ...items[iIdx], quoteCountClient: v, quoteTotalPrice: (items[iIdx].quotePrice || items[iIdx].price) * v }; newDays[dIdx] = { ...day, singleItems: items }; updateData({ dailyExpenses: newDays }); }} />
                                </div>
                              )}
                              <span>{formatMoney(qTotal)}</span>
                            </div>
                          </div>
                        );
                      }))}
                    </div>
                  </>
                )}

                {stats.quoteOther_m > 0 && (
                  <>
                    <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-600 font-medium">其他费用</span><span className="font-medium">{formatMoney(stats.quoteOther_m)}</span></div>
                    <div className="pl-2 text-xs text-gray-500 space-y-1 py-1 border-b border-gray-50">
                      {stats.insuranceQ_m > 0 && (
                        <div className="flex justify-between items-center">
                          <span>保险费</span>
                          <div className="flex items-center gap-2">
                            {isQuoteEditing && <NumberInput className="h-6 w-20 text-xs border rounded" value={otherExpenses.insurance?.quoteAmount ?? otherExpenses.insurance?.totalAmount} onChange={(v) => updateData({ otherExpenses: { ...otherExpenses, insurance: { ...otherExpenses.insurance, quoteAmount: v } } })} />}
                            <span>{formatMoney(stats.insuranceQ_m)}</span>
                          </div>
                        </div>
                      )}
                      {(otherExpenses.materials || []).map((m: any, mIdx: number) => {
                        const qTotal = m.quoteTotalPrice ?? m.totalPrice ?? (m.price * m.quantity);
                        if (qTotal <= 0) return null;
                        return (
                          <div key={m.id} className="flex justify-between items-center">
                            <span>杂费-{m.name}</span>
                            <div className="flex items-center gap-2">
                              {isQuoteEditing && <NumberInput className="h-6 w-20 text-xs border rounded" value={qTotal} onChange={(v) => { const newMats = [...otherExpenses.materials]; newMats[mIdx] = { ...m, quoteTotalPrice: v }; updateData({ otherExpenses: { ...otherExpenses, materials: newMats } }); }} />}
                              <span>{formatMoney(qTotal)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-600 font-medium">小计</span><span className="font-medium">{formatMoney(qSubtotal_m)}</span></div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  {(otherExpenses.serviceFeeMode ?? 'percent') === 'per-person' ? 
                    <span className="text-gray-600">服务费 ({otherExpenses.serviceFeePerPerson || 0}元/人/天 × {otherExpenses.serviceFeeDays || 1}天 × {otherExpenses.serviceFeePeople ?? totalClients}人)</span> 
                    : <span className="text-gray-600">服务费 ({otherExpenses.serviceFeePercent}%)</span>}
                  <span className="font-medium">{formatMoney(serviceFeeAmount)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100 items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 font-medium">税费 ({otherExpenses.taxPercent ?? 1}%)</span>
                    <span className="text-xs text-gray-400">税基 ¥{formatMoney(qSubtotal_m)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{formatMoney(tax)}</span>
                  </div>
                </div>
                <div className="flex justify-between py-2.5 bg-gray-50 rounded mt-2 px-3"><span className="font-semibold text-gray-800">报价合计</span><span className="font-bold text-gray-900 text-xl">{formatMoney(totalPrice)}</span></div>
                {discountAmount > 0 && (
                  <div className="flex justify-between py-2 border-b border-gray-100 text-red-600"><span className="font-medium">优惠</span><span className="font-medium">-{formatMoney(discountAmount)}</span></div>
                )}
                <div className="flex justify-between py-2.5 bg-gray-100 rounded mt-2 px-3"><span className="font-bold text-gray-800">应付金额</span><span className="font-bold text-gray-900 text-2xl">{formatMoney(finalPrice)}</span></div>
                <div className="flex justify-between items-center py-2 text-gray-500"><span className="flex-shrink-0">人均费用</span><span className="font-medium text-gray-700">{formatMoney(finalPrice / (coreConfig.pricingCount || totalClients || 1))}/人</span></div>
              </div>
            </CardContent>
          </Card>
          </div>
          </div>
        </div>
      </main>
      
      {/* 登录对话框 - 用于保存时登录 */}
      <AuthModal open={showLoginForSave} onOpenChange={setShowLoginForSave} />
    </div>
  );
}
