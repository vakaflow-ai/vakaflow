# 🔍 Reviewer Credentials & Workflow Guide

## 📋 Quick Reference

After submitting an agent, you need to use **reviewer accounts** to review it. Here are the available reviewers:

### 🔐 Reviewer Login Credentials

| Role | Email | Password | Review Stage |
|------|-------|----------|--------------|
| **Security Reviewer** | `security@example.com` | `reviewer123` | Security Review |
| **Compliance Reviewer** | `compliance@example.com` | `reviewer123` | Compliance Review |
| **Technical Reviewer** | `technical@example.com` | `reviewer123` | Technical Review |
| **Business Reviewer** | `business@example.com` | `reviewer123` | Business Review |
| **Tenant Admin** | `admin@example.com` | `admin123` | All Stages |

### 📝 Review Workflow Steps

1. **Vendor submits agent** (using `vendor@example.com`)
   - Agent status changes to `submitted`

2. **Security Reviewer** logs in (`security@example.com`)
   - Navigate to **Reviews** → Select agent
   - Create review with stage: `security`
   - Status: `approved` or `rejected`

3. **Compliance Reviewer** logs in (`compliance@example.com`)
   - Navigate to **Reviews** → Select agent
   - Create review with stage: `compliance`
   - Status: `approved` or `rejected`

4. **Technical Reviewer** logs in (`technical@example.com`)
   - Navigate to **Reviews** → Select agent
   - Create review with stage: `technical`
   - Status: `approved` or `rejected`

5. **Business Reviewer** logs in (`business@example.com`)
   - Navigate to **Reviews** → Select agent
   - Create review with stage: `business`
   - Status: `approved` or `rejected`

6. **Final Approval**
   - If all stages are approved, agent status becomes `approved`
   - If any stage is rejected, agent status becomes `rejected`

## 🚀 Quick Setup

Run this script to create all reviewer users:

```bash
./create_reviewers.sh
```

## 🔗 Access Points

- **Login Page**: http://localhost:3000/login
- **Reviewer Dashboard**: After login, go to **Reviews** in navigation
- **Review Interface**: Click on any agent in the reviews list

## 📊 Review Stages

Each review stage has specific responsibilities:

- **Security**: Security vulnerabilities, access controls, encryption
- **Compliance**: Regulatory compliance, data privacy, policies
- **Technical**: Code quality, architecture, performance, scalability
- **Business**: Business value, ROI, alignment with goals

## 💡 Tips

1. **Tenant Admin** can review any stage
2. Each reviewer can only review their assigned stage
3. Reviews can include comments, findings, and recommendations
4. Use the **Comments** tab on agent detail page to communicate with reviewers
5. Check **Messages** for notifications about review status

## 🔄 Testing the Full Workflow

1. Login as vendor (`vendor@example.com`)
2. Submit a new agent
3. Logout and login as security reviewer (`security@example.com`)
4. Go to Reviews → Find the submitted agent → Create review
5. Repeat for other reviewers
6. Check agent status after all reviews complete

