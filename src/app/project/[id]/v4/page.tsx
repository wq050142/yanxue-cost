
'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Calendar, Users, Trash2, Copy, MoreVertical, ChevronDown, ChevronUp, Lock, Percent } from 'lucide-react';

// ========== 类型定义 ==========
// V4数据结构：行程节点
interface ItineraryItem {
  id: string;
  time: string; // "08:00"
  icon: string;
  title: string;
  description: string;
  pricePerPerson: number;
  quantity: number;
}

// V4数据结构：每日行程
interface ItineraryDay {
  id: string;
  dayNumber: number;
  date: string;
  weekday: string;
  items: ItineraryItem[];
}

// V4数据结构：成本构成
interface CostItem {
  id: string;
  name: string;
  amount: number;
  color: string;
}

// V4数据结构：完整项目
interface ProjectDataV4 {
  // 基础信息
  id: string;
  name: string;
  clientName: string;
  dateRange: { start: string; end: string };
  quoteDate: string;
  quoteBy: string;
  peopleCount: number;
  
  // 行程
  itineraryDays: ItineraryDay[];
  
  // 成本（内部计算）
  totalCost: number;
  costItems: CostItem[];
  
  // 利润率
  profitMargin: number;
  
  // 报价
  totalQuote: number;
  profit: number;
  pricePerPerson: number;
}

// ========== 默认数据 ==========
const DEFAULT_ITEMS: ItineraryItem[] = [
  { id: 'i1', time: '08:00', icon: '🚐', title: '出发', description: '学校集合，乘车出发', pricePerPerson: 0, quantity: 90 },
  { id: 'i2', time: '09:30', icon: '🤖', title: '机器人小镇', description: '参观+课程体验', pricePerPerson: 120, quantity: 90 },
  { id: 'i3', time: '12:00', icon: '🍱', title: '午餐', description: '400元/桌 × 10桌', pricePerPerson: 44.44, quantity: 90 },
  { id: 'i4', time: '14:00', icon: '🎓', title: '课程体验', description: '参观+互动体验', pricePerPerson: 0, quantity: 90 },
  { id: 'i5', time: '18:00', icon: '🍜', title: '晚餐', description: '400元/桌 × 10桌', pricePerPerson: 44.44, quantity: 90 },
  { id: 'i6', time: '19:30', icon: '🏨', title: '入住酒店', description: '3钻酒店，双床房49间 × 180元/间', pricePerPerson: 98, quantity: 90 },
];

const DEFAULT_DAYS: ItineraryDay[] = [
  { id: 'd1', dayNumber: 1, date: '6月5日', weekday: '周五', items: DEFAULT_ITEMS },
  { id: 'd2', dayNumber: 2, date: '6月6日', weekday: '周六', items: [
    { id: 'i7', time: '09:00', icon: '🏛️', title: '浙大一日', description: '280元 × 96人', pricePerPerson: 280, quantity: 96 },
    { id: 'i8', time: '12:00', icon: '🍱', title: '午餐', description: '400元/桌 × 12桌', pricePerPerson: 50, quantity: 96 },
    { id: 'i9', time: '18:00', icon: '🍜', title: '晚餐', description: '400元/桌 × 12桌', pricePerPerson: 50, quantity: 96 },
  ]},
  { id: 'd3', dayNumber: 3, date: '6月7日', weekday: '周日', items: [
    { id: 'i10', time: '09:00', icon: '🏺', title: '浙江省博物馆', description: '250元 × 3团', pricePerPerson: 8.33, quantity: 96 },
    { id: 'i11', time: '12:00', icon: '🍱', title: '午餐', description: '400元/桌 × 12桌 + 15元/人', pricePerPerson: 49.48, quantity: 96 },
    { id: 'i12', time: '14:00', icon: '🚐', title: '返程', description: '整理返程，返回学校', pricePerPerson: 0, quantity: 96 },
  ]},
];

const DEFAULT_COST_ITEMS: CostItem[] = [
  { id: 'c1', name: '交通费', amount: 33229, color: '#2563EB' },
  { id: 'c2', name: '活动项目', amount: 36750, color: '#16A34A' },
  { id: 'c3', name: '餐费', amount: 18475, color: '#F59E0B' },
  { id: 'c4', name: '住宿费', amount: 17640, color: '#8B5CF6' },
  { id: 'c5', name: '工作人员', amount: 6000, color: '#059669' },
  { id: 'c6', name: '其他费用', amount: 2231, color: '#64748B' },
];

