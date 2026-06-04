'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Calendar, Users, Lock, Percent, ChevronDown, ChevronUp } from 'lucide-react';

interface ItineraryItem {
  id: string;
  time: string;
  icon: string;
  title: string;
  description: string;
  pricePerPerson: number;
  quantity: number;
}

interface ItineraryDay {
  id: string;
  dayNumber: number;
  date: string;
  weekday: string;
  items: ItineraryItem[];
}

interface CostItem {
  id: string;
  name: string;
  amount: number;
  color: string;
}

interface ProjectDataV4 {
  id: string;
  name: string;
  clientName: string;
  dateRange: { start: string; end: string };
  quoteDate: string;
  quoteBy: string;
  peopleCount: number;
  itineraryDays: ItineraryDay[];
  totalCost: number;
  costItems: CostItem[];
  profitMargin: number;
  totalQuote: number;
  profit: number;
  pricePerPerson: number;
}

const DEFAULT_ITEMS: ItineraryItem[] = [
  { id: 'i1', time: '08:00', icon: '🚐', title: '出发', description: '学校集合，乘车出发', pricePerPerson: 0, quantity: 90 },
  { id: 'i2', time: '09:30', icon: '🤖', title: '机器人小镇', description: '参观+课程体验', pricePerPerson: 120, quantity: 90 },
  { id: 'i3', time: '12:00', icon: '🍱', title: '午餐', description: '400元/桌 × 10桌', pricePerPerson: 44.44, quantity: 90 },
];

const DEFAULT_DAYS: ItineraryDay[] = [
  { id: 'd1', dayNumber: 1, date: '6月5日', weekday: '周五', items: DEFAULT_ITEMS },
];

const DEFAULT_COST_ITEMS: CostItem[] = [
  { id: 'c1', name: '交通费', amount: 33229, color: '#2563EB' },
  { id: 'c2', name: '活动项目', amount: 36750, color: '#16A34A' },
  { id: 'c3', name: '餐费', amount: 18475, color: '#F59E0B' },
];

