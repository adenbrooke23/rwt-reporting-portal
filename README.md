# RWT Reporting Portal

An enterprise-level internal reporting application providing centralized access to SSRS and Power BI reports organized into reporting hubs. Built with Angular 19+ using Server-Side Rendering (SSR) and IBM Carbon Design System.

## Overview

The RWT Reporting Portal serves as a unified interface for accessing business intelligence reports across multiple domains including Sequoia, Corevest, Enterprise, and Aspire reporting suites. The application features user authentication, personalized dashboards, and a responsive design optimized for both desktop and mobile devices.

## Tech Stack

- **Framework**: Angular 19+ (Standalone Components)
- **Rendering**: Server-Side Rendering (SSR) with hydration and event replay
- **Design System**: IBM Carbon Design System
- **Styling**: SCSS with Carbon Design tokens
- **HTTP**: Angular HttpClient with Fetch API integration
- **Forms**: Reactive Forms
- **Authentication**: Prepared for .NET SSO integration

## Implementation Status

### Frontend (Angular) - Complete
- All UI components built and functional
- Using mock data services for development
- SSR configured and working
- Theme system with Carbon Design System
- Content Management (Hubs, Report Categories, Reports, Departments)
- User Management with department-based permissions
- Notification system with read tracking

### Backend Documentation - Ready for Implementation
The following documentation files contain complete specifications for backend development:

| File | Description |
|------|-------------|
| `DATABASE_TABLES.md` | T-SQL CREATE TABLE scripts (21 tables, portal schema) |
| `DATABASE_STORED_PROCEDURES.md` | All stored procedures (21 procedures) |
| `DATABASE_SEED_DATA.md` | Seed data scripts for initial setup |
| `API_DOCUMENTATION.md` | Full API specification with authentication flows |
| `BACKEND_IMPLEMENTATION.md` | Master implementation guide with phases |

**Target Environment:**
- **Server:** DEVSQLGEN01
- **Database:** REDWOOD_SOLUTIONS
- **Schema:** portal

### Backend Implementation - Not Started
- .NET API project not yet created
- Database not yet created
- Entra SSO integration pending

## Getting Started

### Prerequisites

- Node.js (LTS version recommended)
- npm or yarn
- Angular CLI 19+

### Installation

```bash
# Install dependencies
npm install

# Or with yarn
yarn install
```

### Development Server

Start the local development server:

```bash
ng serve
```

Navigate to `http://localhost:4200/` in your browser. The application will automatically reload when you modify source files.

To specify a custom port:

```bash
ng serve --port 4200
```

### Building

#### Development Build
```bash
ng build
```

#### Production Build
```bash
ng build --configuration production
```

Build artifacts are stored in the `dist/` directory.

**Note**: Prerendering is disabled for this application as it serves dynamic, user-specific reporting data that requires SSR on each request.

### SSR Build

To serve the SSR build locally:

```bash
npm run serve:ssr:rwt-reporting-portal
```

## Application Structure

### Route Structure

```
/ (root)              → redirects to /home
/home                 → Landing page with welcome message and updates
/dashboard            → Hub selection page
/hub/:hubId           → Hub detail page showing reports
/hub/:hubId/report/:reportId → Individual report viewer
/my-dashboard         → Personal dashboard
/settings             → User settings
/admin                → Admin dashboard
/admin/theme-settings → Theme configuration
/login                → Authentication page
/**                   → redirects to /home
```

### User Journey

1. **Login** → User authenticates at `/login`
2. **Landing Page** (`/home`) → Welcome page with portal overview and latest updates
3. **Hub Selection** (`/dashboard`) → User selects from available reporting hubs
4. **Hub Detail** (`/hub/:hubId`) → User views reports within selected hub
5. **Report Viewer** → User accesses individual SSRS or Power BI reports

### Reporting Hubs

The application provides access to four main reporting hubs:

- **Sequoia** - Access Sequoia reporting suite and analytics (24 reports)
- **Corevest** - Corevest financial reports and dashboards (18 reports)
- **Enterprise** - Enterprise-wide reports and analytics (32 reports)
- **Aspire** - Aspire platform reports and insights (15 reports)