// ========== V4页面组件 ==========
export default function ProjectPageV4() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.id as string;

  // ========== 状态 ==========
  const [data, setData] = useState&lt;ProjectDataV4&gt;({
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

  // ========== 计算逻辑 ==========
  useEffect(() =&gt; {
    const profitMargin = data.profitMargin / 100;
    const totalQuote = data.totalCost / (1 - profitMargin);
    const profit = totalQuote - data.totalCost;
    const pricePerPerson = totalQuote / data.peopleCount;
    
    setData(prev =&gt; ({
      ...prev,
      totalQuote,
      profit,
      pricePerPerson,
    }));
  }, [data.profitMargin, data.totalCost, data.peopleCount]);

  // ========== 渲染函数 ==========
  return (
    &lt;div className="min-h-screen bg-[#F8FAFC]"&gt;
      
      {/* ========== 顶部：项目信息区 ========== */}
      &lt;header className="h-[60px] bg-white border-b border-[#E5E7EB] flex items-center px-6 gap-6"&gt;
        &lt;button 
          onClick={() =&gt; router.push('/')}
          className="flex items-center gap-2 text-[#64748B] hover:text-[#2563EB] transition-colors"
        &gt;
          &lt;ArrowLeft size={20} /&gt;
          &lt;span className="text-sm font-semibold"&gt;返回项目列表&lt;/span&gt;
        &lt;/button&gt;
        
        &lt;div className="h-6 w-px bg-[#E5E7EB]" /&gt;
        
        {/* 项目名称 */}
        &lt;div className="flex items-center gap-2"&gt;
          &lt;span className="text-lg font-semibold text-[#0F172A]"&gt;{data.name}&lt;/span&gt;
          &lt;span className="px-2 py-0.5 bg-[#DBEAFE] text-[#2563EB] text-xs font-semibold rounded-full"&gt;V4&lt;/span&gt;
        &lt;/div&gt;
        
        &lt;div className="flex-1" /&gt;
        
        {/* 项目信息 */}
        &lt;div className="flex items-center gap-6 text-sm"&gt;
          &lt;div className="flex items-center gap-2"&gt;
            &lt;Calendar size={14} className="text-[#64748B]" /&gt;
            &lt;span className="text-[#64748B]"&gt;{data.dateRange.start} - {data.dateRange.end}&lt;/span&gt;
          &lt;/div&gt;
          &lt;div className="flex items-center gap-2"&gt;
            &lt;Users size={14} className="text-[#64748B]" /&gt;
            &lt;span className="text-[#64748B]"&gt;{data.clientName}&lt;/span&gt;
          &lt;/div&gt;
          &lt;div className="flex items-center gap-2"&gt;
            &lt;span className="text-[#64748B]"&gt;{data.peopleCount}人&lt;/span&gt;
          &lt;/div&gt;
        &lt;/div&gt;
        
        &lt;div className="flex items-center gap-3"&gt;
          &lt;button className="px-4 py-2 text-sm font-semibold text-[#2563EB] bg-[#EFF6FF] rounded-lg hover:bg-[#DBEAFE] transition-colors"&gt;
            保存
          &lt;/button&gt;
        &lt;/div&gt;
      &lt;/header&gt;
      
      {/* ========== 三栏布局 ========== */}
      &lt;main className="px-6 py-4 grid grid-cols-[55%_25%_20%] gap-4 h-[calc(100vh-60px)]"&gt;
        
        {/* ========== 左侧：行程编辑器 ========== */}
        &lt;section className="overflow-y-auto pr-2"&gt;
          &lt;div className="flex items-center justify-between mb-4"&gt;
            &lt;h2 className="text-base font-semibold text-[#0F172A]"&gt;行程编辑器&lt;/h2&gt;
            &lt;button 
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-[#2563EB] bg-[#EFF6FF] rounded-lg hover:bg-[#DBEAFE] transition-colors"
            &gt;
              &lt;Plus size={16} /&gt;
              添加天数
            &lt;/button&gt;
          &lt;/div&gt;
          
          {/* DAY卡片列表 */}
          &lt;div className="space-y-4"&gt;
            {data.itineraryDays.map((day) =&gt; (
              &lt;ItineraryDayCard key={day.id} day={day} /&gt;
            ))}
          &lt;/div&gt;
          
          {/* 添加一天按钮 */}
          &lt;button className="mt-4 w-full py-3 border-2 border-dashed border-[#E5E7EB] rounded-xl text-[#64748B] hover:border-[#2563EB] hover:text-[#2563EB] transition-all flex items-center justify-center gap-2 text-sm font-semibold"&gt;
            &lt;Plus size={18} /&gt;
            添加一天
          &lt;/button&gt;
        &lt;/section&gt;
        
        {/* ========== 中间：成本核算中心 ========== */}
        &lt;section className="overflow-y-auto pr-2"&gt;
          &lt;div className="flex items-center justify-between mb-4"&gt;
            &lt;div className="flex items-center gap-2"&gt;
              &lt;h2 className="text-base font-semibold text-[#0F172A]"&gt;成本核算&lt;/h2&gt;
              &lt;span className="px-2 py-0.5 bg-gray-100 text-xs font-semibold rounded flex items-center gap-1"&gt;
                &lt;Lock size={12} /&gt;
                仅内部可见
              &lt;/span&gt;
            &lt;/div&gt;
            &lt;button 
              onClick={() =&gt; setShowCostDetail(!showCostDetail)}
              className="text-sm font-semibold text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
            &gt;
              查看明细
            &lt;/button&gt;
          &lt;/div&gt;
          
          {/* 总成本卡片 */}
          &lt;div className="bg-gradient-to-br from-[#EFF6FF] to-[#F8FAFC] rounded-xl p-6 mb-4 border border-[#DBEAFE]"&gt;
            &lt;div className="text-xs text-[#64748B] font-semibold uppercase tracking-wider mb-2"&gt;总成本（含税）&lt;/div&gt;
            &lt;div className="text-3xl font-bold text-[#2563EB] numeric"&gt;¥{data.totalCost.toLocaleString()}&lt;/div&gt;
          &lt;/div&gt;
          
          {/* 成本构成 */}
          &lt;div className="bg-white rounded-xl border border-[#E5E7EB] p-5 mb-4"&gt;
            &lt;h3 className="text-sm font-semibold text-[#0F172A] mb-4"&gt;成本构成&lt;/h3&gt;
            &lt;div className="space-y-3"&gt;
              {data.costItems.map((item) =&gt; {
                const percentage = (item.amount / data.totalCost) * 100;
                return (
                  &lt;CostItemRow key={item.id} item={item} percentage={percentage} /&gt;
                );
              })}
            &lt;/div&gt;
          &lt;/div&gt;
          
          {/* 报价敏感度调节器 */}
          &lt;div className="bg-gradient-to-br from-[#F8FAFC] to-[#F1F5F9] rounded-xl p-5 border border-[#E5E7EB]"&gt;
            &lt;div className="flex items-center justify-between mb-4"&gt;
              &lt;h3 className="text-sm font-semibold text-[#0F172A]"&gt;报价敏感度调节器&lt;/h3&gt;
              {data.profitMargin &gt;= 15 &amp;&amp; data.profitMargin &lt;= 20 &amp;&amp; (
                &lt;span className="px-2 py-0.5 bg-[#D1FAE5] text-[#059669] text-xs font-semibold rounded-full"&gt;
                  推荐区间 15%-20%
                &lt;/span&gt;
              )}
            &lt;/div&gt;
            
            &lt;div className="mb-4"&gt;
              &lt;div className="flex items-center justify-between mb-2"&gt;
                &lt;span className="text-sm font-semibold text-[#334155]"&gt;利润率&lt;/span&gt;
                &lt;span className="text-base font-bold text-[#2563EB] numeric"&gt;{data.profitMargin}%&lt;/span&gt;
              &lt;/div&gt;
              &lt;input
                type="range"
                min="5"
                max="30"
                value={data.profitMargin}
                onChange={(e) =&gt; setData(prev =&gt; ({ ...prev, profitMargin: Number(e.target.value) }))}
                className="w-full h-2 bg-[#E5E7EB] rounded-lg appearance-none cursor-pointer accent-[#2563EB]"
              /&gt;
              &lt;div className="flex justify-between mt-1 text-xs text-[#64748B]"&gt;
                &lt;span&gt;5%&lt;/span&gt;
                &lt;span&gt;30%&lt;/span&gt;
              &lt;/div&gt;
            &lt;/div&gt;
            
            {/* 实时计算结果 */}
            &lt;div className="grid grid-cols-3 gap-3 pt-3 border-t border-[#E5E7EB]"&gt;
              &lt;div className="text-center"&gt;
                &lt;div className="text-xs text-[#64748B] mb-1"&gt;当前报价（含税）&lt;/div&gt;
                &lt;div className="text-lg font-bold text-[#2563EB] numeric"&gt;¥{data.totalQuote.toFixed(1).toLocaleString()}&lt;/div&gt;
              &lt;/div&gt;
              &lt;div className="text-center"&gt;
                &lt;div className="text-xs text-[#64748B] mb-1"&gt;利润&lt;/div&gt;
                &lt;div className="text-lg font-bold text-[#16A34A] numeric"&gt;¥{data.profit.toFixed(0).toLocaleString()}&lt;/div&gt;
              &lt;/div&gt;
              &lt;div className="text-center"&gt;
                &lt;div className="text-xs text-[#64748B] mb-1"&gt;人均费用&lt;/div&gt;
                &lt;div className="text-lg font-bold text-[#0F172A] numeric"&gt;¥{data.pricePerPerson.toFixed(2)}&lt;/div&gt;
              &lt;/div&gt;
            &lt;/div&gt;
          &lt;/div&gt;
        &lt;/section&gt;
        
        {/* ========== 右侧：项目报价单 ========== */}
        &lt;section className="overflow-y-auto pr-2"&gt;
          &lt;div className="flex items-center justify-between mb-4"&gt;
            &lt;h2 className="text-base font-semibold text-[#0F172A]"&gt;项目报价单（对外）&lt;/h2&gt;
            &lt;div className="flex items-center gap-2"&gt;
              &lt;button className="px-3 py-1.5 text-xs font-semibold text-[#64748B] border border-[#E5E7EB] rounded-lg hover:bg-[#F8FAFC] transition-colors"&gt;
                查看明细
              &lt;/button&gt;
              &lt;button className="px-3 py-1.5 text-xs font-semibold text-white bg-[#2563EB] rounded-lg hover:bg-[#1D4ED8] transition-colors"&gt;
                导出PDF
              &lt;/button&gt;
            &lt;/div&gt;
          &lt;/div&gt;
          
          {/* 报价单卡片 */}
          &lt;div className="bg-white rounded-xl border border-[#E5E7EB]"&gt;
            {/* 头部信息 */}
            &lt;div className="px-5 pt-4 pb-3 border-b border-[#E5E7EB]"&gt;
              &lt;h3 className="text-lg font-bold text-[#0F172A] mb-2"&gt;项目报价单&lt;/h3&gt;
              &lt;div className="grid grid-cols-2 gap-3 text-xs"&gt;
                &lt;div&gt;
                  &lt;span className="text-[#64748B]"&gt;客户：&lt;/span&gt;
                  &lt;span className="text-[#0F172A] font-semibold"&gt;{data.clientName}&lt;/span&gt;
                &lt;/div&gt;
                &lt;div&gt;
                  &lt;span className="text-[#64748B]"&gt;出行：&lt;/span&gt;
                  &lt;span className="text-[#0F172A] font-semibold"&gt;{data.dateRange.start} - {data.dateRange.end}&lt;/span&gt;
                &lt;/div&gt;
                &lt;div&gt;
                  &lt;span className="text-[#64748B]"&gt;报价：&lt;/span&gt;
                  &lt;span className="text-[#0F172A] font-semibold"&gt;{data.quoteDate}&lt;/span&gt;
                &lt;/div&gt;
                &lt;div&gt;
                  &lt;span className="text-[#64748B]"&gt;报价人：&lt;/span&gt;
                  &lt;span className="text-[#0F172A] font-semibold"&gt;{data.quoteBy}&lt;/span&gt;
                &lt;/div&gt;
              &lt;/div&gt;
            &lt;/div&gt;
            
            {/* 报价概览 */}
            &lt;div className="px-5 py-5 bg-gradient-to-br from-[#EFF6FF] to-white border-b border-[#E5E7EB]"&gt;
              &lt;div className="flex items-center justify-between"&gt;
                &lt;div&gt;
                  &lt;div className="text-xs text-[#64748B] mb-1"&gt;报价合计（含税）&lt;/div&gt;
                  &lt;div className="text-2xl font-bold text-[#2563EB] numeric"&gt;¥{data.totalQuote.toFixed(1).toLocaleString()}&lt;/div&gt;
                &lt;/div&gt;
                &lt;div className="text-right"&gt;
                  &lt;div className="text-xs text-[#64748B] mb-1"&gt;人均费用&lt;/div&gt;
                  &lt;div className="text-lg font-semibold text-[#0F172A] numeric"&gt;¥{data.pricePerPerson.toFixed(2)}/人&lt;/div&gt;
                &lt;/div&gt;
              &lt;/div&gt;
            &lt;/div&gt;
            
            {/* 报价明细 */}
            &lt;div className="p-5"&gt;
              &lt;button 
                onClick={() =&gt; setQuoteDetailExpanded(!quoteDetailExpanded)}
                className="flex items-center justify-between w-full text-sm font-semibold text-[#0F172A] mb-3 py-2 hover:bg-[#F8FAFC] rounded-lg transition-colors"
              &gt;
                &lt;span&gt;费用项目（默认收起，点击看明细）&lt;/span&gt;
                {quoteDetailExpanded ? &lt;ChevronUp size={16} /&gt; : &lt;ChevronDown size={16} /&gt;}
              &lt;/button&gt;
              
              {quoteDetailExpanded &amp;&amp; (
                &lt;div className="space-y-2"&gt;
                  {[
                    { name: '住宿费', amount: 22540, icon: '🏨' },
                    { name: '餐费', amount: 18880, icon: '🍜' },
                    { name: '交通费', amount: 33229, icon: '🚐' },
                    { name: '活动项目', amount: 43900, icon: '🎯' },
                    { name: '工作人员费用', amount: 6000, icon: '👤' },
                    { name: '服务费（10%）', amount: 12546, icon: '💼' },
                    { name: '税费（1%）', amount: 1254.6, icon: '📊' },
                  ].map((item, idx) =&gt; (
                    &lt;div key={idx} className="flex items-center justify-between py-2 border-b border-[#F3F4F6] last:border-0"&gt;
                      &lt;div className="flex items-center gap-2"&gt;
                        &lt;span&gt;{item.icon}&lt;/span&gt;
                        &lt;span className="text-sm text-[#0F172A]"&gt;{item.name}&lt;/span&gt;
                      &lt;/div&gt;
                      &lt;span className="text-sm font-semibold text-[#0F172A] numeric"&gt;¥{item.amount.toLocaleString()}&lt;/span&gt;
                    &lt;/div&gt;
                  ))}
                &lt;/div&gt;
              )}
            &lt;/div&gt;
            
            {/* 固定底部合计 */}
            &lt;div className="sticky bottom-0 bg-gradient-to-t from-white via-white to-transparent p-5 border-t border-[#E5E7EB]"&gt;
              &lt;div className="flex items-center justify-between"&gt;
                &lt;div className="text-lg font-semibold text-[#0F172A]"&gt;报价合计（含税）&lt;/div&gt;
                &lt;div className="text-2xl font-bold text-[#2563EB] numeric"&gt;¥{data.totalQuote.toFixed(1).toLocaleString()}&lt;/div&gt;
              &lt;/div&gt;
              &lt;div className="mt-1 text-right text-sm text-[#64748B]"&gt;
                人均费用：¥{data.pricePerPerson.toFixed(2)}/人
              &lt;/div&gt;
            &lt;/div&gt;
          &lt;/div&gt;
        &lt;/section&gt;
        
      &lt;/main&gt;
    &lt;/div&gt;
  );
}

// ========== 子组件：行程天卡片 ==========
function ItineraryDayCard({ day }: { day: ItineraryDay }) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    &lt;div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden"&gt;
      {/* 头部 */}
      &lt;div className="px-4 py-3 border-b border-[#E5E7EB] flex items-center justify-between bg-gradient-to-r from-[#F8FAFC] to-white"&gt;
        &lt;div className="flex items-center gap-3"&gt;
          &lt;div className="w-8 h-8 rounded-lg bg-[#2563EB] text-white flex items-center justify-center text-sm font-bold"&gt;
            {day.dayNumber}
          &lt;/div&gt;
          &lt;div&gt;
            &lt;div className="text-sm font-semibold text-[#0F172A]"&gt;DAY {day.dayNumber}&lt;/div&gt;
            &lt;div className="text-xs text-[#64748B]"&gt;{day.date} {day.weekday}&lt;/div&gt;
          &lt;/div&gt;
        &lt;/div&gt;
        &lt;div className="flex items-center gap-2"&gt;
          &lt;button className="p-1.5 text-[#64748B] hover:text-[#2563EB] hover:bg-[#EFF6FF] rounded-md transition-colors"&gt;
            &lt;Plus size={16} /&gt;
          &lt;/button&gt;
          &lt;button className="p-1.5 text-[#64748B] hover:text-[#2563EB] hover:bg-[#EFF6FF] rounded-md transition-colors"&gt;
            &lt;Copy size={16} /&gt;
          &lt;/button&gt;
          &lt;button 
            onClick={() =&gt; setIsExpanded(!isExpanded)}
            className="p-1.5 text-[#64748B] hover:text-[#2563EB] hover:bg-[#EFF6FF] rounded-md transition-colors"
          &gt;
            {isExpanded ? &lt;ChevronUp size={16} /&gt; : &lt;ChevronDown size={16} /&gt;}
          &lt;/button&gt;
        &lt;/div&gt;
      &lt;/div&gt;
      
      {/* 内容 */}
      {isExpanded &amp;&amp; (
        &lt;div className="p-4 space-y-3"&gt;
          {day.items.map((item) =&gt; (
            &lt;ItineraryItemRow key={item.id} item={item} /&gt;
          ))}
        &lt;/div&gt;
      )}
    &lt;/div&gt;
  );
}

