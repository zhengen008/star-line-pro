-- Starline B2B OA System - PostgreSQL Database Schema
-- 共 14 张表，与 server/prisma/schema.prisma 保持一致
-- Execute this script to create all tables with correct fields

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. 员工表 (Employee)
-- Source: Employee_export.csv
-- ============================================================
CREATE TABLE employees (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    employee_id VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    department VARCHAR(100) NOT NULL,
    position VARCHAR(100),
    employment_type VARCHAR(50) DEFAULT '全职', -- 全职, 兼职, 合同工, 实习
    base_salary DECIMAL(12, 2),
    status VARCHAR(50) DEFAULT '在职', -- 在职, 离职, 试用期
    role VARCHAR(50) DEFAULT '普通员工', -- 管理员, 审核员, 普通员工, 查看者
    email VARCHAR(255),
    join_date VARCHAR(50),
    created_by VARCHAR(255),
    created_by_id VARCHAR(100),
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_employees_employee_id ON employees(employee_id);
CREATE INDEX idx_employees_name ON employees(name);
CREATE INDEX idx_employees_department ON employees(department);

-- ============================================================
-- 2. 部门表 (Department)
-- Source: Department_export.csv
-- ============================================================
CREATE TABLE departments (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50),
    head VARCHAR(100),
    head_open_id VARCHAR(100),
    feishu_dept_id VARCHAR(100) UNIQUE,
    parent_dept_id VARCHAR(100),
    member_count INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT '启用', -- 启用, 停用
    created_by VARCHAR(255),
    created_by_id VARCHAR(100),
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_departments_feishu_dept_id ON departments(feishu_dept_id);
CREATE INDEX idx_departments_parent_dept_id ON departments(parent_dept_id);

-- ============================================================
-- 3. 角色权限表 (Role)
-- Source: Role_export.csv
-- ============================================================
CREATE TABLE roles (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    color VARCHAR(20) DEFAULT 'blue', -- purple, blue, green, gray
    permissions TEXT, -- JSON 格式的权限矩阵
    is_system BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    created_by VARCHAR(255),
    created_by_id VARCHAR(100),
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_roles_sort_order ON roles(sort_order);

-- ============================================================
-- 4. 商机/投标表 (Bid)
-- Source: Bid_export.csv
-- ============================================================
CREATE TABLE bids (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    project_name VARCHAR(255) NOT NULL,
    customer_name VARCHAR(255),
    bid_form VARCHAR(50), -- 公开竞标, 客户指定
    bid_stage VARCHAR(50), -- 报名, 开标中, 竞标结束
    project_type VARCHAR(100),
    signup_date VARCHAR(50),
    open_date VARCHAR(50),
    open_form VARCHAR(50), -- 线上, 线下
    open_location VARCHAR(255),
    bid_amount DECIMAL(12, 2),
    deposit_amount DECIMAL(12, 2),
    manager VARCHAR(100),
    result VARCHAR(50) DEFAULT '弃标', -- 弃标, 流标, 未中标, 中标
    payment_method VARCHAR(50), -- 月付, 季付, 半年付, 结束后支付, 里程碑付款, 验收付款
    contract_files TEXT, -- JSON 格式 [{url, name, size}]
    proposal_files TEXT, -- JSON 格式 [{url, name, size}]
    quotation_files TEXT, -- JSON 格式 [{url, name, size}] -- 报价文件
    created_by VARCHAR(255),
    created_by_id VARCHAR(100),
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bids_customer_name ON bids(customer_name);
CREATE INDEX idx_bids_manager ON bids(manager);

-- ============================================================
-- 5. 项目表 (Project)
-- Source: Project_export.csv
-- ============================================================
CREATE TABLE projects (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    project_id VARCHAR(100) UNIQUE,
    bid_id VARCHAR(36),
    name VARCHAR(255) NOT NULL,
    contract_no VARCHAR(100),
    project_type VARCHAR(100),
    customer VARCHAR(255) NOT NULL,
    start_date VARCHAR(50),
    end_date VARCHAR(50),
    contract_amount DECIMAL(12, 2),
    budget_cost DECIMAL(12, 2),
    remaining_budget DECIMAL(12, 2),
    manager VARCHAR(100),
    members TEXT[], -- 项目成员数组
    payment_method VARCHAR(50), -- 里程碑付款, 月结, 验收付款, 预付款, 季付
    status VARCHAR(50) DEFAULT '立项审批中', -- 待立项, 立项审批中, 已立项, 执行中, 完成审批中, 已完成, 已归档
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at VARCHAR(50),
    deleted_by VARCHAR(100),
    created_by VARCHAR(255),
    created_by_id VARCHAR(100),
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bid_id) REFERENCES bids(id) ON DELETE SET NULL
);

CREATE INDEX idx_projects_project_id ON projects(project_id);
CREATE INDEX idx_projects_customer ON projects(customer);
CREATE INDEX idx_projects_manager ON projects(manager);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_bid_id ON projects(bid_id);

-- ============================================================
-- 6. 项目日志表 (ProjectLog)
-- Source: ProjectLog_export.csv
-- ============================================================
CREATE TABLE project_logs (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    project_id VARCHAR(36) NOT NULL,
    action VARCHAR(100) NOT NULL,
    detail TEXT,
    operator VARCHAR(100),
    created_by VARCHAR(255),
    created_by_id VARCHAR(100),
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX idx_project_logs_project_id ON project_logs(project_id);
CREATE INDEX idx_project_logs_created_date ON project_logs(created_date);

-- ============================================================
-- 7. 审批表 (Approval)
-- Source: Approval_export.csv
-- ============================================================
CREATE TABLE approvals (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    title VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- reimbursement, purchase, project_payment, project_init, invoice, contract, seal, expense
    type_label VARCHAR(100),
    sub_type VARCHAR(100),
    applicant VARCHAR(100),
    dept VARCHAR(100),
    fields TEXT, -- JSON 格式的表单字段
    amount DECIMAL(12, 2),
    direction VARCHAR(20), -- 收入, 支出, 无
    project_id VARCHAR(36),
    project_name VARCHAR(255),
    status VARCHAR(50) DEFAULT '待审核', -- 待审核, 审核中, 已通过, 已拒绝, 已付款
    cc_list TEXT[], -- 抄送人列表
    steps TEXT, -- JSON 格式的审批步骤 [{name, actor, role, done, passed, time}]
    workflow_id VARCHAR(36),
    related_project_id VARCHAR(36),
    created_by VARCHAR(255),
    created_by_id VARCHAR(100),
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_approvals_type ON approvals(type);
CREATE INDEX idx_approvals_applicant ON approvals(applicant);
CREATE INDEX idx_approvals_status ON approvals(status);
CREATE INDEX idx_approvals_project_id ON approvals(project_id);

-- ============================================================
-- 8. 项目审批表 (ProjectApproval)
-- Source: ProjectApproval_export.csv
-- ============================================================
CREATE TABLE project_approvals (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    project_id VARCHAR(36) NOT NULL,
    project_name VARCHAR(255),
    type VARCHAR(50) NOT NULL, -- reimbursement, income, expense
    type_label VARCHAR(100),
    title VARCHAR(255) NOT NULL,
    fields TEXT, -- JSON 格式
    direction VARCHAR(20), -- 收入, 支出
    amount DECIMAL(12, 2),
    applicant VARCHAR(100),
    status VARCHAR(50) DEFAULT '待审核', -- 待审核, 审核中, 已通过, 已拒绝
    created_by VARCHAR(255),
    created_by_id VARCHAR(100),
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX idx_project_approvals_project_id ON project_approvals(project_id);
CREATE INDEX idx_project_approvals_status ON project_approvals(status);

-- ============================================================
-- 9. 工作流模板表 (WorkflowTemplate)
-- Source: WorkflowTemplate_export.csv
-- ============================================================
CREATE TABLE workflow_templates (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    approval_type VARCHAR(100), -- project_init, reimbursement, contract 等
    nodes TEXT, -- JSON 格式的节点数据 [{id, type, x, y, label, config}]
    connections TEXT, -- JSON 格式的连线数据 [{id, from, to}]
    status VARCHAR(50) DEFAULT '草稿', -- 草稿, 已发布, 已归档
    created_by VARCHAR(255),
    created_by_id VARCHAR(100),
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_workflow_templates_status ON workflow_templates(status);

-- ============================================================
-- 10. 公告表 (Notice)
-- Source: Notice_export.csv
-- ============================================================
CREATE TABLE notices (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(50) DEFAULT '公告', -- 公告, 制度, 活动, 新闻
    is_pinned BOOLEAN DEFAULT FALSE,
    expires_at VARCHAR(50),
    published_by VARCHAR(100),
    status VARCHAR(50) DEFAULT '已发布', -- 草稿, 已发布, 已撤回
    read_by TEXT[], -- 已读人员列表
    feishu_sent BOOLEAN DEFAULT FALSE,
    created_by VARCHAR(255),
    created_by_id VARCHAR(100),
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notices_category ON notices(category);
CREATE INDEX idx_notices_status ON notices(status);
CREATE INDEX idx_notices_is_pinned ON notices(is_pinned);

-- ============================================================
-- 11. 通知表 (Notification)
-- Source: Notification_export.csv
-- ============================================================
CREATE TABLE notifications (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    recipient VARCHAR(100) NOT NULL,
    recipient_open_id VARCHAR(100),
    type VARCHAR(50) NOT NULL, -- notice, approval_pending, approval_result, approval_cc, project_status, system
    title VARCHAR(255) NOT NULL,
    content TEXT,
    link VARCHAR(500),
    related_id VARCHAR(36),
    is_read BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    feishu_sent BOOLEAN DEFAULT FALSE,
    priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high
    created_by VARCHAR(255),
    created_by_id VARCHAR(100),
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);

-- ============================================================
-- 12. 横幅/轮播图表 (Banner)
-- Source: Banner_export.csv
-- ============================================================
CREATE TABLE banners (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    image_url VARCHAR(500),
    title VARCHAR(255),
    link VARCHAR(500),
    "order" INTEGER DEFAULT 0,
    created_by VARCHAR(255),
    created_by_id VARCHAR(100),
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_banners_order ON banners("order");

-- ============================================================
-- 13. 打卡记录表 (CheckIn)
-- Source: CheckIn_export.csv
-- ============================================================
CREATE TABLE check_ins (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id VARCHAR(100), -- 用户名或ID
    date VARCHAR(20), -- YYYY-MM-DD 格式
    created_by VARCHAR(255),
    created_by_id VARCHAR(100),
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_check_ins_user_id ON check_ins(user_id);
CREATE INDEX idx_check_ins_date ON check_ins(date);

-- ============================================================
-- 14. 备忘录表 (Memo) - 工作台便签
-- ============================================================
CREATE TABLE memos (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    owner VARCHAR(100), -- 所有者（员工姓名）
    content TEXT, -- 富文本 HTML，图片为 OSS URL 或 base64
    color VARCHAR(20) DEFAULT 'yellow', -- yellow, pink, green, blue, purple
    created_by VARCHAR(255),
    created_by_id VARCHAR(100),
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_memos_owner ON memos(owner);

-- ============================================================
-- 15. 执行内容表 (ExecutionItem) - 项目执行内容（Excel 导入）
-- 一条项目对应多条执行内容
-- ============================================================
CREATE TABLE execution_items (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    project_id VARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    seq_id VARCHAR(50), -- 序号ID（Excel 导入）
    project_name VARCHAR(255), -- 项目名称
    content VARCHAR(500) NOT NULL, -- 内容
    detail TEXT, -- 详细说明
    unit VARCHAR(50), -- 单位
    quantity DECIMAL(14, 2), -- 数量
    init_price DECIMAL(14, 2), -- 立项金额单价（含税）
    init_total DECIMAL(14, 2), -- 立项金额总价（含税）
    budget_price DECIMAL(14, 2), -- 预算金额单价（含税）
    budget_total DECIMAL(14, 2), -- 预算金额总价（含税）
    created_by VARCHAR(255),
    created_by_id VARCHAR(100),
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_execution_items_project_id ON execution_items(project_id);

-- ============================================================
-- 16. 供应商明细表 (SupplierItem) - 执行内容下的供应商
-- 一条执行内容对应多条供应商明细
-- ============================================================
CREATE TABLE supplier_items (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    execution_item_id VARCHAR(36) NOT NULL REFERENCES execution_items(id) ON DELETE CASCADE,
    supplier_name VARCHAR(255) NOT NULL, -- 供应商名称
    cost_detail TEXT, -- 成本明细（金额）
    remark TEXT, -- 备注
    contract_file TEXT, -- 合同归档（文件 JSON）
    invoice_file TEXT, -- 发票归档（文件 JSON）
    created_by VARCHAR(255),
    created_by_id VARCHAR(100),
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_supplier_items_execution_item_id ON supplier_items(execution_item_id);

-- ============================================================
-- 触发器：自动更新 updated_date
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_date_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_date = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_employees_updated_date BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION update_updated_date_column();
CREATE TRIGGER update_departments_updated_date BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION update_updated_date_column();
CREATE TRIGGER update_roles_updated_date BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION update_updated_date_column();
CREATE TRIGGER update_bids_updated_date BEFORE UPDATE ON bids FOR EACH ROW EXECUTE FUNCTION update_updated_date_column();
CREATE TRIGGER update_projects_updated_date BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_date_column();
CREATE TRIGGER update_approvals_updated_date BEFORE UPDATE ON approvals FOR EACH ROW EXECUTE FUNCTION update_updated_date_column();
CREATE TRIGGER update_project_approvals_updated_date BEFORE UPDATE ON project_approvals FOR EACH ROW EXECUTE FUNCTION update_updated_date_column();
CREATE TRIGGER update_workflow_templates_updated_date BEFORE UPDATE ON workflow_templates FOR EACH ROW EXECUTE FUNCTION update_updated_date_column();
CREATE TRIGGER update_notices_updated_date BEFORE UPDATE ON notices FOR EACH ROW EXECUTE FUNCTION update_updated_date_column();
CREATE TRIGGER update_notifications_updated_date BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION update_updated_date_column();
CREATE TRIGGER update_banners_updated_date BEFORE UPDATE ON banners FOR EACH ROW EXECUTE FUNCTION update_updated_date_column();
CREATE TRIGGER update_memos_updated_date BEFORE UPDATE ON memos FOR EACH ROW EXECUTE FUNCTION update_updated_date_column();
CREATE TRIGGER update_execution_items_updated_date BEFORE UPDATE ON execution_items FOR EACH ROW EXECUTE FUNCTION update_updated_date_column();
CREATE TRIGGER update_supplier_items_updated_date BEFORE UPDATE ON supplier_items FOR EACH ROW EXECUTE FUNCTION update_updated_date_column();

-- ============================================================
-- 初始数据
-- ============================================================

-- 默认角色
INSERT INTO roles (name, description, color, is_system, sort_order) VALUES
('管理员', '系统管理员，拥有所有权限', 'purple', TRUE, 1),
('审核员', '负责审批业务流程', 'blue', TRUE, 2),
('普通员工', '普通员工，基本查看权限', 'green', TRUE, 3),
('查看者', '仅查看权限', 'gray', TRUE, 4);

-- 默认工作流模板（项目立项已改为免审批，不再需要立项审批流模板）

COMMENT ON TABLE employees IS '员工信息表';
COMMENT ON TABLE departments IS '部门组织架构表';
COMMENT ON TABLE roles IS '角色权限表';
COMMENT ON TABLE bids IS '商机投标表';
COMMENT ON TABLE projects IS '项目管理表';
COMMENT ON TABLE project_logs IS '项目操作日志表';
COMMENT ON TABLE approvals IS '审批流程表';
COMMENT ON TABLE project_approvals IS '项目专属审批表';
COMMENT ON TABLE workflow_templates IS '工作流模板表';
COMMENT ON TABLE notices IS '公告通知表';
COMMENT ON TABLE notifications IS '用户通知表';
COMMENT ON TABLE banners IS '横幅轮播图表';
COMMENT ON TABLE check_ins IS '员工打卡记录表';
COMMENT ON TABLE memos IS '备忘录便签表';
COMMENT ON TABLE execution_items IS '项目执行内容表';
COMMENT ON TABLE supplier_items IS '执行内容供应商明细表';