export default function ProjectPageV4() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.id as string;

  const [data, setData] = useState<ProjectDataV4>({
    id: projectId || 'demo',
    name: '苍南 3天2晚 杭州浙大研学',
    clientName: '苍南县实验中学',
    dateRange: { start: '2026/06/05', end: '2026/06/07' },
    quoteDate: '2026/06/04',
    quoteBy: '王琦',
    peopleCount: 96,
    itineraryDays: DEFAULT_DAYS,
    totalCost: 114325,
    costItems: DEFAULT_COST_ITEMS,
    profitMargin: 17,
    totalQuote: 139260.6,
    profit: 24935.6,
    pricePerPerson: 1450.63,
  });

  const [showCostDetail, setShowCostDetail] = useState(false);
  const [quoteDetailExpanded, setQuoteDetailExpanded] = useState(false);

  useEffect(() => {
    const profitMargin = data.profitMargin / 100;
    const totalQuote = data.totalCost / (1 - profitMargin);
    const profit = totalQuote - data.totalCost;
    const pricePerPerson = totalQuote / data.peopleCount;
    
    setData(prev => ({
      ...prev,
      totalQuote,
      profit,
      pricePerPerson,
    }));
  }, [data.profitMargin, data.totalCost, data.peopleCount]);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="h-[60px] bg-white border-b border-[#E5E7EB] flex items-center px-6 gap-6">
        <button 
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-[#64748B] hover:text-[#2563EB] transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="text-sm font-semibold">返回项目列表</span>
        </button>
        
        <div className="h-6 w-px bg-[#E5E7EB]" />
        
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-[#0F172A]">{data.name}</span>
          <span className="px-2 py-0.5 bg-[#DBEAFE] text-[#2563EB] text-xs font-semibold rounded-full">V4</span>
        </div>
        
        <div className="flex-1" />
        
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-[#64748B]" />
            <span className="text-[#64748B]">{data.dateRange.start} - {data.dateRange.end}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users size={14} className="text-[#64748B]" />
            <span className="text-[#64748B]">{data.clientName}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#64748B]">{data.peopleCount}人</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 text-sm font-semibold text-[#2563EB] bg-[#EFF6FF] rounded-lg hover:bg-[#DBEAFE] transition-colors">
            保存
          </button>
        </div>
      </header>
      
      <main className="px-6 py-4 grid grid-cols-[55%_25%_20%] gap-4 h-[calc(100vh-60px)]">
        <section className="overflow-y-auto pr-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-[#0F172A]">行程编辑器</h2>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-[#2563EB] bg-[#EFF6FF] rounded-lg hover:bg-[#DBEAFE] transition-colors">
              <Plus size={16} />
              添加天数
            </button>
          </div>
          
          <div className="space-y-4">
            {data.itineraryDays.map((day) => (
              <ItineraryDayCard key={day.id} day={day} />
            ))}
          </div>
          
          <button className="mt-4 w-full py-3 border-2 border-dashed border-[#E5E7EB] rounded-xl text-[#64748B] hover:border-[#2563EB] hover:text-[#2563EB] transition-all flex items-center justify-center gap-2 text-sm font-semibold">
            <Plus size={18} />
            添加一天
          </button>
        </section>
        
        <section className="overflow-y-auto pr-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-[#0F172A]">成本核算</h2>
              <span className="px-2 py-0.5 bg-gray-100 text-xs font-semibold rounded flex items-center gap-1">
                <Lock size={12} />
                仅内部可见
              </span>
            </div>
            <button 
              onClick={() => setShowCostDetail(!showCostDetail)}
              className="text-sm font-semibold text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
            >
              查看明细
            </button>
          </div>
          
          <div className="bg-gradient-to-br from-[#EFF6FF] to-[#F8FAFC] rounded-xl p-6 mb-4 border border-[#DBEAFE]">
            <div className="text-xs text-[#64748B] font-semibold uppercase tracking-wider mb-2">总成本（含税）</div>
            <div className="text-3xl font-bold text-[#2563EB]">¥{data.totalCost.toLocaleString()}</div>
          </div>
          
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 mb-4">
            <h3 className="text-sm font-semibold text-[#0F172A] mb-4">成本构成</h3>
            <div className="space-y-3">
              {data.costItems.map((item) => {
                const percentage = (item.amount / data.totalCost) * 100;
                return (
                  <CostItemRow key={item.id} item={item} percentage={percentage} />
                );
              })}
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-[#F8FAFC] to-[#F1F5F9] rounded-xl p-5 border border-[#E5E7EB]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#0F172A]">报价敏感度调节器</h3>
              {data.profitMargin >= 15 && data.profitMargin <= 20 && (
                <span className="px-2 py-0.5 bg-[#D1FAE5] text-[#059669] text-xs font-semibold rounded-full">
                  推荐区间 15%-20%
                </span>
              )}
            </div>
            
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-[#334155]">利润率</span>
                <span className="text-base font-bold text-[#2563EB]">{data.profitMargin}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="30"
                value={data.profitMargin}
                onChange={(e) => setData(prev => ({ ...prev, profitMargin: Number(e.target.value) }))}
                className="w-full h-2 bg-[#E5E7EB] rounded-lg appearance-none cursor-pointer accent-[#2563EB]"
              />
              <div className="flex justify-between mt-1 text-xs text-[#64748B]">
                <span>5%</span>
                <span>30%</span>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[#E5E7EB]">
              <div className="text-center">
                <div className="text-xs text-[#64748B] mb-1">当前报价（含税）</div>
                <div className="text-lg font-bold text-[#2563EB]">¥{data.totalQuote.toFixed(1)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-[#64748B] mb-1">利润</div>
                <div className="text-lg font-bold text-[#16A34A]">¥{data.profit.toFixed(0)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-[#64748B] mb-1">人均费用</div>
                <div className="text-lg font-bold text-[#0F172A]">¥{data.pricePerPerson.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </section>
        
        <section className="overflow-y-auto pr-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-[#0F172A]">项目报价单（对外）</h2>
          </div>
          
          <div className="bg-white rounded-xl border border-[#E5E7EB]">
            <div className="px-5 pt-4 pb-3 border-b border-[#E5E7EB]">
              <h3 className="text-lg font-bold text-[#0F172A] mb-2">项目报价单</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[#64748B]">客户：</span>
                  <span className="text-[#0F172A] font-semibold">{data.clientName}</span>
                </div>
                <div>
                  <span className="text-[#64748B]">出行：</span>
                  <span className="text-[#0F172A] font-semibold">{data.dateRange.start} - {data.dateRange.end}</span>
                </div>
                <div>
                  <span className="text-[#64748B]">报价：</span>
                  <span className="text-[#0F172A] font-semibold">{data.quoteDate}</span>
                </div>
                <div>
                  <span className="text-[#64748B]">报价人：</span>
                  <span className="text-[#0F172A] font-semibold">{data.quoteBy}</span>
                </div>
              </div>
            </div>
            
            <div className="px-5 py-5 bg-gradient-to-br from-[#EFF6FF] to-white border-b border-[#E5E7EB]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-[#64748B] mb-1">报价合计（含税）</div>
                  <div className="text-2xl font-bold text-[#2563EB]">¥{data.totalQuote.toFixed(1)}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-[#64748B] mb-1">人均费用</div>
                  <div className="text-lg font-semibold text-[#0F172A]">¥{data.pricePerPerson.toFixed(2)}/人</div>
                </div>
              </div>
            </div>
            
            <div className="p-5">
              <button 
                onClick={() => setQuoteDetailExpanded(!quoteDetailExpanded)}
                className="flex items-center justify-between w-full text-sm font-semibold text-[#0F172A] mb-3 py-2 hover:bg-[#F8FAFC] rounded-lg transition-colors"
              >
                <span>费用项目</span>
                {quoteDetailExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>
            
            <div className="sticky bottom-0 bg-gradient-to-t from-white via-white to-transparent p-5 border-t border-[#E5E7EB]">
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold text-[#0F172A]">报价合计（含税）</div>
                <div className="text-2xl font-bold text-[#2563EB]">¥{data.totalQuote.toFixed(1)}</div>
              </div>
              <div className="mt-1 text-right text-sm text-[#64748B]">
                人均费用：¥{data.pricePerPerson.toFixed(2)}/人
              </div>
            </div>
          </div>
        </section>
        
      </main>
    </div>
  );
}

function ItineraryDayCard({ day }: { day: ItineraryDay }) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#E5E7EB] flex items-center justify-between bg-gradient-to-r from-[#F8FAFC] to-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#2563EB] text-white flex items-center justify-center text-sm font-bold">
            {day.dayNumber}
          </div>
          <div>
            <div className="text-sm font-semibold text-[#0F172A]">DAY {day.dayNumber}</div>
            <div className="text-xs text-[#64748B]">{day.date} {day.weekday}</div>
          </div>
        </div>
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1.5 text-[#64748B] hover:text-[#2563EB] hover:bg-[#EFF6FF] rounded-md transition-colors"
        >
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>
      
      {isExpanded && (
        <div className="p-4 space-y-3">
          {day.items.map((item) => (
            <ItineraryItemRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function ItineraryItemRow({ item }: { item: ItineraryItem }) {
  const totalAmount = item.pricePerPerson * item.quantity;
  
  return (
    <div className="relative pl-6">
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#E5E7EB]" />
      <div className="absolute left-[-5px] top-2 w-2.5 h-2.5 rounded-full bg-[#2563EB] border-2 border-white shadow-sm" />
      
      <div className="flex items-start gap-3 py-1.5 hover:bg-[#F8FAFC] rounded-lg px-2 transition-colors">
        <div className="text-sm font-semibold text-[#64748B] w-12 shrink-0">{item.time}</div>
        
        <div className="w-7 h-7 rounded-lg bg-[#EFF6FF] flex items-center justify-center text-base shrink-0">
          {item.icon}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[#0F172A]">{item.title}</div>
              <div className="text-xs text-[#64748B] mt-0.5">{item.description}</div>
            </div>
            {totalAmount > 0 && (
              <div className="text-right shrink-0">
                <div className="text-sm font-semibold text-[#0F172A]">¥{totalAmount.toFixed(0)}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CostItemRow({ item, percentage }: { item: CostItem, percentage: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
          <span className="font-medium text-[#0F172A]">{item.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[#0F172A]">¥{item.amount.toLocaleString()}</span>
          <span className="text-xs text-[#64748B]">{percentage.toFixed(1)}%</span>
        </div>
      </div>
      <div className="h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
        <div 
          className="h-full rounded-full"
          style={{ 
            width: `${Math.min(percentage, 100)}%`,
            backgroundColor: item.color 
          }}
        />
      </div>
    </div>
  );
}