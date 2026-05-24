# 解决注册邮件验证问题

## 问题描述

用户注册后没有收到验证邮件。

## 原因

Supabase 默认开启邮箱验证功能，用户注册后需要点击邮件中的链接才能激活账户。Supabase 免费版的邮件发送有限制，可能导致邮件延迟或无法送达。

---

## 解决方案

### 方案一：关闭邮箱验证（推荐）✅

**这是最简单的方案，用户注册后可直接登录。**

#### 操作步骤

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 左侧菜单进入 **Authentication** → **Providers**
4. 找到 **Email** 提供商，点击右侧的设置图标（齿轮）
5. 找到 **Confirm email** 选项，**关闭**它
6. 点击 **Save** 保存

![Supabase 关闭邮箱验证](https://supabase.com/docs/img/guides/auth/auth-email-confirmation.png)

关闭后，用户注册成功即可直接登录，无需等待邮件验证。

---

### 方案二：配置自定义 SMTP 服务器

如果需要邮箱验证功能，建议配置自己的 SMTP 服务器。

#### 腾讯企业邮箱配置

1. 在 Supabase Dashboard 进入 **Project Settings** → **Authentication**
2. 找到 **SMTP Settings** 部分
3. 开启 **Enable Custom SMTP**
4. 填写以下配置：

| 字段 | 值 |
|------|-----|
| Host | `smtp.exmail.qq.com` |
| Port | `465` |
| User | 你的企业邮箱地址 |
| Pass | 邮箱密码或授权码 |
| Sender email | 发件人邮箱地址 |
| Sender name | `研学旅行成本核算` |

#### QQ 邮箱配置

| 字段 | 值 |
|------|-----|
| Host | `smtp.qq.com` |
| Port | `465` |
| User | 你的QQ邮箱 |
| Pass | QQ邮箱授权码（不是QQ密码） |

**获取QQ邮箱授权码：**
1. 登录 QQ 邮箱网页版
2. 设置 → 账户 → POP3/SMTP 服务
3. 开启服务，生成授权码

#### 163 邮箱配置

| 字段 | 值 |
|------|-----|
| Host | `smtp.163.com` |
| Port | `465` |
| User | 你的163邮箱 |
| Pass | 客户端授权密码 |

---

### 方案三：手动验证用户

如果用户已注册但未收到邮件，管理员可以手动验证。

#### 操作步骤

1. 在 Supabase Dashboard 进入 **Authentication** → **Users**
2. 找到状态为 `Waiting for verification` 的用户
3. 点击用户行右侧的 **...** 按钮
4. 选择 **Confirm user** 或 **Delete user**

---

## 检查邮件是否被拦截

提醒用户检查：

1. **垃圾邮件文件夹** - 邮件可能被误判为垃圾邮件
2. **邮箱拦截** - 企业邮箱可能有安全策略拦截
3. **邮件规则** - 是否有自动归档或删除规则

邮件发件人通常是：`noreply@mail.supabase.io` 或你配置的自定义发件人地址。

---

## 当前代码行为

代码已更新，支持两种情况：

- **邮箱验证关闭**：注册成功后自动登录，关闭对话框
- **邮箱验证开启**：显示提示信息，引导用户检查邮件后登录

---

## 常见错误

| 错误信息 | 原因 | 解决方案 |
|---------|------|---------|
| `User already registered` | 邮箱已注册 | 直接登录或使用其他邮箱 |
| `Email not confirmed` | 邮箱未验证 | 手动验证或关闭邮箱验证 |
| `Signups not allowed` | 禁止注册 | 检查 Supabase 设置 |

---

## 推荐配置

对于研学旅行成本核算系统，推荐：

1. **关闭邮箱验证**（简化用户流程）
2. 或者使用 **腾讯企业邮箱 SMTP**（稳定可靠）
3. 设置密码强度要求（至少6位）

这样用户体验最佳，无需等待邮件验证。
