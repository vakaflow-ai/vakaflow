import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'

// Pages
import Login from './pages/Login'
import AgentSubmission from './pages/AgentSubmission'
import AgentDetail from './pages/AgentDetail'
import ReviewerDashboard from './pages/ReviewerDashboard'
import ReviewInterface from './pages/ReviewInterface'
import AgentCatalog from './pages/AgentCatalog'
import AdminDashboard from './pages/AdminDashboard'
import AnalyticsDashboard from './pages/AnalyticsDashboard'
import AIPostureDashboard from './pages/AIPostureDashboard'
import EcosystemMap from './pages/EcosystemMap'
import AuditTrail from './pages/AuditTrail'
import VendorDashboard from './pages/VendorDashboard'
import VendorTrustCenterManagement from './pages/VendorTrustCenterManagement'
import PolicyManagement from './pages/PolicyManagement'
import RulesManagement from './pages/RulesManagement'
import UserManagement from './pages/UserManagement'
import RolePermissions from './pages/RolePermissions'
import MySubmissions from './pages/MySubmissions'
import Messages from './pages/Messages'
// ApproverDashboard removed - functionality consolidated into MyActions
import ApprovalInterface from './pages/ApprovalInterface'
import OffboardingManagement from './pages/OffboardingManagement'
import IntegrationManagement from './pages/IntegrationManagement'
import IntegrationDetail from './pages/IntegrationDetail'
import MFASettings from './pages/MFASettings'
import Recommendations from './pages/Recommendations'
import WebhookManagement from './pages/WebhookManagement'
import ExportData from './pages/ExportData'
import PredictiveAnalytics from './pages/PredictiveAnalytics'
import ApplicationLogs from './pages/ApplicationLogs'
import Marketplace from './pages/Marketplace'
import Tickets from './pages/Tickets'
import TenantManagement from './pages/TenantManagement'
import ComplianceChecks from './pages/ComplianceChecks'
import SubmissionRequirementsManagement from './pages/SubmissionRequirementsManagement'
import AssessmentsManagement from './pages/AssessmentsManagement'
import AssessmentAssignmentPage from './pages/AssessmentAssignment'
import AssessmentApprover from './pages/AssessmentApprover'
import QuestionLibrary from './pages/QuestionLibrary'
import MyActions from './pages/MyActions'
import AssessmentAnalytics from './pages/AssessmentAnalytics'
import AgentConnections from './pages/AgentConnections'
import WorkflowManagement from './pages/WorkflowManagement'
import InviteVendor from './pages/InviteVendor'
import VendorRegistration from './pages/VendorRegistration'
import MyVendors from './pages/MyVendors'
import PlatformConfiguration from './pages/PlatformConfiguration'
import ClusterNodeManagement from './pages/ClusterNodeManagement'
import FormDesignerList from './pages/FormDesignerList'
import FormDesignerEditor from './pages/FormDesignerEditor'
import MasterData from './pages/MasterData'
import Studio from './pages/Studio'
import Profile from './pages/Profile'
import TenantSettings from './pages/TenantSettings'
import TrustCenter from './pages/TrustCenter'
import MyInterests from './pages/MyInterests'
import MyFollowing from './pages/MyFollowing'
import CVEDashboard from './pages/CVEDashboard'
import CVEDetail from './pages/CVEDetail'
import CVESettings from './pages/CVESettings'
import VendorSecurity from './pages/VendorSecurity'
import CustomFields from './pages/CustomFields'
import MyAssessments from './pages/MyAssessments'

const queryClient = new QueryClient()

