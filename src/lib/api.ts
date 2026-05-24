import { 
  Project, 
  ProjectType, 
  ProjectData, 
  CoreConfig, 
  DailyExpense, 
  OtherExpenses,
  Folder,
  DEFAULT_CORE_CONFIG,
  DEFAULT_OTHER_EXPENSES
} from '@/types';

const SESSION_KEY = 'study_tour_session';

// 获取认证 token
async function getAuthToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  
  const savedSession = localStorage.getItem(SESSION_KEY);
  if (!savedSession) return null;
  
  try {
    const session = JSON.parse(savedSession);
    return session.access_token || null;
  } catch {
    return null;
  }
}

// 数据库返回的项目格式（snake_case）
interface DbProject {
  id: string;
  user_id: string;
  name: string;
  type: string;
  remark: string | null;
  core_config: Record<string, unknown>;
  daily_expenses: Record<string, unknown>[];
  other_expenses: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

// 将数据库格式转换为前端格式
function dbToProjectData(db: DbProject): ProjectData {
  return {
    project: {
      id: db.id,
      name: db.name,
      type: db.type as ProjectType,
      remark: db.remark || '',
      createdAt: db.created_at,
      updatedAt: db.updated_at,
    },
    coreConfig: (db.core_config as unknown as CoreConfig) || { ...DEFAULT_CORE_CONFIG },
    dailyExpenses: (db.daily_expenses as unknown as DailyExpense[]) || [],
    otherExpenses: (db.other_expenses as unknown as OtherExpenses) || { ...DEFAULT_OTHER_EXPENSES },
  };
}

// API 请求封装
async function apiRequest<T>(
  path: string, 
  options: RequestInit = {}
): Promise<{ data?: T; error?: string }> {
  const token = await getAuthToken();
  if (!token) {
    return { error: '未登录' };
  }

  try {
    const response = await fetch(`/api${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

    const result = await response.json();
    
    if (!response.ok) {
      return { error: result.error || '请求失败' };
    }
    
    return { data: result };
  } catch (err) {
    return { error: err instanceof Error ? err.message : '网络错误' };
  }
}

// 获取所有项目列表
export async function getProjects(folderId?: string | null): Promise<Project[]> {
  const queryParam = folderId ? `?folderId=${folderId}` : '';
  const { data, error } = await apiRequest<{ projects: Project[] }>(`/projects${queryParam}`);
  if (error) {
    console.error('获取项目列表失败:', error);
    return [];
  }
  return data?.projects || [];
}

// 获取单个项目完整数据
export async function getProjectData(projectId: string): Promise<ProjectData | null> {
  const { data, error } = await apiRequest<{ project: DbProject }>(`/projects/${projectId}`);
  if (error) {
    console.error('获取项目详情失败:', error);
    return null;
  }
  
  if (!data?.project) return null;
  return dbToProjectData(data.project);
}

// 创建新项目
export async function createProject(
  name: string, 
  type: ProjectType, 
  remark: string
): Promise<ProjectData | null> {
  const { data, error } = await apiRequest<{ project: DbProject }>('/projects', {
    method: 'POST',
    body: JSON.stringify({ name, type, remark }),
  });
  
  if (error) {
    console.error('创建项目失败:', error);
    return null;
  }
  
  if (!data?.project) return null;
  return dbToProjectData(data.project);
}

// 更新项目数据
export async function updateProjectData(projectData: ProjectData): Promise<boolean> {
  const { error } = await apiRequest(`/projects/${projectData.project.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: projectData.project.name,
      remark: projectData.project.remark,
      core_config: projectData.coreConfig,
      daily_expenses: projectData.dailyExpenses,
      other_expenses: projectData.otherExpenses,
    }),
  });
  
  if (error) {
    console.error('更新项目失败:', error);
    return false;
  }
  
  return true;
}

// 删除项目
export async function deleteProject(projectId: string): Promise<boolean> {
  const { error } = await apiRequest(`/projects/${projectId}`, {
    method: 'DELETE',
  });
  
  if (error) {
    console.error('删除项目失败:', error);
    return false;
  }
  
  return true;
}

