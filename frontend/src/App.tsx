import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { DialogProvider } from './contexts/DialogContext'

// Pages
import Login from './pages/Login'
import AgentSubmission from './pages/AgentSubmission'
import AgentDetail from './pages/AgentDetail'
import { WorkflowPageRoute } from './components/workflow/WorkflowPageRoute'
import ReviewerDashboard from './pages/ReviewerDashboard'
import ReviewInterface from './pages/ReviewInterface'
import AgentCatalog from './pages/AgentCatalog'
import AdminDashboard from './pages/AdminDashboard'
import AnalyticsDashboard from './pages/AnalyticsDashboard'
import AIPostureDashboard from './pages/AIPostureDashboard'
import EcosystemMap from './pages/EcosystemMap'
import EcosystemMapV2 from './pages/EcosystemMapV2'
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
import GenericApprover from './pages/GenericApprover'
import QuestionLibrary from './pages/QuestionLibrary'
import QuestionLibraryEdit from './pages/QuestionLibraryEdit'
import MyActions from './pages/MyActions'
import AssessmentAnalytics from './pages/AssessmentAnalytics'
import AgentConnections from './pages/AgentConnections'
import WorkflowManagement from './pages/WorkflowManagement'
import UnifiedWorkflowManagement from './pages/UnifiedWorkflowManagement'
import StandardizedWorkflows from './pages/StandardizedWorkflows'
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
import SuppliersMasterView from './pages/SuppliersMasterView'
import VendorProfile from './pages/VendorProfile'
import PlatformArchitecture from './pages/PlatformArchitecture'
import Products from './pages/Products'
import Services from './pages/Services'
import WorkflowTemplates from './pages/WorkflowTemplates'
import IncidentReports from './pages/IncidentReports'
import WorkflowAnalytics from './pages/WorkflowAnalytics'
import OnboardingHub from './pages/OnboardingHub'
import ProductOnboarding from './pages/ProductOnboarding'
import ServiceOnboarding from './pages/ServiceOnboarding'
import VendorOnboarding from './pages/VendorOnboarding'
import AssessmentReviewInterface from './pages/AssessmentReviewInterface'

const queryClient = new QueryClient()

// Component to handle redirect from old route format
// Note: This route accepts either assignment IDs or question response IDs
// If it's a question response ID, it will show an error that the assignment wasn't found
function AssessmentAssignmentRedirect() {
  const { id } = useParams<{ id: string }>()
  // Try to redirect to the assignment page
  // If the ID is actually a question response ID, the AssignmentAssignmentPage will show an appropriate error
  return <Navigate to={`/assessments/assignments/${id}`} replace />
}