function App() {
  // Branding is now handled by Layout.tsx based on user role

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 4000,
            iconTheme: {
              primary: '#4ade80',
              secondary: '#fff',
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Routes>
          <Route path="/" element={<Navigate to="/my-actions" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/agents/new" element={<AgentSubmission />} />
          <Route path="/agents/:id" element={<AgentDetail />} />
          <Route path="/agents/:agentId/connections" element={<AgentConnections />} />
          <Route path="/agent-connections" element={<Navigate to="/agents" replace />} />
          <Route path="/agents" element={<Navigate to="/my-actions" replace />} />
          <Route path="/reviews" element={<ReviewerDashboard />} />
          <Route path="/reviews/:id" element={<ReviewInterface />} />
          <Route path="/catalog" element={<AgentCatalog />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/policies" element={<PolicyManagement />} />
          <Route path="/admin/rules" element={<RulesManagement />} />
          <Route path="/admin/users" element={<UserManagement />} />
          <Route path="/admin/role-permissions" element={<RolePermissions />} />
          <Route path="/admin/custom-fields" element={<CustomFields />} />
          <Route path="/admin/tenants" element={<TenantManagement />} />
          <Route path="/admin/workflows" element={<WorkflowManagement />} />
          <Route path="/admin/integrations" element={<IntegrationManagement />} />
          <Route path="/workflows" element={<WorkflowManagement />} />
          <Route path="/form-designer" element={<FormDesignerList />} />
          <Route path="/compliance/:agentId" element={<ComplianceChecks />} />
          <Route path="/compliance" element={<ComplianceChecks />} />
          <Route path="/frameworks" element={<Navigate to="/compliance" replace />} />
          <Route path="/cve/settings" element={<CVESettings />} />
          <Route path="/cve/:id" element={<CVEDetail />} />
          <Route path="/cve" element={<CVEDashboard />} />
          <Route path="/vendors/:vendorId/security" element={<VendorSecurity />} />
          <Route path="/admin/question-library" element={<QuestionLibrary />} />
          <Route path="/question-library" element={<Navigate to="/admin/question-library" replace />} />
          <Route path="/admin/submission-requirements" element={<SubmissionRequirementsManagement />} />
          <Route path="/submission-requirements" element={<Navigate to="/admin/submission-requirements" replace />} />
          <Route path="/admin/assessments" element={<AssessmentsManagement />} />
          <Route path="/assessments/analytics" element={<AssessmentAnalytics />} />
          <Route path="/assessments/review/:id" element={<AssessmentApprover />} />
          <Route path="/assessments/assignments/:id" element={<AssessmentAssignmentPage />} />
          <Route path="/assessments/:id" element={<AssessmentAssignmentPage />} />
          <Route path="/my-assessments" element={<MyAssessments />} />
          <Route path="/assessments" element={<Navigate to="/admin/assessments" replace />} />
          <Route path="/admin/form-designer" element={<FormDesignerList />} />
          <Route path="/admin/form-designer/new" element={<FormDesignerEditor />} />
          <Route path="/admin/form-designer/:id" element={<FormDesignerEditor />} />
          <Route path="/admin/master-data" element={<MasterData />} />
          <Route path="/analytics" element={<AnalyticsDashboard />} />
          <Route path="/ai-posture" element={<AIPostureDashboard />} />
          <Route path="/ecosystem-map" element={<EcosystemMap />} />
          <Route path="/vendor-dashboard" element={<VendorDashboard />} />
          <Route path="/vendor/trust-center" element={<VendorTrustCenterManagement />} />
          <Route path="/audit" element={<AuditTrail />} />
          <Route path="/submissions" element={<MySubmissions />} />
          <Route path="/my-actions" element={<MyActions />} />
          <Route path="/messages" element={<Messages />} />
          {/* Approvals route removed - consolidated into /my-actions with filterType=approval */}
          <Route path="/approvals/:id" element={<ApprovalInterface />} />
          <Route path="/offboarding" element={<OffboardingManagement />} />
          <Route path="/integrations" element={<IntegrationManagement />} />
          <Route path="/integrations/:id" element={<IntegrationDetail />} />
          <Route path="/mfa" element={<MFASettings />} />
          <Route path="/recommendations/:agentId" element={<Recommendations />} />
          <Route path="/webhooks" element={<WebhookManagement />} />
          <Route path="/export" element={<ExportData />} />
          <Route path="/predictive/:agentId" element={<PredictiveAnalytics />} />
          <Route path="/logs" element={<ApplicationLogs />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/tickets" element={<Tickets />} />
          <Route path="/tickets/:id" element={<Tickets />} />
          <Route path="/invite-vendor" element={<InviteVendor />} />
          <Route path="/vendor/register" element={<VendorRegistration />} />
          <Route path="/my-vendors" element={<MyVendors />} />
          <Route path="/admin/platform-config" element={<PlatformConfiguration />} />
          <Route path="/admin/cluster-nodes" element={<ClusterNodeManagement />} />
          <Route path="/studio" element={<Studio />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/admin/tenant-settings" element={<TenantSettings />} />
          <Route path="/trust-center/:vendorIdentifier" element={<TrustCenter />} />
          <Route path="/my-interests" element={<MyInterests />} />
          <Route path="/my-following" element={<MyFollowing />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
