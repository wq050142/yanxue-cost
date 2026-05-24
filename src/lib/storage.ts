import { Project, ProjectData, DEFAULT_CORE_CONFIG, DEFAULT_OTHER_EXPENSES } from '@/types';

const STORAGE_KEY = 'study_tour_projects';

// 生成唯一ID
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 获取所有项目列表
export function getProjects(): Project[] {
  if (typeof window === 'undefined') return [];
  
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return [];
  
  try {
    const projects: ProjectData[] = JSON.parse(data);
    return projects.map(p => p.project);
  } catch {
    return [];
  }
}

// 获取单个项目完整数据
export function getProjectData(projectId: string): ProjectData | null {
  if (typeof window === 'undefined') return null;
  
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return null;
  
  try {
    const projects: ProjectData[] = JSON.parse(data);
    return projects.find(p => p.project.id === projectId) || null;
  } catch {
    return null;
  }
}

// 创建新项目
export function createProject(name: string, type: Project['type'], remark: string): ProjectData {
  const project: Project = {
    id: generateId(),
    name,
    type,
    remark,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  const projectData: ProjectData = {
    project,
    coreConfig: { ...DEFAULT_CORE_CONFIG },
    dailyExpenses: [],
    otherExpenses: { ...DEFAULT_OTHER_EXPENSES },
  };
  
  // 保存到localStorage
  const data = localStorage.getItem(STORAGE_KEY);
  const projects: ProjectData[] = data ? JSON.parse(data) : [];
  projects.push(projectData);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  
  return projectData;
}

// 更新项目数据
export function updateProjectData(projectData: ProjectData): void {
  if (typeof window === 'undefined') return;
  
  const data = localStorage.getItem(STORAGE_KEY);
  const projects: ProjectData[] = data ? JSON.parse(data) : [];
  
  const index = projects.findIndex(p => p.project.id === projectData.project.id);
  if (index !== -1) {
    projectData.project.updatedAt = new Date().toISOString();
    projects[index] = projectData;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  }
}

// 删除项目
export function deleteProject(projectId: string): void {
  if (typeof window === 'undefined') return;
  
  const data = localStorage.getItem(STORAGE_KEY);
  const projects: ProjectData[] = data ? JSON.parse(data) : [];
  
  const filtered = projects.filter(p => p.project.id !== projectId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

// 复制项目
export function copyProject(projectId: string): ProjectData | null {
  if (typeof window === 'undefined') return null;
  
  const originalData = getProjectData(projectId);
  if (!originalData) return null;
  
  // 创建新的项目ID
  const newId = generateId();
  const now = new Date().toISOString();
  
  // 复制项目数据
  const newProjectData: ProjectData = {
    project: {
      ...originalData.project,
      id: newId,
      name: `${originalData.project.name} (副本)`,
      createdAt: now,
      updatedAt: now,
    },
    coreConfig: JSON.parse(JSON.stringify(originalData.coreConfig)),
    dailyExpenses: JSON.parse(JSON.stringify(originalData.dailyExpenses)),
    otherExpenses: JSON.parse(JSON.stringify(originalData.otherExpenses)),
  };
  
  // 保存到localStorage
  const data = localStorage.getItem(STORAGE_KEY);
  const projects: ProjectData[] = data ? JSON.parse(data) : [];
  projects.push(newProjectData);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  
  return newProjectData;
}

// 更新项目名称
export function updateProjectName(projectId: string, name: string): void {
  if (typeof window === 'undefined') return;
  
  const data = localStorage.getItem(STORAGE_KEY);
  const projects: ProjectData[] = data ? JSON.parse(data) : [];
  
  const index = projects.findIndex(p => p.project.id === projectId);
  if (index !== -1) {
    projects[index].project.name = name;
    projects[index].project.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  }
}