function App() {
  // Branding is now handled by Layout.tsx based on user role

  return (
    <QueryClientProvider client={queryClient}>
      <DialogProvider>
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
          <Route path="/admin/entity-fields" element={<CustomFields />} />
          <Route path="/admin/tenants" element={<TenantManagement />} />
          <Route path="/admin/workflows" element={<WorkflowManagement />} />
          <Route path="/admin/integrations" element={<IntegrationManagement />} />
          <Route path="/admin/logs" element={<ApplicationLogs />} />
          <Route path="/admin/export" element={<ExportData />} />
          <Route path="/admin/webhooks" element={<WebhookManagement />} />
          <Route path="/admin/predictive" element={<PredictiveAnalytics />} />
          <Route path="/admin/recommendations" element={<Recommendations />} />
          <Route path="/admin/audit" element={<AuditTrail />} />
          <Route path="/workflow-configs/:id" element={<WorkflowManagement />} />
          <Route path="/workflows/templates" element={<WorkflowTemplates />} />
          <Route path="/workflows/analytics" element={<WorkflowAnalytics />} />
          <Route path="/workflows" element={<StandardizedWorkflows />} />
          <Route path="/form-designer" element={<FormDesignerList />} />
          <Route path="/compliance/:agentId" element={<ComplianceChecks />} />
          <Route path="/compliance" element={<ComplianceChecks />} />
          <Route path="/frameworks" element={<Navigate to="/compliance" replace />} />
          <Route path="/cve/settings" element={<CVESettings />} />
          <Route path="/admin/cve/settings" element={<CVESettings />} />
          <Route path="/admin/cve/dashboard" element={<CVEDashboard />} />
          <Route path="/cve/:id" element={<CVEDetail />} />
          <Route path="/admin/cve/:id" element={<CVEDetail />} />
          <Route path="/cve" element={<CVEDashboard />} />
          <Route path="/vendors/:vendorId/security" element={<VendorSecurity />} />
          <Route path="/admin/question-library" element={<QuestionLibrary />} />
          <Route path="/admin/question-library/:id/edit" element={<QuestionLibraryEdit />} />
          <Route path="/question-library" element={<Navigate to="/admin/question-library" replace />} />
          <Route path="/admin/submission-requirements" element={<SubmissionRequirementsManagement />} />
          <Route path="/submission-requirements" element={<Navigate to="/admin/submission-requirements" replace />} />
          <Route path="/admin/assessments" element={<AssessmentsManagement />} />
          <Route path="/assessments/analytics" element={<AssessmentAnalytics />} />
          <Route path="/assessments/review/:assessmentId" element={<AssessmentReviewInterface />} />
          <Route path="/approver/:sourceType/:sourceId" element={<GenericApprover />} />
          <Route path="/assessments/assignments/:id" element={<AssessmentAssignmentPage />} />
          <Route path="/assessments/:id" element={<AssessmentAssignmentPage />} />
          {/* Redirect old route format to new format */}
          <Route path="/assessment_question_responses/:id" element={<AssessmentAssignmentRedirect />} />
          <Route path="/my-assessments" element={<MyAssessments />} />
          <Route path="/assessments" element={<Navigate to="/admin/assessments" replace />} />
          <Route path="/admin/form-designer" element={<FormDesignerList />} />
          <Route path="/admin/form-designer/new" element={<FormDesignerEditor />} />
          <Route path="/admin/form-designer/:id" element={<FormDesignerEditor />} />
          <Route path="/admin/master-data" element={<MasterData />} />
          <Route path="/suppliers-master" element={<SuppliersMasterView />} />
          <Route path="/vendors/:vendorId" element={<VendorProfile />} />
          <Route path="/suppliers-master/:vendorId" element={<VendorProfile />} />
          <Route path="/onboarding" element={<OnboardingHub />} />
          <Route path="/onboarding/product" element={<ProductOnboarding />} />
          <Route path="/onboarding/service" element={<ServiceOnboarding />} />
          <Route path="/onboarding/vendor" element={<VendorOnboarding />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:id" element={<Products />} />
          <Route path="/services" element={<Services />} />
          <Route path="/services/:id" element={<Services />} />
          <Route path="/analytics" element={<AnalyticsDashboard />} />
          <Route path="/ai-posture" element={<AIPostureDashboard />} />
          <Route path="/ecosystem-map" element={<EcosystemMap />} />
          <Route path="/ecosystem-map-v2" element={<EcosystemMapV2 />} />
          <Route path="/vendor-dashboard" element={<VendorDashboard />} />
          <Route path="/vendor/trust-center" element={<VendorTrustCenterManagement />} />
          <Route path="/audit" element={<AuditTrail />} />
          <Route path="/submissions" element={<MySubmissions />} />
          <Route path="/my-actions" element={<MyActions />} />
          <Route path="/messages" element={<Messages />} />
          {/* Universal Workflow Route */}
          <Route path="/workflow/:sourceType/:sourceId" element={<WorkflowPageRoute />} />
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
          <Route path="/incident-reports" element={<IncidentReports />} />
          <Route path="/admin/incident-reports" element={<IncidentReports />} />
          <Route path="/invite-vendor" element={<InviteVendor />} />
          <Route path="/vendor/register" element={<VendorRegistration />} />
          <Route path="/my-vendors" element={<MyVendors />} />
          <Route path="/admin/platform-config" element={<PlatformConfiguration />} />
          <Route path="/admin/cluster-nodes" element={<ClusterNodeManagement />} />
          <Route path="/admin/architecture" element={<PlatformArchitecture />} />
          <Route path="/architecture" element={<PlatformArchitecture />} />
          <Route path="/studio" element={<Studio />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/admin/tenant-settings" element={<TenantSettings />} />
          <Route path="/trust-center/:vendorIdentifier" element={<TrustCenter />} />
          <Route path="/my-interests" element={<MyInterests />} />
          <Route path="/my-following" element={<MyFollowing />} />
          {/* Tenant slug route - must be last to avoid conflicts */}
          <Route path="/:tenantSlug" element={<Login />} />
        </Routes>
      </BrowserRouter>
      </DialogProvider>
    </QueryClientProvider>
  )
}

export default App