// 复制项目
export async function copyProject(projectId: string): Promise<ProjectData | null> {
  const { data, error } = await apiRequest<{ project: DbProject }>(`/projects/${projectId}/copy`, {
    method: 'POST',
  });
  
  if (error) {
    console.error('复制项目失败:', error);
    return null;
  }
  
  if (!data?.project) return null;
  return dbToProjectData(data.project);
}

// 更新项目名称
export async function updateProjectName(projectId: string, name: string): Promise<boolean> {
  const { error } = await apiRequest(`/projects/${projectId}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });
  
  if (error) {
    console.error('更新项目名称失败:', error);
    return false;
  }
  
  return true;
}

// 获取回收站项目列表
export async function getTrashProjects(): Promise<Project[]> {
  const { data, error } = await apiRequest<{ projects: Project[] }>('/trash');
  if (error) {
    console.error('获取回收站列表失败:', error);
    return [];
  }
  return data?.projects || [];
}

// 恢复项目
export async function restoreProject(projectId: string): Promise<boolean> {
  const { error } = await apiRequest(`/trash/${projectId}`, {
    method: 'POST',
  });
  
  if (error) {
    console.error('恢复项目失败:', error);
    return false;
  }
  
  return true;
}

// 永久删除项目
export async function permanentDeleteProject(projectId: string): Promise<boolean> {
  const { error } = await apiRequest(`/trash/${projectId}`, {
    method: 'DELETE',
  });
  
  if (error) {
    console.error('永久删除项目失败:', error);
    return false;
  }
  
  return true;
}

// 获取文件夹列表
export async function getFolders(): Promise<Folder[]> {
  const { data, error } = await apiRequest<{ folders: Folder[] }>('/folders');
  if (error) {
    console.error('获取文件夹列表失败:', error);
    return [];
  }
  return data?.folders || [];
}

// 创建文件夹
export async function createFolder(name: string, parentId?: string): Promise<Folder | null> {
  const { data, error } = await apiRequest<{ folder: Folder }>('/folders', {
    method: 'POST',
    body: JSON.stringify({ name, parentId }),
  });
  
  if (error) {
    console.error('创建文件夹失败:', error);
    return null;
  }
  
  return data?.folder || null;
}

// 更新文件夹
export async function updateFolder(folderId: string, name: string): Promise<boolean> {
  const { error } = await apiRequest(`/folders/${folderId}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });
  
  if (error) {
    console.error('更新文件夹失败:', error);
    return false;
  }
  
  return true;
}

// 删除文件夹
export async function deleteFolder(folderId: string): Promise<boolean> {
  const { error } = await apiRequest(`/folders/${folderId}`, {
    method: 'DELETE',
  });
  
  if (error) {
    console.error('删除文件夹失败:', error);
    return false;
  }
  
  return true;
}

// 批量操作项目
export async function batchOperateProjects(
  action: 'delete' | 'move' | 'copy',
  projectIds: string[],
  targetFolderId?: string | null
): Promise<{ success: boolean; count: number }> {
  const { data, error } = await apiRequest<{ success: boolean; count: number }>('/projects/batch', {
    method: 'POST',
    body: JSON.stringify({ action, projectIds, targetFolderId }),
  });
  
  if (error) {
    console.error('批量操作失败:', error);
    return { success: false, count: 0 };
  }
  
  return data || { success: false, count: 0 };
}

// 批量恢复项目
export async function batchRestoreProjects(projectIds: string[]): Promise<{ success: boolean; count: number }> {
  const { data, error } = await apiRequest<{ success: boolean; count: number }>('/trash/batch', {
    method: 'POST',
    body: JSON.stringify({ action: 'restore', projectIds }),
  });
  
  if (error) {
    console.error('批量恢复失败:', error);
    return { success: false, count: 0 };
  }
  
  return data || { success: false, count: 0 };
}

// 批量永久删除项目
export async function batchDeleteProjects(projectIds: string[]): Promise<{ success: boolean; count: number }> {
  const { data, error } = await apiRequest<{ success: boolean; count: number }>('/trash/batch', {
    method: 'POST',
    body: JSON.stringify({ action: 'delete', projectIds }),
  });
  
  if (error) {
    console.error('批量永久删除失败:', error);
    return { success: false, count: 0 };
  }
  
  return data || { success: false, count: 0 };
}
