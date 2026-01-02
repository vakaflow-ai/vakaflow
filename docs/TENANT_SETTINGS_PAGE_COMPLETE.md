# Tenant Settings Page - Complete Implementation

## Overview
Created a comprehensive tenant administration page where tenant admins can manage their tenant profile, organization details, and branding.

## Features Implemented

### 1. Tenant Profile Tab
- **Industry Selection**: Dropdown with industries (healthcare, finance, technology, etc.)
  - Affects which assessments, requirements, and frameworks are shown
- **Timezone**: Select from common timezones (UTC, US timezones, international)
- **Locale**: Select language/locale (en, en-US, fr, de, es, etc.)
- **I18N Settings**:
  - Date format (MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD)
  - Time format (12-hour, 24-hour)
  - Currency code

### 2. Organization Details Tab
- **Organization Name**: Update tenant name
- **Contact Information**:
  - Contact Email
  - Contact Name
  - Contact Phone
- **Read-only Information**:
  - Tenant Slug
  - License Tier
  - Status

### 3. Branding Tab
- **Logo Upload**:
  - Upload logo (PNG, SVG, JPG, etc.)
  - Preview before saving
  - Remove logo option
  - Max 2MB recommended
- **Color Scheme**:
  - Primary Color (for buttons, links, primary actions)
  - Secondary Color (for accents, secondary elements)
  - Color picker + hex input
  - Live preview of buttons

## Backend Changes

### New API Endpoints (Tenant Admin Access)

1. **GET /api/v1/tenants/me**
   - Get current user's tenant information
   - Returns full tenant details including profile fields

2. **PATCH /api/v1/tenants/me**
   - Update current user's tenant
   - Can update: name, industry, timezone, locale, i18n_settings, contact fields
   - Cannot update: status, license_tier (platform admin only)

3. **POST /api/v1/tenants/me/logo**
   - Upload logo for current user's tenant
   - Validates file type and size
   - Returns updated tenant with logo URL

4. **PATCH /api/v1/tenants/me/branding**
   - Update branding (colors, etc.) for current user's tenant
   - Merges with existing branding

### Helper Function
- `_upload_logo_for_tenant()`: Shared helper for logo upload logic
- Used by both tenant admin and platform admin endpoints

### Updated Models
- `TenantResponse`: Added contact_email, contact_name, contact_phone fields
- `TenantUpdate`: Added all profile and contact fields

## Frontend Changes

### New Page
- **TenantSettings.tsx** (`/admin/tenant-settings`)
  - Tabbed interface (Profile, Organization Details, Branding)
  - Form validation
  - Loading states
  - Success/error handling
  - Responsive design

### Updated Components
- **Layout.tsx**: Added "Tenant Settings" link in Administration menu
- **tenants.ts**: Added new API methods:
  - `getMyTenant()`
  - `updateMyTenant()`
  - `uploadMyLogo()`
  - `updateMyBranding()`

### Route Added
- `/admin/tenant-settings` - Accessible to tenant_admin and platform_admin

## Access Control

- **Tenant Admins**: Can update their own tenant's profile, details, and branding
- **Platform Admins**: Can update any tenant (existing functionality preserved)
- **Other Roles**: Access denied

## Usage

1. Navigate to Administration → Tenant Settings
2. Select tab:
   - **Profile**: Set industry, timezone, locale, I18N settings
   - **Organization Details**: Update name and contact information
   - **Branding**: Upload logo and customize colors
3. Click "Save" to apply changes

## Benefits

1. **Self-Service**: Tenant admins can manage their tenant without platform admin intervention
2. **Industry-Based Filtering**: Setting industry automatically filters assessments/requirements
3. **Branding Control**: Customize logo and colors for their organization
4. **I18N Support**: Configure locale and formatting preferences
5. **Centralized Management**: All tenant settings in one place

## Next Steps

1. Add validation for industry selection (show warning if changing)
2. Add preview of how branding affects UI
3. Add tenant onboarding wizard that uses this page
4. Add export/import of tenant settings