## Project Architecture

### Directory Structure

```
src/app/
├── core/                    # Singleton services, guards, interceptors
├── shared/                  # Reusable components, directives, pipes
├── features/                # Feature modules organized by domain
│   ├── home/               # Landing page
│   ├── dashboard/          # Hub selection
│   ├── hub/                # Hub detail and report viewer
│   ├── auth/               # Authentication components and services
│   └── admin/              # Admin dashboard
├── app.component.*         # Root component
├── app.routes.ts           # Application routing configuration
├── app.config.ts           # Application configuration
└── app.config.server.ts    # SSR-specific configuration
```

### Key Features

- **Standalone Components**: Modern Angular architecture without NgModules
- **Lazy Loading**: Feature routes are lazy-loaded for optimal performance
- **SSR Ready**: Full Server-Side Rendering support with hydration
- **Reactive State Management**: RxJS-based state management for authentication
- **Carbon Design System**: Consistent styling with IBM Carbon tokens and components
- **Authentication Ready**: Prepared for .NET backend SSO integration
- **Responsive Design**: Mobile-first approach with multiple breakpoints

## Styling Conventions

The application uses IBM Carbon Design System with the following conventions:

### Carbon Spacing Tokens

All spacing uses Carbon tokens for consistency:

```scss
@use '@carbon/styles/scss/spacing';

padding: spacing.$spacing-05;
margin-bottom: spacing.$spacing-06;
gap: spacing.$spacing-04;
```

### CSS Custom Properties

Theme-aware colors are defined using CSS custom properties:

```scss
background: var(--color-bg-primary);
color: var(--color-text-primary);
border: 1px solid var(--color-border-light);
```

Available custom properties:
- `--color-primary`, `--color-primary-hover`
- `--color-bg-primary`, `--color-bg-secondary`, `--color-bg-tertiary`
- `--color-text-primary`, `--color-text-secondary`, `--color-text-tertiary`
- `--color-border-light`, `--color-border-medium`
- `--color-error`, `--color-warning`

### Typography Scale

Uses Carbon productive heading scale:
- Heading 04: 1.75rem (28px)
- Heading 03: 1.25rem (20px)
- Heading 02: 1rem (16px)
- Body: 0.875rem (14px)
- Label: 0.75rem (12px)

## Code Scaffolding

Generate new components:

```bash
ng generate component features/[feature-name]/components/[component-name] --skip-tests
```

Generate services:

```bash
ng generate service features/[feature-name]/services/[service-name]
```

Generate guards:

```bash
ng generate guard features/auth/guards/[guard-name]
```

For a complete list of available schematics:

```bash
ng generate --help
```

## Testing

### Running Unit Tests

Execute unit tests with Karma:

```bash
ng test
```

## Authentication Integration

The authentication system is prepared for .NET backend integration with the following capabilities:

- Username/password authentication
- Single Sign-On (SSO) support
- Token-based session management
- Token refresh mechanism
- Auth guards for route protection

### Integration Requirements

1. Update API endpoint in `auth.service.ts`
2. Configure CORS on .NET backend
3. Implement SSO callback handling
4. Add HTTP interceptor for token attachment

See `src/app/features/auth/` for implementation details.

## SSR Considerations

When developing new components:

- Avoid direct use of `window`, `document`, `localStorage` in component initialization
- Use `isPlatformBrowser()` checks for browser-only code
- Use `afterNextRender()` or `afterRender()` for DOM manipulation
- HTTP requests during SSR are automatically cached via TransferState

## Important Notes

- **Prerendering**: Disabled by design for dynamic reporting content
- **CSS Budget**: Enterprise styling may exceed default 4KB warning (non-critical)
- **Default Route**: Application defaults to `/home` landing page
- **Lazy Loading**: All feature routes are lazy-loaded for performance
- **Event Replay**: Enabled for optimal user experience during hydration

## Additional Resources

- [Angular Documentation](https://angular.dev/)
- [Angular CLI Reference](https://angular.dev/tools/cli)
- [Angular SSR Guide](https://angular.dev/guide/ssr)
- [Carbon Design System](https://carbondesignsystem.com/)

## License

Internal use only - RWT Holdings