// ========== 子组件：行程节点 ==========
function ItineraryItemRow({ item }: { item: ItineraryItem }) {
  const totalAmount = item.pricePerPerson * item.quantity;
  
  return (
    &lt;div className="relative pl-6"&gt;
      {/* 时间轴 */}
      &lt;div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#E5E7EB]" /&gt;
      &lt;div className="absolute left-[-5px] top-2 w-2.5 h-2.5 rounded-full bg-[#2563EB] border-2 border-white shadow-sm" /&gt;
      
      {/* 内容 */}
      &lt;div className="flex items-start gap-3 py-1.5 hover:bg-[#F8FAFC] rounded-lg px-2 transition-colors"&gt;
        &lt;div className="text-sm font-semibold text-[#64748B] w-12 shrink-0"&gt;{item.time}&lt;/div&gt;
        
        &lt;div className="w-7 h-7 rounded-lg bg-[#EFF6FF] flex items-center justify-center text-base shrink-0"&gt;
          {item.icon}
        &lt;/div&gt;
        
        &lt;div className="flex-1 min-w-0"&gt;
          &lt;div className="flex items-start justify-between gap-3"&gt;
            &lt;div className="min-w-0"&gt;
              &lt;div className="text-sm font-semibold text-[#0F172A]"&gt;{item.title}&lt;/div&gt;
              &lt;div className="text-xs text-[#64748B] mt-0.5"&gt;{item.description}&lt;/div&gt;
            &lt;/div&gt;
            {totalAmount &gt; 0 &amp;&amp; (
              &lt;div className="text-right shrink-0"&gt;
                &lt;div className="text-sm font-semibold text-[#0F172A] numeric"&gt;¥{totalAmount.toFixed(0)}&lt;/div&gt;
                {item.pricePerPerson &gt; 0 &amp;&amp; (
                  &lt;div className="text-xs text-[#64748B] numeric"&gt;¥{item.pricePerPerson.toFixed(2)} × {item.quantity}人&lt;/div&gt;
                )}
              &lt;/div&gt;
            )}
          &lt;/div&gt;
        &lt;/div&gt;
      &lt;/div&gt;
    &lt;/div&gt;
  );
}

// ========== 子组件：成本构成行 ==========
function CostItemRow({ item, percentage }: { item: CostItem, percentage: number }) {
  return (
    &lt;div className="space-y-1.5"&gt;
      &lt;div className="flex items-center justify-between text-sm"&gt;
        &lt;div className="flex items-center gap-2"&gt;
          &lt;div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} /&gt;
          &lt;span className="font-medium text-[#0F172A]"&gt;{item.name}&lt;/span&gt;
        &lt;/div&gt;
        &lt;div className="flex items-center gap-2"&gt;
          &lt;span className="font-semibold text-[#0F172A] numeric"&gt;¥{item.amount.toLocaleString()}&lt;/span&gt;
          &lt;span className="text-xs text-[#64748B] numeric"&gt;{percentage.toFixed(1)}%&lt;/span&gt;
        &lt;/div&gt;
      &lt;/div&gt;
      &lt;div className="h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden"&gt;
        &lt;div 
          className="h-full rounded-full transition-all duration-300"
          style={{ 
            width: `${Math.min(percentage, 100)}%`,
            backgroundColor: item.color 
          }}
        /&gt;
      &lt;/div&gt;
    &lt;/div&gt;
  );
}
